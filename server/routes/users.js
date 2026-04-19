import { Router } from 'express';
import pool from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM users ORDER BY id');
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  const { rows } = await pool.query('INSERT INTO users (name) VALUES ($1) RETURNING *', [name.trim()]);
  const userId = rows[0].id;
  // Seed default swap methods for new user
  await pool.query(`
    INSERT INTO swap_methods (user_id, name, sort_order) VALUES
    ($1, '5.3夜音律', 1),
    ($1, 'ACF', 2),
    ($1, '互寄', 3)
  `, [userId]);
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  // Don't allow deleting last user
  const { rows: count } = await pool.query('SELECT COUNT(*) FROM users');
  if (parseInt(count[0].count) <= 1) return res.status(400).json({ error: 'Cannot delete last user' });
  await pool.query('DELETE FROM users WHERE id = $1', [parseInt(req.params.id)]);
  res.json({ ok: true });
});

export default router;
