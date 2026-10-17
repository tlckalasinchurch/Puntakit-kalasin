# Dark Theme Conversion — Implementation Record

**Status: IMPLEMENTED and TESTED across all theme layers. Per-route browser sweep still pending.**
**Date:** 2026-10-15
**Authorised by:** owner, 2026-10-15 — *"ทำทุกหน้าเป็น dark glassmorphism"* + *"รวมเข้ากับ token กลาง"*

> **Read this first.** Every *theme layer* is now done: tokens, chrome, member
> app, clay, charts, badges, docs. What is **not** done is opening all 38 routes
> in a browser at 390/768/1280 × light/dark. The client suite renders nothing,
> so that sweep is the only proof still outstanding — see §10.

---

## 1. What "all pages" actually costs

| | |
|---|---|
| Routes | 38 slots |
| Pages | 33 (`client/src/pages`) |
| Shells | 2 (`AppLayout`, `MemberAppLayout`) |
| Colour tokens | 79 `--color-*` declarations, 41 `.dark` remaps |
| Independent palette | `.lamb-theme` (was a second brand) |

Retuning the palette is reversible. Sweeping 33 pages is not — and the client
test suite **renders nothing** (no jsdom, no React Testing Library), so a page
sweep can only be verified by opening each route in a browser.

---

## 2. Layer 1 — dark palette foundation ✅

The `.dark` block was **already present** (41 token remaps) but used the retired
sage/graphite V2 palette — a *third* brand colour next to light teal. It is now
retuned to the deep-teal palette measured against the PIN surface.

| Token | Was | Now |
|---|---|---|
| `--color-canvas` | `#2a2a2c` | `#061a1f` |
| `--color-canvas-soft` | `#252527` | `#123033` |
| `--color-surface` | `#272729` | `#0c2529` |
| `--color-canvas-sunken` | `#202022` | `#0a2126` |
| `--color-ink` | `#ffffff` | `#f4faf9` |
| `--color-body-muted` | `rgba(255,255,255,.64)` | `#9db2b2` |
| `--color-primary` | `#7faf72` (sage) | `#2fc4bd` (teal) |
| `--color-primary-focus` | `#7faf72` | `#5fd7d1` |
| `--color-accent-soft` | `rgba(127,175,114,.16)` | `rgba(47,196,189,.16)` |
| status `--color-success/warning/error/info` | not remapped | now remapped for dark |

**Also:** `--shadow` deepened to `rgba(0,0,0,.5)`; four new `--glass-*` tokens.

`ThemeProvider defaultTheme` flipped `"light"` → **`"dark"`**. The toggle stays,
so light remains reachable per user.

### Contrast — measured before writing
| Pairing | On canvas | On surface |
|---|---|---|
| ink `#f4faf9` | 16.92 | 15.16 |
| secondary `#c3d4d4` | 11.65 | 10.43 |
| tertiary `#9db2b2` | 8.04 | 7.20 |
| quaternary `#7e9493` | 5.57 | 4.99 |
| primary `#2fc4bd` (as text) | 8.30 | 7.43 |
| on-primary `#04211f` on primary fill | 7.85 | — |
| `primary-ink` on `accent-soft` tint (the `design-tokens` contract) | 6.16 | — |

All ≥4.5:1. The weakest pair is quaternary on surface at 4.99.

## 3. Layer 2 — glass chrome ✅

Added a `.dark`-scoped block that re-skins the premium chrome without touching
light mode:

- `.pk-glass` (topbar, bottom nav) → `--glass-fill` + `blur(22px) saturate(160%)`
- `.pk-sidebar` → glass column
- `.pk-atmosphere` → dark aurora wash
- `.pk-premium .card-surface` / `.pk-surface` / `.pk-card` → glass fill + a
  top-edge highlight (a drop shadow alone reads as a plain dark card)
- `.pk-nav-active` → glass pill

All opt-in to `.dark`, so `premium-shell-contract.test.ts` is untouched.

## 4. `.lamb-theme` converged (decision D5) ✅

The member app had its own palette (`#0A767C`, ivory `#F8F7F1`) — a second brand
that could never converge on its own. It is now **pure aliases**:

```css
.lamb-theme {                      .dark .lamb-theme {
  --lamb-primary: var(--color-primary-focus);   --lamb-primary: var(--color-primary);
  --lamb-ink:     var(--color-primary-focus);   --lamb-ink:     var(--color-primary);
  --lamb-mint:    var(--color-accent-soft);     --lamb-mint:    var(--color-canvas-soft);
  --lamb-canvas:  var(--color-canvas);          --lamb-canvas:  var(--color-canvas);
  --lamb-surface: var(--color-surface);         --lamb-surface: var(--color-surface);
}                                          }
```

**Why `primary-focus` and not `primary` in light mode.** Aliasing `--lamb-primary`
straight to `--color-primary` (`#0c7c82`) would have shipped a regression: on
`--color-accent-soft` (`#e8f0e4`) it measures **4.27:1 — FAIL**. `#09696e`
(`--color-primary-focus`) measures **5.53:1**, and is *better* than the
`#0A767C` it replaces (4.62:1). This is the rule now written into `brand-spec.md`.

**Dead tokens removed:** `--lamb-primary-dark`, `--lamb-primary-soft` — zero
references anywhere in `client/src`.

**Hardcoded light hexes tokenised** (17 replacements across 6 files):

| Was | Now |
|---|---|
| `bg-[#E4F7F2]`, `bg-[#DDF7F0]` | `bg-[var(--lamb-mint)]` |
| `border-[#D8EEE7]` | `border-[var(--glass-line)]` |
| `border-[#0C7C82]` | `border-[var(--lamb-primary)]` |
| `focus-visible:ring-[#0C7C82]` | `focus-visible:ring-[var(--color-primary-focus)]` |
| `bg-[#0C7C82] text-white` (RSVP button) | `bg-[var(--color-primary)] text-[var(--color-on-primary)]` |
| light `shadow-[0_10px_28px_rgba(29,29,31,.08)]` | `shadow-[var(--shadow)]` |

Without this the member app would have shown pale-mint blocks on a dark canvas.

## 5. A bug I introduced, and fixed

Splicing the chrome block in at a fixed line number **cut a multi-line CSS
comment in half**, orphaning a `*/`. Vite emitted a parse warning
(`Expected identifier in class selector, got WhiteSpace`). The build still
succeeded and `.pk-glass` still worked, so only the warning exposed it.

**Fixed** by restoring the comment. Verified: `/*` vs `*/` balance is now
`delta=1` in both `HEAD` and the working tree — the single remaining unclosed
comment is **pre-existing**, not mine. The Vite warning is gone.

## 5b. Additional layers completed in the same pass

### Member-hero illustration → tokens
`LambHero.tsx` painted its landscape with literals that only made sense on
white: `#E4F7FC` sky, `#BAE6FD` far cloud, `#CBE9A1` / `#78C99A` / `#37A978`
leaves. These are now `--lamb-sky`, `--lamb-sky-far`, `--lamb-leaf-far`,
`--lamb-leaf-mid`, `--lamb-leaf-near`, with a dark set
(`#0d2b33` / `#14414c` / `#1c4f3f` / `#1e6b4e` / `#17553c`). `.lamb-hero`'s
gradient also has a dark branch.

### `/care` clay → teal family
`.dark` already carried a complete clay override, but it was the **neutral
sage** (`hsl(110 …)`), which clashed with the teal canvas. Retuned to the teal
family and re-measured: mint-ink on mint **9.00**, peach-ink **9.76**,
butter-ink **8.93**, body ink on grounds **14.0–15.7**.

### Chart series + activity accents for dark
`--chart-1..6` and `--activity-orange`, `--care-purple`, `--relationship-pink`
now have dark values (6.34–10.22 on canvas). **Correction to an earlier claim of
mine:** the light series was *already* ≥3.68:1 on the dark canvas, so it was
never invisible — this is an improvement, not a bug fix. The comment in
`index.css` now says so.

### Two real dark-mode contrast bugs found and fixed
| | Was | Now |
|---|---|---|
| `index.css:613` button on primary | `color: #ffffff` → **2.15:1 in dark** | `var(--color-on-primary)` → 7.85:1 |
| Notification badge (`Topbar`, `LambQuickActions`) | `text-white` on `--color-error` → **3.20:1 in dark** | `text-[var(--color-on-primary)]` → 5.27:1 |
| `MemberReports` form + report row | `bg-white` cards on a `#061a1f` canvas | `bg-[var(--lamb-surface)]` |

### `theme-color` meta
`ThemeContext` set dark → `#000000`. Now `#061a1f`, matching the canvas, and
`client/index.html` was updated to match (dark is the default).

### Docs
`brand-spec.md` gained a full **Dark mode** section (palette + the glass rules +
the "never `color:#fff` on a primary fill" warning). `design.md` gained a
matching Thai section `## 1b. โหมดมืด`.

## 5c. Two tests were made less brittle, not weaker

Both hardcoded colours that had now legitimately changed. In each case the
**assertion was kept or tightened**; only the stale literal was removed.

- `design-tokens.test.ts:236` — the dark accent-soft assertion hardcoded the
  retired sage `rgba(127,175,114,…)` and `#7faf72`. The mix base is now **read
  from the sheet**. Still asserts ≥4.5:1.
- `ux-audit-regressions.test.ts` — the theme-color test pinned `#000000` /
  `#f5f5f7` and the static meta. It now **reads both canvases from `index.css`
  and compares**, and still asserts no `media=` attribute.

## 6. Verification

| Gate | Result |
|---|---|
| `pnpm check` | ✅ exit 0 |
| `pnpm test` (client + shared) | ✅ 22 files / 246 tests |
| `pnpm test` (full) | **not re-run** — see §7 |
| `pnpm build` | ✅ exit 0, CSS warning cleared |
| Contrast (12 pairs) | ✅ all ≥4.5:1, computed before the CSS was written |
| Visual | ✅ rendered the real stylesheet at 1180×700 with `html.dark` |

The screenshot confirmed: dark canvas, glass cards, teal primary, distinguishable
text ramp, and the `.lamb-theme` section now rendering from central tokens with
its mint surface correctly darkened.

## 7. Honest limitations

| | |
|---|---|
| **33 pages NOT swept** | Pages still contain light-specific hardcoded CSS (`.pk-card`, `.lamb-hero` gradients, clay surfaces on `/care`, activity-accent colours, chart series). Those need per-route review. |
| **Not run in the real app** | The dark theme has **never been seen inside the Vite app**. Verification used the real stylesheet in a harness, which does not execute Tailwind's generated utilities or React. |
| **Light theme not re-verified** | The `:root` palette is untouched, but `.lamb-theme`'s light branch now aliases `primary-focus` instead of a dedicated hex — its light rendering is unverified. |
| **`/care` clay surfaces** | `.clay-*` is an opt-in sage/peach/butter palette that was built for a light canvas. It will look wrong on dark. **Not addressed.** |
| **Chart series `--chart-1..6`** | Not remapped in dark; not addressed. |
| **Full test suite** | Last full run (63 files / 781 tests) predates this change. Client + shared re-run green; **server suites not re-run.** |
| **`design-tokens.test.ts` was edited** | Its dark-accent assertion hardcoded the retired sage values. The tint base is now **read from the sheet** instead of hardcoded — the ≥4.5:1 assertion is unchanged, only the stale constant removed. |

## 8. Remaining work, in order

1. **Sweep the 33 pages** — replace hardcoded light CSS; review `.pk-card`,
   `.lamb-hero`, `.clay-*`, activity accents, chart colours per route
2. **Decide `/care` clay** — re-skin for dark, or drop the clay scope in dark
3. **Chart series** — remap or desaturate for dark
4. **Verify light mode** still looks right after the `.lamb-theme` alias change
5. **Run the full suite** (`pnpm test`) and re-render every route at
   390 / 768 / 1280 × light / dark
6. Update `brand-spec.md` + `design.md` with the dark palette (not yet done —
   they still document the light teal as the only identity)

## 10. Route sweep — DONE (2026-10-15)

**111 loads · 37 routes · desktop 1280x900 (dark + light) and mobile 390x844 (dark).**

Driven over the Chrome DevTools Protocol against a real dev server
(Vite 3001 -> API 3102, `PUNTAKIT_DEMO_MODE=1`, authenticated as
`demo@puntakit.local` / role `admin`, 8 members of local PGlite data).
No dependency was installed — the Chromium already on the box was driven with
Node's built-in `WebSocket`.

| Check | Result |
|---|---|
| Horizontal overflow | **0 / 111** |
| Console errors / uncaught exceptions | **0 / 111** |
| API responses >= 400 | **0 / 111** |
| Theme applied as requested | **111 / 111 correct, 0 mismatches** |
| Screenshots captured | 111 |

Dark resolved to `rgb(6, 26, 31)` and light to `rgb(245, 245, 247)` on every
route, confirming `ThemeProvider defaultTheme="dark"` plus the toggle both work
end-to-end.

### Sub-44px findings — mostly false positives
| Flagged | Verdict |
|---|---|
| `<a>` 1x1 on ~34 routes | **False positive** — the shell's skip link, visually hidden until focused |
| `<a>` 144x21 on `/terms` | **Expected** — an inline prose link; WCAG 2.5.8 exempts links inline in a sentence |
| `<input>` 20x20 on `/follow-up` | **Unconfirmed** — a focused re-probe found 0 sub-44px controls |
| `<button>` 36px on `/login` and `/` | **Unconfirmed**, same reason |

The two unconfirmed classes did not reproduce on a second, slower probe
(4.5 s settle instead of 2.2 s), so they are most likely transient elements
captured during the theme reload rather than real defects. **Not claimed as
fixed.**

### Roles not covered
Swept as `admin`. `/admin/users` and `/admin/pins` require `SUPER_ADMIN_ROLES`,
so both rendered the denial screen — which was itself verified as legible in
dark. Their real content is **not visually verified**.

### Also still open
**G-02**, the `/app/reports/:id` dead link, is untouched — a separate
approved-item decision.

`MemberCard`'s printed membership card (`--card-emerald-*`, `--card-gold-*`)
was deliberately **left alone**: it mocks a physical card with its own ink and
a white plate, and reads correctly on a dark page by design.

## 11. Status

| Item | Status |
|---|---|
| Dark palette | **IMPLEMENTED + TESTED + SWEPT** |
| Glass chrome | **IMPLEMENTED + SWEPT** |
| `.lamb-theme` to central tokens (D5) | **IMPLEMENTED + TESTED + SWEPT** |
| Hardcoded lamb hexes (17) | **IMPLEMENTED + SWEPT** |
| Member-hero illustration tokens | **IMPLEMENTED + SWEPT** |
| `/care` clay to teal | **IMPLEMENTED + SWEPT** |
| Chart series + activity accents | **IMPLEMENTED** |
| Dark contrast bugs (2) + `bg-white` cards (2) | **FOUND + FIXED + SWEPT** |
| `theme-color` | **FIXED** |
| `brand-spec.md` + `design.md` | **UPDATED** |
| Self-inflicted CSS comment break | **FOUND + FIXED** |
| Route sweep 111 loads | **DONE — 0 overflow / 0 errors / 0 theme mismatch** |
| `/admin/*` real content as `super_admin` | **NOT VERIFIED** |
| Commits / pushes / deploys | **NONE** |
| Dependencies installed | **NONE** |