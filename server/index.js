import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { initDB } from './db.js';
import { requireAuth, requireAdmin } from './middleware/auth.js';
import authRouter from './routes/auth.js';
import productsRouter from './routes/products.js';
import swapsRouter from './routes/swaps.js';
import methodsRouter from './routes/methods.js';
import usersRouter from './routes/users.js';
import { createOptionsRouter } from './routes/options.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Public auth routes (no token needed)
app.use('/api/auth', authRouter);

// All other API routes require authentication
app.use('/api/products', requireAuth, productsRouter);
app.use('/api/swaps', requireAuth, swapsRouter);
app.use('/api/methods', requireAuth, methodsRouter);
app.use('/api/product-types', requireAuth, createOptionsRouter('product_types'));
app.use('/api/characters', requireAuth, createOptionsRouter('characters'));
app.use('/api/users', requireAuth, requireAdmin, usersRouter);

// Serve React build
app.use(express.static(path.join(__dirname, '..', 'dist')));
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

initDB()
  .then(() => {
    const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    server.on('error', (err) => {
      console.error('Server error:', err);
      process.exit(1);
    });
  })
  .catch((err) => {
    console.error('Failed to init DB:', err);
    process.exit(1);
  });
