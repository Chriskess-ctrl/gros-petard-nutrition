const CACHE = 'gp-nutrition-prototype-neon-v7';
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
  './manifest.webmanifest', './library-picker.js', './reminders.js', '../icon-192.png', '../icon-512.png',
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
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) return cached;
      // A Vercel share link or a campaign link can carry a query string.
      if (request.mode === 'navigate' && url.href.startsWith(self.registration.scope)) {
        return (await cache.match(ENTRY)) || Response.error();
      }
      return Response.error();
    }
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const destination = new URL('./index.html', self.registration.scope).href;
  event.waitUntil((async () => {
    const clientsList = await clients.matchAll({type:'window',includeUncontrolled:true});
    const existing = clientsList.find(client => client.url.startsWith(self.registration.scope));
    if(existing){await existing.focus();return;}
    await clients.openWindow(destination);
  })());
});
self.addEventListener('push', event => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); } catch { return; }
  if (!payload || typeof payload !== 'object') return;
  const body = typeof payload.body === 'string' ? payload.body.slice(0, 240) : 'Ton rappel est arrivé.';
  const tag = typeof payload.tag === 'string' && /^[a-z0-9-]{1,32}$/.test(payload.tag) ? payload.tag : 'gp-reminder';
  const icon = new URL('../icon-192.png', self.registration.scope).href;
  event.waitUntil(self.registration.showNotification('GROS PÉTARD — Nutrition', {
    body, icon, tag, renotify: tag === 'gp-test',
  }));
});
