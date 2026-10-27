/* global __FILES__ */
// Offline cache for the standalone Útikész app. The build fills in the
// version and the file list (see offlineServiceWorker in vite.config.ts).
const CACHE = "utikesz-2cc2df5bcc83";
const FILES = ["./","apple-touch-icon.png","assets/bricolage-grotesque-latin-ext-wght-normal-CcLUaPy7.woff2","assets/bricolage-grotesque-latin-wght-normal-DLoelf7F.woff2","assets/bricolage-grotesque-vietnamese-wght-normal-BUzh504Q.woff2","assets/figtree-latin-ext-wght-normal-DCwSJGxG.woff2","assets/figtree-latin-wght-normal-D_ZTVpCC.woff2","assets/index-BZG_7KMv.css","assets/index-DQxlbuqa.js","assets/leaflet-src-DztTpKbL.js","icon-192.png","icon-512.png","icon.svg","manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // Fresh copies only: a page the browser cached a few minutes ago
      // could point to files of an older version.
      .then((cache) =>
        cache.addAll(FILES.map((file) => new Request(file, { cache: "reload" }))),
      )
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
            .filter(
              (key) =>
                key.startsWith("utikesz-") && key !== CACHE && key !== TILES,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Map tiles seen once stay for offline use (at most this many).
const TILES = "utikesz-tiles";
const MAX_TILES = 1500;
async function tile(request) {
  const cache = await caches.open(TILES);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    const keys = await cache.keys();
    for (const old of keys.slice(0, Math.max(0, keys.length - MAX_TILES)))
      await cache.delete(old);
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (
    request.method === "GET" &&
    new URL(request.url).hostname === "tile.openstreetmap.org"
  ) {
    event.respondWith(tile(request));
    return;
  }
  if (
    request.method !== "GET" ||
    new URL(request.url).origin !== location.origin
  )
    return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      // Opening the app: the newest page when the network answers quickly,
      // else the cached one, so it starts without internet too.
      if (request.mode === "navigate") {
        const cached =
          (await cache.match("./")) || (await cache.match("./index.html"));
        try {
          const fresh = await Promise.race([
            fetch(request, { cache: "no-cache" }),
            new Promise((_, reject) => setTimeout(reject, cached ? 3000 : 15000)),
          ]);
          if (fresh.ok) return fresh;
        } catch {}
        return cached || fetch(request);
      }
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })(),
  );
});
