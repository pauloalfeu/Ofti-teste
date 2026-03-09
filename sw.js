/* ════════════════════════════════════════
   OptiAgenda — Service Worker
   Configurado para: pauloalfeu.github.io/Ofti-teste/
════════════════════════════════════════ */

const CACHE_NAME = 'optiagenda-v2';
const BASE = '/Ofti-teste';
const OFFLINE_URL = BASE + '/offline.html';

const PRECACHE_URLS = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/offline.html',
  BASE + '/manifest.json',
  BASE + '/icon-192.png',
  BASE + '/icon-512.png',
];

// ── INSTALL ──────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll([OFFLINE_URL]).catch(() => {});
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ─────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH ─────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // Google Fonts — cache-first
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(request, 'optiagenda-fonts-v2'));
    return;
  }

  // HTML navigation — network-first with offline fallback
  if (request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(networkFirstWithOfflineFallback(request));
    return;
  }

  // Everything else — cache-first
  event.respondWith(cacheFirst(request, CACHE_NAME));
});

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
    const offlinePage = await cache.match(OFFLINE_URL);
    return offlinePage || new Response('<h1>Offline</h1>', { headers: { 'Content-Type': 'text/html' } });
  }
}
