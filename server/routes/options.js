import { Router } from 'express';
import pool from '../db.js';

// Generic CRUD for option-style tables (product_types, characters)
export function createOptionsRouter(tableName) {
  const router = Router();

  router.get('/', async (req, res) => {
    const { rows } = await pool.query(
      `SELECT * FROM ${tableName} WHERE user_id = $1 ORDER BY sort_order, id`,
      [req.userId]
    );
    res.json(rows);
  });

  router.post('/', async (req, res) => {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name required' });
    const { rows: maxRows } = await pool.query(
      `SELECT COALESCE(MAX(sort_order), 0) AS m FROM ${tableName} WHERE user_id = $1`,
      [req.userId]
    );
    const next = parseInt(maxRows[0].m) + 1;
    const { rows } = await pool.query(
      `INSERT INTO ${tableName} (user_id, name, sort_order) VALUES ($1, $2, $3) RETURNING *`,
      [req.userId, name.trim(), next]
    );
    res.json(rows[0]);
  });

  router.patch('/:id', async (req, res) => {
    const { name } = req.body;
    const { rows } = await pool.query(
      `UPDATE ${tableName} SET name = $1 WHERE id = $2 AND user_id = $3 RETURNING *`,
      [name, parseInt(req.params.id), req.userId]
    );
    res.json(rows[0]);
  });

  router.delete('/:id', async (req, res) => {
    await pool.query(
      `DELETE FROM ${tableName} WHERE id = $1 AND user_id = $2`,
      [parseInt(req.params.id), req.userId]
    );
    res.json({ ok: true });
  });

  router.put('/reorder', async (req, res) => {
    const { order } = req.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const item of order) {
        await client.query(
          `UPDATE ${tableName} SET sort_order = $1 WHERE id = $2 AND user_id = $3`,
          [parseInt(item.sort_order), parseInt(item.id), req.userId]
        );
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

  return router;
}
