/* global __FILES__, __PAGES__ */
// Offline cache for the standalone Útikész app. The build fills in the
// version and the file list (see offlineServiceWorker in vite.config.ts).
const CACHE = "utikesz-10dc788869d3";
const FILES = ["./","apple-touch-icon-utikesz.png","assets/SourceSerif4-Regular-IpLKW43r.ttf","assets/brand--MRyjKZ8.css","assets/brand-BqAecsio.js","assets/brand-logo-BQsKz8LV.png","assets/figtree-latin-ext-wght-normal-DCwSJGxG.woff2","assets/figtree-latin-wght-normal-D_ZTVpCC.woff2","assets/index-CuHElmtS.css","assets/index-n3QseNIs.js","assets/jsx-runtime-BFL8nrA6.js","assets/leaflet-src-Dzs1SUxv.js","assets/pdf-Ddl2ZVIk.js","assets/pdf.worker.min-Cv1U6N_d.js","assets/pdf.worker.min-rsCePomN.mjs","brand-logo.png","icon-192.png","icon-512.png","icon.svg","index.html","manifest.webmanifest"];
// The other pages (offer studio, website, workshop) and their files. They
// are not downloaded with the phone app, only once someone opens them.
const PAGES = {"szervezo.html":["apple-touch-icon-szervezo.png","assets/Figtree-Bold-CnuFHRRE.ttf","assets/Figtree-Regular-VtLqxhSM.ttf","assets/Figtree-SemiBold-B0xMtDcJ.ttf","assets/brand-Bzz4veXy.png","assets/studio-Df5S-x1N.js","assets/studio-yHV7zitB.css","assets/szervezo-Bog6WOXi.js","icon-szervezo-192.png","icon-szervezo-512.png","icon-szervezo.svg","manifest-szervezo.webmanifest"],"honlap.html":["assets/honlap-CNcpct4E.css","assets/honlap-sYArSfUV.js","assets/site-model-BpX5QFIU.js","site-Figtree-Regular.ttf","site-Figtree-SemiBold.ttf","site-SourceSerif4-Regular.ttf","site-app-packing.jpg","site-app-places.jpg","site-hero-athens.webp","site-hero-cafe.webp","site-krakko-cover.webp","site-krakko-preview-programs.webp","site-krakko-preview-sights.webp","site-utikesz-logo.png","site.css"],"muhely.html":["assets/Figtree-Bold-CnuFHRRE.ttf","assets/Figtree-Regular-VtLqxhSM.ttf","assets/Figtree-SemiBold-B0xMtDcJ.ttf","assets/brand-Bzz4veXy.png","assets/muhely-Bq9rW21Z.css","assets/muhely-DKqqlExp.js","assets/site-model-BpX5QFIU.js","assets/studio-Df5S-x1N.js","assets/studio-yHV7zitB.css"]};

// Saves a page and its files for offline use; a failed file is skipped.
async function keepPage(name) {
  const files = PAGES[name];
  if (!files) return;
  const cache = await caches.open(CACHE);
  for (const file of [name, ...files]) {
    const url = new URL(file, self.registration.scope).href;
    try {
      if (await cache.match(url)) continue;
      const response = await fetch(new Request(url, { cache: "reload" }));
      if (response.ok) await cache.put(url, response);
    } catch {}
  }
}
// Pages this phone already kept in an older version stay available.
async function keptPages() {
  const names = [];
  for (const key of await caches.keys()) {
    if (!key.startsWith("utikesz-") || key === CACHE || key === TILES) continue;
    const old = await caches.open(key);
    for (const name of Object.keys(PAGES))
      if (
        !names.includes(name) &&
        (await old.match(new URL(name, self.registration.scope).href))
      )
        names.push(name);
  }
  return names;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // Fresh copies only: a page the browser cached a few minutes ago
      // could point to files of an older version.
      .then((cache) =>
        cache.addAll(FILES.map((file) => new Request(file, { cache: "reload" }))),
      )
      .then(async () => {
        try {
          for (const name of await keptPages()) await keepPage(name);
        } catch {}
      })
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
          if (fresh.ok) {
            const name = pageUrl.pathname.split("/").pop();
            if (PAGES[name] && event.waitUntil) event.waitUntil(keepPage(name));
            return fresh;
          }
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

