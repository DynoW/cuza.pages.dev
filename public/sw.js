var CACHE = 'cuza-pages-v2';

var IMMUTABLE_PATTERNS = [
  /^\/file\//,
  /^\/assets\//,
  /^\/manifest\.webmanifest$/,
  /^\/favicon\.ico$/,
];

self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        await cache.addAll(['/', '/404.html']);
      } catch {}
    })(),
  );
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
  var url = new URL(event.request.url);

  const workerUrl =
    import.meta.env.PUBLIC_WORKER_URL.replace(/\/$/, '') ||
    'https://api.my-lab.ro';

  if (url.origin === workerUrl) {
    return;
  }

  if (
    IMMUTABLE_PATTERNS.some(function (p) {
      return p.test(url.pathname);
    })
  ) {
    event.respondWith(cacheFirst(event.request));
  } else if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request));
  } else {
    event.respondWith(cacheFirst(event.request));
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (
    response &&
    response.ok &&
    (response.type === 'basic' || response.type === 'cors')
  ) {
    const copy = response.clone();
    const cache = await caches.open(CACHE);
    cache.put(request, copy);
  }
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request, { mode: 'same-origin' });
    if (response && response.ok) {
      const copy = response.clone();
      const cache = await caches.open(CACHE);
      cache.put(request, copy);
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || caches.match('/404.html');
  }
}
