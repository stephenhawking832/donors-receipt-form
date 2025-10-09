const CACHE_NAME = 'donation-receipt-cache-v9';
const PRECACHE_URLS = [
    './',
    './index.html',
    './manifest.json',
    './icon-192x192.png',
    './icon-512x512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache and caching precache URLs');
        return cache.addAll(PRECACHE_URLS);
      })
      .catch(err => {
        console.error('Failed to cache during install:', err);
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', event => {
  // Use a cache-first strategy for all assets for performance
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // Not in cache, fetch from network
        return fetch(event.request).then(
          networkResponse => {
            // Check if we received a valid response
            if (!networkResponse || networkResponse.status !== 200 || (networkResponse.type !== 'basic' && networkResponse.type !== 'cors')) {
              return networkResponse;
            }
            
            // We only cache external GET requests that aren't already precached
            const responseToCache = networkResponse.clone();
            if (event.request.method === 'GET' && (event.request.url.startsWith('https://'))) {
                caches.open(CACHE_NAME)
                  .then(cache => {
                      cache.put(event.request, responseToCache);
                  });
            }

            return networkResponse;
          }
        ).catch(error => {
            console.log('Fetch failed; returning offline page instead.', error);
            // Optional: return a fallback offline page if the request fails
        });
      })
    );
});