import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// Get all swaps with items (no image data; lazy-load covers via /covers)
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
  const { rows: items } = await pool.query(
    `SELECT si.*, p.name AS product_name
     FROM swap_items si JOIN products p ON p.id = si.product_id
     WHERE si.swap_id = ANY($1::int[])`,
    [ids]
  );
  const { rows: counts } = await pool.query(
    `SELECT swap_id, COUNT(*)::int AS n FROM swap_images
     WHERE swap_id = ANY($1::int[]) GROUP BY swap_id`,
    [ids]
  );
  const itemMap = new Map(ids.map(id => [id, []]));
  for (const it of items) itemMap.get(it.swap_id)?.push(it);
  const countMap = new Map(counts.map(c => [c.swap_id, c.n]));
  for (const swap of swaps) {
    swap.items = itemMap.get(swap.id) || [];
    swap.image_count = countMap.get(swap.id) || 0;
  }
  res.json(swaps);
});

// Batch cover thumbnails (lazy load)
router.get('/covers', async (req, res) => {
  const { rows: covers } = await pool.query(
    `SELECT DISTINCT ON (si.swap_id) si.swap_id, si.id, si.data
     FROM swap_images si
     JOIN swaps s ON s.id = si.swap_id
     WHERE s.user_id = $1
     ORDER BY si.swap_id, si.sort_order, si.id`,
    [req.userId]
  );
  res.json(covers.map(c => ({ swap_id: c.swap_id, cover_image: { id: c.id, data: c.data } })));
});

// Get a single swap (with items, image_count, cover_image) for granular row refresh
router.get('/:id', async (req, res) => {
  const swapId = parseInt(req.params.id);
  if (Number.isNaN(swapId)) return res.status(400).json({ error: 'Invalid id' });
  const { rows } = await pool.query(`
    SELECT s.*, sm.name AS method_name, sm.sort_order AS method_sort
    FROM swaps s
    LEFT JOIN swap_methods sm ON sm.id = s.swap_method_id
    WHERE s.id = $1 AND s.user_id = $2
  `, [swapId, req.userId]);
  if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
  const swap = rows[0];
  const { rows: items } = await pool.query(
    `SELECT si.*, p.name AS product_name FROM swap_items si JOIN products p ON p.id = si.product_id WHERE si.swap_id = $1`,
    [swapId]
  );
  const { rows: countRows } = await pool.query('SELECT COUNT(*)::int AS n FROM swap_images WHERE swap_id = $1', [swapId]);
  const { rows: coverRows } = await pool.query(
    'SELECT id, data FROM swap_images WHERE swap_id = $1 ORDER BY sort_order, id LIMIT 1',
    [swapId]
  );
  swap.items = items;
  swap.image_count = countRows[0]?.n || 0;
  swap.cover_image = coverRows[0] ? { id: coverRows[0].id, data: coverRows[0].data } : null;
  res.json(swap);
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
    const { rows: maxRows } = await client.query(
      'SELECT COALESCE(MAX(sort_order), 0) AS m FROM swaps WHERE user_id = $1',
      [req.userId]
    );
    const nextSort = (maxRows[0]?.m || 0) + 1;
    const { rows } = await client.query(
      `INSERT INTO swaps (user_id, nickname, qq, swap_method_id, received_product, notes, address, is_packed, is_swapped, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [req.userId, nickname, qq, swap_method_id ? parseInt(swap_method_id) : null, received_product || '', notes || '', address || '', !!is_packed, !!is_swapped, nextSort]
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

// Set cover (move image to sort_order 0; shift others)
router.patch('/:id/images/:imageId/cover', async (req, res) => {
  const swapId = parseInt(req.params.id);
  const imageId = parseInt(req.params.imageId);
  const { rows } = await pool.query(
    'SELECT id FROM swap_images WHERE swap_id = $1 ORDER BY sort_order, id',
    [swapId]
  );
  const newOrder = [imageId, ...rows.map(r => r.id).filter(id => id !== imageId)];
  const sorts = newOrder.map((_, i) => i);
  await pool.query(
    `UPDATE swap_images SET sort_order = u.sort_order::int
     FROM (SELECT UNNEST($1::int[]) AS id, UNNEST($2::int[]) AS sort_order) u
     WHERE swap_images.id = u.id`,
    [newOrder, sorts]
  );
  res.json({ ok: true });
});

// Reorder swap images
router.put('/:id/images/reorder', async (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order) || order.length === 0) return res.json({ ok: true });
  const ids = order.map(i => parseInt(i));
  const sorts = order.map((_, i) => i);
  await pool.query(
    `UPDATE swap_images SET sort_order = u.sort_order::int
     FROM (SELECT UNNEST($1::int[]) AS id, UNNEST($2::int[]) AS sort_order) u
     WHERE swap_images.id = u.id`,
    [ids, sorts]
  );
  res.json({ ok: true });
});

export default router;
