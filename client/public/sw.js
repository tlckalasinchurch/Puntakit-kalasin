// Bumped to v3 when the icon set changed: the pre-cache list below now carries
// real PNGs, so a returning install must re-run `install` against a fresh cache
// rather than add the new files into the old one alongside stale entries.
const CACHE_NAME = "puntakit-pwa-v3";
const STATIC_ASSETS = [
  "/",
  "/app",
  "/manifest.json",
  "/icon.svg",
  // Raster icons must be pre-cached too: they are what Android and iOS look for
  // when installing, and on a cold offline install a cache miss means no icon.
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/apple-touch-icon.png",
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
      // Start the navigation request while the SW is still waking up. The shell
      // is network-first by design (see below), so on a mobile connection the
      // time to first paint is dominated by that round trip; preloading lets it
      // start during SW startup instead of after the fetch handler is attached.
      .then(() =>
        self.navigationPreload
          ? self.navigationPreload.enable().catch(() => {})
          : undefined
      )
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
  //
  // `event.preloadResponse` is non-null only for navigations when preload is
  // enabled; for every other request it falls through to fetch().
  //
  // The preload is NOT a substitute for the request. It rejects on its own
  // whenever the preloaded fetch fails (connection reset, 5xx, preload timeout)
  // and a rejected `preloadResponse` propagates straight to the offline
  // fallback below — so `preloadResponse || fetch(...)` left the real network
  // untried and pinned every navigation to the stale cached shell. Retry with
  // fetch() first, and only treat the request as offline if that fails too.
  const networkAttempt = event.preloadResponse
    ? event.preloadResponse.catch(() => fetch(event.request))
    : fetch(event.request);

  event.respondWith(
    networkAttempt
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
        caches
          .match(event.request)
          .then((cachedResponse) => cachedResponse || caches.match("/"))
          // `respondWith(undefined)` throws a TypeError and fails the navigation
          // outright. The cache can legitimately be empty: `install` swallows a
          // `cache.addAll` rejection, so a failed pre-cache still activates.
          // Fall back to an explicit offline document rather than a hard error.
          .then(
            (fallbackResponse) =>
              fallbackResponse ||
              new Response(
                "<!doctype html><meta charset=\"utf-8\"><title>ออฟไลน์</title>" +
                  "<body style=\"font-family:system-ui;padding:2rem\">" +
                  "<h1>ไม่มีการเชื่อมต่อ</h1>" +
                  "<p>ยังไม่มีข้อมูลที่บันทึกไว้บนอุปกรณ์นี้ กรุณาเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่อีกครั้ง</p>",
                { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
              )
          )
      )
  );
});

// Push Notification Event
self.addEventListener("push", (event) => {
  // Raster, not /icon.svg: Android does not rasterise an SVG notification icon
  // and silently renders the notification with no image at all. `badge` is
  // drawn as a monochrome silhouette, so it reuses the same PNG.
  const DEFAULT_ICON = "/icon-192.png";
  let data = {
    title: "Puntakit Kalasin",
    body: "มีการประกาศหรือกิจกรรมใหม่จากคริสตจักร",
    icon: DEFAULT_ICON,
    badge: DEFAULT_ICON,
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
    icon: data.icon || DEFAULT_ICON,
    badge: data.badge || DEFAULT_ICON,
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
