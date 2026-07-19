/* sw.js - Custom Service Worker for NexEagle CMS */

const CACHE_NAME = 'nexeagle-cms-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/Logo.png',
  '/favicon.ico',
];

// Install Service Worker and cache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate Service Worker and clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event interceptor
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Skip intercepting API calls (we handle API requests via app layer caching)
  if (requestUrl.pathname.includes('/api/')) {
    return;
  }

  // HTML Page Navigation: Network-First, Cache Fallback
  if (event.request.mode === 'navigate' || (event.request.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Save a copy in cache
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => {
          // If offline, serve from cache
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            return caches.match('/index.html'); // SPA fallback
          });
        })
    );
    return;
  }

  // Static Assets (JS, CSS, Images): Cache-First, Network Fallback
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch in background to update cache (stale-while-revalidate style)
        fetch(event.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => { /* ignore background sync fail */ });
        
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const clone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return networkResponse;
      });
    })
  );
});
