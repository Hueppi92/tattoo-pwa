import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import './seed-demo.js';


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const dbPath = path.join(__dirname, 'tattoo.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS artists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  password TEXT
);
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  password TEXT,
  artistId TEXT,
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
`);

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

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log('MVP server listening on http://localhost:' + PORT);
});
