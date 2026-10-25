// RUSHBLADE service worker (M12 Task 6): saves the built game on install, answers from the saved copy first, and tells
// the page when a newer version is waiting. It never takes over a running game: the new version starts on the next launch.
const PREFIX = 'rushblade-';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const list = await (await fetch('./precache.json', { cache: 'no-store' })).json();
    const cache = await caches.open(PREFIX + list.version);
    await cache.addAll(list.files.map((f) => new Request(f, { cache: 'reload' })));
    // Tell open pages that a new version is ready (only when an older one is already in charge).
    if (self.registration.active) for (const c of await self.clients.matchAll()) c.postMessage({ type: 'update-ready', version: list.version });
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Older saved copies go, but only when this version's list can be read (offline, keep what there is).
    let keep = null;
    try { keep = PREFIX + (await (await fetch('./precache.json', { cache: 'no-store' })).json()).version; } catch { /* offline */ }
    if (keep) for (const key of await caches.keys()) if (key.startsWith(PREFIX) && key !== keep) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: req.mode === 'navigate' });
    if (hit) return hit;
    try { return await fetch(req); }
    catch (e) {
      if (req.mode === 'navigate') { const index = await caches.match('./index.html') ?? await caches.match('./'); if (index) return index; }
      throw e;
    }
  })());
});
