// Минимальный service worker — нужен для установки PWA (критерий installability).
// Намеренно НЕ кешируем HTML, чтобы не отдавать устаревшие сборки после деплоя.
const STATIC = 'condr-static-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    // чистим старые кеши
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== STATIC).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Network-first для статики (иконки/манифест); навигации и API — всегда сеть.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // только статические ассеты, без HTML/API
  if (!/\.(png|jpg|jpeg|webp|svg|ico|woff2?|json)$/i.test(url.pathname)) return;
  if (url.pathname.startsWith('/api/')) return;
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res && res.ok) { const c = await caches.open(STATIC); c.put(req, res.clone()); }
      return res;
    } catch {
      const cached = await caches.match(req);
      if (cached) return cached;
      throw new Error('offline');
    }
  })());
});
