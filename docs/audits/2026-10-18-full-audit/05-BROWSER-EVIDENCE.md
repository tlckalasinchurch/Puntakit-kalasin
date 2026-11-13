# 05 — Browser evidence

**Harness:** Playwright 1.64.1 · Chromium 156.0.8078.4 · headless · installed to a temp sandbox, not the project.
**Target:** `http://localhost:3000` → Vite proxy → API on `:3101` → **isolated PGlite copy** (isolation proof in [`01-BASELINE-AND-METHOD.md`](01-BASELINE-AND-METHOD.md)).

---

## 1. Coverage matrix

| Axis | Value |
|---|---|
| Routes exercised | **37 / 37** (all registered routes + `/mission-feed` + a deliberate 404) |
| Viewports | **3** — 390×844 (mobile), 768×1024 (tablet), 1440×900 (desktop) |
| Themes | **2** — dark (default) and light |
| Page loads | **222** = 37 × 3 × 2 |
| Navigation failures | **0** |
| Role | `admin` only — see §6 |

---

## 2. ✅ Verified clean — measured, not assumed

| Check | Result | Method |
|---|---|---|
| Theme actually applied | **0 mismatches / 222.** dark 111/111, light 111/111 | asserted `documentElement.classList.contains("dark")` per load |
| Horizontal overflow | **0 / 222** | `documentElement.scrollWidth > clientWidth + 1` |
| Exactly one `<h1>` | **222 / 222** | `querySelectorAll("h1").length === 1` |
| `<main>` present | **222 / 222** | exactly one per load |
| Heading-level skips | **none detected** | walked every `h1`–`h6` in document order |
| Uncaught exceptions | **0 / 222** | `pageerror` |
| `outline-none` with no `focus-visible` replacement | **0 / 222** | class inspection |
| `<img>` without `alt` | **0 / 222** | attribute check |
| Skip link present | 215 / 222 — see §4 | correct selector `a[href="#app-main"], a[href="#member-app-main"]` |

**The project's own rule `design.md:185` ("no horizontal scroll at 360–414px") holds at every viewport tested, in both themes.**

---

## 3. 🔴 F-08 — confirmed live: unstyled primary button

`/media` and `/settings`, measured at 390×844 dark:

| Property | `class="primary-action min-h-11"` | correct button (`/care`) |
|---|---|---|
| `background-color` | `rgba(0,0,0,0)` | `rgb(53,180,176)` |
| `border-radius` | `0px` | `9999px` |
| `padding` | `0px` | `0px 26px` |
| `height` | 44px (from `min-h-11` alone) | 56px |

`.primary-action` matches **no CSS rule**. The primary action on those two routes renders as bare text with no horizontal padding, so its tap target is the glyph width. Full write-up: F-08.

---

## 4. Confirmed gaps

### Skip link absent on 7 routes
| Routes | Cause |
|---|---|
| `/privacy`, `/terms`, `/404`, `/this-route-does-not-exist` | **Real.** No layout, so nothing to skip past. Matches the 2026-10-17 audit's P3. |
| `/admin/users`, `/admin/pins`, `/import/org` | **Consequence of the role ceiling.** These render the access-denied screen, which sits outside the layout wrapper. Not a defect for a real `super_admin` — but it means a denied user gets no skip link. |

### `/follow-up` checkbox is 20×20px
Measured **6/6 loads**. `brand-spec.md:174` and `design.md:138` require **44×44px** minimum. The `<input>` itself is 20×20; whether the wrapping `<label>` extends the hit area was **not verified** — check before fixing.

### Unnamed controls — 2 sites, 10 loads
- `<A class="group flex min-h-11 items-center gap-2.5 rounded-[var(--radi…]">` on 2 routes
- `<TEXTAREA class="min-h-11 w-full rounded-[var(--radius-sm)] border border-[va…]">` on 1 route

Both need an accessible name added or the surrounding markup inspected.

### Network: the only failures were external fonts
`net::ERR_CONNECTION_TIMED_OUT` on 6 `fonts.gstatic.com` URLs — **this sandbox has no outbound internet.** Not an application defect. Worth noting that the app therefore rendered with a **fallback font**, so no typographic measurement in this pass is representative.

---

## 5. ⚠️ NOT VERIFIED — contrast, and why

**I could not produce trustworthy contrast data, and I am not reporting the numbers I collected.**

My detector resolved each element's backdrop by walking ancestors for the first opaque `background-color`, compositing alpha. **This app paints its chrome and member hero with `linear-gradient(...)`.** Proven by ancestor inspection:

```
/            sidebar <A>  -> ancestors carry a gradient; painted backdrop is graphite, not white
/app/group   <SECTION>    -> linear-gradient(to right bottom in oklab, …)
/app/attendance <SECTION> -> linear-gradient(…)
/attendance  "ออนไลน์"    -> reported 1.17:1; the REAL pairing is
                            --color-info-ink #1f5aa6 on --color-info-soft #e6f1ff
                            — exactly what brand-spec prescribes, and it passes
```

**Result:** 25 distinct "failures" were produced; spot-checking four showed all four to be detector artifacts. **Treat the contrast numbers as void, not as 25 defects.**

What still stands, on independent source evidence (explicit token pairs on flat tints, unaffected by gradients):
- **F-15** — plain `--color-warning` / `--color-success` used as body text: 2.98–4.02:1 measured from token math. This is a real class of failure, independent of the browser pass.
- The **2026-10-17 audit** did do contrast properly (computed, 33 routes, both themes) and found 3 real defects (`P2-2` avatar 2.15:1 dark, `P2-3` `--color-primary` on `--color-accent-soft` 4.27:1, `P2-4` email wrapping).

**To close this properly:** sample actual painted pixels (screenshot the region and compute luminance from the bitmap) instead of resolving computed styles. Not done here.

---

## 6. Coverage limits of this pass

| Limit | Consequence |
|---|---|
| Role = `admin` only | `/admin/users`, `/admin/pins`, `/import/org` rendered *access-denied*. **NOT VERIFIED.** |
| Member PWA routes rendered as `admin` | `/app/*` were exercised, but with admin data, not a real member's scoped data. |
| No interaction | No clicks, typing, dialogs, or mutations. **Phase 3 is incomplete.** |
| No keyboard/focus-order pass | Tab order, focus trapping and focus restoration were **not** tested. Only static class inspection. |
| No zoom/reflow (200%, 400%) | **Not tested.** |
| No screen reader | Automated structure only. |
| No axe-core | Custom checks only — narrower than a standard engine. |
| No performance measurement | No timing, no bundle analysis, no paint metrics. **Phase 8 is incomplete.** |
| No outbound network | Fonts fell back. |
| No destructive flows | Delete, merge, apply, rollback deliberately not executed. |

---

## 7. Four methodology bugs I hit — do not repeat them

Documented because each one produced a confident, wrong result:

| # | Bug | How it misled me | Fix used |
|---|---|---|---|
| 1 | Set `localStorage["puntakit-theme"]`; the app reads `localStorage["theme"]` (`client/index.html`) | **111 light-theme loads silently rendered dark.** Half the sweep was fake coverage. | re-ran with the right key **and** asserted `html.dark` per load |
| 2 | Skip-link selector looked for `.skip-link` | Reported "no skip link on any route" — the real class is `sr-only focus:not-sr-only`. | matched `href="#app-main"` / `href="#member-app-main"` |
| 3 | Denied-state regex `/ไม่มีสิทธิ์/` | Flagged `/privacy` as access-denied; that phrase occurs **inside the privacy policy**. | cross-checked `bodyLen` (2341 chars = full legal text) |
| 4 | Contrast backdrop resolved from `background-color` only | 25 false failures on gradient-painted surfaces. | proved via ancestor inspection; **discarded the data rather than reporting it** |

The general lesson: a clean-looking automated result deserves the same scepticism as a source reading. Two of my four "findings" that looked most alarming were my own bugs.

---

## 8. Raw artefacts

```
%TEMP%\opencode\pw-audit\sweep-1.json     first sweep (light half invalid — see §7.1)
%TEMP%\opencode\pw-audit\deep-1.json      222 rows: theme, contrast, touch, a11y, headings
%TEMP%\opencode\pw-audit\verify-primary.cjs     F-08 measurement
%TEMP%\opencode\pw-audit\verify-contrast.cjs    gradient-proof for §5
```
Not committed. Regenerate with the scripts in that directory.
