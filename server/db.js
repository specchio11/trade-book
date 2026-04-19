import pg from 'pg';
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
  `);

  // Seed default admin user if empty
  const { rows: userRows } = await pool.query('SELECT COUNT(*) FROM users');
  if (parseInt(userRows[0].count) === 0) {
    const { rows } = await pool.query("INSERT INTO users (name) VALUES ('Admin') RETURNING id");
    const userId = rows[0].id;
    // Seed default swap methods for admin
    await pool.query(`
      INSERT INTO swap_methods (user_id, name, sort_order) VALUES
      ($1, '5.3夜音律', 1),
      ($1, 'ACF', 2),
      ($1, '互寄', 3)
    `, [userId]);
  }
}

export default pool;
