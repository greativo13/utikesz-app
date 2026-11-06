/* global __FILES__ */
// Offline cache for the standalone Útikész app. The build fills in the
// version and the file list (see offlineServiceWorker in vite.config.ts).
const CACHE = "utikesz-7acff90b59d5";
const FILES = ["./","apple-touch-icon-szervezo.png","apple-touch-icon.png","assets/Figtree-Bold-CnuFHRRE.ttf","assets/Figtree-Regular-VtLqxhSM.ttf","assets/Figtree-SemiBold-B0xMtDcJ.ttf","assets/SourceSerif4-Regular-IpLKW43r.ttf","assets/brand-CtT3zZe2.png","assets/bricolage-grotesque-latin-ext-wght-normal-CcLUaPy7.woff2","assets/bricolage-grotesque-latin-wght-normal-DLoelf7F.woff2","assets/bricolage-grotesque-vietnamese-wght-normal-BUzh504Q.woff2","assets/figtree-latin-ext-wght-normal-DCwSJGxG.woff2","assets/figtree-latin-wght-normal-D_ZTVpCC.woff2","assets/globals-Cc92rji0.js","assets/globals-DBTIyDB0.css","assets/index-DBBLomc8.css","assets/index-DoKqRAju.js","assets/leaflet-src-CHWrX12r.js","assets/pdf-IO7OHP6n.js","assets/pdf.worker.min-BSO9jRIL.js","assets/pdf.worker.min-rsCePomN.mjs","assets/szervezo-1H_m7tjN.js","assets/szervezo-yHV7zitB.css","icon-192.png","icon-512.png","icon-szervezo-192.png","icon-szervezo-512.png","icon-szervezo.svg","icon.svg","index.html","manifest-szervezo.webmanifest","manifest.webmanifest","szervezo.html","utikesz-utmutato.pdf"];

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
        // Each entry point needs its own offline page. Drop tracking/query
        // parameters, and resolve the scope root to the client entry point.
        const pageUrl = new URL(request.url);
        pageUrl.search = "";
        pageUrl.hash = "";
        if (pageUrl.pathname === new URL(self.registration.scope).pathname)
          pageUrl.pathname += "index.html";
        const cached = await cache.match(pageUrl.href);
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
