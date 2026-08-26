/* ============================================================
   service-worker.js — Practice English PWA
   No version numbers needed — network-first for code, cache-first for images.
   ============================================================ */

// Permanent caches. AUDIO/APP never need a version bump (audio is slug-named and
// self-invalidating; app is network-first). IMAGES use a stable filename per
// topic ({topic}.webp), so a changed image reuses the same URL — cache-first
// forever would pin the old one permanently. They are served
// stale-while-revalidate instead, and the cache name carries a version so a
// bump force-purges stale images when one is intentionally replaced.
const IMG_CACHE   = 'pe-images-v3'; // photos/icons: stale-while-revalidate (bumped: 178 topic images replaced)
const AUDIO_CACHE = 'pe-audio';     // pre-generated WAV: cache-first forever (slug-named, immutable)
const APP_CACHE   = 'pe-app';       // HTML/JS/CSS/JSON: network-first, cached for offline
const APP_CACHE_MAX = 250;          // cap network-first growth (all visited JSON would accumulate otherwise)

// Dev kill-switch: on localhost the SW must not run — its image cache hides fresh local
// changes and complicates review. A SW already active can't be removed from the page just
// by unregistering in the page script, so the SW removes ITSELF here: on activate it drops
// its own pe-* caches (NEVER the transformers-cache holding the ~130 MB ML models), then
// unregisters and reloads open tabs. In fetch it stops intercepting so requests hit the
// (no-cache, revalidating) dev server directly. Production is unaffected.
const IS_DEV = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(self.location.hostname);

// FIFO trim: cache.keys() preserves insertion order, so deleting the oldest entries
// beyond the cap keeps the network-first cache bounded without tracking access times.
async function trimCache(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

const isImage = url =>
  url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/i) !== null;

// Audio files are named by content slug and never change after upload, so they
// are safe to serve cache-first forever — the same reasoning as images. Serving
// them network-first (the old default) re-downloaded a 100-300 KB WAV on every
// single playback, which is what made repeat audio feel slow to load.
const isAudio = url =>
  url.pathname.match(/\.(wav|mp3|ogg|opus|m4a|aac)$/i) !== null;

// Minimum files required to render index.html offline.
// Fetched atomically during install — if any returns non-200 the install
// fails and the browser retries, so this list must only contain real paths.
const SHELL = [
  './',                               // root navigation (GET /)
  './index.html',                     // direct navigation + offline fallback target
  './manifest.json',
  './index/css/generalities.css',
  './index/css/index.css',
  './shared/js/progress.js',
  './shared/js/network-status.js',
  './shared/js/theme.js',
  './shared/js/milestones.js',
  './shared/js/notifications.js',
  './index/js/index.js',
];

// Install: pre-cache the app shell so the first offline visit works,
// then activate immediately (skipWaiting after caching, not before).
self.addEventListener('install', event => {
  if (IS_DEV) { self.skipWaiting(); return; }
  event.waitUntil(
    caches.open(APP_CACHE)
      // Revalidate against the server so a freshly-installed SW never precaches a
      // stale shell from the HTTP cache.
      .then(cache => cache.addAll(SHELL.map(u => new Request(u, { cache: 'no-cache' }))))
      .then(() => self.skipWaiting())
  );
});

// Activate: delete any old versioned caches (pe-v1 … pe-v9), then claim clients
self.addEventListener('activate', event => {
  if (IS_DEV) {
    // Self-destruct on localhost: drop only this SW's own caches (keep the ML models),
    // unregister, then reload open tabs so they run with no SW (fresh from disk).
    event.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k.startsWith('pe-')).map(k => caches.delete(k)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const c of clients) { try { c.navigate(c.url); } catch { /* ignore */ } }
    })());
    return;
  }
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== IMG_CACHE && k !== AUDIO_CACHE && k !== APP_CACHE)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Notification tap: focus existing window or open a new one
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url)
    ? './' + event.notification.data.url
    : './index.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.endsWith(url.replace('./', '')) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// Fetch strategy:
//   Images      → cache-first (large files, never change after upload)
//   Everything  → network-first, fall back to cache when offline
self.addEventListener('fetch', event => {
  if (IS_DEV) return;              // dev: don't intercept — hit the dev server directly
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  // Audio: cache-first forever. Slug-named files are immutable — a changed
  // phrase produces a new filename, so the cache self-invalidates.
  if (isAudio(url)) {
    event.respondWith(
      caches.open(AUDIO_CACHE).then(cache =>
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

  // Images: stale-while-revalidate. Serve the cached copy instantly (fast), but
  // always fetch a fresh copy in the background and update the cache, so a
  // replaced image ({topic}.webp reuses its URL) propagates on the next view
  // instead of being pinned forever.
  if (isImage(url)) {
    event.respondWith(
      caches.open(IMG_CACHE).then(cache =>
        cache.match(event.request).then(cached => {
          const network = fetch(event.request).then(response => {
            if (response && response.status === 200)
              cache.put(event.request, response.clone());
            return response;
          }).catch(() => cached);
          return cached || network;
        })
      )
    );
    return;
  }

  // Network-first: always fetch fresh JS/CSS/JSON/HTML when online. `cache:
  // 'no-cache'` forces the browser to revalidate with the server (a cheap
  // conditional request → 304 when unchanged, fresh 200 when changed) instead of
  // serving a possibly-stale copy from the HTTP cache. This closes the last
  // staleness window so a deploy is visible on the next navigation — the user
  // never needs a manual/hard refresh. Falls back to the SW cache when offline.
  event.respondWith(
    fetch(event.request, { cache: 'no-cache' })
      .then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(APP_CACHE).then(cache =>
            cache.put(event.request, clone).then(() => trimCache(cache, APP_CACHE_MAX)));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request)
          .then(cached => cached || caches.match('./index.html'))
      )
  );
});
