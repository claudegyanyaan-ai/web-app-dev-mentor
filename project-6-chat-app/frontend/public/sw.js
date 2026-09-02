const CACHE_NAME = "chat-app-cache-v1";
const PRECACHE_URLS = ["/", "/manifest.json", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (url.protocol === "ws:" || url.protocol === "wss:") {
    return;
  }

  const isApiCall = url.port === "8000" || url.hostname.includes("onrender.com");
  if (isApiCall) {
    return; // API calls always go straight to the network
  }

  if (event.request.method !== "GET") {
    return;
  }

  // Network-first: always try to get the latest app shell/JS when online,
  // so new features show up immediately after every deploy. Only fall back
  // to the cache when the network is unavailable (true offline use).
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});