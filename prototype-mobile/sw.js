const CACHE = 'gp-nutrition-prototype-neon-v5';
const ENTRY = './index.html';
const ART = [
  'welcome', 'crown', 'charms', 'flourish-left', 'flourish-right',
  'potion', 'weights', 'quill',
  'meal-breakfast', 'meal-snack-am', 'meal-lunch', 'meal-snack-pm', 'meal-dinner',
  'journal-breakfast', 'journal-snack-am', 'journal-lunch', 'journal-snack-pm', 'journal-dinner',
  'editor-crest', 'editor-footer', 'editor-rule', 'editor-rune', 'editor-rail-left', 'editor-rail-right',
  'nav-hat', 'nav-grimoire', 'nav-cauldron', 'nav-hourglass', 'nav-crystals',
];
const ASSETS = [
  ENTRY, './style.css', './neon.css', './editor.css', './app.js', './suivi.js',
  './manifest.webmanifest', '../icon-192.png', '../icon-512.png',
  ...ART.map(name => './assets/' + name + '.webp'),
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS.map(url => new Request(url, {cache: 'reload'})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith('gp-nutrition-prototype-') && key !== CACHE)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const {request} = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    try {
      return await fetch(request);
    } catch {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      // A Vercel share link or a campaign link can carry a query string.
      if (request.mode === 'navigate' && url.href.startsWith(self.registration.scope)) {
        return (await cache.match(ENTRY)) || Response.error();
      }
      return Response.error();
    }
  })());
});
