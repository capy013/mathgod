
const VERSION = "mathgod-v1.0.0";
const APP_SHELL_CACHE = `app-shell-${VERSION}`;
const RUNTIME_CACHE = `runtime-${VERSION}`;


const APP_SHELL = [
  "./",                
  "./index.html",      
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


self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);


  if (req.method !== "GET") return;


  if (req.mode === "navigate" || req.destination === "document") {
    event.respondWith(networkFirst(req, APP_SHELL_CACHE));
    return;
  }


  if (
    req.destination === "script" ||
    req.destination === "style" ||
    req.destination === "image" ||
    url.origin !== self.location.origin 
  ) {
    event.respondWith(staleWhileRevalidate(req, RUNTIME_CACHE));
    return;
  }


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
