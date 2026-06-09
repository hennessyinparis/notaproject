const CACHE = 'nota-offline-v2';
const TRACK_DATA_CACHE = 'nota-track-data-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'CACHE_TRACK' && data.url) {
    event.waitUntil(
      caches.open(CACHE).then((cache) => cache.add(data.url).catch(() => undefined))
    );
  }
  if (data.type === 'CACHE_TRACK_DATA' && data.url) {
    event.waitUntil(
      fetch(data.url).then((res) => {
        if (res.ok) {
          caches.open(TRACK_DATA_CACHE).then((cache) => cache.put(data.url, res));
        }
      }).catch(() => undefined)
    );
  }
  if (data.type === 'UNCACHE_TRACK' && data.url) {
    event.waitUntil(
      caches.open(CACHE).then((cache) => cache.delete(data.url))
    );
  }
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  if (url.includes('/api/tracks/') && url.includes('/stream')) {
    event.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(event.request).then((cached) => cached || fetch(event.request).then((res) => {
          if (res.ok) cache.put(event.request, res.clone());
          return res;
        }))
      )
    );
    return;
  }

  if (/\/api\/tracks\/\d+$/.test(url) && event.request.method === 'GET') {
    event.respondWith(
      caches.open(TRACK_DATA_CACHE).then((cache) =>
        cache.match(event.request).then((cached) => {
          const fetched = fetch(event.request).then((res) => {
            if (res.ok) cache.put(event.request, res.clone());
            return res;
          });
          return cached || fetched;
        })
      )
    );
  }
});