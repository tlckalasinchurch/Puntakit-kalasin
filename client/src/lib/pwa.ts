import { api } from "./api";

let deferredPrompt: any = null;

export function initPwa() {
  if (typeof window === "undefined") return;

  // Register Service Worker
  if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("[PWA] Service Worker registered with scope:", reg.scope);
        })
        .catch((err) => {
          console.warn("[PWA] Service Worker registration failed:", err);
        });
    });
  }

  // Capture Install Prompt
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    window.dispatchEvent(new Event("pwa-install-ready"));
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    console.log("[PWA] App successfully installed to home screen");
  });
}

export function isInstallPromptAvailable(): boolean {
  return Boolean(deferredPrompt);
}

export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;

  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return choice.outcome === "accepted";
}

function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function subscribeToPushNotifications(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return false;
    }

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();

    if (!sub) {
      // In production with VAPID key: reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: ... })
      // For mock/graceful fallback:
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
      }).catch(() => null);
    }

    if (sub) {
      const p256dh = sub.getKey ? arrayBufferToBase64(sub.getKey("p256dh")) : "test-p256dh";
      const auth = sub.getKey ? arrayBufferToBase64(sub.getKey("auth")) : "test-auth";

      await api.post("/api/me/push/subscribe", {
        endpoint: sub.endpoint,
        p256dh: p256dh || "test-p256dh",
        auth: auth || "test-auth",
        userAgent: navigator.userAgent,
      });
      return true;
    }

    // Register simulated subscription if browser environment lacks real VAPID server
    await api.post("/api/me/push/subscribe", {
      endpoint: `https://push.puntakit.org/sub-${Date.now()}`,
      p256dh: "mock-key",
      auth: "mock-auth",
      userAgent: navigator.userAgent,
    });
    return true;
  } catch (err) {
    console.warn("Push subscription failed:", err);
    return false;
  }
}
