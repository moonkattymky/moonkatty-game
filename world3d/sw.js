// Cache-first for the immutable, versioned 3D assets (bundle, GLB, icons); network-first for the HTML.
// Never touches API calls (Supabase) or other paths. Bump VERSION with every build (tools/world3d/build.sh does it).
const VERSION = 'ef5e6750cf';
const CACHE = 'mkty-world3d-' + VERSION;
const PRECACHE = ['./', './index.html', './boot.js?v=' + VERSION, './app.min.js?v=' + VERSION, './assets/moonkatty.glb?v=39', './favicon.svg'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()).catch(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('mkty-world3d-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || !u.pathname.startsWith(new URL('./', self.registration.scope).pathname)) return;
  if (e.request.mode === 'navigate' || u.pathname.endsWith('/') || u.pathname.endsWith('.html')) {
    e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html'))));
    return;
  }
  if (u.search.includes('v=')) e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((res) => { if (res.ok) { const c = res.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); } return res; })));
});
