// server/server.js
// Minimal-Backend mit SQLite (better-sqlite3) statt data.json
// Start: node server.js  (PORT via env möglich)

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import dbApi, { sha256 } from './db.js';

// __dirname sauber aus import.meta.url erzeugen
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Pfade & Helpers ---------------------------------------------------------
const UPLOAD_ROOT = path.join(__dirname, 'uploads');
const UPLOAD_DIRS = {
  wannado: path.join(UPLOAD_ROOT, 'wannado'),
  ideas: path.join(UPLOAD_ROOT, 'ideas'),
  templates: path.join(UPLOAD_ROOT, 'templates'),
  final: path.join(UPLOAD_ROOT, 'final'),
  healing: path.join(UPLOAD_ROOT, 'healing'),
};
// Verzeichnisse sicherstellen:
Object.values(UPLOAD_DIRS).forEach((p) => {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

function sendJSON(res, status, obj) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  });
  res.end(JSON.stringify(obj));
}
function sendText(res, status, text) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  });
  res.end(text);
}
async function readBody(req) {
  return await new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}
function saveDataUrlToFile(dataUrl, targetDir) {
  // dataUrl: "data:image/png;base64,...."
  const m = /^data:(.+);base64,(.*)$/.exec(dataUrl || '');
  if (!m) return null;
  const ext = (m[1].split('/')[1] || 'bin').split('+')[0];
  const buf = Buffer.from(m[2], 'base64');
  const id = randomUUID();
  const fileName = `${id}.${ext}`;
  const filePath = path.join(targetDir, fileName);
  fs.writeFileSync(filePath, buf);
  return { id, filename: fileName, path: `/uploads/${path.basename(targetDir)}/${fileName}` };
}
function ensureArray(x) { return Array.isArray(x) ? x : (x ? [x] : []); }

function serveUploads(req, res, pathname) {
  const rel = pathname.replace(/^\/uploads\//, '');
  const filePath = path.join(UPLOAD_ROOT, rel);
  if (!filePath.startsWith(UPLOAD_ROOT)) return sendText(res, 403, 'Forbidden');
  if (!fs.existsSync(filePath)) return sendText(res, 404, 'Not found');
  const ext = path.extname(filePath).toLowerCase();
  const type =
    ext === '.png' ? 'image/png'
      : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
      : ext === '.webp' ? 'image/webp'
      : 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*' });
  fs.createReadStream(filePath).pipe(res);
}

// --- Server & Routing --------------------------------------------------------
const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    });
    return res.end();
  }

  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname || '/';
  const parts = pathname.split('/').filter(Boolean); // ["api", "...", ...]

  // Statische Uploads
  if (pathname.startsWith('/uploads/')) return serveUploads(req, res, pathname);

  // Nur API-Routen hier
  if (!pathname.startsWith('/api/')) return sendText(res, 404, 'Not Found');

  const method = req.method.toUpperCase();

  // --- AUTH / REGISTER -------------------------------------------------------

  // POST /api/register   {clientId, password, name?, artistId?, studioId?}
  if (parts[1] === 'register' && method === 'POST') {
    try {
      const { clientId, password, name, artistId, studioId } = await readBody(req);
      if (!clientId || !password) return sendJSON(res, 400, { error: 'clientId und password erforderlich' });
      if (dbApi.getClientById(clientId)) return sendJSON(res, 409, { error: 'Client existiert bereits' });
      // db.js hasht intern via sha256(password)
      dbApi.createClient({ id: clientId, name, password, studioId, artistId });
      return sendJSON(res, 200, { success: true, clientId });
    } catch (e) {
      return sendJSON(res, 500, { error: 'Register fehlgeschlagen' });
    }
  }

  // POST /api/artist/register   {artistId, password, name?, studioId?}
  if (parts[1] === 'artist' && parts[2] === 'register' && method === 'POST') {
    try {
      const { artistId, password, name, studioId } = await readBody(req);
      if (!artistId || !password) return sendJSON(res, 400, { error: 'artistId und password erforderlich' });
      if (dbApi.getArtistById(artistId)) return sendJSON(res, 409, { error: 'Artist existiert bereits' });
      // db.js hasht intern via sha256(password)
      dbApi.createArtist({ id: artistId, name, password, studioId });
      return sendJSON(res, 200, { success: true, artistId });
    } catch (e) {
      return sendJSON(res, 500, { error: 'Artist-Register fehlgeschlagen' });
    }
  }

  // POST /api/login   {userId, password, role: 'client'|'artist'}
  if (parts[1] === 'login' && method === 'POST') {
    try {
      const { userId, password, role } = await readBody(req);
      if (!userId || !password || !role) return sendJSON(res, 400, { error: 'userId, password, role erforderlich' });

      if (role === 'client') {
        const c = dbApi.getClientById(userId);
        if (!c || c.password !== sha256(password)) return sendJSON(res, 401, { error: 'Ungültige Zugangsdaten' });
        return sendJSON(res, 200, { success: true, clientId: c.id });
      }

      if (role === 'artist') {
        const a = dbApi.getArtistById(userId);
        if (!a || a.password !== sha256(password)) return sendJSON(res, 401, { error: 'Ungültige Zugangsdaten' });
        return sendJSON(res, 200, { success: true, artistId: a.id });
      }

      return sendJSON(res, 400, { error: 'Unbekannte Rolle' });
    } catch {
      return sendJSON(res, 500, { error: 'Login fehlgeschlagen' });
    }
  }

  // --- CLIENT ---------------------------------------------------------------

  // GET /api/client/:id
  if (parts[1] === 'client' && parts[2] && method === 'GET' && parts.length === 3) {
    const c = dbApi.getClientById(parts[2]);
    if (!c) return sendJSON(res, 404, { error: 'Client nicht gefunden' });
    const appointments = dbApi.listAppointmentsForClient(c.id);
    const ideas = dbApi.listImages(c.id, 'idea');
    const templates = dbApi.listImages(c.id, 'template');
    const final = dbApi.listImages(c.id, 'final');
    const healing = dbApi.listImages(c.id, 'healing');
    return sendJSON(res, 200, {
      id: c.id, name: c.name,
      appointments, ideas, templates,
      finalTemplate: final[0] || null,
      healing,
      messages: []
    });
  }

  // GET /api/client/:id/wannado   -> nur Wanna-Do des zugewiesenen Artists
  if (parts[1] === 'client' && parts[2] && parts[3] === 'wannado' && method === 'GET') {
    return sendJSON(res, 200, dbApi.listWannadoForClient(parts[2]));
  }

  // POST /api/client/:id/ideas { images: [{name,data}] }
  if (parts[1] === 'client' && parts[2] && parts[3] === 'ideas' && method === 'POST') {
    const c = dbApi.getClientById(parts[2]);
    if (!c) return sendJSON(res, 404, { error: 'Client nicht gefunden' });
    try {
      const { images } = await readBody(req);
      const results = [];
      ensureArray(images).forEach((img) => {
        const saved = saveDataUrlToFile(img.data, UPLOAD_DIRS.ideas);
        if (saved) results.push({ id: saved.id, filename: img.name || saved.filename, path: saved.path, kind: 'idea' });
      });
      // Kompatibel zu verschiedenen db.js-Versionen:
      if (typeof dbApi.addImagesForClient === 'function') dbApi.addImagesForClient(c.id, results);
      else if (typeof dbApi.addImages === 'function') dbApi.addImages(c.id, results);
      return sendJSON(res, 200, { success: true, uploaded: results.length });
    } catch {
      return sendJSON(res, 500, { error: 'Upload fehlgeschlagen' });
    }
  }

  // POST /api/client/:id/healing  { images: [{name,data,comment?}] }
  if (parts[1] === 'client' && parts[2] && parts[3] === 'healing' && method === 'POST') {
    try {
      const clientId = parts[2];
      const { images } = await readBody(req);
      const rows = [];
      ensureArray(images).forEach((img) => {
        const saved = saveDataUrlToFile(img.data, UPLOAD_DIRS.healing);
        if (saved) rows.push({
          id: saved.id,
          filename: img.name || saved.filename,
          path: saved.path,
          comment: img.comment || null
        });
      });
      if (typeof dbApi.addHealingForClient === 'function') dbApi.addHealingForClient(clientId, rows);
      else if (typeof dbApi.addImagesForClient === 'function')
        dbApi.addImagesForClient(clientId, rows.map(x => ({ ...x, kind: 'healing' })));
      else if (typeof dbApi.addImages === 'function')
        dbApi.addImages(clientId, rows.map(x => ({ ...x, kind: 'healing' })));
      return sendJSON(res, 200, { success: true, uploaded: rows.length });
    } catch {
      return sendJSON(res, 500, { error: 'Healing-Upload fehlgeschlagen' });
    }
  }

  // --- ARTIST ---------------------------------------------------------------

  // GET /api/artist/:id/appointments
  if (parts[1] === 'artist' && parts[2] && parts[3] === 'appointments' && method === 'GET') {
    // Beispiel: hole alle Termine der dem Artist zugewiesenen Clients
    const artistId = parts[2];
    const clients = dbApi.listArtistClients(artistId);
    let list = [];
    clients.forEach(c => { list = list.concat(dbApi.listAppointmentsForClient(c.id)); });
    return sendJSON(res, 200, list);
  }

  // GET /api/artist/:id/clients
  if (parts[1] === 'artist' && parts[2] && parts[3] === 'clients' && method === 'GET') {
    return sendJSON(res, 200, dbApi.listArtistClients(parts[2]));
  }

  // GET /api/artist/:id/wannado
  if (parts[1] === 'artist' && parts[2] && parts[3] === 'wannado' && method === 'GET') {
    if (typeof dbApi.listWannadoForArtist === 'function') {
      return sendJSON(res, 200, dbApi.listWannadoForArtist(parts[2]));
    }
    // Fallback: falls nur eine generische liste existiert
    return sendJSON(res, 200, dbApi.listWannado ? dbApi.listWannado(parts[2]) : []);
  }

  // POST /api/artist/:id/wannado  { images: [{name,data}] }
  if (parts[1] === 'artist' && parts[2] && parts[3] === 'wannado' && method === 'POST') {
    try {
      const artistId = parts[2];
      const { images } = await readBody(req);
      const results = [];
      ensureArray(images).forEach((img) => {
        const saved = saveDataUrlToFile(img.data, UPLOAD_DIRS.wannado);
        if (saved) results.push({ id: saved.id, filename: img.name || saved.filename, path: saved.path });
      });
      if (typeof dbApi.addWannado === 'function' && dbApi.addWannado.length >= 2) {
        dbApi.addWannado(artistId, results); // bevorzugte Signatur
      } else if (typeof dbApi.addWannado === 'function') {
        dbApi.addWannado(results); // ältere Signatur
      }
      return sendJSON(res, 200, { success: true, uploaded: results.length });
    } catch {
      return sendJSON(res, 500, { error: 'Upload fehlgeschlagen' });
    }
  }

  // GET /api/artist/:id/healing  -> Healing-Bilder aller eigenen Kunden
  if (parts[1] === 'artist' && parts[2] && parts[3] === 'healing' && method === 'GET') {
    if (typeof dbApi.listHealingForArtist === 'function') {
      return sendJSON(res, 200, dbApi.listHealingForArtist(parts[2]));
    }
    // Fallback – falls noch nicht implementiert:
    return sendJSON(res, 200, []);
  }

  // Liste Artists (für Dropdown): GET /api/artists?studio=...
  if (parts[1] === 'artists' && method === 'GET') {
    const studio = parsed.query?.studio || null;
    return sendJSON(res, 200, dbApi.listArtists(studio));
  }

  // --- STUDIOS --------------------------------------------------------------

  // GET /api/studios
  if (parts[1] === 'studios' && method === 'GET') {
    return sendJSON(res, 200, dbApi.getStudios());
  }

  // GET /api/studio/:id/config
  if (parts[1] === 'studio' && parts[2] && parts[3] === 'config' && method === 'GET') {
    const t = dbApi.getStudioTheme(parts[2]);
    if (!t) return sendJSON(res, 404, { error: 'Studio nicht gefunden' });
    return sendJSON(res, 200, t);
  }

  // POST /api/studio/:id/manager/login  {user,password}
  if (parts[1] === 'studio' && parts[2] && parts[3] === 'manager' && parts[4] === 'login' && method === 'POST') {
    const { user, password } = await readBody(req);
    const ok = dbApi.checkManager(parts[2], user, password);
    return ok ? sendJSON(res, 200, { success: true, studioId: parts[2] })
              : sendJSON(res, 401, { success: false, error: 'Ungültige Zugangsdaten' });
  }

  // POST /api/studio/:id/assign   { clientId, artistId }
  if (parts[1] === 'studio' && parts[2] && parts[3] === 'assign' && method === 'POST') {
    const studioId = parts[2];
    const { clientId, artistId } = await readBody(req);
    if (!clientId || !artistId) return sendJSON(res, 400, { error: 'clientId und artistId erforderlich' });

    // (Optional: prüfen, ob beide zum Studio gehören)
    const c = dbApi.getClientById(clientId);
    const a = dbApi.getArtistById(artistId);
    if (!c || !a || (c.studio_id && c.studio_id !== studioId) || (a.studio_id && a.studio_id !== studioId)) {
      return sendJSON(res, 400, { error: 'Studio-Zugehörigkeit inkonsistent' });
    }
    dbApi.assignClientToArtist(clientId, artistId);
    return sendJSON(res, 200, { success: true });
  }

  // GET /api/studio/:id/overview
  if (parts[1] === 'studio' && parts[2] && parts[3] === 'overview' && method === 'GET') {
    return sendJSON(res, 200, dbApi.studioOverview(parts[2]));
  }

  // Fallback
  return sendJSON(res, 404, { error: 'Endpoint nicht gefunden' });
});

// --- Start -------------------------------------------------------------------
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});
