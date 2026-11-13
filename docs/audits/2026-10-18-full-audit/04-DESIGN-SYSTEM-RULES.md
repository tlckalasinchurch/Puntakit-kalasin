# 04 — Binding design-system rules, and how the documents contradict each other

**Purpose:** so that any engineer or agent auditing this codebase judges it against the project's *real* rules instead of a generic checklist.

---

## 1. Authority order — settled, use it

Four documents independently declare the same precedence:

> `client/src/index.css` > `design.md` ≈ `brand-spec.md` > `PRODUCT.md` / `CLAUDE.md` > `DESIGN-apple.md`

- `brand-spec.md:3-5` — "If this file and `index.css` ever disagree, **`index.css` wins**"
- `design.md:5-6` — same, in Thai
- `CLAUDE.md:54,56` — same
- `DESIGN-apple.md:276` — **"REFERENCE ONLY… Do not copy its colours or fonts into Puntakit code."**

`DESIGN-apple.md` is a **trap**. Its Action Blue `#0068CC`, SF Pro, 8px spacing base and `3px 5px 30px` shadow all directly contradict Puntakit, and it says so itself.

---

## 2. ⚠️ Three doc-vs-CSS contradictions — audit against CSS

### C1 — Card radius. The docs are stale and wrong.
| Source | Claim |
|---|---|
| `brand-spec.md:159-160` | legacy `--radius-card` maps to `--radius-lg` |
| `brand-spec.md:173`, `design.md:142` | cards are at `--radius-lg` (18px) |
| **`index.css:134-136` (authoritative)** | `--radius-card: 24px`, `--radius-tile: 16px`, `--radius-panel: 16px` |

**Consequence:** real `.card-surface` cards are **24px**, not 18px. `design.md`'s radius-scale section lists no card/tile/panel token at all. **No test guards this** — `design-tokens.test.ts` only checks that the docs *mention* `index.css`.

### C2 — `--shadow-card` exists but is documented nowhere.
`index.css:122` defines a **two-layer** shadow:
```
--shadow-card: 0 1px 2px rgba(23,23,23,.06), 0 14px 28px -16px rgba(23,23,23,.2)
```
`brand-spec.md:167-169` says `--shadow` is "the only standard elevation". `design.md:143` bans stacked shadows ("ห้ามซ้อนเงาหลายชั้น") and `design.md:199` grants the exception **only to `clay-*` classes**. Yet `--shadow-card` is the default card elevation via `.card-surface` (30 uses / 12 files) plus five more selectors. **The exception has leaked outside `clay-*`.**

### C3 — `--color-secondary` and `--color-accent-orange` are "never text" but both are currently **dead tokens**.
`CLAUDE.md:54` and `design.md:22-23` forbid them as text. Zero violations exist — but `palette-contrast.test.ts:159` only scans `index.css`, so a `.tsx` violation would pass CI.

---

## 3. The real token values

### Radius (`index.css:47-53`, legacy `:134-136`)
```
--radius-none 0 · --radius-xs 5 · --radius-sm 8 · --radius-md 11 · --radius-lg 18 · --radius-pill 9999 · --radius-circle 50%
--radius-card 24 · --radius-tile 16 · --radius-panel 16      ← undocumented, CSS wins
```

### Colour — light (`brand-spec.md:26-62`)
| Token | Value | Role |
|---|---|---|
| `--color-primary` | `#0c7c82` | fills, icons. **Unsafe as text on soft/mint tints (4.13–4.47:1)** |
| `--color-primary-ink` | `#0a6a70` | the safe teal *text* colour (≥4.5:1 on every tint) |
| `--color-primary-focus` | `#09666b` | focus ring, hover |
| `--color-on-primary` | `#ffffff` | text **on** a primary fill. Never hardcode `#fff` |
| `--color-secondary` | `#35b4b0` | **never text** |
| `--color-accent-orange` | `#ff8a3d` | **fill or dot only** |
| `--color-accent-soft` | `#e6f6f5` | selected/active tint |
| `--color-canvas` | `#fffbf7` | page background |
| `--color-hairline` | `#dce8e7` | 1px card border |
| `--color-ink` | `#1f2937` | body text |
| status | success `#1e8e5a` · warning `#c77819` · error `#c23b4d` · info `#2f6fcc` | **fixed meaning, never repurpose** |
| status `-ink` | `#15704a` · `#8a5410` · `#b02a3e` · `#1f5aa6` | the AA-safe *text* variant of each status |
| status `-soft` | e.g. `#e6f1ff` | the tint |

**The `-ink` convention is the single most-violated rule:** plain `--color-warning` used as body text measures ~3.0–3.3:1 and fails AA. The tokens exist precisely to prevent this.

### Dark mode (default since 2026-10-15)
canvas `#111827` · surface `#1f2937` · primary `#35b4b0` · primary-ink `#5fd0cc` · **on-primary `#111827`** (inverted — white on the lighter dark fill is 2.3:1).

### Typography (`index.css:207-215`)
| Class | size/weight/line-height |
|---|---|
| `.type-hero` | 56 / 600 / 1.07 |
| `.type-display-lg` | 40 / 600 / 1.1 |
| `.type-display-md` | 34 / 600 / 1.15 |
| `.type-lead` | 28 / 400 / 1.35 |
| `.type-body` | 17 / 400 / 1.47 |
| `.type-body-strong` | 17 / 600 / 1.47 |
| `.type-caption` | 14 / 400 / 1.45 |
| `.type-caption-strong` | 14 / 600 / 1.45 |
| `.type-fine` | 12 / 400 / 1.4 |

Font: **`"Prompt"` only**, weights 400/500/600/700/800, loaded via head `<link>` not `@import`. Line-heights exist **only in CSS** — the docs never state them.

### Elevation
- `--shadow` — single layer. Light `0 10px 28px rgba(29,29,31,.08)`; dark `rgba(0,0,0,.5)`.
- `--shadow-card` — two layers, see C2.
- **Shadows must be neutral black.** A hued shadow violates `brand-spec.md:164` / `design.md:123`. (Currently 100% compliant.)
- **Chrome stays flat** (`brand-spec.md:165`, `design.md:119`).
- Overlays (drawer, dropdown, modal, tooltip) get the deeper black.

### Spacing (`design.md:134-138`)
4px base: `4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48`. In-card 16–24px, between cards 16px, page margin 24px. **No spacing tokens exist in CSS** — doc-only.

### Composition
240px graphite sidebar · 76px sticky topbar · content locked at 1440px · **minimum touch target 44×44px** · body line length ≤ ~70 characters.

---

## 4. Binding prohibitions

| # | Forbidden | Cite |
|---|---|---|
| 1 | Hardcoding white on a primary fill — use `--color-on-primary` | `CLAUDE.md:54` |
| 2 | `--color-secondary` / `--color-accent-orange` as a text colour | `CLAUDE.md:54` |
| 3 | Teal as the only status signal (needs icon or label) | `brand-spec.md:40` |
| 4 | Status by colour alone — `StatusChip` always carries text | `design.md:171` |
| 5 | Meaningless gradients | `design.md:89` |
| 6 | More than 3 accent tones on one page | `design.md:90` |
| 7 | Hardcoded hex in components — always `var(--token)` | `design.md:92` |
| 8 | Raw Tailwind palette (`slate-*`, `blue-*`, `gray-*`) — breaks dark mode | `design.md:180` |
| 9 | `.dark` must be a **token remap**, never a class override / `!important` | `design.md:43` |
| 10 | A second font family | `design.md:97` |
| 11 | Inline `font-size` — use `.type-*` | `design.md:98` |
| 12 | Real content below `.type-fine` (12px) | `design.md:188` |
| 13 | Hued shadows | `design.md:123` |
| 14 | Stacked shadows, except `clay-*` | `design.md:143`, `:199` |
| 15 | Shadow on chrome | `design.md:119` |
| 16 | `"..."` as a loading indicator — use `…` (U+2026) | `design.md:150` |
| 17 | Empty state and error state co-rendered with loading | `design.md:151` |
| 18 | **Mock or fabricated data** — honest empty state beats a plausible number | `PRODUCT.md:24` |
| 19 | Animation not caused by a user action; must honour `prefers-reduced-motion` | `design.md:154` |
| 20 | Re-declaring `PageHeader`/`SectionHeader`/`EmptyState`/`ErrorState`/`StatusChip`/`Modal`/`Field` | `design.md:162` |
| 21 | Direct use of `.modal-card` / `.modal-backdrop` | `design.md:172` |
| 22 | A placeholder used as a label | `design.md:173` |
| 23 | A raw error as the primary message | `design.md:170` |
| 24 | Horizontal scroll at 360–414px | `design.md:185` |
| 25 | Tables over 4 columns not collapsing at `md` | `design.md:186` |
| 26 | Buttons/links without a `:focus-visible` ring | `design.md:189` |

---

## 5. 🔴 No WCAG level is claimed anywhere

The only conformance language in the entire doc set is the phrase "AA contrast" applied to a single token (`brand-spec.md:93`). **Do not report "fails WCAG 2.1 AA" as a project-requirement violation** — no such requirement is written down. Report against the measured thresholds instead:

- text on primary fill ≥ 4.5:1 (both themes)
- focus ring ≥ 3:1 on canvas and surface
- `--color-primary-ink` ≥ 4.5:1 on canvas/surface/soft tints (both themes)
- sidebar muted text ≥ 4.5:1
- disabled text ≥ 3:1
- touch target 44×44px

---

## 6. What CI already guarantees — do not re-report

`pnpm test` locks: core token hexes · on-primary contrast both themes · primary-ink contrast · focus-ring contrast · the 12px floor (`text-[9|10|11]px`) · the retired Tailwind palette · `!important` dark overrides · no `.modal-card` · `PageHeader.primaryAction` ≤ 1 button · theme boot defaults to dark · skip links in both shells · `--app-vh` over `100vh` · reduced-motion blocks · bottom-nav contrast · MemberPicker keyboard combobox · bottom-nav active state by shape not colour.

**A rule absent from that list is doc-only and is yours to check.**

### Known holes in the guards
1. Retired-literal scan is **CSS-only** → the retired orange `#e8560a` survives at `lib/geo.ts:77`.
2. The 12px floor matches only Tailwind utilities → a JS `fontSize: "11px"` is invisible (which is how `components/map/pins.ts:57` shipped).
3. The floor never scans `index.css` (ten sub-12px declarations live there).
4. The retired-palette regex requires a numeric shade → `bg-white` / `text-black` / `ring-black` are unmatchable.
5. The banned-component test matches `function PageHeader` / `className="modal-card"` → **hand-rolled bypasses are invisible.**
6. Nothing verifies that a CSS class used in TSX actually has a rule in `index.css` (this is exactly how the `ComingSoon` defect shipped).
7. 66 of 197 class selectors in `index.css` are **dead**, and no guard detects new dead CSS.

---

## 7. Thai language requirements

Binding vocabulary (`CLAUDE.md:11`, `PRODUCT.md:22`): `พันธกิจ` = care group (`/groups`, `org_level='care'`), `บอดี้` = body, `ฝ่ายงาน` = ministry team. **`รหัสแคร์` and `หนค. (ต้นฉบับ)` must stay verbatim** — `shared/orgView.ts:28,30` parses them back.

`ErrorState` titles must be user-understandable Thai sentences with the raw error behind a technical disclosure (`design.md:170`). Numbers use `th-TH` formatting. Loading labels use `…`, never ASCII dots. Every login and profile page must link both `/privacy` and `/terms` (`design.md:156`).
