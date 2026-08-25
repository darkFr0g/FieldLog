/* Cipher — service worker
   - App shell (HTML/CSS/JS/manifest/icons): network-first, cache fallback,
     so deploys go live when online but the app still opens offline.
   - Tesseract.js OCR assets (jsdelivr CDN + tessdata): cache-first runtime
     cache, so after the first successful OCR the reader works offline too.
   Bump CACHE_VERSION to evict everything on next load.
*/
var CACHE_VERSION = 'cipher-v1';
var SHELL_CACHE = CACHE_VERSION + '-shell';
var OCR_CACHE = CACHE_VERSION + '-ocr';

var SHELL_ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(function (c) { return c.addAll(SHELL_ASSETS); })
      .then(function () { return self.skipWaiting(); })
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

function isOCRAsset(url) {
  return url.indexOf('cdn.jsdelivr.net') !== -1 ||
         url.indexOf('tessdata.projectnaptha.com') !== -1 ||
         url.indexOf('unpkg.com') !== -1;
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = req.url;

  // OCR engine + language data — cache-first, populate on first online use.
  if (isOCRAsset(url)) {
    event.respondWith(
      caches.open(OCR_CACHE).then(function (cache) {
        return cache.match(req).then(function (hit) {
          if (hit) return hit;
          return fetch(req).then(function (res) {
            if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
            return res;
          });
        });
      })
    );
    return;
  }

  // Only manage our own origin beyond this point.
  if (new URL(url).origin !== self.location.origin) return;

  // App shell — network-first, fall back to cache offline.
  event.respondWith(
    fetch(req).then(function (res) {
      var copy = res.clone();
      caches.open(SHELL_CACHE).then(function (c) { c.put(req, copy); });
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) {
        if (hit) return hit;
        if (req.mode === 'navigate') return caches.match('./index.html');
        return undefined;
      });
    })
  );
});
