/* 离线与更新平衡策略（v1.2）：
 * - HTML 页面导航（req.mode === 'navigate'）：网络优先（Network-First），保证 GitHub Pages 发版后立即拿到最新入口，断网时退回缓存；
 * - 静态带哈希资源（/assets/*、图标等）：缓存优先 + 后台更新（Stale-While-Revalidate）。
 * - 仅在 http(s) 网页环境注册，Capacitor Android App 内不注册。
 */
const CACHE = 'plc-academy-v1.2';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(['./', './index.html', './manifest.webmanifest']))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // Navigation HTML: Network-First so new deployments never reference stale deleted chunks
  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // Hashed static assets & icons: Cache-First with background refresh
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
