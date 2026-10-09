// Offline cache. Network first (so updates arrive), cache as backup (so it works offline).
const C = 'aliar-v112';
const FILES = [
  './', 'index.html', 'style.css', 'manifest.webmanifest',
  'icon-192.png', 'icon-512.png', 'icon-maskable-512.png',
  'core.js', 'themes.js', 'settings.js', 'menu.js', 'emmet.js',
  'editor.js', 'preview.js', 'projects.js', 'format.js', 'shortcuts.js',
  'credit.html', 'gun-park.jpg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(C).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== C).map((x) => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((r) => { const copy = r.clone(); caches.open(C).then((c) => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
