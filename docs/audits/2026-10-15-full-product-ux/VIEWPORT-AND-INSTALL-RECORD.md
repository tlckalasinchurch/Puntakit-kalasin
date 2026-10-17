# Viewport, Install & In-App-Browser Record

Date: 2026-10-15
Branch: `redesign/full-app-claude-20261015` (worktree `02-Worktrees/puntakit-claude-redesign`)
Scope: responsive behaviour across phone / tablet / desktop, and using the app opened from a LINE link.

This record follows the same shape as `LOGIN-REWRITE-RECORD.md` and
`DARK-THEME-RECORD.md`: what was wrong, what changed, what was verified, and what
is explicitly **not** verified.

---

## 1. The reported symptom: "มันไม่เต็มจอ" (not full screen)

The app was full-bleed on paper but not in practice. Root cause was one line of
CSS repeated in four places:

```css
height: 100vh;              /* admin sidebar   */
min-height: 100vh;          /* .login-shell    */
min-height: calc(100vh - …) /* .coming-soon    */
min-height: min-h-screen;   /* member shell    */
```

On a mobile browser — and in the LINE in-app webview, which behaves the same way
— `100vh` resolves to the **large** viewport: the height you would get *after* the
browser's URL bar retracts. A shell built on it is therefore **taller than what
the user can actually see**. The symptom is not an obvious blank strip; it is
the page scrolling behind a fixed bottom navigation, and a bottom bar that feels
detached from the content above it.

`.pin-login` was already on `100svh`, which is the correct instinct but the
wrong unit: `svh` is the **shortest** viewport (toolbar shown). When the user
scrolls and the toolbar retracts, the gradient stopped short and the page canvas
showed as a seam at the foot of the page — a visible band of a different dark.

## 2. What changed

### 2.1 One viewport variable for every shell

`client/src/index.css` now declares the value once:

```css
:root {
  --app-vh: 100vh;   /* fallback for webviews without dvh */
  --safe-l: env(safe-area-inset-left, 0px);
  --safe-r: env(safe-area-inset-right, 0px);
  --safe-t: env(safe-area-inset-top, 0px);
  --safe-b: env(safe-area-inset-bottom, 0px);
}
@supports (height: 100dvh) {
  :root { --app-vh: 100dvh; }
}
```

The `vh` value stays as the declared fallback, so a webview too old for `dvh`
still gets a full-height shell — just the old, slightly-too-tall one. All four
call-sites now read `var(--app-vh)`, and `.pin-login` was moved from `100svh` to
`var(--app-vh)` so it is always full-bleed.

### 2.2 Safe areas on all four edges

`viewport-fit=cover` was already set, but only two of the four insets were ever
compensated for: `Topbar` handled `inset-top` and the bottom bars handled
`inset-bottom`. **Nothing handled left/right**, so in landscape on a notched
phone a sidebar or the first nav item could sit under the notch.

The insets are now applied to elements that have no responsive padding of their
own — which turned out to matter, see §4.

### 2.3 Real icons, not one SVG claiming to be two sizes

`client/public/manifest.json` advertised a single `icon.svg` with
`sizes: "192x192 512x512"`, and `index.html` pointed `apple-touch-icon` at the
same SVG. Consequences:

- **Android never shows the install prompt** without real raster icons at 192
  and 512.
- **iOS ignores an SVG `apple-touch-icon` outright.**
- The artwork itself was still the retired V2 mark: graphite `#2a2a2c` ground
  with a gold `#ffe66d` leaf, on an app that is now deep teal.

`icon.svg` was redrawn on the current brand, and five real PNGs were produced by
rasterising it through headless Chrome (no new dependency):
`icon-192`, `icon-512`, `icon-maskable-512` (content inside the inner 80% safe
zone so a launcher mask never clips the cross), `apple-touch-icon` at 180, and
`favicon-32`.

### 2.4 Manifest metadata

| Field | Was | Now | Why |
|---|---|---|---|
| `orientation` | `"portrait"` | `"any"` | `portrait` refuses to install on a tablet or desktop **at all** |
| `theme_color` / `background_color` | `#272729` / `#f5f5f7` | `#061a1f` | Both were stale; `#272729` is the retired graphite, `#f5f5f7` is a light canvas |
| `start_url` | `/app` | `/` | `/app` drops a staff account into the member shell; `/` routes by role |
| `icons` | 1 SVG | 3 PNG + 1 SVG | see §2.3 |
| `shortcuts` | — | หน้าหลัก / กิจกรรม | Long-press on the installed icon |

`index.html` additionally gained `color-scheme`, `format-detection`, and PNG
favicon links. Pinch-zoom is deliberately still enabled — `maximum-scale` and
`user-scalable` remain absent, pinned by `ux-audit-regressions.test.ts`.

### 2.5 Service worker

Two real defects surfaced once the icon set changed:

1. **Push notifications pointed at an SVG icon.** Android does not rasterise an
   SVG notification icon and silently renders the notification with **no image
   at all**. Now bound to `/icon-192.png`.
2. **The raster icons were not pre-cached**, so a cold offline install had no
   icon. Added to `STATIC_ASSETS`, with `CACHE_NAME` bumped to `v3` so a
   returning install re-runs `install` against a clean cache instead of adding
   the new files alongside stale entries.

Also added `navigationPreload`. The shell is deliberately **network-first** (see
the existing comment in `sw.js`: cache-first served a stale shell after deploy
and could reference an evicted chunk). Network-first on a mobile connection makes
time-to-paint depend on one round trip; preloading lets it start while the
service worker is still waking up. This is the single biggest felt-speed win for
the "opened from a LINE link on mobile data" case.

### 2.6 Member shell width, and a bug it introduced

The member shell's width was written out **twice** — on the scroll container and
again on the fixed bottom nav. On a tablet those could drift apart. Both now call
one `shellWidthClass()` helper.

The width steps were also made coherent across devices. Previously the member
home was `max-w-[1440px]` while every other member page was `max-w-[600px]`,
which is invisible on a phone (both are just full width) but means a tablet
shows a 600px ribbon beside a 1440px home:

```
phone    600
tablet   sm:max-w-[680px]  md:max-w-[760px]
desktop  lg:max-w-[720px]     ← capped again; this is a member PWA, not a dashboard
```

## 3. Verification

### 3.1 Gates

| Gate | Result |
|---|---|
| `pnpm check` | exit 0 |
| `pnpm test` | 64 files passed |
| `pnpm build` | exit 0, no CSS warnings |

Machine is SE Asia, CI is UTC — `$env:TZ="UTC"` was set for the test run.

### 3.2 Device sweep — 55/55 clean

11 profiles × 5 routes, driven over CDP against a throwaway PGlite database
(`PGLITE_DATA_DIR` under the OS temp dir; the repo's `.db_data` was never
opened, because PGlite is single-process and another server already held it).

Profiles: 320×568, 360×800, 390×844, 430×932, **844×390 landscape**, 768×1024,
1024×768, 1366×1024, 1280×900, 1920×1080, and a 412×892 profile sent with a real
LINE in-app user-agent token (`LINE/14.9.0/IAB`).

Routes: `/login`, `/app`, `/app/events`, `/app/profile`, `/`.

Assertions per cell: no horizontal overflow, `--app-vh` resolves, the engine
supports `dvh`, the fixed bottom nav's bottom edge is not below the fold, the
topbar is not clipped above the viewport, and no console errors.

Measured: shell `min-height` equals the viewport height on **every** profile, and
the bottom nav's bottom edge equals the viewport height on **every** profile.

### 3.3 The gutter regression, re-measured

`.pk-route` computed padding was read back at six widths against the Tailwind
breakpoints it is supposed to honour:

| viewport | measured | expected |
|---|---|---|
| 390 | 16px / 16px | `px-4` → 16 ✅ |
| 640 | 24px / 24px | `sm:px-6` → 24 ✅ |
| 768 | 24px / 24px | `sm:px-6` → 24 ✅ |
| 1024 | 32px / 32px | `lg:px-8` → 32 ✅ |
| 1280 | 32px / 32px | `lg:px-8` → 32 ✅ |
| 1920 | 32px / 32px | `lg:px-8` → 32 ✅ |

The safe-area wrapper reads `0px` at every width, as expected — headless Chrome
reports zero insets. The wrapper is therefore *exercised* but never non-zero,
which is why real safe-area behaviour remains in §6.

### 3.4 Login page

Rendered at five sizes with demo auth disabled (otherwise `/login` redirects to
the dashboard and you photograph the wrong page). The card is full-bleed at
390×844, 412×892, 768×1024 and 1920×1080. At 320×568 and 844×390 the card is
taller than the viewport and the page scrolls — which is the intended behaviour,
since clipping the keypad would make login impossible.

### 3.5 An earlier sweep reported 3 failures that were not real

The first sweep reported `--app-vh unresolved` on three cells. It was a race: in
dev, Vite injects the stylesheet from JavaScript, so on a cold navigation the
custom properties do not exist yet. The fix was to wait for the route's own
readiness marker instead of sleeping a fixed 1400 ms. The same sweep also
reported `shell=224px / min-height 44px` on several cells — that was the
selector `[class*="min-h-"]` matching the first 44px-tall button in the document,
not the shell.

Both are recorded here because the tempting move was to report them as findings.

## 4. A regression this work introduced, and then fixed

The first attempt put the safe-area inline style on `.pk-route`:

```jsx
<div className="pk-route … px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-8"
     style={{ paddingLeft: "calc(1rem + var(--safe-l))", … }}>
```

An inline `padding-left` **always beats** a Tailwind `px-*` utility, so this
silently reduced `sm:px-6` and `lg:px-8` to a flat `1rem` at every breakpoint.
It was visible in the tablet screenshot — the admin dashboard's gutter was ~18px
where it should have been 24px — and would not have shown up in any unit test,
because the classes were still present in the source.

The insets now sit on the scroll-container `<div>`, which has no responsive
padding of its own, and `viewport-and-install.test.ts` asserts that no
`pk-route` element carries an inline `paddingLeft`/`paddingRight`.

## 5. Opening the app from a LINE link — what works, what is missing

### 5.1 What works

- The 412×892 profile, sent with a real LINE in-app user-agent token
  (`LINE/14.9.0/IAB`), loads `/login` and every authenticated route with **no
  overflow, no console errors and no failed requests**. The API log confirms the
  UA string reached it.
- The install button is driven by the captured `beforeinstallprompt` event, and
  that event **never fires** in an in-app webview — so the button correctly
  never appears there. This was already right; a test now pins it, and it pins
  the absence of any user-agent sniffing (a loose `/Line/i` would also match
  "over**line**-hidden", which is exactly the false positive a naive guard hits).
- `/api/` is network-first with a Thai offline envelope, so a link opened with no
  signal degrades to "คุณกำลังใช้งานในโหมดออฟไลน์…" rather than looking like a crash.

### 5.2 Landscape phone is usable but tight

At **844×390** the login card is ~997px tall, so the page scrolls. Checked
explicitly: the CTA and both legal links are reachable and **no ancestor clips
them** (`clippedBy=null`, and `scrollIntoView` brings the CTA fully into view at
`167..223` within a 390px viewport). This is friction, not breakage — but the
CTA and the two legal links cannot both be on screen at once, so it is worth
knowing before anyone calls landscape "done".

### 5.3 Open Graph tags are missing entirely — NOT FIXED

This is the one genuinely unresolved item, and it is a real gap:

- `client/index.html` contains **no `og:` or `twitter:` tags at all**, and a
  repository-wide search finds none in `client/src` or `server` either.
- Consequence: a link shared into a LINE group renders as a **bare URL** — no
  title, no description, no thumbnail. LINE builds its preview card entirely
  from Open Graph tags.
- It was deliberately **not** fixed here, for two concrete reasons:
  1. `og:url` and `og:image` must be **absolute** URLs. There is **no canonical
     production host anywhere in this repository** — `DEPLOYMENT.md` and
     `.env.example` contain no absolute URL. Writing one would mean inventing a
     domain, which is exactly the kind of fabrication to avoid.
  2. The only real image asset available, `church-emblem.png`, is **208×140** —
     far below the ≥300×300 that link-preview scrapers want, and well below the
     1200×630 usually recommended. It would render as a tiny thumbnail.

  Closing this needs two things from the owner: the production domain, and a
  decision on producing a proper 1200×630 preview card (which is new artwork,
  not a mechanical fix).

## 6. Explicitly NOT verified

These are stated as `NOT VERIFIED` because they were not run:

- **The dynamic-toolbar behaviour itself.** A headless browser has no browser
  toolbar, so `dvh` and `vh` are numerically identical there. The sweep proves
  the declaration resolves and that no rule regressed to a raw `100vh`; it does
  **not** prove the shell shrinks when the URL bar appears. That needs a real
  device.
- **Real safe-area inset values.** Headless Chrome reports `0px` for all four
  insets, so the left/right padding is exercised but never non-zero.
- **The install prompt on a real Android or iOS device**, and the actual
  rendered icon in a launcher.
- **The real LINE in-app browser.** Only the user-agent was emulated. LINE's
  webview may still differ in ways a UA string cannot reproduce (its own
  toolbar, storage partitioning, cookie policy for first-party cookies).
- **Push notifications.** The icon was changed from SVG to PNG because Android
  drops SVG notification icons; no push was actually delivered.
- **The new pre-cache list and `navigationPreload`** were not exercised against
  a production build — the service worker only registers when
  `NODE_ENV === "production"`, and the dev server used here does not register it.
- **768 px was swept as a device profile but 2560 px and ultra-wide were not.**

## 6. Files touched

| File | Change |
|---|---|
| `client/src/index.css` | `--app-vh` + `@supports` upgrade, `--safe-*`, `.pin-login` → `var(--app-vh)` |
| `client/src/components/layout/AppLayout.tsx` | insets moved to the scroll container |
| `client/src/components/layout/MemberAppLayout.tsx` | `min-h-dvh`, insets, `shellWidthClass()` |
| `client/src/components/layout/MobileBottomNav.tsx` | left/right insets, `--safe-b` |
| `client/index.html` | PNG icons, `color-scheme`, `format-detection`, meta comments |
| `client/public/manifest.json` | rewritten (§2.4) |
| `client/public/icon.svg` | redrawn on the teal brand |
| `client/public/{icon-192,icon-512,icon-maskable-512,apple-touch-icon,favicon-32}.png` | new |
| `client/public/sw.js` | PNG notification icon, pre-cache, `navigationPreload`, `v3` |
| `client/src/viewport-and-install.test.ts` | new — 20 contract tests |

Nothing was committed. No business logic, schema, migration, API authorization
or permission code was touched.
