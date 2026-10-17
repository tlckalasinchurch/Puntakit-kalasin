# Login Rewrite — Implementation Record

**Status: IMPLEMENTED and TESTED. Visual verification: browser-rendered.**
**Date:** 2026-10-15
**Authorised by:** owner instruction, 2026-10-15 — *"รื้อแล้วทำใหม่ทั้งหน้า"*, after *"แก้ Batch 1 ก่อน แล้วค่อยทำ login"*

> This file supersedes the "IMPLEMENTED: NONE" line that earlier phases of this
> audit folder carried. Everything else in this folder is still accurate.

---

## 1. Why Batch 1 came first

The tree was **red**: `ux-audit-regressions.test.ts` failed because the
uncommitted palette swap in `client/src/index.css` changed
`--color-canvas-sunken` to `#f1f5f9` while `brand-spec.md` still said `#f2f2f4`.
Building UI on an already-failing baseline hides new breakage.

## 2. Batch 1 — baseline restored (documentation only)

| File | Change |
|---|---|
| `brand-spec.md` | 6 stale hexes → current token values; visual-direction line olive → teal; added the **neutral text ramp** (previously undocumented in CSS); added the **teal-text contrast rule** |
| `design.md` | 6 stale hexes → current token values; corrected `--color-canvas` description (page background, not card) |
| `CLAUDE.md:56` | removed the stale "olive `--color-primary: #315c2b`" claim |

**No token value was changed.** This commit is docs-only by construction.

## 3. The login rewrite

### Files changed
| File | Change |
|---|---|
| `client/src/index.css` | replaced the `.pin-login` block (was lines 2008–2052) — 311 lines |
| `client/src/pages/PinSignInPage.tsx` | rebuilt markup; **logic byte-identical** |

### What "Luxury Dark Glassmorphism" was applied as
- **Base** — near-black teal gradient `#04161a → #072028 → #0a2f33`, two slow
  aurora washes (teal + a faint champagne), `blur(72px)`, `isolation: isolate`
- **Glass card** — `backdrop-filter: blur(30px) saturate(155%)`, translucent
  `rgba(255,255,255,.055)` fill, `1px solid rgba(255,255,255,.15)` edge,
  inset top highlight, `2rem` radius, deep shadow
- **Keypad** — glass tiles with their own `backdrop-filter: blur(10px)`
- **One warm moment** — the CTA is a solid champagne gradient
  (`#f2e2c4 → #e8d3a8 → #d9bf8c`), the only non-cool element on the screen
- **Accent** — mint `#7ff0dd` for the PIN dots, eyebrow and focus ring

### Logic was NOT touched
State, `submit()`, `handleKeyDown`, rate of append, error handling and
`window.location.assign("/")` are unchanged. The reload after login is
deliberate — `AuthContext.user` is still null when the session cookie is
issued, so a client-side `navigate()` would bounce straight back to `/login`
(the same class of loop `ProtectedRoute` already guards against).

## 4. Three real defects found *by rendering it* — and fixed

These were invisible in source review and only appeared in a rendered
screenshot:

| # | Defect | Fix |
|---|---|---|
| **L1** | `.pin-login` had `overflow: hidden`, making it a scroll container. On a short phone the **legal links and the foot of the card were unreachable**. Pre-existing, inherited. | `overflow-x: clip` — hides the aurora bleed, leaves the block axis scrollable |
| **L2** | `.pin-login__eyebrow` carried `letter-spacing: .18em; text-transform: uppercase`. Thai has no letter case and tracking **shatters its word shapes** — "ยินดีต้อนรับกลับ" rendered as seven disconnected clusters. | tracking and uppercase removed; weight + colour carry the eyebrow |
| **L3** | Mobile logo used `tone="onLight"` → `--color-ink` `#0f172a`, i.e. **near-black text on a dark card**. | `tone="onDark"` |

Plus a seam on desktop where the brand rail's gradient panel ended in a hard
rectangle — now a left-anchored radial fade.

## 5. Dead code removed
`.pin-login__identity` and its three child rules — input styling for an
"identifier" field that does not exist in the component. A leftover of the
**unapproved** `pin-login` blueprint (`authenticateWithPin` identifier + PIN).
Not reinstated: that blueprint is still `NOT APPROVED`.

## 6. The elegant fix worth recording
`LegalLinks` is a **shared** component that paints itself from global light
tokens (`--color-canvas`, `--color-ink`, `--color-hairline`), so on a dark card
it rendered as two opaque white pills. Rather than fork the component or fight
Tailwind specificity, `.pin-login` now **re-points those tokens for its own
scope only**:

```css
.pin-login {
  --color-canvas: rgba(255, 255, 255, .055);
  --color-canvas-soft: rgba(255, 255, 255, .09);
  --color-ink: #f4faf9;
  --color-body-muted: rgba(244, 250, 249, .68);
  --color-hairline: rgba(255, 255, 255, .18);
  --color-divider: rgba(255, 255, 255, .12);
  --color-primary-focus: #7ff0dd;
}
```
`design-tokens.test.ts` reads only the `:root` block, so this is invisible to
the token contract by design — the token scope is the mechanism, not a bypass.

## 7. Verification

### Gates — all run, all green

| Gate | Result |
|---|---|
| `pnpm check` | ✅ exit 0 |
| `pnpm test` (full) | ✅ **63 files / 781 tests** |
| `pnpm build` | ✅ exit 0 |

### Contract compliance — checked individually
| Rule | Result |
|---|---|
| `auth-session-contract` | `pin-login__error` ✓ · no `<SignIn>` ✓ · `api.post("/api/auth/login", { pin })` ✓ |
| `ux-audit-regressions` | `<LegalLinks />` ✓ · `usePageTitle(` ✓ |
| `design-system-consistency` | 0 retired palette classes · 0 sub-12px text |
| `premium-shell-contract` | 0 `pk-glass` / `pk-premium` in the page |
| `design-tokens` retired hexes | 0 (`#2f72bf` hit is the pre-existing `--color-info-strong` **token declaration**, which the test explicitly permits) |
| `design-tokens` blueGray scan | **0 offenders** across all of `index.css` outside `:root` — every new hex verified `safe` |

### Contrast — measured, not assumed
Every pairing was computed before a line of CSS was written:

| Pairing | Ratio | |
|---|---|---|
| body/heading on base | 17.53 | ✅ |
| mint accent on base | 13.58 | ✅ |
| champagne on base | 12.61 | ✅ |
| heading / mint / champagne on the glass card | 15.35 / 11.90 / 11.05 | ✅ |
| secondary text `.74` on card | 9.39 | ✅ |
| tertiary text `.56` on card | 5.95 | ✅ |
| keypad digit on glass key | 11.59 | ✅ |
| CTA label on champagne | 12.61 | ✅ |

### Visual verification
Rendered the **real** `.pin-login` CSS + markup in headless Chromium
(no dependency installed — the browser was already on the box) at **390×844**
and **1280×820**, and inspected both. Screenshot review is what surfaced L1–L3.

## 8. Honest limitations

| | |
|---|---|
| **NOT verified** | The login running inside the **real Vite app** with **Prompt** actually loaded. The harness used a system-font fallback because there is no network in this environment, so real Thai typography is untested. |
| **NOT verified** | Live PIN submission end-to-end. Requires a running API + a seeded PIN. |
| **NOT verified** | Dark-mode *toggle* interplay — `.pin-login` is intentionally theme-independent and always dark, but that was not exercised in the app. |
| **NOT verified** | Safari/iOS `backdrop-filter`, and real safe-area insets on a notched device. |
| **NOT changed** | `window.location.assign("/")` after login — see §3. |
| **NOT done** | `.pin-login` remains a **token-exempt scope** (audit finding **D9** still stands). It now declares its own `--pin-*` tokens, which is tidier, but it still does not read the global brand tokens. Converging it is decision **D5**, still open. |
| **NOT done** | Server suites were re-run in full after Batch 1 and after the first rewrite; the three post-screenshot fixes were CSS-only and covered by the `client/ shared/` run. |

## 9. Status summary

| Item | Status |
|---|---|
| Batch 1 (docs → tokens) | **IMPLEMENTED + TESTED** |
| Login rewrite | **IMPLEMENTED + TESTED + browser-rendered** |
| Dead CSS removed | **IMPLEMENTED** |
| L1 / L2 / L3 defects | **FOUND + FIXED** |
| `pnpm check` / `pnpm test` / `pnpm build` | **ALL GREEN** |
| Runtime login in the real app | **NOT VERIFIED** |
| Commits / pushes / deploys | **NONE** |
| Dependencies installed | **NONE** |