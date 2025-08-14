/*
 * Service Worker für die Tattoo-PWA (Render Static Site).
 * - Cache-Version bumpen, nur gleiche Origin cachen
 * - API-/Fremd-Requests nicht anfassen
 * - SPA: Navigation fällt offline auf /index.html zurück
 */

const VERSION = 'v7'; // neu
const CACHE_NAME = `tattoo-pwa-${VERSION}`;
const OFFLINE_URLS = [
  '/', '/index.html', '/studio.html', '/artist.html',
  '/artist-register.html', '/artist-register.js', // <— NEU
  '/style.css', '/theme.css', '/config.js',
  '/script.js', '/studio.js', '/artist.js',
  '/assets/marble-bg.png', '/manifest.json',
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

  // Nur GET-Anfragen cachen
  if (req.method !== 'GET') return;

  // API und Cross-Origin nicht cachen → direkt ins Netz
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) {
    return; // Browser macht normalen Fetch
  }

  // SPA-Navigation: bei Offline → /index.html aus dem Cache
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Statische Ressourcen: cache first, dann Netzwerk + nachcachen
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
