import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      total INTEGER NOT NULL DEFAULT 0,
      notes TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS product_images (
      id SERIAL PRIMARY KEY,
      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
      data TEXT NOT NULL,
      is_cover BOOLEAN DEFAULT FALSE,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS swap_methods (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS swaps (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      nickname TEXT NOT NULL,
      qq TEXT NOT NULL,
      swap_method_id INTEGER REFERENCES swap_methods(id) ON DELETE SET NULL,
      is_packed BOOLEAN DEFAULT FALSE,
      is_swapped BOOLEAN DEFAULT FALSE,
      received_product TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS swap_images (
      id SERIAL PRIMARY KEY,
      swap_id INTEGER REFERENCES swaps(id) ON DELETE CASCADE,
      data TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS swap_items (
      id SERIAL PRIMARY KEY,
      swap_id INTEGER REFERENCES swaps(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL DEFAULT 0,
      UNIQUE(swap_id, product_id)
    );

    ALTER TABLE swaps ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
    ALTER TABLE swaps ADD COLUMN IF NOT EXISTS address TEXT DEFAULT '';

    ALTER TABLE swap_methods ADD COLUMN IF NOT EXISTS color TEXT;

    CREATE TABLE IF NOT EXISTS product_types (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS characters (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    );

    ALTER TABLE products ADD COLUMN IF NOT EXISTS type_id INTEGER REFERENCES product_types(id) ON DELETE SET NULL;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS character_id INTEGER REFERENCES characters(id) ON DELETE SET NULL;

    ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

    -- Performance indexes
    CREATE INDEX IF NOT EXISTS idx_products_user ON products(user_id);
    CREATE INDEX IF NOT EXISTS idx_swaps_user ON swaps(user_id);
    CREATE INDEX IF NOT EXISTS idx_swap_items_swap ON swap_items(swap_id);
    CREATE INDEX IF NOT EXISTS idx_swap_items_product ON swap_items(product_id);
    CREATE INDEX IF NOT EXISTS idx_swap_images_swap ON swap_images(swap_id);
    CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);
    CREATE INDEX IF NOT EXISTS idx_swap_methods_user ON swap_methods(user_id);
    CREATE INDEX IF NOT EXISTS idx_product_types_user ON product_types(user_id);
    CREATE INDEX IF NOT EXISTS idx_characters_user ON characters(user_id);
  `);

  // Seed default admin user if empty
  const { rows: userRows } = await pool.query('SELECT COUNT(*) FROM users');
  if (parseInt(userRows[0].count) === 0) {
    const hash = await bcrypt.hash('admin123', 10);
    const { rows } = await pool.query("INSERT INTO users (name, password_hash, role) VALUES ('Admin', $1, 'admin') RETURNING id", [hash]);
    const userId = rows[0].id;
    // Seed default swap methods for admin
    await pool.query(`
      INSERT INTO swap_methods (user_id, name, sort_order) VALUES
      ($1, '5.3夜音律', 1),
      ($1, 'ACF', 2),
      ($1, '互寄', 3)
    `, [userId]);
  }

  // Ensure existing admin users have password and role set
  const { rows: admins } = await pool.query("SELECT id FROM users WHERE role IS NULL OR role = '' OR password_hash IS NULL");
  if (admins.length > 0) {
    const hash = await bcrypt.hash('admin123', 10);
    await pool.query("UPDATE users SET role = 'admin', password_hash = $1 WHERE id = $2", [hash, admins[0].id]);
    for (let i = 1; i < admins.length; i++) {
      await pool.query("UPDATE users SET role = COALESCE(NULLIF(role, ''), 'user'), password_hash = COALESCE(password_hash, $1) WHERE id = $2", [hash, admins[i].id]);
    }
  }
}

export default pool;
