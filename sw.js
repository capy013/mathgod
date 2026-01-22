// sw.js (robust offline for CDN-heavy single-page index.html)
const VERSION = "mathgod-v1.2.0";
const CORE_CACHE = `core-${VERSION}`;
const RUNTIME_CACHE = `runtime-${VERSION}`;

// ✅ 只 cache 本域必要檔案，避免 install 因 404/跨域資源而 fail
const CORE_ASSETS = [
  "/",                       // 重要：支援從「已安裝」入口打開
  "/index.html",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CORE_CACHE);

    // ✅ 保險做法：逐個加，唔會因為某個檔出事就整個 SW 裝唔到
    for (const url of CORE_ASSETS) {
      try { await cache.add(url); } catch (_) {}
    }

    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => {
      if (![CORE_CACHE, RUNTIME_CACHE].includes(k)) return caches.delete(k);
    }));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // ✅ 1) 導航（打開 App / reload）：network-first，離線 fallback index.html
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);

        // 更新 core cache：保持 index.html 最新
        const cache = await caches.open(CORE_CACHE);
        cache.put("/index.html", fresh.clone());

        return fresh;
      } catch {
        const cache = await caches.open(CORE_CACHE);
        return (await cache.match("/index.html")) || Response.error();
      }
    })());
    return;
  }

  const url = new URL(req.url);

  // ✅ 2) CDN / script / style / font / image：stale-while-revalidate
  const isStaticLike =
    ["script", "style", "font", "image"].includes(req.destination) ||
    url.origin !== self.location.origin;

  if (isStaticLike) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // ✅ 3) 其他：cache-first
  event.respondWith(cacheFirst(req));
});

async function staleWhileRevalidate(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(req);

  const fetchPromise = fetch(req).then((fresh) => {
    cache.put(req, fresh.clone());
    return fresh;
  }).catch(() => cached);

  return cached || fetchPromise;
}

async function cacheFirst(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;

  const fresh = await fetch(req);
  cache.put(req, fresh.clone());
  return fresh;
}
