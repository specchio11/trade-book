import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// Get all products with exchanged counts (no images)
router.get('/', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT p.*,
      pt.name AS type_name,
      pt.sort_order AS type_sort,
      c.name AS character_name,
      c.sort_order AS character_sort,
      COALESCE(SUM(si.quantity), 0)::int AS exchanged,
      (p.total - COALESCE(SUM(si.quantity), 0))::int AS remaining
    FROM products p
    LEFT JOIN swap_items si ON si.product_id = p.id
    LEFT JOIN product_types pt ON pt.id = p.type_id
    LEFT JOIN characters c ON c.id = p.character_id
    WHERE p.user_id = $1
    GROUP BY p.id, pt.name, pt.sort_order, c.name, c.sort_order
    ORDER BY p.sort_order, p.id
  `, [req.userId]);
  res.json(rows);
});

// Batch cover thumbnails (separate endpoint for lazy load)
router.get('/covers', async (req, res) => {
  const { rows: covers } = await pool.query(
    `SELECT DISTINCT ON (pi.product_id) pi.product_id, pi.id, pi.data, pi.is_cover
     FROM product_images pi
     JOIN products p ON p.id = pi.product_id
     WHERE p.user_id = $1
     ORDER BY pi.product_id, pi.is_cover DESC, pi.sort_order`,
    [req.userId]
  );
  res.json(covers.map(c => ({ product_id: c.product_id, cover_image: { id: c.id, data: c.data, is_cover: c.is_cover } })));
});

// Get a single product (with cover_image) for granular row refresh
router.get('/:id', async (req, res) => {
  const productId = parseInt(req.params.id);
  if (Number.isNaN(productId)) return res.status(400).json({ error: 'Invalid id' });
  const { rows } = await pool.query(`
    SELECT p.*,
      pt.name AS type_name,
      pt.sort_order AS type_sort,
      c.name AS character_name,
      c.sort_order AS character_sort,
      COALESCE(SUM(si.quantity), 0)::int AS exchanged,
      (p.total - COALESCE(SUM(si.quantity), 0))::int AS remaining
    FROM products p
    LEFT JOIN swap_items si ON si.product_id = p.id
    LEFT JOIN product_types pt ON pt.id = p.type_id
    LEFT JOIN characters c ON c.id = p.character_id
    WHERE p.id = $1 AND p.user_id = $2
    GROUP BY p.id, pt.name, pt.sort_order, c.name, c.sort_order
  `, [productId, req.userId]);
  if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
  const product = rows[0];
  const { rows: coverRows } = await pool.query(
    'SELECT id, data, is_cover FROM product_images WHERE product_id = $1 ORDER BY is_cover DESC, sort_order LIMIT 1',
    [productId]
  );
  product.cover_image = coverRows[0] ? { id: coverRows[0].id, data: coverRows[0].data, is_cover: coverRows[0].is_cover } : null;
  res.json(product);
});

// Create product
router.post('/', async (req, res) => {
  const { name, total, notes, type_id, character_id } = req.body;
  const { rows } = await pool.query(
    'INSERT INTO products (user_id, name, total, notes, type_id, character_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
    [req.userId, name, parseInt(total) || 0, notes || '', type_id ? parseInt(type_id) : null, character_id ? parseInt(character_id) : null]
  );
  res.json(rows[0]);
});

// Update product field
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const allowed = ['name', 'total', 'notes', 'type_id', 'character_id'];
  const sets = [];
  const vals = [];
  let i = 1;
  for (const [key, val] of Object.entries(updates)) {
    if (allowed.includes(key)) {
      sets.push(`${key} = $${i}`);
      if (key === 'total') vals.push(parseInt(val));
      else if (key === 'type_id' || key === 'character_id') vals.push(val ? parseInt(val) : null);
      else vals.push(val);
      i++;
    }
  }
  if (sets.length === 0) return res.status(400).json({ error: 'No valid fields' });
  vals.push(parseInt(id), req.userId);
  const { rows } = await pool.query(
    `UPDATE products SET ${sets.join(', ')} WHERE id = $${i} AND user_id = $${i + 1} RETURNING *`,
    vals
  );
  res.json(rows[0]);
});

// Delete product
router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM products WHERE id = $1 AND user_id = $2', [parseInt(req.params.id), req.userId]);
  res.json({ ok: true });
});

// Reorder products
router.put('/reorder', async (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order) || order.length === 0) return res.json({ ok: true });
  const ids = order.map(o => parseInt(o.id));
  const sorts = order.map(o => parseInt(o.sort_order));
  await pool.query(
    `UPDATE products SET sort_order = u.sort_order::int
     FROM (SELECT UNNEST($1::int[]) AS id, UNNEST($2::int[]) AS sort_order) u
     WHERE products.id = u.id AND products.user_id = $3`,
    [ids, sorts, req.userId]
  );
  res.json({ ok: true });
});

// Get product images
router.get('/:id/images', async (req, res) => {
  const { rows: own } = await pool.query('SELECT id FROM products WHERE id = $1 AND user_id = $2', [parseInt(req.params.id), req.userId]);
  if (own.length === 0) return res.status(404).json({ error: 'Not found' });
  const { rows } = await pool.query(
    'SELECT * FROM product_images WHERE product_id = $1 ORDER BY is_cover DESC, sort_order',
    [parseInt(req.params.id)]
  );
  res.json(rows);
});

// Upload product image (base64)
router.post('/:id/images', async (req, res) => {
  const { data } = req.body;
  const productId = parseInt(req.params.id);
  // Check if first image → make cover
  const { rows: existing } = await pool.query(
    'SELECT COUNT(*) FROM product_images WHERE product_id = $1', [productId]
  );
  const isCover = parseInt(existing[0].count) === 0;
  const { rows } = await pool.query(
    'INSERT INTO product_images (product_id, data, is_cover, sort_order) VALUES ($1, $2, $3, $4) RETURNING *',
    [productId, data, isCover, parseInt(existing[0].count)]
  );
  res.json(rows[0]);
});

// Set cover image
router.patch('/:id/images/:imageId/cover', async (req, res) => {
  const productId = parseInt(req.params.id);
  const imageId = parseInt(req.params.imageId);
  await pool.query('UPDATE product_images SET is_cover = FALSE WHERE product_id = $1', [productId]);
  await pool.query('UPDATE product_images SET is_cover = TRUE WHERE id = $1', [imageId]);
  res.json({ ok: true });
});

// Reorder product images
router.put('/:id/images/reorder', async (req, res) => {
  const { order } = req.body; // [imageId,...] in display order
  if (!Array.isArray(order) || order.length === 0) return res.json({ ok: true });
  const ids = order.map(i => parseInt(i));
  const sorts = order.map((_, i) => i);
  await pool.query(
    `UPDATE product_images SET sort_order = u.sort_order::int
     FROM (SELECT UNNEST($1::int[]) AS id, UNNEST($2::int[]) AS sort_order) u
     WHERE product_images.id = u.id`,
    [ids, sorts]
  );
  res.json({ ok: true });
});

// Delete product image
router.delete('/:id/images/:imageId', async (req, res) => {
  const imageId = parseInt(req.params.imageId);
  const productId = parseInt(req.params.id);
  await pool.query('DELETE FROM product_images WHERE id = $1', [imageId]);
  // If deleted was cover, make next one cover
  const { rows } = await pool.query(
    'SELECT id FROM product_images WHERE product_id = $1 ORDER BY sort_order LIMIT 1',
    [productId]
  );
  if (rows.length > 0) {
    await pool.query('UPDATE product_images SET is_cover = TRUE WHERE id = $1', [rows[0].id]);
  }
  res.json({ ok: true });
});

export default router;
