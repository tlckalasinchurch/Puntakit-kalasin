# Phase A — Audit · Minimal Premium design system

**Status: AUDIT ONLY. No files were edited in this phase.**
Date 2026-10-15 · Branch `redesign/full-app-claude-20261015` · HEAD `1eddddb`

---

## 0. Git state (recorded before any edit)

```
branch : redesign/full-app-claude-20261015   (not main)
HEAD   : 1eddddb                              (unchanged, nothing committed)
12 modified files, 3 untracked images, docs/audits/ untracked
```

The 12 modified files are **not** from this task. They are:
- 8 from the BLOCKER 1/2/3 session (route gates, member report form, `SUBMISSION_CREATE_ROLES`) — gated green, awaiting commit
- 4 from the Clay styling session — **see §1, they contradict this brief**

---

## 1. ⚠️ Blocking conflict — uncommitted Clay work contradicts this brief

Four files carry a whole-app Clay restyle that was never committed:

| File | Change |
|---|---|
| `client/src/index.css` | `.clay-app` / `.clay-chrome` / `.clay-panel` scopes; clay overrides for `.pk-glass`, `.pk-surface*`, and the muted text family |
| `client/src/components/layout/AppLayout.tsx` | root gained `clay-app` |
| `client/src/components/layout/MemberAppLayout.tsx` | root gained `clay-app` |
| `design.md` | §8.2 retitled "Clay surfaces (whole app, as of 2026-10-15)" |

Against this brief: sage ground `hsl(110 22% 88%)` vs "white or near-white surfaces"; multi-layer `--clay-puff` shadows vs "minimal or no shadow".

**This needs an owner decision before Phase C.** Options: revert those 4 files to `HEAD`, or keep Clay and accept that this brief is not applied. Nothing else in the working tree is affected either way.

---

## 2. Current vs proposed tokens

### Primary — conflict, and the proposal is the weaker of the two

| | Value | White-on-it | Note |
|---|---|---|---|
| **Current** `--color-primary` | `#315c2b` olive | **7.79:1** | AAA |
| **Proposed** Primary | `#0C7C82` teal | **4.98:1** | AA, passing with little headroom |

Two independent findings against the proposal:

1. `#0C7C82` is **not a new colour to this repo.** `client/src/index.css` already records it as a rejected value: `--lamb-primary: #0A767C; /* ... was #0C7C82 (4.47:1 on mint) */`. It was replaced because it failed contrast against the member mint surface.
2. On the proposed **Primary subtle background** `#E8F5F4` it measures **4.45:1 — below AA** for normal text. That combination is the one the repo already rejected.

Brief rule 10 says: *"If existing brand tokens conflict with this proposal, document the conflict and preserve the established product identity unless the change is explicitly approved."* By the brief's own rule, `--color-primary` stays `#315c2b` unless you say otherwise.

### Proposed neutrals and semantics — measured

| Pair | Ratio | Verdict |
|---|---|---|
| `#0F172A` on `#F8FAFC` | 17.06 | AAA |
| `#475569` on `#FFFFFF` | 7.58 | AAA |
| `#64748B` on `#FFFFFF` | 4.76 | AA ✅ |
| `#64748B` on `#F1F5F9` (secondary surface) | **4.34** | ❌ below AA |
| `#94A3B8` on `#FFFFFF` (disabled) | 2.56 | exempt (inactive control) — do not rely on it for meaning |
| `#15803D` on `#F0FDF4` | 4.79 | AA ✅ |
| `#B45309` on `#FFFBEB` | 4.84 | AA ✅ |
| `#B91C1C` on `#FEF2F2` | 5.91 | AA ✅ |
| `#0369A1` on `#F0F9FF` | 5.57 | AA ✅ |

**One fix needed if the proposal is adopted:** `#64748B` must darken to about `#5B6474` to clear 4.5:1 on `#F1F5F9`. Current `--color-body-muted` is `#6f6f73` at **5.00:1** on white — already better.

---

## 3. Typography — conflict

| | |
|---|---|
| Brief | "Use the existing **Sarabun** font configuration if already available" |
| **Actual** | **It is not available.** `client/src/index.css:5,123,1780` → `--font-sans: "Prompt", system-ui, sans-serif` |

Existing scale (CSS-first, `index.css`): `type-hero 56/1.07`, `type-display-lg 40`, `type-display-md 34`, `type-lead 28/1.35`, `type-body 17/1.47`, `type-caption`, `type-fine` (12px floor per `design.md` §8.1).

Decision needed: keep Prompt, or introduce Sarabun. Adding a font is a dependency + performance decision, not a token edit.

---

## 4. Build setup

- **No `tailwind.config.js` / `tailwind.config.ts`** — Tailwind v4, CSS-first via the Vite plugin. Tokens live in `client/src/index.css`. This matches `AGENTS.md`.
- **No `postcss.config.js`** — expected for v4.
- `client/src/components/ui/**` is shadcn-generated (`new-york`) and must be regenerated, not hand-edited.

## 5. Structure

- 37 routes · 28 page files · 13 `DesignSystem.tsx` exports · 6 layout components · 85 components total
- Member PWA: `/app`, `/app/events`, `/app/group`, `/app/reports`, `/app/attendance`, `/app/profile`
- Admin shell: 24 further routes + `/login`, `/privacy`, `/terms`, `/404`
- Locked by `client/src/design-tokens.test.ts`: `--color-primary`, `--color-primary-focus`, `--color-primary-on-dark`, `--color-ink`, `--color-canvas`, `--color-canvas-sunken`, `--color-dark-surface`, plus a `--shadow !== none` assertion
- `.lamb-theme` is a **separate palette scope** on the member shell (`MemberAppLayout.tsx:74`, teal `#0A767C`) — it does not read the global tokens, so any token change touches the admin shell only until this is reconciled

## 6. Tests

63 files / 781 tests. `tsconfig.json` excludes `**/*.test.ts`, so **`pnpm check` does not parse test files** — a broken test passes `tsc` and fails only at `pnpm test`. Many client tests are static source scans, which prove a string is present, not that a page renders.

---

## Phase B — proposed plan (NOT executed)

1. **Decide the Clay conflict** (§1) — blocks everything
2. **Decide primary** — keep `#315c2b` (brief rule 10) or approve teal with the `#E8F5F4` contrast fixed
3. **Decide font** — Prompt (keep) or Sarabun (add)
4. Neutral ramp adopted as a **scoped** override, not a `:root` replacement, so locked token assertions still hold
5. Reconcile `.lamb-theme` with the neutral ramp — it is currently independent of the global tokens
6. Component pass in dependency order: tokens → `DesignSystem.tsx` → layout → pages
7. Per route: browser check at 390/768/1280 light + dark, contrast, overflow, 44px targets
8. `pnpm check` → `pnpm test` → `pnpm build` at phase end

**Stopping here for approval, as instructed.**
