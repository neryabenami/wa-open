// Keeps the page and the phone-number library on the device so the site opens without internet.
const VERSION = 'wa-open-v4';
const LIB = 'https://cdn.jsdelivr.net/npm/libphonenumber-js@1.13.14/bundle/libphonenumber-max.js';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', './icon-maskable.png', LIB];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(CORE.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const cacheable = sameOrigin || url.href === LIB || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!cacheable) return;

  // Other pages on the site: network first, saved copy as fallback
  const scopePath = new URL(self.registration.scope).pathname;
  const isHome = url.pathname === scopePath || url.pathname === scopePath + 'index.html';
  if (req.mode === 'navigate' && !isHome) {
    event.respondWith(fetch(req).catch(() => caches.match(req, { ignoreSearch: true })));
    return;
  }

  // Home page: serve the saved copy at once, refresh it in the background
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.open(VERSION).then(async (cache) => {
        const cached = await cache.match('./index.html');
        const fresh = fetch(req, { cache: 'no-cache' }).then((res) => {
          if (res.ok) cache.put('./index.html', res.clone());
          return res;
        }).catch(() => cached);
        return cached || fresh;
      })
    );
    return;
  }

  // Everything else: cache first, then network
  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(req);
      const fresh = fetch(req).then((res) => {
        if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
        return res;
      }).catch(() => cached);
      return cached || fresh;
    })
  );
});
