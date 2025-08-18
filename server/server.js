// server/server.js
// Node Web Service (Render-ready): Static + API + Health

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import dbApi, { sha256 } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CLIENT_ROOT = path.join(__dirname, '..', 'client');
const UPLOAD_ROOT = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
for (const d of ['wannado','ideas','templates','final','healing']) {
  fs.mkdirSync(path.join(UPLOAD_ROOT, d), { recursive: true });
}

function sendJSON(res, status, obj) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
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
function sendFile(res, filePath) {
  if (!fs.existsSync(filePath)) return false;
  const ext = path.extname(filePath).toLowerCase();
  const type =
    ext === '.html' ? 'text/html; charset=utf-8' :
    ext === '.css'  ? 'text/css; charset=utf-8' :
    ext === '.js'   ? 'application/javascript; charset=utf-8' :
    ext === '.json' ? 'application/json; charset=utf-8' :
    ext === '.png'  ? 'image/png' :
    ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
    ext === '.webp' ? 'image/webp' :
    'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*' });
  fs.createReadStream(filePath).pipe(res);
  return true;
}
async function readBody(req) {
  return await new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => (data += c));
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}
function saveDataUrlToFile(dataUrl, targetDir) {
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
function ensureArray(x){ return Array.isArray(x) ? x : (x ? [x] : []); }

const server = http.createServer(async (req, res) => {
  const { method } = req;
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname || '/';

  // CORS preflight
  if (method === 'OPTIONS') return sendText(res, 200, 'OK');

  // Serve uploads
  if (pathname.startsWith('/uploads/')) {
    const rel = pathname.replace(/^\/uploads\//, '');
    const filePath = path.join(UPLOAD_ROOT, rel);
    if (!filePath.startsWith(UPLOAD_ROOT)) return sendText(res, 403, 'Forbidden');
    if (!fs.existsSync(filePath)) return sendText(res, 404, 'Not found');
    return sendFile(res, filePath);
  }

  // API
  if (pathname.startsWith('/api/')) {
    // GET /api/health
if (parts[0] === 'health' && method === 'GET') {
  return sendJSON(res, 200, {
    ok: true,
    time: new Date().toISOString(),
    dbPath: process.env.DB_PATH,
    uploadDir: process.env.UPLOAD_DIR
  });
}


    const parts = pathname.replace(/^\/api\//, '').split('/');
    try {
      // Health
      if (parts[0] === 'health' && method === 'GET') {
        return sendJSON(res, 200, {
          ok: true,
          time: new Date().toISOString(),
          dbPath: process.env.DB_PATH,
          uploadDir: process.env.UPLOAD_DIR
        });
      }

      // Studios
      if (parts[0] === 'studios' && method === 'GET') {
        return sendJSON(res, 200, dbApi.getStudios());
      }
      if (parts[0] === 'studio' && parts[1] && parts[2] === 'config' && method === 'GET') {
        const t = dbApi.getStudioTheme(parts[1]);
        return t ? sendJSON(res, 200, t) : sendJSON(res, 404, { error: 'Studio nicht gefunden' });
      }
      if (parts[0] === 'studio' && parts[1] && parts[2] === 'manager' && parts[3] === 'login' && method === 'POST') {
        const { user, password } = await readBody(req);
        const ok = dbApi.checkManager(parts[1], user, password);
        return ok ? sendJSON(res, 200, { success: true, studioId: parts[1] })
                  : sendJSON(res, 401, { success: false, error: 'Ungültige Zugangsdaten' });
      }
      if (parts[0] === 'studio' && parts[1] && parts[2] === 'overview' && method === 'GET') {
        return sendJSON(res, 200, dbApi.studioOverview(parts[1]));
      }

      // Login (client/artist)
      if (parts[0] === 'login' && method === 'POST') {
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
      }

      // Artist uploads (Beispiel)
      if (parts[0] === 'artist' && parts[1] && parts[2] === 'upload' && parts[3] && method === 'POST') {
        const artistId = parts[1];
        const kind = parts[3]; // 'templates' | 'final'
        const valid = ['templates', 'final'];
        if (!valid.includes(kind)) return sendJSON(res, 400, { error: 'Ungültiger Upload-Typ' });
        const { clientId, images } = await readBody(req);
        if (!clientId) return sendJSON(res, 400, { error: 'clientId erforderlich' });
        const target = path.join(UPLOAD_ROOT, kind);
        const saved = ensureArray(images).map(img => saveDataUrlToFile(img?.data || img, target)).filter(Boolean);
        return sendJSON(res, 200, { success: true, files: saved });
      }

      return sendJSON(res, 404, { error: 'Endpoint nicht gefunden' });
    } catch (e) {
      console.error('API error:', e);
      return sendJSON(res, 500, { error: 'Serverfehler' });
    }
  }

  // Static (client)
  if (pathname === '/' || pathname === '/index.html') {
    if (sendFile(res, path.join(CLIENT_ROOT, 'index.html'))) return;
  } else {
    const safeRel = pathname.replace(/^\/+/, '').replace(/\.\.+/g, '');
    const filePath = path.join(CLIENT_ROOT, safeRel);
    if (sendFile(res, filePath)) return;
  }
  if (sendFile(res, path.join(CLIENT_ROOT, 'index.html'))) return;
  sendText(res, 404, 'Not Found');
});



const PORT = process.env.PORT || 3001;
process.on('unhandledRejection', err => console.error('unhandledRejection', err));
process.on('uncaughtException', err => console.error('uncaughtException', err));
server.listen(PORT, () => {
  console.log(`✅ Server listening on :${PORT}`);
  console.log(`DB_PATH = ${process.env.DB_PATH}`);
  console.log(`UPLOAD_DIR = ${process.env.UPLOAD_DIR}`);
});
