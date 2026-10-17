# Puntakit brand spec

> **Source of truth:** the token block at the top of `client/src/index.css` (`:root`).
> `design.md` is the working reference. If this file and `index.css` ever disagree,
> `index.css` wins — fix this file.

## Visual direction

Premium Teal, soft mint and warm white: slate chrome, white cards on a warm-white canvas,
and one strategic teal. The interface stays calm, minimal and people-centered; teal marks
the primary action and the current place, not every control. A single limited warm accent
(`#ff8a3d`) exists as a fill or dot only. Church blue, deep navy, olive green and Neon
Orange (decided 2026-10-17, replaced 2026-10-18) were earlier identities and are retired.
The Puntakit logo keeps its original colours in every theme (it is a multicolour mark on a
white plate).

## Assets

- Hero illustration: `/manus-storage/puntakit-hero_d9170436.png`
- Inspirational Bible illustration: `/manus-storage/puntakit-bible_6f94bd0e.png`

## Tokens

**Primary (Premium Teal, used strategically)**

| Token | Hex | Use |
|---|---|---|
| Primary | `#0c7c82` | fill of primary buttons, selected state, current-page indicator. White text on it is 4.98:1 |
| On primary | `#ffffff` | text/icons on the teal fill (dark mode: `#111827` on the lighter fill) |
| Primary hover / ring | `#09666b` | hover / pressed fill (6.72:1 with white) and focus ring (6.53:1 on canvas) |
| Primary ink | `#0a6a70` | teal as text, link or icon on light surfaces (6.16:1 on canvas, >= 5.26:1 on every tint) |
| Primary on dark | `#35b4b0` | accent on the dark chrome (7.02:1) |
| Primary tint (soft mint) | `#e6f6f5` | selected/active surface, soft chip background |
| Secondary | `#35b4b0` | fills, icons and chart accents only (2.5:1 on white, never text) |
| Accent orange | `#ff8a3d` | the one limited warm accent: a dot or fill, never text or a primary action |

> **Contrast rule for teal.** `#0c7c82` is 4.83:1 on canvas but 4.13-4.47:1 on the soft
> and mint tints, so as *text* it is not safe everywhere: it is a fill colour that carries
> white text, and teal text and links use `--color-primary-ink`. The secondary `#35b4b0`
> is never a text colour. Status is never carried by teal alone (icon or label as well).
> All pairs are measured from the real tokens in `palette-contrast.test.ts`.

**Chrome & surfaces** (a three-step neutral ladder)

| Token | Hex | Use |
|---|---|---|
| Ink | `#1f2937` | headings and body text |
| Ink muted | `#5b6472` | secondary text, labels, metadata |
| Canvas (`--color-background`) | `#fffbf7` | the page background (warm white) |
| Canvas soft | `#f6f1eb` | wells, table stripes, `secondary` / `muted` / `accent` |
| Surface | `#ffffff` | card surfaces |
| Sunken | `#efe9e1` | recessed areas only: inset wells, hover fills |
| Divider | `#e8f0ef` | hairlines inside a card |
| Hairline (`--color-border`) | `#dce8e7` | card borders, inputs (`--border`, `--input`) |

**Neutral text ramp** (for secondary and muted copy on canvas)

| Token | Hex | Use | On canvas |
|---|---|---|---|
| Text secondary | `#4b5563` | supporting copy, descriptions | 7.34:1 |
| Text tertiary | `#5b6472` | metadata, helper text | 5.81:1 |
| Text quaternary | `#5b6472` | the quietest legible text (>= 4.96:1 on every surface) | 5.81:1 |

> The Master Prompt's `#6b7280` for secondary text measures 4.0-4.8:1 and fails on the soft,
> sunken and mint surfaces, so the ramp above is used instead.

**Semantic aliases** (no second source of truth; they resolve onto the tokens above):
`--color-background`, `--color-text-primary`, `--color-border`, `--color-focus-ring`,
`--color-primary-hover`, `--color-primary-foreground`, `--color-surface-elevated`,
`--color-surface-selected`, `--color-state-hover`, `--color-state-active`, `--color-disabled`,
`--color-disabled-ink`.

**Dark chrome**

| Token | Hex | Use |
|---|---|---|
| Chrome | `#111827` | sidebar, dark surfaces, tooltips |
| Chrome 2 | `#1f2937` | raised dark surface |
| Chrome 3 | `#0d1320` | recessed dark surface |
| On dark | `#f9fafb` | text on the chrome |
| On dark muted | `#9ca3af` | secondary text on the chrome (6.99:1) |
| On dark hairline | `#2b3544` | dividers on the chrome |
| Black | `#000000` | dark-mode page background |

**Status (fixed meaning — never repurpose these)**

| Token | Hex | Meaning |
|---|---|---|
| Success | `#1e8e5a` | success, active, confirmed |
| Warning | `#c77819` | warning, needs attention |
| Error | `#c23b4d` | error, destructive, delete |
| Info | `#2f6fcc` | neutral information only |
| Info strong | `#2f72bf` | info text/icon on white (AA contrast) |
| Info soft | `#e6f1ff` | info chip background on white |

**Activity accents** (semantic only, max 3 tones per page)

| Token | Hex | Meaning |
|---|---|---|
| Care purple | `#7950d8` | care / prayer ministry activity |
| Relationship pink | `#e85d78` | relationships / follow-up activity |
| Activity orange | `#f3a23a` | activity / scheduling |

**Chart series** — use in order, do not reorder:
`#548bd9` · `#44b889` · `#f1a73b` · `#df5b79` · `#7e5ad6` · `#45a8a4`

## Dark mode (the default as of 2026-10-15)

Dark is not a variant of light here — it is its own retuned palette, measured
against the PIN sign-in surface. `ThemeProvider` defaults to `dark`; the toggle
stays. **`.dark` is a token remap**, never a class override (`!important` dark
rules are banned by `design-system-consistency.test.ts`).

| Token | Hex | On canvas |
|---|---|---|
| Canvas | `#111827` | - |
| Canvas soft / elevated surface | `#273449` | - |
| Surface | `#1f2937` | - |
| Sunken | `#0d1320` | - |
| Border / hairline | `#374151` | - |
| Ink | `#f9fafb` | 16.98:1 |
| Text secondary | `#d1d5db` | 12.04:1 |
| Text tertiary | `#b6bdc9` | 9.39:1 |
| Text quaternary | `#a3acb9` | >= 4.5:1 on every surface |
| Primary (fill) | `#35b4b0` | 7.02:1 against canvas |
| Primary hover / ring | `#4cc5c1` | 8.50:1 on canvas |
| Primary ink (text) | `#5fd0cc` | 9.61:1 as text |
| On primary | `#111827` | 7.02:1 on the fill |

> **Do not write `color: #fff` on a primary fill.** It is 4.98:1 in light mode but 2.3:1
> on the lighter dark-mode fill. Use `var(--color-on-primary)`, which follows the theme.

**Glass.** Chrome in dark mode is glass, not flat fill: `--glass-fill`,
`--glass-fill-strong`, `--glass-line`, `--glass-line-bright`, `--glass-blur`.
A card reads as glass through its **top-edge highlight**, not a drop shadow
alone.

**The member app shares this palette.** `.lamb-theme` is now pure aliases onto
the central tokens — there is no second brand left to drift.

## Typography

**Prompt** — Thai-first, weights 400/500/600/700/800. One family; no second
typeface. Use the `.type-*` utility classes defined in `index.css` rather than
inline sizes:

`.type-hero` 56/600 · `.type-display-lg` 40/600 · `.type-display-md` 34/600 ·
`.type-lead` 28/400 · `.type-body` 17/400 · `.type-body-strong` 17/600 ·
`.type-caption` 14/400 · `.type-caption-strong` 14/600 · `.type-fine` 12/400

Keep body line length at or under ~70 characters. Headings take negative
letter-spacing; body text does not.

## Radius

`--radius-xs` 5px · `--radius-sm` 8px · `--radius-md` 11px · `--radius-lg` 18px ·
`--radius-pill` 9999px · `--radius-circle` 50%

Legacy aliases `--radius-tile` / `--radius-panel` / `--radius-card` map to
md / md / lg respectively.

## Shadow

Elevation is neutral black, never a hue. Only elements that genuinely lift off
the canvas get a shadow; chrome stays flat.

- `--shadow` — `0 10px 28px rgba(29,29,31,.08)` — the only standard elevation
- Overlays (drawer, dropdown, tooltip) use a deeper, more opaque black

## Composition

240px graphite sidebar · 76px sticky topbar · fluid content · 70/30 main/right
split · cards at `--radius-lg` with a hairline border and low or no elevation.
Minimum touch target 44 × 44px. Content locks at 1440px; margins absorb beyond.
