/* global __FILES__ */
// Offline cache for the standalone Útikész app. The build fills in the
// version and the file list (see offlineServiceWorker in vite.config.ts).
const CACHE = "utikesz-c8a748e6726d";
const FILES = ["./","apple-touch-icon-szervezo.png","apple-touch-icon-utikesz-24cedddb5799.png","apple-touch-icon-utikesz-49a2801fb332.png","apple-touch-icon-utikesz-vilagos.png","apple-touch-icon.png","assets/Figtree-Bold-CnuFHRRE.ttf","assets/Figtree-Regular-VtLqxhSM.ttf","assets/Figtree-SemiBold-B0xMtDcJ.ttf","assets/SourceSerif4-Regular-IpLKW43r.ttf","assets/brand-CvAZBwuV.css","assets/brand-DmaeF7aF.js","assets/brand-logo-Bzz4veXy.png","assets/figtree-latin-ext-wght-normal-DCwSJGxG.woff2","assets/figtree-latin-wght-normal-D_ZTVpCC.woff2","assets/honlap-BZ-z_JUU.js","assets/honlap-CNcpct4E.css","assets/index-DBBLomc8.css","assets/index-DxVNzmil.js","assets/jsx-runtime-BFL8nrA6.js","assets/leaflet-src-Dzs1SUxv.js","assets/muhely-CueAbODS.js","assets/muhely-KNBwx_YS.css","assets/pdf-Bmm6cclP.js","assets/pdf.worker.min-Cv1U6N_d.js","assets/pdf.worker.min-rsCePomN.mjs","assets/site-model-71Zw8grr.js","assets/studio-DnubE1mw.js","assets/studio-yHV7zitB.css","assets/szervezo-D74zlpX-.js","brand-logo.png","honlap.html","icon-192.png","icon-512.png","icon-szervezo-192.png","icon-szervezo-512.png","icon-szervezo.svg","icon.svg","index.html","manifest-szervezo.webmanifest","manifest.webmanifest","muhely.html","site-Figtree-Regular.ttf","site-Figtree-SemiBold.ttf","site-SourceSerif4-Regular.ttf","site-app-packing.jpg","site-app-places.jpg","site-hero-athens.png","site-hero-cafe.png","site-krakko-cover.webp","site-krakko-preview-programs.webp","site-krakko-preview-sights.webp","site-utikesz-krakko-karacsony-betekinto.pdf","site-utikesz-logo-short-u.png","site.css","szervezo.html","utikesz-utmutato.pdf"];

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

