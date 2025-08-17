/*
 * Service Worker für die Tattoo-PWA (Static Site).
 * - Cache-Version bumpen
 * - Nur same-origin cachen (kein /api/ oder Cross-Origin)
 * - SPA: Navigation -> /index.html Fallback
 */

const VERSION = 'v9';
const CACHE_NAME = `tattoo-pwa-${VERSION}`;

const OFFLINE_URLS = [
  '/',                       // Render leitet auf /index.html
  '/index.html',             '/script.js',
  '/artist.html',            '/artist.js',
  '/artist-login.html',      '/artist-login.js',
  '/artist-register.html',   '/artist-register.js',
  '/home.html',              '/home.js',
  '/studio.html',            '/studio.js',
  '/style.css',              '/theme.css', '/config.js',
  '/assets/marble-bg.png',
  '/manifest.json',
  '/icons/icon-192.png', '/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(OFFLINE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) =>
        Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Nur GET cachen
  if (req.method !== 'GET') return;

  // API und Cross-Origin NICHT cachen
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) {
    return; // normaler Netz-Fetch
  }

  // SPA-Navigation -> App-Shell
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Statisches Asset: Cache First, sonst Netz + nachcachen
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        return resp;
      });
    })
  );
});
