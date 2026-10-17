# Puntakit brand spec

> **Source of truth:** the token block at the top of `client/src/index.css` (`:root`).
> `design.md` is the working reference. If this file and `index.css` ever disagree,
> `index.css` wins — fix this file.

## Visual direction

Quiet graphite chrome, rounded white surfaces, and a single teal interactive color.
The interface recedes so the people in it are the content: warm and people-centered,
never loud. Church blue and deep navy were the pre-V2 identity; olive field green was
the V2 identity. Both are fully retired.

## Assets

- Hero illustration: `/manus-storage/puntakit-hero_d9170436.png`
- Inspirational Bible illustration: `/manus-storage/puntakit-bible_6f94bd0e.png`

## Tokens

**Field (the one interactive color)**

| Token | Hex | Use |
|---|---|---|
| Field | `#0c7c82` | links, primary buttons, icons, focus. The only chromatic UI color |
| Field hover | `#09696e` | hover / pressed / focus ring |
| Field on dark | `#7faf72` | accent text on graphite surfaces |
| Field tint | `#e8f0e4` | soft chip background on white |

> **Contrast rule for teal text.** `#0c7c82` clears AA as a *fill* carrying white
> text (4.98:1) and on canvas (4.76:1), but it measures **4.45:1 on a pale tint** —
> below AA. On any tinted or dark surface, use `--color-primary-focus` `#09696e`
> (5.77:1) for teal text instead. This is the same finding that moved the member
> app to `--lamb-primary: #0A767C`.

**Chrome & surfaces** (a three-step neutral ladder)

| Token | Hex | Use |
|---|---|---|
| Ink | `#0f172a` | headings and body text |
| Ink muted | `#5b6474` | secondary text, labels, metadata |
| Canvas | `#f8fafc` | the page background |
| Canvas soft | `#f5f5f7` | wells, table stripes, `secondary` / `muted` / `accent` |
| Surface | `#ffffff` | card surfaces |
| Sunken | `#f1f5f9` | recessed areas only — inset wells, hover fills |
| Divider | `#e2e8f0` | hairlines inside a card |
| Hairline | `#e2e8f0` | card borders, inputs (`--border`, `--input`) |

**Neutral text ramp** (for secondary and muted copy on canvas)

| Token | Hex | Use | On canvas |
|---|---|---|---|
| Text secondary | `#475569` | supporting copy, descriptions | 7.24:1 |
| Text tertiary | `#5b6474` | metadata, helper text | 6.4:1 |
| Text quaternary | `#64748b` | the quietest legible text | 4.55:1 |

**Graphite (dark chrome)**

| Token | Hex | Use |
|---|---|---|
| Graphite | `#272729` | sidebar, dark surfaces, tooltips |
| Graphite 2 | `#2a2a2c` | gradient start / raised dark surface |
| Graphite 3 | `#252527` | gradient end / recessed dark surface |
| On dark | `#ffffff` | text on graphite |
| On dark muted | `#a1a1a6` | secondary text on graphite |
| On dark hairline | `#3a3a3c` | dividers on graphite |
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
| Canvas | `#061a1f` | — |
| Canvas soft | `#123033` | — |
| Surface | `#0c2529` | — |
| Sunken | `#0a2126` | — |
| Ink | `#f4faf9` | 16.92:1 |
| Text secondary | `#c3d4d4` | 11.65:1 |
| Text tertiary | `#9db2b2` | 8.04:1 |
| Text quaternary | `#7e9493` | 5.57:1 |
| Field (primary) | `#2fc4bd` | 8.30:1 as text |
| Field hover | `#5fd7d1` | — |
| On field | `#04211f` | 7.85:1 on the fill |

> **Do not write `color: #fff` on a primary fill.** White on the dark primary
> measures **2.15:1**. Use `var(--color-on-primary)`.

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
