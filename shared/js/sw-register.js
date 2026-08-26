/* Service Worker registration with fully automatic updates.

   Goal: a deploy reaches every user with no manual reload or cache clear.
   How it works together with service-worker.js (skipWaiting + clients.claim):
     1. Every page load re-checks service-worker.js for a new version.
        `updateViaCache: 'none'` forces that check to bypass the HTTP cache, so
        a new SW is detected on the very next navigation instead of up to 24h
        later.
     2. A new SW installs, calls skipWaiting(), activates (purging stale caches),
        and claims the open page.
     3. controllerchange fires and we reload ONCE so the page re-renders through
        the new SW with fresh content. The guard below avoids reloading on the
        first-ever visit (when there was no previous controller, nothing is
        stale to refresh).
     4. Returning to a long-open tab triggers an extra update() check, so users
        who leave the app open still pick up deploys when they come back.
*/
// Dev hosts: never run the SW. On localhost the SW's image cache (and its
// stale-while-revalidate delay) hides fresh local changes on a normal reload,
// forcing hard-resets / DevTools cache tricks. So on localhost we UNREGISTER any
// existing SW and never register — with no SW its caches are no longer served, so a
// plain reload shows the current files from disk. We do NOT delete Cache API entries:
// that would nuke the transformers-cache (Kokoro/Whisper models, ~130 MB) and force a
// re-download on every page. Production (GitHub Pages) is unaffected: it registers
// below and keeps offline + performance caching.
const _isDevHost = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(location.hostname);

if ('serviceWorker' in navigator && _isDevHost) {
  // Force the browser to re-fetch service-worker.js: the new SW detects localhost and
  // self-destructs (unregister + reload). update() is what actually dislodges an already-
  // active SW that a plain unregister() can't remove while it still controls the page.
  navigator.serviceWorker.getRegistrations()
    .then(regs => { if (regs.length) regs.forEach(r => r.update().catch(() => {})); })
    .catch(() => {});
}

if ('serviceWorker' in navigator && !_isDevHost) {
  // Only auto-reload when a controller already existed on load — i.e. a real
  // update, not the first install.
  const hadController = !!navigator.serviceWorker.controller;
  let refreshing = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  navigator.serviceWorker.register('../../service-worker.js', { updateViaCache: 'none' })
    .then(reg => {
      // Belt-and-suspenders: some browsers activate without firing
      // controllerchange for the current page — reload on activation too.
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'activated' && hadController && !refreshing) {
            refreshing = true;
            window.location.reload();
          }
        });
      });

      // Check for a new SW when the user returns to a tab that stayed open.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    })
    .catch(() => {});
}
