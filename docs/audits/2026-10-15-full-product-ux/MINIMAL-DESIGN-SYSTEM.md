# MINIMAL-DESIGN-SYSTEM.md

**Status: AUDITED (read-only). No token, CSS, or component file was modified.**

> **Status update 2026-10-16 (documentation only).** This audit was written against a working tree with uncommitted changes. Since then the teal palette, the dark theme tokens, the `.lamb-theme` mapping and `brand-spec.md` / `design.md` have been committed (`f87c770`). Findings that describe the pre-commit state are kept as audited and followed by a "Status at HEAD" note. `index.css` line numbers are given for HEAD `1e8f58f` unless marked "as audited". The 8 token rows and the contrast measurements are unchanged.

---

## 1. Headline finding — the proposed palette is already 88% implemented

The brief proposes 9 colour values. **8 of 9 already exist as tokens in `client/src/index.css`**, and they were put there by a working-tree change that was **uncommitted when this audit ran** and is now committed in `f87c770` `[RUN]`.

| Proposed | Token | Value | `index.css` line | Already present? |
|---|---|---|---|---|
| Primary `#0C7C82` | `--color-primary` | `#0c7c82` | 12 | ✅ yes (committed, `f87c770`) |
| Primary hover `#09696E` | `--color-primary-focus` | `#09696e` | 13 | ✅ yes (committed, `f87c770`) |
| Primary subtle `#E8F5F4` | — | — | — | ❌ **does not exist anywhere** |
| Page background `#F8FAFC` | `--color-canvas` | `#f8fafc` | 18 | ✅ yes (committed, `f87c770`) |
| Surface `#FFFFFF` | `--color-surface` | `#ffffff` | 20 | ✅ yes (committed, `f87c770`) |
| Border `#E2E8F0` | `--color-divider` / `--color-hairline` | `#e2e8f0` | 25, 26 | ✅ yes (committed, `f87c770`) |
| Primary text `#0F172A` | `--color-ink` | `#0f172a` | 15 | ✅ yes (committed, `f87c770`) |
| Secondary text `#475569` | `--color-text-secondary` | `#475569` | 63 | ✅ yes (committed, `f87c770`) |
| Muted text `#64748B` | `--color-text-quaternary` | `#64748b` | 65 | ✅ yes (committed, `f87c770`) |

**`#E8F5F4` is the only genuinely new value.** Nearest existing tints: `--color-accent-soft: #e8f0e4` (`index.css:55`), `--lamb-mint` (was `#E4F7F2` at `:2062` when audited; now `var(--color-accent-soft)` at `:2303`), `--color-info-soft: #e6f1ff` (`:56`).

> **Do not add `#E8F5F4` blindly.** See §4 — the pairing it implies fails WCAG AA. The existing `--color-primary-focus` already solves it correctly.

---

## 2. Token architecture `[CODE]`

- **Tailwind v4.1.14**, CSS-first. **No `tailwind.config.*` exists** — config lives in `@theme inline` (`index.css:159-179`) + `:root`.
- **79 `--color-*` declarations.** `@theme` exposes only the shadcn bridge.
- **Radius** is a real scale: `--radius-xs 5 · sm 8 · md 11 · lg 18 · pill · circle`.
- **Shadow:** exactly one token, `--shadow: 0 10px 28px rgba(29,29,31,.08)` (`:100`).
- **Motion:** `--pk-ease-out/in`, `--pk-dur-fast/base/slow`, `--pk-rise`, `--pk-glass-blur`.
- **No spacing or type tokens.** `design.md` documents a 4 px scale that is **not encoded in CSS**.
- **Dark mode** (`.dark`, from `:1443`) is a **token remap**, not class overrides — the correct architecture, and enforced by `design-system-consistency.test.ts` (bans `!important` dark rules).

### 2.1 The actual design system is not `components/ui/`

`client/src/components/DesignSystem.tsx` (899 lines) is the real system: `PageHeader`, `SectionHeader`, `StatusChip`, `EmptyState`, `ErrorState`, `Field`, `FieldError`, `FormError`, `Modal` (focus trap + dirty-discard guard + `openModalStack`), `FilterDisclosure`, `ListPager`, `DataBar`, `InitialsAvatar`. Plus `LoadingStates.tsx` (7 skeletons) and `ConfirmDialog.tsx`.

`components/ui/` has **53 shadcn files but only 7 are actually imported**: `skeleton`, `button`, `card`, `input`, `sheet`, `popover`+`calendar`, `sonner`. The other 46 are unused — pages hand-roll classes instead.

**Implication for Phase 6:** "start with shared UI components" should mean **`DesignSystem.tsx` first**, *not* shadcn primitives. `AGENTS.md` also forbids hand-editing `components/ui/**` (shadcn-generated), and `components.json` uses `baseColor: neutral`, so re-running `shadcn add` would **overwrite the project palette**.

---

## 3. Font — the brief's premise is wrong `[RUN]`

> Brief: *"Reuse the existing Sarabun font configuration if present."*

**Sarabun is not present.** Repo-wide grep finds it only in prose (`docs/PUNTAKIT_MISSION_DOMAIN_PLAN.md:749`, two prior audit files). Zero occurrences in `client/`, `server/`, `shared/`, `index.html`, or any config.

The real font is **Prompt**:
- `"Prompt", system-ui, sans-serif` — `index.css:5` and `@theme --font-sans` `index.css:160`
- Loaded via Google Fonts `<link>` + preconnect (**deliberately not `@import`**, pinned by `ux-audit-regressions.test.ts`)
- Weights 400/500/600/700/800 — matches `brand-spec.md`
- Type scale: `.type-hero 56/600` · `.type-display-lg 40` · `-md 34` · `.type-lead 28` · `.type-body 17` · `.type-caption 14` · `.type-fine 12`

**Recommendation: keep Prompt.** Introducing a second Thai typeface would violate `brand-spec.md` ("one family; no second typeface") and require a Google Fonts change plus a visual-regression pass. **This is an owner decision, recorded not made.**

---

## 4. Contrast — measured, not estimated 🔴 `[RUN]`

I computed WCAG 2.1 ratios for every pairing the new palette creates.

| Pairing | Ratio | Result |
|---|---|---|
| `#FFFFFF` text on `#0C7C82` (primary button) | **4.98:1** | ✅ PASS AA |
| `#0C7C82` text on `#F8FAFC` (canvas) | **4.76:1** | ✅ PASS AA |
| `#0C7C82` text on `#FFFFFF` (surface) | **4.98:1** | ✅ PASS AA |
| `#0F172A` on `#F8FAFC` (body text) | **17.06:1** | ✅ PASS AAA |
| `#475569` on `#F8FAFC` (secondary) | **7.24:1** | ✅ PASS AAA |
| `#64748B` on `#F8FAFC` (muted) | **4.55:1** | ✅ PASS AA (tight) |
| `#64748B` on `#FFFFFF` (muted) | **4.76:1** | ✅ PASS AA |
| `#09696E` on `#E8F5F4` (hover on subtle) | **5.77:1** | ✅ PASS AA |
| **`#0C7C82` on `#E8F5F4`** (proposed subtle tint) | **4.45:1** | 🔴 **FAILS AA** (needs 4.5) |
| **`#0C7C82` on `#E4F7F2`** (`--lamb-mint`) | **4.47:1** | 🔴 **FAILS AA** |
| `#0A767C` on `#E4F7F2` (current `--lamb-primary`) | 4.85:1 | ✅ PASS AA |
| `#E2E8F0` border on `#FFFFFF` | 1.23:1 | ⚠️ informational — borders are non-text; 3:1 applies to meaningful UI boundaries, not decorative hairlines |

### 4.1 The palette was previously rejected for exactly this reason 🔴

At audit time `client/src/index.css:2059` carried this comment (**Status at HEAD:** that comment and `#0A767C` no longer exist in `index.css` — see §4.2):

```css
--lamb-primary: #0A767C; /* AA (>=4.78:1) on white, mint and canvas; was #0C7C82 (4.47:1 on mint) */
```

I reproduced the historic figure: `#0C7C82` on `#E4F7F2` = **4.47:1**. **Someone already tried this teal, measured it, and chose `#0A767C` instead.**

**This is the most important design finding in the audit.** The new `--color-primary: #0c7c82` is fine as a **button fill with white text (4.98:1)** — which is why `design-tokens.test.ts` still passes. The danger is **`#0C7C82` used as foreground text on a pale tint**, where it fails.

> **Rule that follows:** teal-as-fill ✅ (with white text); teal-as-text must use `--color-primary-focus` (`#09696e`, 5.77:1) on tinted backgrounds, or the surface must stay white.

### 4.2 `.lamb-theme` is an independent palette scope 🔴 (as audited — converged at HEAD, see the note after the decision line)

```
--lamb-primary:       #0A767C   ← deliberately ≠ --color-primary (#0c7c82)
--lamb-primary-dark:  #0a6b70
--lamb-primary-soft:  #35B4B0
--lamb-mint:          #E4F7F2
--lamb-canvas:        #F8F7F1   ← ≠ --color-canvas (#f8fafc)
--lamb-surface:       #FFFFFF
--lamb-ink:           #075B5D
```
(`index.css:2058-2076`, dark `:2069-2076` — line numbers as audited, before `f87c770`)

The member PWA does **not** follow `--color-primary`. Changing the global primary will **not** change the member app's brand colour — the two will drift further apart, not converge.

**Decision needed:** converge `.lamb-theme` onto the global tokens, or declare it a permanent independent brand. Both are defensible; neither is a UI decision.

**Status at HEAD (verified 2026-10-16):** the `.lamb-theme` block (`index.css:2300`) now derives from the global tokens: `--lamb-primary` and `--lamb-ink` are `var(--color-primary-focus)`, `--lamb-mint` is `var(--color-accent-soft)`, `--lamb-canvas` and `--lamb-surface` are `var(--color-canvas)` / `var(--color-surface)` (`:2301-2305`), with a second mapping at `:2322-2326`. The hard-coded `#0A767C` set above no longer exists, so the drift described here is resolved in code. Whether the owner explicitly approved convergence is not recorded in this folder, and the member app's rendered contrast with these tokens is **NOT VERIFIED**.

---

## 5. Documented token conflicts (must be fixed, not ignored) 🔴 `[RUN]`

`brand-spec.md:3-5` declares: *"If this file and `index.css` ever disagree, `index.css` wins — fix this file."* The then-uncommitted change broke that rule and left `brand-spec.md` stale; `brand-spec.md` and `design.md` were brought in line in `f87c770`.

| Token | `index.css` (as audited, uncommitted) | `brand-spec.md` (stale when audited) | Verdict when audited |
|---|---|---|---|
| Primary | `#0c7c82` (`:12`) | `#315c2b` (`:24`) | 🔴 conflict |
| Primary hover | `#09696e` (`:13`) | `#3f7337` (`:25`) | 🔴 conflict |
| Ink | `#0f172a` (`:15`) | `#1d1d1f` (`:33`) | 🔴 conflict |
| Ink muted | `#5b6474` (`:17`) | `#6f6f73` (`:34`) | 🔴 conflict |
| Canvas | `#f8fafc` (`:18`) | `#ffffff` (`:35`) | 🔴 conflict |
| Surface | `#ffffff` (`:20`) | `#fafafc` (`:37`) | 🔴 conflict |
| Sunken | `#f1f5f9` (`:58`) | `#f2f2f4` (`:38`) | 🔴 **conflict — breaks a test** |
| Divider | `#e2e8f0` (`:25`) | `#f0f0f0` (`:39`) | 🔴 conflict |
| Hairline | `#e2e8f0` (`:26`) | `#e0e0e0` (`:40`) | 🔴 conflict |
| Text secondary | `#475569` (`:63`) | `#55555a` | 🔴 conflict |

**Status at HEAD (verified 2026-10-16):** `brand-spec.md` (`:25` teal "Field" row `#0c7c82`, `:45` Sunken `#f1f5f9`, `:46-47` Divider/Hairline `#e2e8f0`) and `design.md:14` now carry the teal palette (`f87c770`), so the conflict rows above no longer hold. `CLAUDE.md:56` at HEAD still reads "olive … `#315c2b`"; the working-tree `CLAUDE.md` (modified, not committed) already says teal at `:53`.

As audited: `design.md:14-22` carried the **same 6 conflicts**. `CLAUDE.md:56` still says *"Design System V2 (olive `--color-primary: #315c2b`)"*.

### 5.1 The conflict already broke CI 🔴 `[RUN]`

`ux-audit-regressions.test.ts:569-577` (was `:535-543` when audited) asserts `brand-spec.md` contains the hex at `index.css:58`. It does not. **I ran it: 1 test fails, 66 pass in that file; client+shared overall 245 pass / 1 fail.**

`design-tokens.test.ts` was updated in lock-step with the CSS; `brand-spec.md`, `design.md` and `CLAUDE.md` were **not**.

**Status at HEAD:** resolved. `ux-audit-regressions.test.ts` passes (57 tests) and the full `pnpm test` passed 64 files / 796 tests on 2026-10-16 (run against the working tree, which also carries other uncommitted changes).

---

## 6. Component gaps against the brief

| Brief requirement | Current state `[CODE]` | Verdict |
|---|---|---|
| Buttons & action hierarchy | `Button` has 6 variants / 6 sizes; **no `loading` prop, no `aria-busy`, no spinner**. `PageAction.loading` only swaps label text. `size="sm"`/`"icon-sm"` = **36px**, below the 44px rule. | ⚠️ partial |
| Cards & density | `Card` has **no `cva`, no variants, no sizes**. Two competing radius scales: `rounded-[var(--radius-lg)]` (18px) in `Card`, `rounded-lg` (8px) in `Alert`/`Dialog`/`Sheet`. `bg-card` → `--color-canvas` `#f8fafc`, **not** the white `--color-surface` — "surface" and "card" are different tokens. | ⚠️ partial |
| Forms & validation | `Field` is good: hint/help/error, `aria-describedby`, `aria-invalid`, `*` + `sr-only " (จำเป็น)"`. **No validation library is used at runtime** — `zod` + `react-hook-form` are in `package.json` but have **zero client imports**. Hand-written `requiredErrors`. | ✅ pattern good, no lib |
| Tables & lists | `Table` primitive **unused**; pages write raw `<table>`. **`bg-muted` is broken** (see §7). | ⚠️ gap |
| Navigation & active states | Three different active-state algorithms across three navigations (exact / exact+special / prefix). | 🔴 inconsistent |
| Dialogs & confirmations | **Strong.** Shared `Modal` with focus trap, dirty-discard guard, modal stack; `ConfirmDialog` with `danger`/`primary` tones; `AlertDialog` exists but unused. | ✅ good |
| Loading / empty / error / success | **7 skeletons**; `EmptyState` + `ErrorState` with a technical-details disclosure; `FormError`; sonner toasts. All enforced by contract tests. | ✅ good |
| Mobile & touch targets | `min-h-11` (44px) pervasive; safe-area insets in 4 places; dual card/table presentation. | ✅ good |
| Status semantics | `StatusChip` with 5 tones and a label-always rule — **but tone maps are duplicated per page**, and `absent` is `neutral` in the member app but `--color-error` in admin. | 🔴 inconsistent |
| **Charts** | `--chart-1..6` declared and **never referenced**. `components/ui/chart.tsx` (recharts) **never imported**. **No chart exists on any page.** | ❌ none |
| Toast semantics | `sonner` mounted with **no per-type styling** — falls back to its own palette, not the project's status tokens. | ⚠️ gap |

---

## 7. Defects found `[CODE]`

| # | Defect | Location | Effect |
|---|---|---|---|
| **D1** | `--muted` declared **twice** in `:root` — `var(--color-canvas-soft)` at `:81`, then `var(--color-body-muted)` `#5b6474` at `:95`. Later wins. | `index.css:81,95` | `bg-muted` renders **mid-grey**, not a surface tint. Light and dark disagree. |
| **D2** | `ui/sidebar.tsx` consumes `--sidebar`, `--sidebar-foreground`, `--sidebar-accent`, `--sidebar-border`, `--sidebar-ring` — **none exist in `index.css`** | `ui/sidebar.tsx` | Those utilities resolve to nothing (file is unused, so latent) |
| **D3** | Two competing radius scales: Tailwind default `rounded-md/lg` (6/8px) vs project `--radius-md/lg` (11/18px). `@theme` declares **no `--radius-*`** | `index.css:159-179` | `rounded-md` ≠ `--radius-md` — silent inconsistency |
| **D4** | Dead parallel chip system `.chip-success/warning/error/info/neutral` using `color-mix` — **zero consumers** | `index.css:698-702` | Third chip language alongside `StatusChip` |
| **D5** | `absent` = `neutral` (member) vs `--color-error` (admin) | `MemberAttendance.tsx:139` vs `Attendance.tsx:151` | Same datum, opposite meaning |
| **D6** | `ImportDuplicates.tsx:353` — `differing === 0 ? "warning" : "neutral"` | `ImportDuplicates.tsx` | **Inverted**: zero differences shows a warning |
| **D7** | `skeleton.tsx` `animate-pulse` has no `motion-reduce:` guard (unlike `Home.tsx:334`) | `ui/skeleton.tsx` | Reduced-motion gap |
| **D8** | `PinManagement` uses shadcn `Sheet` while every other dialog uses the shared `Modal` | `PinManagement.tsx:180` | Two dialog systems in one product |
| **D9** | `.pin-login` is a **fully untokenised** second visual identity — hardcoded `#092b3a`, `#9affec`, `#b7c7ff`, `#138c82` | `index.css:2248-2289` (HEAD, still present; a rewrite of this block exists only in the uncommitted working tree) | Login does not follow the brand |
| **D10** | `--lamb-*` never follows `--color-*` — **resolved at HEAD**: `:2301-2305` and `:2322-2326` now reference `--color-*` | `index.css:2058+` as audited | Member and admin brands drift (as audited) |

---

## 8. Applying the brief without breaking anything

### 8.1 What is already done (committed in `f87c770`)
All 8 existing tokens. `design-tokens.test.ts` updated in lock-step and **passing** `[RUN]`.

### 8.2 What must NOT be done blindly

| Action | Why not |
|---|---|
| Add `--color-primary-subtle: #E8F5F4` and use `--color-primary` as text on it | **4.45:1 — fails AA.** Measured. Use `--color-primary-focus` (`#09696e`, 5.77:1) instead. |
| Update `brand-spec.md` **without** updating `design.md` + `CLAUDE.md` | Leaves the doc set inconsistent — the exact failure that produced the red test. |
| Introduce Sarabun | Not present; conflicts with `brand-spec.md` "one family". |
| Introduce a charting library | `recharts` exists but is unused; **no new dependencies without approval**. |
| Hand-edit `components/ui/**` | shadcn-generated; `AGENTS.md` forbids it. |
| Add `--sidebar*` tokens | `ui/sidebar.tsx` is unused. Delete-or-wire is a decision, not a design change. |
| Restyle the member PWA to match the new primary | `.lamb-theme` is deliberately separate and `.lamb-primary` is `#0A767C` for a **measured contrast reason**. |

### 8.3 The minimal correct sequence
1. Update `brand-spec.md`, `design.md`, `CLAUDE.md` to the teal palette → **turns the red test green**. (Status: `brand-spec.md` and `design.md` done in `f87c770`; `CLAUDE.md` still reads olive at HEAD.)
2. Decide `#E8F5F4`: either add it with `--color-primary-focus` as its foreground, or skip it. **Do not pair it with `--color-primary`.**
3. Fix D1 (`--muted`) — a genuine bug, independent of palette.
4. Fix D5/D6 (status semantics) — copy-paste defects.
5. **Then, and only then**, consider visual changes.

---

## 9. Honest status

| Item | Status |
|---|---|
| Token inventory, contrast measurements, doc conflicts | **AUDITED** — all measured `[RUN]` |
| Palette proposal reconciled against existing tokens | **AUDITED** — 8/9 already present |
| Contrast of every proposed pairing | **TESTED** — computed locally |
| Any token / CSS / component change | **NONE** — read-only |
| Visual/browser verification of the token swap | **NOT VERIFIED** — no browser used when audited; the per-route sweep is still not verified as of 2026-10-16 |
| `.lamb-theme` convergence decision | **WAITING FOR OWNER DECISION** |