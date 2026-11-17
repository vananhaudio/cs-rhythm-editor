// Service worker tối giản — đủ để Android/Chrome cho "Cài đặt app"
// Chiến lược network-first: luôn ưu tiên bản mới, chỉ fallback cache khi offline.
const CACHE = 'tva-guitar-v2';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        // Lưu bản mới nhất để dùng khi offline — CHỈ phản hồi thành công, và không lưu HTML trả nhầm cho script/style
        // (chunk cũ bị xoá sau deploy: SPA fallback trả index.html → lưu lại sẽ đầu độc cache).
        const ct = res.headers.get('content-type') || '';
        const wrongHtml = (req.destination === 'script' || req.destination === 'style') && ct.includes('text/html');
        if (res.ok && !wrongHtml) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
