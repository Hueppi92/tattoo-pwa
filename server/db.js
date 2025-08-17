// server/db.js
import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'db.sqlite');
const db = new Database(DB_PATH);

export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

// Schema
db.exec(`
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS studios (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  theme_primary TEXT,
  theme_secondary TEXT,
  theme_accent TEXT,
  font_head TEXT,
  font_body TEXT,
  bg TEXT,
  mgr_user TEXT,
  mgr_pass TEXT
);

CREATE TABLE IF NOT EXISTS artists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  password TEXT NOT NULL,
  studio_id TEXT REFERENCES studios(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  password TEXT NOT NULL,
  studio_id TEXT REFERENCES studios(id) ON DELETE SET NULL,
  artist_id TEXT REFERENCES artists(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  client_id TEXT REFERENCES clients(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  type TEXT,
  description TEXT
);

CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  client_id TEXT REFERENCES clients(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('idea','template','final','healing','wannado')),
  filename TEXT,
  path TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
`);

const api = {
  // Studios
  getStudios: () => db.prepare(`SELECT id, name FROM studios ORDER BY name`).all(),
  getStudioTheme: (id) =>
    db.prepare(`SELECT theme_primary AS primary
