/* ============================================================
   service-worker.js — Practice English PWA
   No version numbers needed — network-first for code, cache-first for images.
   ============================================================ */

// Two permanent caches — never need to bump a version number
const IMG_CACHE = 'pe-images'; // photos/icons: cache-first forever
const APP_CACHE = 'pe-app';    // HTML/JS/CSS/JSON: network-first, cached for offline

const isImage = url =>
  url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/i) !== null;

// Install: activate immediately, no pre-caching required
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

// Activate: delete any old versioned caches (pe-v1 … pe-v9), then claim clients
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== IMG_CACHE && k !== APP_CACHE)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch strategy:
//   Images      → cache-first (large files, never change after upload)
//   Everything  → network-first, fall back to cache when offline
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  if (isImage(url)) {
    event.respondWith(
      caches.open(IMG_CACHE).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(response => {
            if (response && response.status === 200)
              cache.put(event.request, response.clone());
            return response;
          });
        })
      )
    );
    return;
  }

  // Network-first: always fetch fresh JS/CSS/JSON/HTML when online
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(APP_CACHE).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request)
          .then(cached => cached || caches.match('./index.html'))
      )
  );
});
