/* 入校輔導紀錄｜Service Worker：預快取介面、套表程式與 Word 樣板。紀錄存於 IndexedDB，不受快取更新影響。 */
const VERSION = 'v0.3.0';
const CACHE = 'school-visit-' + VERSION;
const ASSETS = ['./', 'index.html', 'styles.css', 'app.js', 'store.js', 'docx-fill.js', 'vendor/jszip.min.js', 'template.docx',
  'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, {cache: 'reload'})))));
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('school-visit-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', async e => {
  if (!e.data) return;
  if (e.data.type === 'skipWaiting') self.skipWaiting();
  if (e.data.type === 'status' && e.ports[0]) {
    const c = await caches.open(CACHE);
    const missing = [];
    for (const u of ASSETS) { if (!(await c.match(u))) missing.push(u); }
    e.ports[0].postMessage({ version: VERSION, missing });
  }
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(req, { ignoreSearch: true }) || (req.mode === 'navigate' ? await c.match('index.html') : null);
    if (hit) return hit;
    try { return await fetch(req); } catch (err) { return new Response('離線中，且此檔案尚未快取。', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }); }
  })());
});
