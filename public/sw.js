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

  // Only this site's own GET requests are handled here. Uploads (POST), the API on its own domain,
  // fonts and other sites go straight to the network, so the browser reports their real error.
  if (event.request.method !== 'GET' || requestUrl.origin !== self.location.origin) {
    return;
  }

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
            // SPA fallback; with nothing cached either, a plain "offline" page instead of a browser error.
            return caches.match('/index.html').then((page) => page || offline());
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
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => { /* full or private */ });
        return networkResponse;
      }).catch(() => Response.error()); // the network dropped: fail this one file quietly, not with an uncaught error
    })
  );
});

/** Shown when a page is opened with no connection and nothing cached. */
function offline() {
  return new Response(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title>' +
    '<body style="font-family:system-ui,sans-serif;padding:40px;color:#344054"><h1 style="font-size:20px">You are offline</h1>' +
    '<p>NexEagle CMS could not be reached. Check your connection and reload.</p></body>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}
