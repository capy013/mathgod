// sw.js
const VERSION = "mathgod-v1.0.0";
const APP_SHELL_CACHE = `app-shell-${VERSION}`;
const RUNTIME_CACHE = `runtime-${VERSION}`;

// 你最核心要離線開到嘅檔案（最少要有 html 同 icon）
const APP_SHELL = [
  "./",                // root
  "./index.html",      // 你個主頁檔名；如果你叫 mathgod_fixed.html 就改返
  "./manifest.webmanifest",
  "https://gcdnb.pbrd.co/images/WfgYQo77g3a6.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.map((k) => {
        if (![APP_SHELL_CACHE, RUNTIME_CACHE].includes(k)) return caches.delete(k);
      })
    );
    await self.clients.claim();
  })());
});

// 策略：
// - 對「HTML / root」：Network-first（有網用最新，冇網用 cache）
// - 對「JS/CSS/CDN/圖片」：Stale-while-revalidate（先用 cache，背景更新）
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 只處理 GET
  if (req.method !== "GET") return;

  // HTML / 導航請求：Network-first
  if (req.mode === "navigate" || req.destination === "document") {
    event.respondWith(networkFirst(req, APP_SHELL_CACHE));
    return;
  }

  // CDN / 靜態資源：Stale-while-revalidate
  if (
    req.destination === "script" ||
    req.destination === "style" ||
    req.destination === "image" ||
    url.origin !== self.location.origin // 跨域 CDN
  ) {
    event.respondWith(staleWhileRevalidate(req, RUNTIME_CACHE));
    return;
  }

  // 其他：cache-first
  event.respondWith(cacheFirst(req, RUNTIME_CACHE));
});

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(req);
    cache.put(req, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(req);
    return cached || caches.match("./index.html");
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);

  const fetchPromise = fetch(req).then((fresh) => {
    cache.put(req, fresh.clone());
    return fresh;
  }).catch(() => cached);

  return cached || fetchPromise;
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  const fresh = await fetch(req);
  cache.put(req, fresh.clone());
  return fresh;
}
