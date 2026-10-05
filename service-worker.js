/* Service worker minimal : mise en cache de l'application (hors ligne après la première visite). */
const CACHE = 'atelier-meca-v2';
const ASSETS = [
  './', 'index.html', 'css/style.css', 'manifest.json',
  'js/core.js', 'js/catalog.js', 'js/threads.js', 'js/bore.js', 'js/parts-fasteners.js', 'js/parts-gears.js',
  'js/library.js', 'js/viewer.bundle.js', 'js/app.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
    return res;
  }).catch(() => caches.match('index.html'))));
});
