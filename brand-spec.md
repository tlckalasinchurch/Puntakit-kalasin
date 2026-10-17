# Puntakit brand spec

> **Source of truth:** the token block at the top of `client/src/index.css` (`:root`).
> `design.md` is the working reference. If this file and `index.css` ever disagree,
> `index.css` wins — fix this file.

## Visual direction

Neon Orange and warm Porcelain: charcoal chrome, white cards on a porcelain canvas, and
one strategic orange. The interface stays warm and people-centered; orange marks the
primary action and the current place, not every control. Church blue, deep navy, olive
green and teal were earlier identities and are retired. The Puntakit logo keeps its
original colours in every theme.

## Assets

- Hero illustration: `/manus-storage/puntakit-hero_d9170436.png`
- Inspirational Bible illustration: `/manus-storage/puntakit-bible_6f94bd0e.png`

## Tokens

**Primary (Neon Orange, used strategically)**

| Token | Hex | Use |
|---|---|---|
| Primary | `#ff6115` | fill of primary buttons, selected state, current-page indicator. Text on it is `#171717` (5.95:1) |
| On primary | `#171717` | text/icons on the orange fill. Never white (3.01:1) |
| Primary hover / ring | `#e8560a` | hover / pressed fill and focus ring (3.55:1 on porcelain) |
| Primary ink | `#b93800` | orange as text, link or icon on light surfaces (5.64:1 on porcelain) |
| Primary on dark | `#ff6115` | accent on charcoal chrome (5.95:1) |
| Primary tint | `#ffeadb` | soft chip background |

> **Contrast rule for orange.** `#ff6115` is 2.94:1 on porcelain and 3.01:1 on white,
> so it is a *fill* colour only: it carries charcoal text, never white, and it is never
> body text. Orange text and links use `--color-primary-ink`. Status is never carried
> by orange alone (icon or label as well). All pairs are measured from the real tokens
> in `palette-contrast.test.ts`.

**Chrome & surfaces** (a three-step neutral ladder)

| Token | Hex | Use |
|---|---|---|
| Ink | `#171717` | headings and body text |
| Ink muted | `#5c554a` | secondary text, labels, metadata |
| Canvas | `#fffcf4` | the page background (Porcelain) |
| Canvas soft | `#f7f2e7` | wells, table stripes, `secondary` / `muted` / `accent` |
| Surface | `#ffffff` | card surfaces |
| Sunken | `#f1ebdd` | recessed areas only — inset wells, hover fills |
| Divider | `#ede7d9` | hairlines inside a card |
| Hairline | `#e6dfcf` | card borders, inputs (`--border`, `--input`) |

**Neutral text ramp** (for secondary and muted copy on canvas)

| Token | Hex | Use | On canvas |
|---|---|---|---|
| Text secondary | `#4a443b` | supporting copy, descriptions | 7.24:1 |
| Text tertiary | `#5c554a` | metadata, helper text | 6.4:1 |
| Text quaternary | `#6a6256` | the quietest legible text | 4.55:1 |

**Graphite (dark chrome)**

| Token | Hex | Use |
|---|---|---|
| Charcoal | `#171717` | sidebar, dark surfaces, tooltips |
| Charcoal 2 | `#1f1f1f` | gradient start / raised dark surface |
| Charcoal 3 | `#141414` | gradient end / recessed dark surface |
| On dark | `#fffcf4` | text on graphite |
| On dark muted | `#a8a298` | secondary text on graphite |
| On dark hairline | `#34312d` | dividers on graphite |
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
| Canvas | `#171717` | — |
| Canvas soft | `#2a2a2a` | — |
| Surface | `#202020` | — |
| Sunken | `#121212` | — |
| Ink | `#fffcf4` | 17.49:1 |
| Text secondary | `#d2ccbf` | 11.21:1 |
| Text tertiary | `#b3aca0` | 7.96:1 |
| Text quaternary | `#a59e92` | >= 4.5:1 on every surface |
| Primary (fill) | `#ff6115` | 5.95:1 against canvas |
| Primary hover / ring | `#ff8a4d` | 7.68:1 on canvas |
| Primary ink (text) | `#ff7a3d` | 6.92:1 as text |
| On primary | `#171717` | 5.95:1 on the fill |

> **Do not write `color: #fff` on a primary fill.** White on Neon Orange
> measures **3.01:1**. Use `var(--color-on-primary)`.

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
