// server/db.js
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
//const DB_PATH = path.join(__dirname, 'db.sqlite');
const db = new Database(DB_PATH);
// oben in db.js:
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'db.sqlite');
// (nicht fest /var/data)

export const sha256 = (s) => createHash('sha256').update(s).digest('hex');

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
  artist_id TEXT REFERENCES artists(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK(kind IN ('idea','template','final','healing','wannado')),
  filename TEXT,
  path TEXT NOT NULL,
  comment TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
`);

// Hilfsfunktion: prüfen ob Spalte existiert (für sanfte Migration)
function hasColumn(table, col) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === col);
}
try { if (!hasColumn('images','artist_id')) db.exec(`ALTER TABLE images ADD COLUMN artist_id TEXT`); } catch {}
try { if (!hasColumn('images','comment'))   db.exec(`ALTER TABLE images ADD COLUMN comment TEXT`); } catch {}

const api = {
  // Studios / Manager
  getStudios: () => db.prepare(`SELECT id, name FROM studios ORDER BY name`).all(),
  getStudioTheme: (id) => db.prepare(`
    SELECT theme_primary AS primaryColor,
           theme_secondary AS secondaryColor,
           theme_accent AS accentColor,
           font_body AS fontBody,
           bg
    FROM studios WHERE id=?`).get(id),
  checkManager: (studioId, user, pass) =>
    db.prepare(`SELECT 1 FROM studios WHERE id=? AND mgr_user=? AND mgr_pass=?`).get(studioId, user, pass),

  // Artists
  getArtistById: (id) => db.prepare(`SELECT * FROM artists WHERE id=?`).get(id),
  createArtist: ({ id, name, password, studioId }) =>
    db.prepare(`INSERT INTO artists(id,name,password,studio_id) VALUES (?,?,?,?)`)
      .run(id, name || id, sha256(password), studioId || null),
  listArtists: (studioId) =>
    (studioId
      ? db.prepare(`SELECT id,name FROM artists WHERE studio_id=? ORDER BY name`).all(studioId)
      : db.prepare(`SELECT id,name FROM artists ORDER BY name`).all()),

  // Clients
  getClientById: (id) => db.prepare(`SELECT * FROM clients WHERE id=?`).get(id),
  createClient: ({ id, name, password, studioId, artistId }) =>
    db.prepare(`INSERT INTO clients(id,name,password,studio_id,artist_id) VALUES (?,?,?,?,?)`)
      .run(id, name || id, sha256(password), studioId || null, artistId || null),
  listArtistClients: (artistId) =>
    db.prepare(`SELECT id,name FROM clients WHERE artist_id=? ORDER BY name`).all(artistId),
  listStudioClients: (studioId) =>
    db.prepare(`SELECT id,name,artist_id FROM clients WHERE studio_id=? ORDER BY name`).all(studioId),
  assignClientToArtist: (clientId, artistId) =>
    db.prepare(`UPDATE clients SET artist_id=? WHERE id=?`).run(artistId, clientId),

  // Appointments
  listAppointmentsForClient: (clientId) =>
    db.prepare(`SELECT * FROM appointments WHERE client_id=? ORDER BY date`).all(clientId),

  // Images (generisch)
  addImagesForClient: (clientId, items) => {
    const stmt = db.prepare(`INSERT INTO images(id, client_id, artist_id, kind, filename, path, comment)
                             VALUES (?,?,?,?,?,?,?)`);
    const tx = db.transaction((rows) => rows.forEach(r =>
      stmt.run(r.id, clientId, r.artist_id || null, r.kind, r.filename || null, r.path, r.comment || null)
    ));
    tx(items);
  },
  // Fallback-API (kompatibel zu älterem server.js)
  addImages: (clientId, items) => {
    const withKind = items.map(x => ({ ...x, kind: x.kind || 'idea' }));
    api.addImagesForClient(clientId, withKind);
  },
  listImages: (clientId, kind) =>
    db.prepare(`SELECT * FROM images WHERE client_id=? AND kind=? ORDER BY created_at DESC`).all(clientId, kind),

  // Wanna-Do
  addWannado: (artistId, items) => {
    const stmt = db.prepare(`INSERT INTO images(id, client_id, artist_id, kind, filename, path)
                             VALUES (?,?,?,?,?,?)`);
    const tx = db.transaction((rows) => rows.forEach(r =>
      stmt.run(r.id, null, artistId, 'wannado', r.filename || null, r.path)
    ));
    tx(items);
  },
  listWannadoForArtist: (artistId) =>
    db.prepare(`SELECT * FROM images WHERE kind='wannado' AND artist_id=? ORDER BY created_at DESC`).all(artistId),
  listWannadoForClient: (clientId) => {
    const c = db.prepare(`SELECT artist_id FROM clients WHERE id=?`).get(clientId);
    if (!c || !c.artist_id) return [];
    return api.listWannadoForArtist(c.artist_id);
  },

  // Healing
  addHealingForClient: (clientId, items) =>
    api.addImagesForClient(clientId, items.map(x => ({ ...x, kind: 'healing' }))),

  listHealingForArtist: (artistId) => db.prepare(`
    SELECT i.* FROM images i
    JOIN clients c ON c.id = i.client_id
    WHERE i.kind='healing' AND c.artist_id=?
    ORDER BY i.created_at DESC
  `).all(artistId),

  // Studio-Overview (Supervisor)
  studioOverview: (studioId) => ({
    artists: api.listArtists(studioId),
    clients: api.listStudioClients(studioId),
    wannado: db.prepare(`
      SELECT i.* FROM images i
      JOIN artists a ON a.id = i.artist_id
      WHERE i.kind='wannado' AND a.studio_id=?
      ORDER BY i.created_at DESC
    `).all(studioId),
    healing: db.prepare(`
      SELECT i.* FROM images i
      JOIN clients c ON c.id = i.client_id
      WHERE i.kind='healing' AND c.studio_id=?
      ORDER BY i.created_at DESC
    `).all(studioId),
  }),
};

export default api;
