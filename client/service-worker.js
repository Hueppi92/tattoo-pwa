/*
 * Service Worker für die Tattoo‑PWA. Er kümmert sich um das Zwischenspeichern
 * statischer Ressourcen und ermöglicht das Offline‑Verhalten. Die Liste der
 * zu cachenden Dateien wird beim Installieren des Service Workers definiert.
 */

const CACHE_NAME = 'tattoo-pwa-v1';
const OFFLINE_URLS = [
  '/',
  '/index.html',
  '/style.css',
  '/theme.css',
  '/script.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(OFFLINE_URLS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  // Für API‑Aufrufe versuchen wir immer, online zu gehen
  if (request.url.includes('/api/')) {
    return;
  }
  event.respondWith(
    caches.match(request).then((response) => {
      return response || fetch(request).then((fetchResponse) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, fetchResponse.clone());
          return fetchResponse;
        });
      });
    }).catch(() => caches.match('/index.html'))
  );
});