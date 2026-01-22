// sw.js (GitHub Pages project-safe)
const VERSION = "mathgod-ghp-v1.0.0";
const CORE_CACHE = `core-${VERSION}`;
const RUNTIME_CACHE = `runtime-${VERSION}`;

// ✅ 會自動偵測 base path，例如 /mathgod/
const BASE = self.location.pathname.replace(/sw\.js$/, ""); // "/mathgod/" 或 "/mathgod/sub/"
const INDEX = BASE + "index.html";
const MANIFEST = BASE + "manifest.webmanifest";

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CORE_CACHE);

    // ✅ 逐個 cache，避免 addAll 因單一失敗令 install 死
    for (const url of [BASE, INDEX, MANIFEST]) {
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

  // ✅ 導航請求：network-first；離線 fallback 到 cache 的 index.html
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);

        // keep index fresh
        const cache = await caches.open(CORE_CACHE);
        cache.put(INDEX, fresh.clone());

        return fresh;
      } catch {
        const cache = await caches.open(CORE_CACHE);
        return (await cache.match(INDEX)) || (await cache.match(BASE)) || Response.error();
      }
    })());
    return;
  }

  const url = new URL(req.url);
  const isStaticLike =
    ["script", "style", "font", "image"].includes(req.destination) ||
    url.origin !== self.location.origin;

  if (isStaticLike) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

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
