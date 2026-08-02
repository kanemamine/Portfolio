/* Service worker : cache hors-ligne.

   Le code (HTML, JS, CSS) est servi *réseau d'abord* : une version en cache ne
   doit jamais pouvoir être mélangée à un HTML plus récent, ce qui casserait le
   démarrage. Seules les images, immuables, sont servies cache d'abord. */

const CACHE = 'business-insider-v3';

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './css/game.css',
  './js/main.js',
  './js/state.js',
  './js/data.js',
  './js/engine.js',
  './js/views.js',
  './js/art.js',
  './js/pano.js',
  './js/ui.js',
  './js/util.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // chaque entrée est mise en cache indépendamment : un fichier manquant
      // ne doit pas faire échouer l'installation entière
      .then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/** Le message permet à la page de forcer la reprise en main immédiate. */
self.addEventListener('message', (e) => {
  if (e.data === 'skip-waiting') self.skipWaiting();
});

const isImage = (url) => /\.(webp|png|jpg|jpeg|svg|gif)$/i.test(url.pathname);

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Images : cache d'abord, elles ne changent pas de contenu à URL constante.
  if (isImage(url)) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }))
    );
    return;
  }

  // Code et documents : réseau d'abord, cache en secours hors-ligne uniquement.
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
  );
});
