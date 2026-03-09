/* ════════════════════════════════════════
   OptiAgenda — Service Worker
   Strategy: Cache-first for static assets,
   Network-first for navigation / data
════════════════════════════════════════ */

const CACHE_NAME = 'optiagenda-v1';
const OFFLINE_URL = 'offline.html';

// Assets to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  // External fonts — cached on first fetch
];

// ── INSTALL: pre-cache shell ──────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache offline page and icons; ignore failures for external resources
      return cache.addAll([OFFLINE_URL]).catch(() => {});
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: clean old caches ────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: smart strategy ─────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin requests (except Google Fonts)
  if (request.method !== 'GET') return;

  // Google Fonts — cache-first
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(request, 'optiagenda-fonts-v1'));
    return;
  }

  // Same-origin HTML (navigation) — network-first with offline fallback
  if (request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(networkFirstWithOfflineFallback(request));
    return;
  }

  // Everything else (JS, CSS, images) — cache-first
  event.respondWith(cacheFirst(request, CACHE_NAME));
});

/* ── Strategies ── */

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return new Response('Recurso não disponível offline.', { status: 503 });
  }
}

async function networkFirstWithOfflineFallback(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    // Serve offline page
    const offlinePage = await cache.match(OFFLINE_URL);
    return offlinePage || new Response('<h1>Offline</h1>', { headers: { 'Content-Type': 'text/html' } });
  }
}
