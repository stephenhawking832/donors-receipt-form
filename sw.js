const CACHE_NAME = 'donation-receipt-cache-v2';
const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/index.tsx',
    '/App.tsx',
    '/types.ts',
    '/components/FormField.tsx',
    '/components/ReceiptPreview.tsx',
    '/components/ReceiptHistory.tsx',
    '/config.json'
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
            
            const responseToCache = networkResponse.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                // We only cache external GET requests, not local files again.
                if (event.request.method === 'GET' && (event.request.url.startsWith('https://') || event.request.url.endsWith('.json'))) {
                    cache.put(event.request, responseToCache);
                }
              });

            return networkResponse;
          }
        ).catch(error => {
            console.log('Fetch failed; returning offline page instead.', error);
            // Optional: return a fallback offline page if the request fails
        });
      })
    );
});