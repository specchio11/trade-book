import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { initDB } from './db.js';
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

// Extract user_id from header for data isolation
app.use('/api/products', (req, res, next) => { req.userId = parseInt(req.headers['x-user-id']) || 1; next(); }, productsRouter);
app.use('/api/swaps', (req, res, next) => { req.userId = parseInt(req.headers['x-user-id']) || 1; next(); }, swapsRouter);
app.use('/api/methods', (req, res, next) => { req.userId = parseInt(req.headers['x-user-id']) || 1; next(); }, methodsRouter);
app.use('/api/product-types', (req, res, next) => { req.userId = parseInt(req.headers['x-user-id']) || 1; next(); }, createOptionsRouter('product_types'));
app.use('/api/characters', (req, res, next) => { req.userId = parseInt(req.headers['x-user-id']) || 1; next(); }, createOptionsRouter('characters'));
app.use('/api/users', usersRouter);

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
