import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Viewport, install and in-app-browser contract.
 *
 * Every rule here exists because the failure is invisible in a code review:
 *
 *  - `100vh` is the LARGE viewport on mobile browsers and in the LINE in-app
 *    browser, so a full-height shell built on it is taller than what the user can
 *    actually see — the page scrolls behind the fixed bottom navigation.
 *  - A manifest whose only icon is an SVG never produces an install prompt on
 *    Android, and iOS ignores an SVG `apple-touch-icon` outright.
 *  - `orientation: "portrait"` blocks installing on a tablet or desktop at all.
 *  - Pinch-zoom must survive; `maximum-scale`/`user-scalable` are banned.
 */

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(REPO_ROOT, rel), "utf8");
const css = read("client/src/index.css");
const html = read("client/index.html");
const manifest = JSON.parse(read("client/public/manifest.json")) as {
  start_url: string;
  display: string;
  orientation?: string;
  background_color: string;
  theme_color: string;
  icons: Array<{ src: string; sizes: string; type: string; purpose?: string }>;
  shortcuts?: Array<{ url: string }>;
};

describe("viewport height", () => {
  it("declares --app-vh with a dvh upgrade", () => {
    expect(css).toMatch(/--app-vh:\s*100vh\s*;/);
    expect(css).toMatch(/@supports\s*\(height:\s*100dvh\)\s*\{[^}]*--app-vh:\s*100dvh/);
  });

  it("has no layout rule still bound to a raw 100vh", () => {
    // Only the fallback declaration itself may still say 100vh. Comments are
    // stripped first, because the note explaining the fallback mentions 100vh.
    const code = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const offenders = code
      .split("\n")
      .map((line, i) => ({ line: line.trim(), n: i + 1 }))
      .filter(({ line }) => /100vh/.test(line))
      .filter(({ line }) => !/--app-vh:\s*100vh/.test(line))
      .map(({ line, n }) => `index.css:${n} ${line}`);
    expect(offenders).toEqual([]);
  });

  it("both shells measure themselves with --app-vh, not Tailwind's min-h-screen", () => {
    const member = read("client/src/components/layout/MemberAppLayout.tsx");
    expect(member).toMatch(/min-h-\[var\(--app-vh\)\]/);
    expect(member).not.toMatch(/min-h-screen/);
  });
});

describe("safe areas", () => {
  it("publishes the four inset variables", () => {
    for (const side of ["l", "r", "t", "b"]) {
      const edge = { l: "left", r: "right", t: "top", b: "bottom" }[side];
      expect(css).toMatch(new RegExp(`--safe-${side}:\\s*env\\(safe-area-inset-${edge},\\s*0px\\)`));
    }
  });

  it("applies left/right insets so a notch cannot clip the shell", () => {
    // Safe on the inline axis only: a landscape phone in standalone mode runs
    // the notch into the sides, and `viewport-fit=cover` is set in index.html.
    expect(read("client/src/components/layout/MemberAppLayout.tsx")).toMatch(/var\(--safe-l\)/);
    expect(read("client/src/components/layout/MemberAppLayout.tsx")).toMatch(/var\(--safe-r\)/);
    expect(read("client/src/components/layout/AppLayout.tsx")).toMatch(/var\(--safe-l\)/);
    // The bottom nav is `fixed inset-x-0`, a sibling of the padded wrapper, so
    // it needs its own insets or the first/last item sits under a notch.
    const nav = read("client/src/components/layout/MobileBottomNav.tsx");
    expect(nav).toMatch(/pl-\[var\(--safe-l\)\]/);
    expect(nav).toMatch(/pr-\[var\(--safe-r\)\]/);
  });

  it("never pins a responsive gutter with an inline style", () => {
    // An inline padding-left/right always beats Tailwind's px-* utilities, so
    // putting one on `.pk-route` silently reduced `sm:px-6 lg:px-8` to 1rem at
    // every breakpoint. The insets must sit on a wrapper with no responsive
    // padding of its own. Comments are stripped first, because the note that
    // explains this rule mentions both `.pk-route` and an inline padding.
    const app = read("client/src/components/layout/AppLayout.tsx").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(app).not.toMatch(/pk-route[^>]*style=\{\{[^}]*padding(Left|Right)/);
    // And the safe-area still has to be applied somewhere on that axis.
    expect(app).toMatch(/var\(--safe-l\)/);
    expect(app).toMatch(/var\(--safe-r\)/);
  });

  it("fills the visible viewport on the login page", () => {
    // 100svh is the SHORTEST viewport, so the gradient ended short and the page
    // canvas showed as a seam once the browser toolbar hid.
    expect(css).not.toMatch(/min-height:\s*100svh/);
    const pinLogin = css.slice(css.indexOf(".pin-login {"));
    expect(pinLogin.slice(0, 2000)).toMatch(/min-height:\s*var\(--app-vh\)/);
  });
});

describe("viewport meta", () => {
  it("covers the notch without disabling pinch-zoom", () => {
    const meta = html.match(/<meta name="viewport"[^>]*>/)?.[0] ?? "";
    expect(meta).toMatch(/width=device-width/);
    expect(meta).toMatch(/viewport-fit=cover/);
    expect(meta).not.toMatch(/maximum-scale/i);
    expect(meta).not.toMatch(/user-scalable\s*=\s*no/i);
  });
});

describe("installability", () => {
  it("ships real PNG icons, not an SVG that Android will reject", () => {
    const pngs = manifest.icons.filter((i) => i.type === "image/png");
    const sizes = pngs.map((i) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    for (const icon of pngs) {
      expect(existsSync(path.join(REPO_ROOT, "client/public", icon.src.replace(/^\//, "")))).toBe(true);
    }
    // An SVG may accompany the PNGs but must not be the only icon.
    expect(pngs.length).toBeGreaterThanOrEqual(2);
  });

  it("has a maskable icon for Android launchers that mask the tile", () => {
    expect(manifest.icons.some((i) => i.purpose === "maskable")).toBe(true);
  });

  it("does not lock orientation to portrait", () => {
    // `portrait` refuses to install on a tablet or desktop at all.
    expect(manifest.orientation).not.toBe("portrait");
  });

  it("matches the theme the app actually paints", () => {
    const darkCanvas = css
      .slice(css.indexOf("\n.dark {"))
      .match(/--color-canvas:\s*(#[0-9a-f]{6})/i)![1]
      .toLowerCase();
    expect(manifest.theme_color.toLowerCase()).toBe(darkCanvas);
    expect(manifest.background_color.toLowerCase()).toBe(darkCanvas);
    expect(html).toMatch(new RegExp(`<meta name="theme-color" content="${darkCanvas}"`, "i"));
  });

  it("starts where role routing works for everyone", () => {
    // `/` bounces a member to /app and shows staff the dashboard; `/app` would
    // drop a staff account into the member shell.
    expect(manifest.start_url).toBe("/");
  });

  it("gives iOS a PNG touch icon (it ignores SVG)", () => {
    const link = html.match(/<link rel="apple-touch-icon"[^>]*>/)?.[0] ?? "";
    expect(link).toMatch(/\.png/);
  });
});

describe("in-app browsers (LINE and friends)", () => {
  it("never renders the install button unless the browser offered one", () => {
    // `beforeinstallprompt` does not fire in an in-app webview, so the button
    // must be driven by the captured event rather than by a user-agent sniff.
    // Match only the real UA tokens: a loose /Line/i would also match
    // "overflow-hidden" and "inline-flex".
    const member = read("client/src/components/layout/MemberAppLayout.tsx");
    expect(member).toMatch(/isInstallPromptAvailable\(\)/);
    expect(member).not.toMatch(/MicroMessenger|\bLine\/\d|\bFBAN\b|\bInstagram\b/i);
  });

  it("keeps the service worker registration behind a build-time check", () => {
    const pwa = read("client/src/lib/pwa.ts");
    expect(pwa).toMatch(/process\.env\.NODE_ENV === "production"/);
  });
});

describe("service worker", () => {
  const sw = read("client/public/sw.js");

  it("uses a raster notification icon, which Android requires", () => {
    // Android does not rasterise an SVG notification icon and silently renders
    // the notification with no image at all.
    const defaultIcon = sw.match(/DEFAULT_ICON\s*=\s*["']([^"']+)["']/)?.[1];
    expect(defaultIcon).toBeDefined();
    expect(defaultIcon!).toMatch(/\.png$/);
    expect(existsSync(path.join(REPO_ROOT, "client/public", defaultIcon!.replace(/^\//, "")))).toBe(true);

    // The constant has to actually reach the notification, and no icon/badge
    // slot may fall back to an SVG.
    expect(sw).toMatch(/icon:\s*data\.icon\s*\|\|\s*DEFAULT_ICON/);
    expect(sw).toMatch(/badge:\s*data\.badge\s*\|\|\s*DEFAULT_ICON/);
    const svgBound = sw
      .split("\n")
      .filter((l) => /\b(icon|badge)\b\s*[:=]\s*["'][^"']*\.svg["']/.test(l));
    expect(svgBound).toEqual([]);
  });

  it("pre-caches every raster icon the manifest advertises", () => {
    const precache = sw.match(/STATIC_ASSETS\s*=\s*\[([\s\S]*?)\]/)?.[1] ?? "";
    for (const icon of manifest.icons) {
      if (icon.type !== "image/png") continue;
      expect(precache).toContain(`"${icon.src}"`);
      expect(existsSync(path.join(REPO_ROOT, "client/public", icon.src.replace(/^\//, "")))).toBe(true);
    }
  });

  it("preloads navigations instead of blocking on a cold service worker", () => {
    // The shell is network-first, so on a mobile connection time-to-paint is
    // dominated by that round trip.
    expect(sw).toMatch(/navigationPreload\.enable\(\)/);
  });

  it("retries the network when the preload itself rejects", () => {
    // `preloadResponse || fetch(...)` was the bug this test used to lock in.
    // A preload rejects on its own (connection reset, 5xx, timeout) and that
    // rejection propagated straight to the offline branch, so every navigation
    // silently fell back to the cached shell without ever retrying the network
    // — with preload enabled for all navigations, that is every single visit.
    expect(sw).toMatch(/event\.preloadResponse/);
    expect(sw).toMatch(/event\.preloadResponse[\s\S]{0,160}?\.catch\(\(\)\s*=>\s*fetch\(event\.request\)\)/);
    expect(sw).not.toMatch(/event\.preloadResponse\s*\|\|\s*fetch\(/);
  });

  it("never hands respondWith an undefined response", () => {
    // `install` swallows a `cache.addAll` rejection, so an empty cache is a
    // reachable state. `caches.match(...)` then resolves to undefined and
    // respondWith(undefined) throws a TypeError that fails the navigation.
    const offlineBranch = sw.slice(sw.indexOf('event.respondWith(\n    networkAttempt'));
    expect(offlineBranch).not.toEqual("");
    expect(offlineBranch).toMatch(/fallbackResponse\s*\|\|\s*new Response\(/);
    expect(sw).toMatch(/status:\s*503/);
  });

  it("keeps /api/ network-first and still answers offline in Thai", () => {
    // A LINE link opened with no signal must not look like a crash.
    expect(sw).toMatch(/url\.pathname\.startsWith\("\/api\/"\)/);
    expect(sw).toMatch(/OFFLINE/);
    expect(sw).toMatch(/โหมดออฟไลน์/);
  });
});