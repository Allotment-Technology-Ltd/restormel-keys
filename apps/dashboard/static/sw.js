/**
 * Legacy service worker cleanup. Older deployments or browser installs may poll GET /sw.js.
 * This script unregisters itself so stale workers stop intercepting navigation.
 */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    self.registration.unregister().then(() => self.clients.claim())
  );
});
