var CACHE = 'cuza-pages-v3';

self.addEventListener('install', function (event) {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (k) {
            return k !== CACHE;
          })
          .map(function (k) {
            return caches.delete(k);
          }),
      );
    }),
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  event.respondWith(networkFirst(event.request));
});

async function networkFirst(request) {
  try {
    var response = await fetch(request);
    if (response && response.ok) {
      var cache = await caches.open(CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (_e) {
    return caches.match(request);
  }
}