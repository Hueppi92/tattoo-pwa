// server/seed-from-datajson.js
// Seed die SQLite-DB aus server/data.json (Clients, Artists, Studios).
// Ausführen: node seed-from-datajson.js

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataFile = path.join(__dirname, 'data.json');
const dbPath = path.join(__dirname, 'db.sqlite');

if (!fs.existsSync(dataFile)) {
  console.error('❌ server/data.json nicht gefunden:', dataFile);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
const studios = data.studios || [];
const artists = data.artists || [];
const clients = data.clients || [];

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const db = new Database(dbPath);

db.exec(`
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS studios (
  id TEXT PRIMARY KEY,
  name TEXT,
  mgr_user TEXT,
  mgr_pass TEXT,
  theme_primary TEXT,
  theme_secondary TEXT,
  theme_accent TEXT,
  font_body TEXT,
  font_head TEXT,
  bg TEXT
);
CREATE TABLE IF NOT EXISTS artists (
  id TEXT PRIMARY KEY,
  name TEXT,
  password TEXT,
  studio_id TEXT,
  FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT,
  password TEXT,
  studio_id TEXT,
  artist_id TEXT,
  FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE SET NULL,
  FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE SET NULL
);
`);

const insStudio = db.prepare(`
  INSERT OR REPLACE INTO studios (id, name, mgr_user, mgr_pass, theme_primary, theme_secondary, theme_accent, font_body, font_head, bg)
  VALUES (@id, @name, @mgr_user, @mgr_pass, @theme_primary, @theme_secondary, @theme_accent, @font_body, @font_head, @bg)`);

const insArtist = db.prepare(`
  INSERT OR REPLACE INTO artists (id, name, password, studio_id)
  VALUES (@id, @name, @password, @studio_id)`);

const insClient = db.prepare(`
  INSERT OR REPLACE INTO clients (id, name, password, studio_id, artist_id)
  VALUES (@id, @name, @password, @studio_id, @artist_id)`);

const tx = db.transaction(() => {
  for (const s of studios) {
    insStudio.run({
      id: s.id,
      name: s.name || s.id,
      mgr_user: s.manager?.user || null,
      mgr_pass: s.manager?.password || null,
      theme_primary: s.theme?.primaryColor || null,
      theme_secondary: s.theme?.secondaryColor || null,
      theme_accent: s.theme?.accentColor || null,
      font_body: s.theme?.fontBody || null,
      font_head: s.theme?.fontHead || null,
      bg: s.theme?.bg || null,
    });
  }
  for (const a of artists) {
    insArtist.run({
      id: a.id,
      name: a.name || a.id,
      password: sha256(a.password || ''),
      studio_id: a.studioId || null,
    });
  }
  for (const c of clients) {
    insClient.run({
      id: c.id,
      name: c.name || c.id,
      password: sha256(c.password || ''),
      studio_id: c.studioId || null,
      artist_id: c.artistId || null,
    });
  }
});
tx();

console.log('✅ Seed abgeschlossen.'); 
