// server/app.js
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CLIENT_DIR = path.join(ROOT, 'client');
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'db.sqlite');
const PORT = process.env.PORT || 3000;

const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true }));

// static uploads + client
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(CLIENT_DIR));

// DB init
const db = new Database(DB_PATH);

// Load MVP schema from server.js (by importing and letting it create tables)
// Instead of executing server.js directly, we replicate its table creation here if present:
function ensureTables() {
  try {
    db.prepare(`CREATE TABLE IF NOT EXISTS artists (id TEXT PRIMARY KEY, name TEXT, email TEXT, password TEXT, createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
    db.prepare(`CREATE TABLE IF NOT EXISTS customers (id TEXT PRIMARY KEY, name TEXT, email TEXT, password TEXT, artistId TEXT, createdAt TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(artistId) REFERENCES artists(id))`).run();
    db.prepare(`CREATE TABLE IF NOT EXISTS ideas (id TEXT PRIMARY KEY, customerId TEXT, artistId TEXT, title TEXT, imageUrl TEXT, createdAt TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(customerId) REFERENCES customers(id), FOREIGN KEY(artistId) REFERENCES artists(id))`).run();
    db.prepare(`CREATE TABLE IF NOT EXISTS templates (id TEXT PRIMARY KEY, customerId TEXT, artistId TEXT, title TEXT, imageUrl TEXT, upvotes INTEGER DEFAULT 0, downvotes INTEGER DEFAULT 0, createdAt TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(customerId) REFERENCES customers(id), FOREIGN KEY(artistId) REFERENCES artists(id))`).run();
    db.prepare(`CREATE TABLE IF NOT EXISTS wannados (id TEXT PRIMARY KEY, artistId TEXT, title TEXT, imageUrl TEXT, createdAt TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(artistId) REFERENCES artists(id))`).run();
  } catch (e) {
    console.error('DB init error:', e);
  }
}
ensureTables();

// Dynamically load MVP feature modules from ./features
const featuresDir = path.join(__dirname, 'features');
if (fs.existsSync(featuresDir)) {
  for (const f of fs.readdirSync(featuresDir)) {
    if (!f.endsWith('.js')) continue;
    const mod = await import(path.join(featuresDir, f));
    if (typeof mod.default === 'function') {
      mod.default({ app, db, __dirname });
      console.log('Feature loaded:', f);
    }
  }
}

// health
app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// SPA fallback
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(CLIENT_DIR, 'index.html'));
});

app.listen(PORT, () => console.log(`Tattoo app running: http://localhost:${PORT}`));
