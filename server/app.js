// server/app.js
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import managerRoutes from "/features/manager.js";
app.use("/api", managerRoutes);


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CLIENT_DIR = path.join(ROOT, 'client');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true }));

// Static: uploads + client
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(CLIENT_DIR));

// DB init
const dbPath = path.join(__dirname, 'tattoo.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS artists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  password TEXT,
  createdAt TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  password TEXT,
  artistId TEXT,
  createdAt TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(artistId) REFERENCES artists(id)
);
CREATE TABLE IF NOT EXISTS ideas (
  id TEXT PRIMARY KEY,
  customerId TEXT NOT NULL,
  artistId TEXT NOT NULL,
  text TEXT,
  imageUrl TEXT,
  createdAt TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(customerId) REFERENCES customers(id),
  FOREIGN KEY(artistId) REFERENCES artists(id)
);
CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  customerId TEXT NOT NULL,
  artistId TEXT NOT NULL,
  note TEXT,
  imageUrl TEXT,
  createdAt TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(customerId) REFERENCES customers(id),
  FOREIGN KEY(artistId) REFERENCES artists(id)
);
CREATE TABLE IF NOT EXISTS wannados (
  id TEXT PRIMARY KEY,
  artistId TEXT NOT NULL,
  title TEXT,
  imageUrl TEXT,
  createdAt TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(artistId) REFERENCES artists(id)
);
CREATE TABLE IF NOT EXISTS managers (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  password TEXT,
  name TEXT,
  createdAt TEXT DEFAULT (datetime('now'))
);
`);

// ---- DEMO-SEED (nach DB-Init!) -----------------------------------
import seedDemo from './seed-demo.js';
await seedDemo(db);

// ---- Features dynamisch laden ------------------------------------
const featuresDir = path.join(__dirname, 'features');
if (fs.existsSync(featuresDir)) {
  const files = fs.readdirSync(featuresDir).filter(f => f.endsWith('.js'));
  for (const f of files) {
    const mod = await import(path.join(featuresDir, f));
    if (typeof mod.default === 'function') {
      mod.default({ app, db, __dirname });
      console.log('Feature loaded:', f);
    }
  }
}

// Health
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// SPA Fallback (alles außer /api/* auf index.html)
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(CLIENT_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log('Tattoo app running on http://localhost:' + PORT);
});
