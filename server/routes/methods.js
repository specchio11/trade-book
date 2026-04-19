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
  const { order } = req.body; // [{id, sort_order}]
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const item of order) {
      await client.query('UPDATE swap_methods SET sort_order = $1 WHERE id = $2 AND user_id = $3', [item.sort_order, item.id, req.userId]);
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

router.patch('/:id', async (req, res) => {
  const { name } = req.body;
  const { rows } = await pool.query(
    'UPDATE swap_methods SET name = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
    [name, parseInt(req.params.id), req.userId]
  );
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM swap_methods WHERE id = $1 AND user_id = $2', [parseInt(req.params.id), req.userId]);
  res.json({ ok: true });
});

export default router;
