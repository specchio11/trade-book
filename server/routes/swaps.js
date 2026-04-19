import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// Get all swaps with items (batched, no full image data)
router.get('/', async (req, res) => {
  const { rows: swaps } = await pool.query(`
    SELECT s.*, sm.name AS method_name, sm.sort_order AS method_sort
    FROM swaps s
    LEFT JOIN swap_methods sm ON sm.id = s.swap_method_id
    WHERE s.user_id = $1
    ORDER BY s.sort_order, s.id
  `, [req.userId]);
  if (swaps.length === 0) return res.json(swaps);
  const ids = swaps.map(s => s.id);
  // All items in one query
  const { rows: items } = await pool.query(
    `SELECT si.*, p.name AS product_name
     FROM swap_items si JOIN products p ON p.id = si.product_id
     WHERE si.swap_id = ANY($1::int[])`,
    [ids]
  );
  // Cover image (first by sort_order) + count per swap, in one query each
  const { rows: covers } = await pool.query(
    `SELECT DISTINCT ON (swap_id) swap_id, id, data
     FROM swap_images WHERE swap_id = ANY($1::int[])
     ORDER BY swap_id, sort_order, id`,
    [ids]
  );
  const { rows: counts } = await pool.query(
    `SELECT swap_id, COUNT(*)::int AS n FROM swap_images
     WHERE swap_id = ANY($1::int[]) GROUP BY swap_id`,
    [ids]
  );
  const itemMap = new Map(ids.map(id => [id, []]));
  for (const it of items) itemMap.get(it.swap_id)?.push(it);
  const coverMap = new Map(covers.map(c => [c.swap_id, { id: c.id, data: c.data }]));
  const countMap = new Map(counts.map(c => [c.swap_id, c.n]));
  for (const swap of swaps) {
    swap.items = itemMap.get(swap.id) || [];
    swap.cover_image = coverMap.get(swap.id) || null;
    swap.image_count = countMap.get(swap.id) || 0;
  }
  res.json(swaps);
});

// Get all images for a single swap (lazy-loaded on modal open)
router.get('/:id/images', async (req, res) => {
  const swapId = parseInt(req.params.id);
  const { rows: own } = await pool.query('SELECT id FROM swaps WHERE id = $1 AND user_id = $2', [swapId, req.userId]);
  if (own.length === 0) return res.status(404).json({ error: 'Not found' });
  const { rows } = await pool.query(
    'SELECT id, data FROM swap_images WHERE swap_id = $1 ORDER BY sort_order, id',
    [swapId]
  );
  res.json(rows);
});

// Create swap
router.post('/', async (req, res) => {
  const { nickname, qq, swap_method_id, received_product, notes, items, images, address, is_packed, is_swapped } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO swaps (user_id, nickname, qq, swap_method_id, received_product, notes, address, is_packed, is_swapped)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [req.userId, nickname, qq, swap_method_id ? parseInt(swap_method_id) : null, received_product || '', notes || '', address || '', !!is_packed, !!is_swapped]
    );
    const swap = rows[0];
    if (items && items.length > 0) {
      for (const item of items) {
        if (item.quantity > 0) {
          await client.query(
            'INSERT INTO swap_items (swap_id, product_id, quantity) VALUES ($1, $2, $3)',
            [swap.id, parseInt(item.product_id), parseInt(item.quantity)]
          );
        }
      }
    }
    if (images && images.length > 0) {
      for (let i = 0; i < images.length; i++) {
        await client.query(
          'INSERT INTO swap_images (swap_id, data, sort_order) VALUES ($1, $2, $3)',
          [swap.id, images[i], i]
        );
      }
    }
    await client.query('COMMIT');
    res.json(swap);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

// Update swap field
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const allowed = ['nickname', 'qq', 'swap_method_id', 'is_packed', 'is_swapped', 'received_product', 'notes', 'address'];
  const sets = [];
  const vals = [];
  let i = 1;
  for (const [key, val] of Object.entries(updates)) {
    if (allowed.includes(key)) {
      sets.push(`${key} = $${i}`);
      if (key === 'swap_method_id') vals.push(val ? parseInt(val) : null);
      else if (key === 'is_packed' || key === 'is_swapped') vals.push(Boolean(val));
      else vals.push(val);
      i++;
    }
  }
  if (sets.length === 0) return res.status(400).json({ error: 'No valid fields' });
  vals.push(parseInt(id), req.userId);
  const { rows } = await pool.query(
    `UPDATE swaps SET ${sets.join(', ')} WHERE id = $${i} AND user_id = $${i + 1} RETURNING *`,
    vals
  );
  res.json(rows[0]);
});

// Update swap items (product quantities)
router.put('/:id/items', async (req, res) => {
  const swapId = parseInt(req.params.id);
  const { items } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: own } = await client.query('SELECT id FROM swaps WHERE id = $1 AND user_id = $2', [swapId, req.userId]);
    if (own.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }
    await client.query('DELETE FROM swap_items WHERE swap_id = $1', [swapId]);
    for (const item of items) {
      if (parseInt(item.quantity) > 0) {
        await client.query(
          'INSERT INTO swap_items (swap_id, product_id, quantity) VALUES ($1, $2, $3)',
          [swapId, parseInt(item.product_id), parseInt(item.quantity)]
        );
      }
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

// Delete swap
router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM swaps WHERE id = $1 AND user_id = $2', [parseInt(req.params.id), req.userId]);
  res.json({ ok: true });
});

// Reorder swaps
router.put('/reorder', async (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order) || order.length === 0) return res.json({ ok: true });
  const ids = order.map(o => parseInt(o.id));
  const sorts = order.map(o => parseInt(o.sort_order));
  await pool.query(
    `UPDATE swaps SET sort_order = u.sort_order::int
     FROM (SELECT UNNEST($1::int[]) AS id, UNNEST($2::int[]) AS sort_order) u
     WHERE swaps.id = u.id AND swaps.user_id = $3`,
    [ids, sorts, req.userId]
  );
  res.json({ ok: true });
});

// Swap images
router.post('/:id/images', async (req, res) => {
  const { data } = req.body;
  const swapId = parseInt(req.params.id);
  const { rows: existing } = await pool.query('SELECT COUNT(*) FROM swap_images WHERE swap_id = $1', [swapId]);
  const { rows } = await pool.query(
    'INSERT INTO swap_images (swap_id, data, sort_order) VALUES ($1, $2, $3) RETURNING *',
    [swapId, data, parseInt(existing[0].count)]
  );
  res.json(rows[0]);
});

router.delete('/:id/images/:imageId', async (req, res) => {
  await pool.query('DELETE FROM swap_images WHERE id = $1', [parseInt(req.params.imageId)]);
  res.json({ ok: true });
});

export default router;
