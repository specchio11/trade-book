import { Router } from 'express';
import pool from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM swap_methods WHERE user_id = $1 ORDER BY sort_order', [req.userId]);
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { name } = req.body;
  const { rows: max } = await pool.query('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM swap_methods WHERE user_id = $1', [req.userId]);
  const { rows } = await pool.query(
    'INSERT INTO swap_methods (user_id, name, sort_order) VALUES ($1, $2, $3) RETURNING *',
    [req.userId, name, max[0].next]
  );
  res.json(rows[0]);
});

router.put('/reorder', async (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order) || order.length === 0) return res.json({ ok: true });
  const ids = order.map(o => parseInt(o.id));
  const sorts = order.map(o => parseInt(o.sort_order));
  await pool.query(
    `UPDATE swap_methods SET sort_order = u.sort_order::int
     FROM (SELECT UNNEST($1::int[]) AS id, UNNEST($2::int[]) AS sort_order) u
     WHERE swap_methods.id = u.id AND swap_methods.user_id = $3`,
    [ids, sorts, req.userId]
  );
  res.json({ ok: true });
});

router.patch('/:id', async (req, res) => {
  const { name, color } = req.body;
  const sets = [];
  const vals = [];
  if (name !== undefined) { sets.push(`name = $${sets.length + 1}`); vals.push(name); }
  if (color !== undefined) { sets.push(`color = $${sets.length + 1}`); vals.push(color || null); }
  if (sets.length === 0) {
    const { rows } = await pool.query('SELECT * FROM swap_methods WHERE id = $1 AND user_id = $2', [parseInt(req.params.id), req.userId]);
    return res.json(rows[0]);
  }
  vals.push(parseInt(req.params.id), req.userId);
  const { rows } = await pool.query(
    `UPDATE swap_methods SET ${sets.join(', ')} WHERE id = $${sets.length + 1} AND user_id = $${sets.length + 2} RETURNING *`,
    vals
  );
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM swap_methods WHERE id = $1 AND user_id = $2', [parseInt(req.params.id), req.userId]);
  res.json({ ok: true });
});

export default router;
