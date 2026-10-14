// The phone web app's offline copy (src/lib/offline.js registers it): the
// page and its files, kept as they're fetched. The page is fetched fresh when
// online, so a new release shows the next time it opens, and comes from the
// copy when not. Nothing of yours is in here: your data is in the browser's
// own storage (and the encrypted OneDrive sync file), not in these files.
const CACHE = 'layers-app-v1';
const SHELL = ['./', './index.html', './manifest.json', './icon.svg', './apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).catch(() => {}));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    // Only the page itself is kept: a "not found" or error page saved in its
    // place was what showed offline (audit 2026-10-14).
    event.respondWith(fetch(request)
      .then(response => { if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put('./index.html', copy)); } return response; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(request).then(hit => hit || fetch(request).then(response => {
    if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(request, copy)); }
    return response;
  })));
});
