/*
 * Service Worker für die Tattoo-PWA (Static Site).
 * - SPA: Navigationen immer auf index.html (App-Shell)
 * - Nur same-origin cachen (kein /api/ oder Cross-Origin)
 * - Cache-Version bumpen
 * - Navigation Preload für schnellere First Load
 */

const VERSION = 'v10';
const CACHE_NAME = `tattoo-pwa-${VERSION}`;

const OFFLINE_URLS = [
  '/', '/index.html',
  '/style.css', '/theme.css',
  '/script.js', '/config.js',
  '/artist.js', '/artist-login.js', '/artist-register.js', '/home.js', '/studio.js',
  '/assets/marble-bg.png',
  '/manifest.json',
  '/icons/icon-192.png', '/icons/icon-512.png'
];

// Install: precache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(OFFLINE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate: alte Caches löschen + Navigation Preload einschalten
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // alte Caches
      const names = await caches.keys();
      await Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)));

      // Navigation Preload (wenn unterstützt)
      if ('navigationPreload' in self.registration) {
        await self.registration.navigationPreload.enable();
      }

      await self.clients.claim();
    })()
  );
});

// Fetch
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Nur GET behandeln
  if (req.method !== 'GET') return;

  // API und Cross-Origin NICHT cachen/abfangen
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) {
    return; // normaler Netz-Fetch
  }

  // SPA: Jede Navigation erhält die App-Shell (index.html), nicht den echten Pfad
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        // Versuch: Navigation Preload oder Netz
        const preload = 'navigationPreload' in self.registration
          ? await event.preloadResponse
          : null;
        if (preload) return preload;

        // Netz fetchen? Für SPA wollen wir trotzdem die App-Shell
        // => direkt Cache-first index.html
        const cachedShell = await caches.match('/index.html');
        if (cachedShell) return cachedShell;

        // Fallback: frische index.html holen und cachen
        const fresh = await fetch('/index.html', { cache: 'no-cache' });
        const copy = fresh.clone();
        const cache = await caches.open(CACHE_NAME);
        cache.put('/index.html', copy);
        return fresh;
      } catch {
        // Offline-Fallback
        const cachedShell = await caches.match('/index.html');
        if (cachedShell) return cachedShell;
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      }
    })());
    return;
  }

  // Statische Assets: Cache First, sonst Netz + nachcachen
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;

    const resp = await fetch(req);
    // Nur erfolgreiche, sichere Responses cachen
    if (resp && resp.ok && (resp.type === 'basic' || resp.type === 'opaque')) {
      const copy = resp.clone();
      const cache = await caches.open(CACHE_NAME);
      cache.put(req, copy);
    }
    return resp;
  })());
});
