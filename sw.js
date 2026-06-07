/* Field Log — service worker
   Strategy:
   - App shell (HTML/CSS/JS/manifest): network-first, fall back to cache when offline.
     => your deploys go live as soon as the device is online, but the app still
        opens with no signal in the field.
   - Static heavy assets (vendored xlsx, icons): cache-first.
   - Google Fonts: cache-first runtime cache (degrades to system fonts if never cached).
   Bump CACHE_VERSION to force-evict everything on the next load.
*/
var CACHE_VERSION = 'fieldlog-v1';
var SHELL_CACHE   = CACHE_VERSION + '-shell';
var STATIC_CACHE  = CACHE_VERSION + '-static';
var FONT_CACHE    = CACHE_VERSION + '-fonts';

// Paths are relative to this file's location (…/FieldLog/), so they work
// correctly on a GitHub Pages project subpath.
var SHELL_ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './manifest.json'
];
var STATIC_ASSETS = [
  './vendor/xlsx.full.min.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    Promise.all([
      caches.open(SHELL_CACHE).then(function (c) { return c.addAll(SHELL_ASSETS); }),
      caches.open(STATIC_CACHE).then(function (c) { return c.addAll(STATIC_ASSETS); })
    ]).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k.indexOf(CACHE_VERSION) !== 0) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

function isFontRequest(url) {
  return url.indexOf('fonts.googleapis.com') !== -1 ||
         url.indexOf('fonts.gstatic.com') !== -1;
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = req.url;

  // Google Fonts — cache-first, populate cache on first online hit.
  if (isFontRequest(url)) {
    event.respondWith(
      caches.open(FONT_CACHE).then(function (cache) {
        return cache.match(req).then(function (hit) {
          if (hit) return hit;
          return fetch(req).then(function (res) {
            if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
            return res;
          }).catch(function () { return hit; });
        });
      })
    );
    return;
  }

  // Only manage our own origin beyond this point.
  if (new URL(url).origin !== self.location.origin) return;

  // Static heavy assets — cache-first.
  var isStatic = STATIC_ASSETS.some(function (p) {
    return url.indexOf(p.replace('./', '')) !== -1;
  });
  if (isStatic) {
    event.respondWith(
      caches.match(req).then(function (hit) {
        return hit || fetch(req).then(function (res) {
          var copy = res.clone();
          caches.open(STATIC_CACHE).then(function (c) { c.put(req, copy); });
          return res;
        });
      })
    );
    return;
  }

  // App shell + navigations — network-first, fall back to cache offline.
  event.respondWith(
    fetch(req).then(function (res) {
      var copy = res.clone();
      caches.open(SHELL_CACHE).then(function (c) { c.put(req, copy); });
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) {
        if (hit) return hit;
        // For navigations, fall back to the cached app shell.
        if (req.mode === 'navigate') return caches.match('./index.html');
        return undefined;
      });
    })
  );
});
