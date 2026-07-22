var CACHE = 'cuza-pages-v3';

self.addEventListener('install', function (_event) {
  self.skipWaiting();
});

self.addEventListener('activate', function (_event) {
  _event.waitUntil(
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

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(networkFirst(e.request));
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
