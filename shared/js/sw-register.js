/* Service Worker registration with auto-reload on update */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('../../service-worker.js')
    .then(reg => {
      // When a new SW installs (update detected), activate it immediately
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          // New SW is fully installed and took over — reload to get fresh files
          if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
            window.location.reload();
          }
        });
      });
    });

  // Also reload if the controlling SW changes while the page is open
  // (handles the skipWaiting + clients.claim case)
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}
