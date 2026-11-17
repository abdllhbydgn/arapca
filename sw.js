// Arapça Öğren — Service Worker
// Siteyi bir kez (internetteyken) açtıktan sonra tüm portal ve veriler internetsiz de çalışır.
// İçerik güncellendiğinde CACHE_NAME sürümünü artırın; tarayıcı eski önbelleği silip yenisini indirir.
const CACHE_NAME = 'arapca-ogren-v29';
const APP_SHELL = [
  './',
  './index.html',
  './assets/app.css?v=29',
  './assets/app.js?v=29',
  './assets/logo.png',
  './assets/legal.js?v=29',
  './assets/logo-ayn.png',
  './assets/portal-logo-seffaf.png',
  './assets/nscs-logo-beyaz.png',
  './data/dict.js?v=29',
  './data/content.js?v=29',
  './data/ortak.js?v=29',
  './assets/fb-config.js?v=29',
  './assets/members.js?v=29',
  './manifest.json',
  './icon-192.png',
  './favicon.png',
  './favicon-32.png',
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

// Sayfa ve veriler: önce ağ, her seferinde sunucuya sorulur (no-cache) — güncellemeler beklemeden gelir.
// Ses dosyaları: adları içeriklerine göre olduğu için önce önbellek (hızlı ve internetsiz).
// Pages and data: network first, always revalidated (no-cache). Audio clips: cache first (content-addressed names).
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !isFont) return;
  const put = (res) => {
    if (res && (res.ok || res.type === 'opaque')) {
      const copy = res.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
    }
    return res;
  };
  if (sameOrigin && /\/audio\/[^/]+\.mp3$/.test(url.pathname)) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then(put)));
    return;
  }
  event.respondWith(
    fetch(sameOrigin ? new Request(req, { cache: 'no-cache' }) : req)
      .then(put)
      .catch(() => caches.match(req, { ignoreSearch: !sameOrigin }).then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});
