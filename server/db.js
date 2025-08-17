// server/db.js
import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'db.sqlite');
const db = new Database(DB_PATH);

export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

// -------------------------------------------------------------------------------------
// SCHEMA
// -------------------------------------------------------------------------------------
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
  -- NEU: für Wanna-Do Zuordnung zum Artist
  artist_id TEXT REFERENCES artists(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK(kind IN ('idea','template','final','healing','wannado')),
  filename TEXT,
  path TEXT NOT NULL,
  -- NEU: Kommentar (z.B. bei Healing)
  comment TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
`);

// sanfte Migration, falls Spalten fehlen (SQLite erlaubt ALTER ADD COLUMN mehrfach nicht IF NOT EXISTS)
function ensureColumn(table, col) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  return cols.includes(col);
}
try {
  if (!ensureColumn('images', 'artist_id')) db.exec(`ALTER TABLE images ADD COLUMN artist_id TEXT;`);
} catch {}
try {
  if (!ensureColumn('images', 'comment')) db.exec(`ALTER TABLE images ADD COLUMN comment TEXT;`);
} catch {}

// -------------------------------------------------------------------------------------
// API-Funktionen
// -------------------------------------------------------------------------------------
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
  listArtists: (studioId) => studioId
    ? db.prepare(`SELECT id,name FROM artists WHERE studio_id=? ORDER BY name`).all(studioId)
    : db.prepare(`SELECT id,name FROM artists ORDER BY name`).all(),
  createArtist: ({ id, name, password, studioId }) =>
    db.prepare(`INSERT INTO artists(id,name,password,studio_id) VALUES (?,?,?,?)`)
      .run(id, name || id, sha256(password), studioId || null),

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

  // Images: generisch
  addImagesForClient: (clientId, items) => {
    const stmt = db.prepare(`INSERT INTO images(id, client_id, artist_id, kind, filename, path, comment)
                             VALUES (?,?,?,?,?,?,?)`);
    const tx = db.transaction((rows) => rows.forEach(r => stmt.run(
      r.id, clientId, r.artist_id || null, r.kind, r.filename || null, r.path, r.comment || null
    )));
    tx(items);
  },
  listImages: (clientId, kind) =>
    db.prepare(`SELECT * FROM images WHERE client_id=? AND kind=? ORDER BY created_at DESC`).all(clientId, kind),

  // Wanna-Do (Artist-Portfolio, per Artist)
  addWannado: (artistId, items) => {
    const stmt = db.prepare(`INSERT INTO images(id, client_id, artist_id, kind, filename, path)
                             VALUES (?,?,?,?,?,?)`);
    const tx = db.transaction((rows) => rows.forEach(r => stmt.run(
      r.id, null, artistId, 'wannado', r.filename || null, r.path
    )));
    tx(items);
  },
  listWannadoForArtist: (artistId) =>
    db.prepare(`SELECT * FROM images WHERE kind='wannado' AND artist_id=? ORDER BY created_at DESC`)
      .all(artistId),

  // Sichtbarkeit: Client darf nur Wanna-Do seines Artists sehen
  listWannadoForClient: (clientId) => {
    const c = db.prepare(`SELECT artist_id FROM clients WHERE id=?`).get(clientId);
    if (!c || !c.artist_id) return [];
    return db.prepare(`SELECT * FROM images WHERE kind='wannado' AND artist_id=? ORDER BY created_at DESC`)
             .all(c.artist_id);
  },

  // Healing-Flow
  addHealingForClient: (clientId, items) => api.addImagesForClient(clientId,
    items.map(x => ({ ...x, kind: 'healing' }))
  ),
  listHealingForArtist: (artistId) =>
    db.prepare(`
      SELECT i.* FROM images i
      JOIN clients c ON c.id = i.client_id
      WHERE i.kind='healing' AND c.artist_id=?
      ORDER BY i.created_at DESC
    `).all(artistId),

  // Studio-Overview für Manager (Supervisor)
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

// -------------------------------------------------------------------------------------
// SEED-Beispiele (optional beim ersten Start): 2 Artists, 2 Kunden, Zuweisungen
// Aufrufen z.B. manuell einmalig: import './seed.js' oder hier sehr defensiv:
try {
  // leeres Studio anlegen, wenn keins existiert
  const haveStudio = db.prepare(`SELECT 1 FROM studios LIMIT 1`).get();
  if (!haveStudio) {
    db.prepare(`INSERT INTO studios(id,name,theme_primary,theme_secondary,theme_accent,font_body,bg,mgr_user,mgr_pass)
                VALUES (?,?,?,?,?,?,?, ?, ?)`)
      .run('exclusive-ink','Beispiel-Studio A','#1a1a1d','#f3f3f3','#c59d5f','Open Sans','/assets/bg-a.png',
           'manager@exclusive','pass123');

    // Artists
    api.createArtist({ id: 'artistA', name: 'Artist A', password: 'devpass', studioId: 'exclusive-ink' });
    api.createArtist({ id: 'artistB', name: 'Artist B', password: 'devpass', studioId: 'exclusive-ink' });

    // Clients (noch ohne Artist)
    api.createClient({ id: 'clientA', name: 'Kunde A', password: 'devpass', studioId: 'exclusive-ink' });
    api.createClient({ id: 'clientB', name: 'Kunde B', password: 'devpass', studioId: 'exclusive-ink' });

    // Zuweisungen
    api.assignClientToArtist('clientA','artistA');
    api.assignClientToArtist('clientB','artistB');
  }
} catch {}
