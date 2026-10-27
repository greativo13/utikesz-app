/* global __FILES__ */
// Offline cache for the standalone Útikész app. The build fills in the
// version and the file list (see offlineServiceWorker in vite.config.ts).
const CACHE = "utikesz-50f9eac1abeb";
const FILES = ["./","apple-touch-icon.png","assets/bricolage-grotesque-latin-ext-wght-normal-CcLUaPy7.woff2","assets/bricolage-grotesque-latin-wght-normal-DLoelf7F.woff2","assets/bricolage-grotesque-vietnamese-wght-normal-BUzh504Q.woff2","assets/figtree-latin-ext-wght-normal-DCwSJGxG.woff2","assets/figtree-latin-wght-normal-D_ZTVpCC.woff2","assets/index-DwD_tVjB.css","assets/index-XOj33y0T.js","icon-192.png","icon-512.png","icon.svg","manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("utikesz-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (
    request.method !== "GET" ||
    new URL(request.url).origin !== location.origin
  )
    return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      // Opening the app: the cached page, so it starts without internet.
      if (request.mode === "navigate")
        return (
          (await cache.match("./")) ||
          (await cache.match("./index.html")) ||
          fetch(request)
        );
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })(),
  );
});
