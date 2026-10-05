// Arapça Öğren — Service Worker
// Siteyi bir kez (internetteyken) açtıktan sonra tüm portal ve veriler internetsiz de çalışır.
// İçerik güncellendiğinde CACHE_NAME sürümünü artırın; tarayıcı eski önbelleği silip yenisini indirir.
const CACHE_NAME = 'arapca-ogren-v6';
const APP_SHELL = [
  './',
  './index.html',
  './assets/app.css?v=6',
  './assets/app.js?v=6',
  './assets/logo.png',
  './data/dict.js?v=6',
  './data/content.js?v=6',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

// Önce ağ (en güncel sürüm), olmazsa önbellek. Çeviri servisi gibi dış adresler önbelleğe alınmaz.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !isFont) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: !sameOrigin }).then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});
