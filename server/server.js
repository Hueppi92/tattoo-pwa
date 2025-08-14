// server/server.js
// Minimalistisches JSON-File-Backend (ohne externe Abhängigkeiten).
// Start: node server.js  (PORT via env überschreibbar)

import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

// __dirname sauber aus import.meta.url erzeugen (Windows-tauglich)
const __dirname = path.dirname(fileURLToPath(import.meta.url));


// --- Pfade & Helpers ---------------------------------------------------------
const DATA_PATH = path.join(__dirname, 'data.json');
const UPLOAD_ROOT = path.join(__dirname, 'uploads');
const UPLOAD_DIRS = {
  ideas: path.join(UPLOAD_ROOT, 'ideas'),
  templates: path.join(UPLOAD_ROOT, 'templates'),
  final: path.join(UPLOAD_ROOT, 'final'),
  healing: path.join(UPLOAD_ROOT, 'healing'),
};
Object.values(UPLOAD_DIRS).forEach((p) => fs.mkdirSync(p, { recursive: true }));

function readJSON() {
  if (!fs.existsSync(DATA_PATH)) {
    fs.writeFileSync(
      DATA_PATH,
      JSON.stringify({ clients: [], artists: [], studios: [], studioConfig: {} }, null, 2)
    );
  }
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
}

function writeJSON(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

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
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function ensureArray(a) {
  if (!a) return [];
  return Array.isArray(a) ? a : [a];
}

function saveDataUrlToFile(dataUrl, targetDir) {
  // dataUrl: "data:image/png;base64,...."
  const m = /^data:(.+);base64,(.*)$/.exec(dataUrl || '');
  if (!m) return null;
  const ext = (m[1].split('/')[1] || 'bin').split('+')[0];
  const buf = Buffer.from(m[2], 'base64');
  const id = crypto.randomUUID();
  const fileName = `${id}.${ext}`;
  const filePath = path.join(targetDir, fileName);
  fs.writeFileSync(filePath, buf);
  return { id, filename: fileName, path: `/uploads/${path.basename(targetDir)}/${fileName}` };
}

function resolveUploadsStatic(req, res, pathname) {
  // serve /uploads/* statisch
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

// Kurz-Helfer für Entities
function findClient(data, id) {
  return (data.clients || []).find((c) => c.id === id);
}
function findArtist(data, id) {
  return (data.artists || []).find((a) => a.id === id);
}
function getStudios(data) {
  return data.studios || [];
}
function findStudio(data, id) {
  return getStudios(data).find((s) => s.id === id);
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

  // Statische Uploads
  if (pathname.startsWith('/uploads/')) {
    return resolveUploadsStatic(req, res, pathname);
  }

  // Nur API-Routen hier
  if (!pathname.startsWith('/api/')) {
    return sendText(res, 404, 'Not Found');
  }

  const data = readJSON();
  const parts = pathname.split('/').filter(Boolean); // ["api", "...", ...]
  const method = req.method.toUpperCase();

  // --- AUTH / BASIC FLOWS ---------------------------------------------------

  // POST /api/register
  if (parts[1] === 'register' && method === 'POST') {
    try {
      const { clientId, password, name, artistId } = await readBody(req);
      if (!clientId || !password) return sendJSON(res, 400, { error: 'clientId und password erforderlich' });
      if (findClient(data, clientId)) return sendJSON(res, 409, { error: 'Client existiert bereits' });
      const client = {
        id: clientId,
        name: name || clientId,
        password: sha256(password),
        artistId: artistId || null,
        appointments: [],
        ideas: [],
        templates: [],
        healing: [],
        finalTemplate: null,
      };
      data.clients = data.clients || [];
      data.clients.push(client);
      writeJSON(data);
      return sendJSON(res, 200, { success: true, clientId: clientId });
    } catch (e) {
      return sendJSON(res, 500, { error: 'Register fehlgeschlagen' });
    }
  }

  // POST /api/login   {userId, password, role}
  if (parts[1] === 'login' && method === 'POST') {
    try {
      const { userId, password, role } = await readBody(req);
      if (!userId || !password || !role) return sendJSON(res, 400, { error: 'userId, password, role erforderlich' });
      if (role === 'client') {
        const c = findClient(data, userId);
        if (!c || c.password !== sha256(password)) return sendJSON(res, 401, { error: 'Ungültige Zugangsdaten' });
        return sendJSON(res, 200, { success: true, clientId: c.id });
      }
      if (role === 'artist') {
        const a = findArtist(data, userId);
        if (!a || a.password !== sha256(password)) return sendJSON(res, 401, { error: 'Ungültige Zugangsdaten' });
        return sendJSON(res, 200, { success: true, artistId: a.id });
      }
      return sendJSON(res, 400, { error: 'Unbekannte Rolle' });
    } catch {
      return sendJSON(res, 500, { error: 'Login fehlgeschlagen' });
    }
  }

  // --- CLIENT DATEN ---------------------------------------------------------

  // GET /api/client/:id
  if (parts[1] === 'client' && parts[2] && method === 'GET' && parts.length === 3) {
    const c = findClient(data, parts[2]);
    if (!c) return sendJSON(res, 404, { error: 'Client nicht gefunden' });
    return sendJSON(res, 200, c);
  }

  // POST /api/client/:id/ideas  { images: [{name,data:dataURL}] }
  if (parts[1] === 'client' && parts[2] && parts[3] === 'ideas' && method === 'POST') {
    const c = findClient(data, parts[2]);
    if (!c) return sendJSON(res, 404, { error: 'Client nicht gefunden' });
    try {
      const { images } = await readBody(req);
      const results = [];
      ensureArray(images).forEach((img) => {
        const saved = saveDataUrlToFile(img.data, UPLOAD_DIRS.ideas);
        if (saved) results.push({ id: saved.id, filename: img.name || saved.filename, path: saved.path });
      });
      c.ideas = c.ideas || [];
      c.ideas.push(...results);
      writeJSON(data);
      return sendJSON(res, 200, { success: true, uploaded: results.length });
    } catch (e) {
      return sendJSON(res, 500, { error: 'Upload fehlgeschlagen' });
    }
  }

  // POST /api/client/:id/templates { templates: [{name,data}] }
  if (parts[1] === 'client' && parts[2] && parts[3] === 'templates' && method === 'POST') {
    const c = findClient(data, parts[2]);
    if (!c) return sendJSON(res, 404, { error: 'Client nicht gefunden' });
    try {
      const { templates } = await readBody(req);
      const results = [];
      ensureArray(templates).forEach((t) => {
        const saved = saveDataUrlToFile(t.data, UPLOAD_DIRS.templates);
        if (saved) results.push({ id: saved.id, filename: t.name || saved.filename, path: saved.path, rating: null });
      });
      c.templates = c.templates || [];
      c.templates.push(...results);
      writeJSON(data);
      return sendJSON(res, 200, { success: true, uploaded: results.length });
    } catch (e) {
      return sendJSON(res, 500, { error: 'Upload fehlgeschlagen' });
    }
  }

  // POST /api/client/:id/templates/:tid/rating {rating:'like'|'dislike'}
  if (parts[1] === 'client' && parts[2] && parts[3] === 'templates' && parts[4] && parts[5] === 'rating' && method === 'POST') {
    const c = findClient(data, parts[2]);
    if (!c) return sendJSON(res, 404, { error: 'Client nicht gefunden' });
    const tmpl = (c.templates || []).find((t) => t.id === parts[4]);
    if (!tmpl) return sendJSON(res, 404, { error: 'Vorlage nicht gefunden' });
    const { rating } = await readBody(req);
    tmpl.rating = rating || null;
    writeJSON(data);
    return sendJSON(res, 200, { success: true });
  }

  // POST /api/client/:id/final { final: {name,data} }
  if (parts[1] === 'client' && parts[2] && parts[3] === 'final' && method === 'POST') {
    const c = findClient(data, parts[2]);
    if (!c) return sendJSON(res, 404, { error: 'Client nicht gefunden' });
    try {
      const { final } = await readBody(req);
      const saved = saveDataUrlToFile(final.data, UPLOAD_DIRS.final);
      if (!saved) return sendJSON(res, 400, { error: 'Ungültige Datei' });
      c.finalTemplate = { id: saved.id, filename: final.name || saved.filename, path: saved.path };
      writeJSON(data);
      return sendJSON(res, 200, { success: true });
    } catch {
      return sendJSON(res, 500, { error: 'Speichern fehlgeschlagen' });
    }
  }

  // POST /api/client/:id/healing  { images:[{name,data}], comment }
  if (parts[1] === 'client' && parts[2] && parts[3] === 'healing' && method === 'POST' && parts.length === 4) {
    const c = findClient(data, parts[2]);
    if (!c) return sendJSON(res, 404, { error: 'Client nicht gefunden' });
    try {
      const { images, comment } = await readBody(req);
      const savedImgs = [];
      ensureArray(images).forEach((im) => {
        const saved = saveDataUrlToFile(im.data, UPLOAD_DIRS.healing);
        if (saved) savedImgs.push({ id: saved.id, filename: im.name || saved.filename, path: saved.path });
      });
      const entry = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        images: savedImgs,
        comment: comment || '',
        responses: [],
      };
      c.healing = c.healing || [];
      c.healing.unshift(entry);
      writeJSON(data);
      return sendJSON(res, 200, { success: true, id: entry.id });
    } catch {
      return sendJSON(res, 500, { error: 'Heilungsdaten fehlgeschlagen' });
    }
  }

  // POST /api/client/:id/healing/:hid/response { artistId, comment }
  if (parts[1] === 'client' && parts[2] && parts[3] === 'healing' && parts[4] && parts[5] === 'response' && method === 'POST') {
    const c = findClient(data, parts[2]);
    if (!c) return sendJSON(res, 404, { error: 'Client nicht gefunden' });
    const entry = (c.healing || []).find((h) => h.id === parts[4]);
    if (!entry) return sendJSON(res, 404, { error: 'Eintrag nicht gefunden' });
    const { artistId, comment } = await readBody(req);
    entry.responses = entry.responses || [];
    entry.responses.push({ artistId: artistId || null, comment: comment || '', createdAt: new Date().toISOString() });
    writeJSON(data);
    return sendJSON(res, 200, { success: true });
  }

// POST /api/artist/register  { artistId, password, name, studioId }
if (parts[1] === 'artist' && parts[2] === 'register' && method === 'POST') {
  const { artistId, password, name, studioId } = await readBody(req);
  if (!artistId || !password || !studioId) {
    return sendJSON(res, 400, { error: 'artistId, password, studioId erforderlich' });
  }
  if (findArtist(data, artistId)) return sendJSON(res, 409, { error: 'Artist existiert bereits' });
  data.artists = data.artists || [];
  data.artists.push({ id: artistId, name: name || artistId, password: sha256(password), studioId });
  writeJSON(data);
  return sendJSON(res, 200, { success: true, artistId });
}

  
  // --- ARTISTS --------------------------------------------------------------
  // GET /api/artist/clients
  if (parts[1] === 'artist' && parts[2] === 'clients' && method === 'GET') {
    return sendJSON(res, 200, data.clients || []);
  }

  // --- AFTERCARE ------------------------------------------------------------
  if (parts[1] === 'aftercare' && method === 'GET') {
    const tips = [
      { title: 'Reinigung', text: 'Wasche dein Tattoo 2–3x täglich mit lauwarmem Wasser und pH-neutraler Seife. Sanft trockentupfen.' },
      { title: 'Pflege', text: 'Dünn eine geeignete Tattoo-Pflege auftragen (Studioempfehlung beachten).' },
      { title: 'Schutz', text: 'Sonne, Solarium, Sauna, Chlor-/Salzwasser in den ersten Wochen meiden. Locker kleiden.' },
      { title: 'Nicht kratzen', text: 'Juckreiz ist normal – bitte nicht kratzen oder Krusten abziehen.' },
    ];
    return sendJSON(res, 200, { tips });
  }

  // --- SINGLE-STUDIO CONFIG (Bestand) --------------------------------------
  if (parts[1] === 'studio' && parts[2] === 'config' && method === 'GET' && parts.length === 3) {
    // Falls du weiterhin eine Default-Konfiguration anbieten willst
    return sendJSON(res, 200, data.studioConfig || {});
  }

  // --- MULTI-TENANT: STUDIOS ----------------------------------------------
  // GET /api/studios
  if (parts[1] === 'studios' && method === 'GET') {
    const list = getStudios(data).map((s) => ({ id: s.id, name: s.name }));
    return sendJSON(res, 200, list);
  }

  // GET /api/studio/:id/config
  if (parts[1] === 'studio' && parts[2] && parts[3] === 'config' && method === 'GET') {
    const studio = findStudio(data, parts[2]);
    if (!studio) return sendJSON(res, 404, { error: 'Studio nicht gefunden' });
    return sendJSON(res, 200, studio.theme || {});
  }

  // POST /api/studio/:id/manager/login  {user,password}
  if (parts[1] === 'studio' && parts[2] && parts[3] === 'manager' && parts[4] === 'login' && method === 'POST') {
    const studio = findStudio(data, parts[2]);
    if (!studio) return sendJSON(res, 404, { error: 'Studio nicht gefunden' });
    const { user, password } = await readBody(req);
    if (studio.manager && user === studio.manager.user && password === studio.manager.password) {
      return sendJSON(res, 200, { success: true, studioId: studio.id });
    }
    return sendJSON(res, 401, { success: false, error: 'Ungültige Zugangsdaten' });
  }

  // Fallback
  return sendJSON(res, 404, { error: 'Endpoint nicht gefunden' });
});

// --- Start ------------------------------------------------------------------
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});
