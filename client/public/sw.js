const CACHE_NAME = "puntakit-pwa-v2";
const STATIC_ASSETS = [
  "/",
  "/app",
  "/manifest.json",
  "/icon.svg",
];

// Install Event - Pre-cache core shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("Pre-cache warning:", err);
      });
    })
  );
  self.skipWaiting();
});

// Activate Event - Clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Vite emits content-hashed asset URLs (/assets/*.<hash>.js): a new deploy
// produces new URLs, so a cached copy can never go stale — cache-first is safe
// and keeps loads fast.
//
// Everything else (notably the SPA shell HTML at /, /login, /signup, /app) must
// be NETWORK-FIRST. The previous strategy served every route stale-while-
// revalidate, so after each deploy users got the previous release's shell for
// one visit (observed live: /signup kept rendering the pre-deploy bundle), and
// if the old hashed chunk had been evicted from the cache the shell referenced
// a file that no longer existed and the page broke.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests and browser extensions
  if (event.request.method !== "GET" || !url.protocol.startsWith("http")) {
    return;
  }

  // API Requests: Network-First
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: "OFFLINE",
              message: "คุณกำลังใช้งานในโหมดออฟไลน์ ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ในขณะนี้",
            },
          }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" },
          }
        );
      })
    );
    return;
  }

  // Hashed build assets: cache-first (immutable by construction)
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(event.request).then(
        (cachedResponse) =>
          cachedResponse ||
          fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache);
              });
            }
            return networkResponse;
          })
      )
    );
    return;
  }

  // HTML and everything else: network-first, cache answers only offline.
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() =>
        caches.match(event.request).then((cachedResponse) => cachedResponse || caches.match("/"))
      )
  );
});

// Push Notification Event
self.addEventListener("push", (event) => {
  let data = {
    title: "Puntakit Kalasin",
    body: "มีการประกาศหรือกิจกรรมใหม่จากคริสตจักร",
    icon: "/icon.svg",
    badge: "/icon.svg",
    url: "/app",
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || "/icon.svg",
    badge: data.badge || "/icon.svg",
    data: { url: data.url || "/app" },
    vibrate: [100, 50, 100],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Notification Click Event
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/app";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
