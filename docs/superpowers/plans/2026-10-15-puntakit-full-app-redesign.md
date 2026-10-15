# Puntakit Full-App Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the existing Puntakit SPA to a polished, mobile-first, consistent UI in small verified batches, without changing API contracts, schema, auth, roles or business logic.

**Architecture:** Visual changes only, centralised in `client/src/index.css` tokens and shared components (`client/src/components/layout/*`, `client/src/components/ui/*`), then applied page by page. Every batch is verified in the live preview (Vite `:3100`, API `:3101`, local PGlite demo mode) before the next starts.

**Tech Stack:** React + wouter, Tailwind v4 (CSS-first) + hand-written classes in `index.css`, Vitest, Playwright (Chromium), pnpm.

**Spec:** the "Puntakit Full-App Redesign — Text-Only Master Prompt" given in this session (visual direction, dashboard hierarchy, forms, navigation, accessibility, safety rules). No spec file exists in the repo; this plan restates the binding parts below.

## Global Constraints

- Work only in worktree `C:\Users\Administrator\Desktop\Work\02-Worktrees\puntakit-claude-redesign`, branch `redesign/full-app-claude-20261015`.
- Never commit, push, open a PR, merge or deploy. Never touch Neon/production data. `.env.local` must contain no `DATABASE_URL`.
- Do not change `shared/schema.ts`, `server/**`, `shared/validation.ts`, `shared/roles.ts`, or any API contract.
- Do not bypass authentication. Demo mode (`PUNTAKIT_DEMO_MODE=1`, development only) is the only permitted local identity.
- `client/src/index.css` is the token source of truth. `client/src/design-tokens.test.ts` locks `--color-primary: #315c2b`, `--color-primary-focus: #3f7337`, `--color-primary-on-dark: #7faf72`. Changing them needs the Task 0 decision.
- Spec reference colors are proposals only: primary `#00C853`, deep `#009944`, mint `#EAF8F0`, surface `#F7F8F8`, text `#252525`, secondary text `#777E86`, border `#E7EBE9`.
- Thai-first UI copy. Vocabulary: พันธกิจ = care group, บอดี้ = body, ฝ่ายงาน = ministry (CLAUDE.md).
- Touch targets ≥ 44×44 CSS px for active controls. Text contrast ≥ 4.5:1 (≥ 3:1 for large text and UI graphics).
- Gates per batch: `pnpm check`, relevant `vitest run <files>`, `pnpm build`, browser check at 360/768/1280, console/network errors inspected. Full `pnpm test` (~235 s) once per phase end.
- No new features, no invented data. Empty space stays empty.

## Verified starting state (this session, 2026-10-15)

- Baseline: `pnpm check` exit 0; `pnpm test` 61 files / 754 tests pass; `pnpm build` exit 0.
- Done and verified: Batch 1 `Attendance.tsx:784` (`min-w-11`); Batch 2 `Home.tsx` (page search `sm:hidden`, "Phase 4" wording removed); Batch 3 Groups/Events/Follow-up audited, no change needed (empty, error, populated, dialogs, contrast light+dark: all pass).
- Uncommitted diff: `client/src/pages/Attendance.tsx`, `client/src/pages/Home.tsx` only.
- Helper scripts (outside repo): `scratchpad/{shots,targets,contrast3,err,modal,search}.cjs`. Run with `NODE_PATH=C:\Users\Administrator\.claude\skills\playwright-skill\node_modules` and `MSYS_NO_PATHCONV=1`.
- Spec greens fail WCAG: white on `#00C853` = 2.24:1, white on `#009944` = 3.72:1, `#777E86` on `#F7F8F8` = 3.86:1. Current olive: white on `#315c2b` = 7.79:1.

## Review Focus

- Last list item hidden behind the fixed mobile bottom nav (safe-area, `MobileBottomNav`, `MemberAppLayout`).
- 320px width and 200% browser text zoom on forms and cards: clipped Thai text or horizontal scroll.
- Dark mode on gradient/image surfaces (event hero card, mission photos): the contrast scanner skips these.
- `member`/`group_leader` accounts reaching admin-only UI, or admin items leaking into their nav.
- Double submit on create dialogs (button not disabled while the request is in flight).

---

### Task 0: Token decision gate (NO CODE until the user answers)

**Files:** none changed.

**Interfaces:**
- Produces: one of `KEEP_OLIVE | ADOPT_ACCESSIBLE_GREEN | ACCENT_ONLY`, recorded here before Task 1 starts.

- [ ] **Step 1: Ask the user to choose** (options and consequences, no recommendation imposed):
  - `KEEP_OLIVE`: keep `#315c2b`. Passes AA (7.79:1), zero test changes, but does not match the "fresh green" reference.
  - `ADOPT_ACCESSIBLE_GREEN`: new primary hue near the reference but darkened until white text ≥ 4.5:1. Update `design-tokens.test.ts` expectations and remap `--color-primary-focus`/`--color-primary-on-dark`; one central edit, touches every screen's look.
  - `ACCENT_ONLY`: keep olive for text/buttons; use the brighter green only on dark surfaces or as decoration where no text or required graphic contrast depends on it. Note `#00C853` fails 3:1 on white, so it cannot carry icons or borders there.
- [x] **Step 2: Decision recorded (2026-10-15): `ACCENT_ONLY`.** All existing tokens and `design-tokens.test.ts` stay unchanged. Brighter greens only where contrast is appropriate (decoration, dark surfaces; never white-surface text or required graphics).
- **Other approved decisions (2026-10-15):** Task 2 = **merge** the duplicated shortcuts into one section, keeping all destinations. Task 3 = local `member` and `group_leader` test users with test PINs, local PGlite only, isolation verified before writing, auth unchanged. Execution = **native**, one task at a time, no commit/push/PR/merge/deploy.

### Task 1: Shared foundation (layout, nav, buttons, surfaces)

**Files:**
- Modify: `client/src/index.css` (tokens only if Task 0 ≠ `KEEP_OLIVE`), `client/src/components/layout/{MobileBottomNav,MemberAppLayout,AppLayout,Topbar}.tsx`
- Test: `client/src/design-tokens.test.ts`, `client/src/nav-structure-contract.test.ts`

**Interfaces:**
- Consumes: Task 0 decision.
- Produces: unchanged class/token names so later tasks need no renames; any new token is added to `index.css` and asserted in `design-tokens.test.ts`.

- [ ] **Step 1: Measure** bottom-nav overlap: Playwright at 360×640, scroll every route in the admin and `/app/*` shells to the end, assert the last content element's bottom ≤ bottom-nav top. Record failing routes.
- [ ] **Step 2: Write a failing assertion** in `design-tokens.test.ts` for each token you change (exact hex, plus ≥ 4.5:1 for `--color-on-primary` on `--color-primary`, reusing the existing contrast helper there).
- [ ] **Step 3: Implement** the token edits (if any) and the bottom padding fix (`padding-bottom: calc(<nav height> + env(safe-area-inset-bottom))` on the shell scroll container) where Step 1 failed.
- [ ] **Step 4: Verify:** `pnpm exec vitest run client/src/design-tokens.test.ts client/src/nav-structure-contract.test.ts`; `pnpm check`; `pnpm build`; screenshots `/`, `/members`, `/app` at 360/1280, light and dark; `contrast3.cjs` on those routes returns 0.

### Task 2: Dashboard (`/`)

**Files:** Modify `client/src/pages/Home.tsx`; Test `client/src/ux-audit-regressions.test.ts`.

**Interfaces:** Consumes `getRoleShortcuts(role)` (unchanged). Produces nothing new.

- [x] **Step 1: Decision: merge** the "ทางลัดของฉัน" section and "ทำต่อได้เลย" into one section; every destination from both must remain reachable.
- [ ] **Step 2: Add a test** asserting the chosen behaviour (e.g. the section is absent from the rendered source when removed) in `ux-audit-regressions.test.ts`.
- [ ] **Step 3: Implement** in `Home.tsx`; keep hierarchy: welcome → primary tasks → upcoming events → recent reports/announcements → stats.
- [ ] **Step 4: Verify** with `search.cjs` (1 search landmark per width), `targets.cjs`, `shots.cjs` for `/` at 360/768/1280; `pnpm check`.

### Task 3: Member PWA (`/app`, `/app/events|group|reports|attendance|profile`)

**Files:** Modify `client/src/pages/member/*.tsx`, `client/src/components/lamb/*` as needed; Test `client/src/member-*.test.ts` (existing contract tests).

**Interfaces:** Consumes `MemberAppLayout`. Produces nothing new.

- [ ] **Step 1: Stop the API** (PGlite single-process trap), insert a local `member` user and a `group_leader` user into `.db_data` with a UUID `id` and `status='active'` (raw `INSERT`, as done for the demo admin), restart the API. Confirm `.env.local` has no `DATABASE_URL` first. Confirm with the user how to sign in as them without bypassing auth (first-party PIN via `pnpm db:set-pin` on the local dir only), since demo mode always resolves to `demo@puntakit.local`.
- [ ] **Step 2: Audit** each `/app/*` route at 360/390/768: overflow, targets, contrast, bottom-nav overlap, empty/error states (`err.cjs` pattern with `/api/me/**`).
- [ ] **Step 3: Fix** only findings from Step 2, one file per commit-sized change; add a contract test per behavioural fix.
- [ ] **Step 4: Verify** each changed route; `pnpm exec vitest run client`; `pnpm build`.

### Task 4: Remaining admin routes, settings, legal

**Files:** Modify pages from `/ministries /church /announcements /reports /map /feed /inbox /memberships /org /import* /admin/* /settings /privacy /terms /profile` found failing in Step 1.

**Interfaces:** none new.

- [ ] **Step 1: Sweep** all listed routes with `targets.cjs`, `shots.cjs`, `contrast3.cjs`, `err.cjs`; list only measured failures.
- [ ] **Step 2: Fix** failures in order of severity, reusing existing shared classes; no new components unless two pages need it.
- [ ] **Step 3: Verify** per fixed route; `pnpm check`; `pnpm build`.

### Task 5: Phase-end regression

**Files:** none (verification) plus one docs update `docs/PUNTAKIT_DESIGN_SYSTEM_AUDIT_2026-10-11.md` appendix or a new dated report.

- [ ] **Step 1:** Run `pnpm check`, `pnpm test`, `pnpm build`; expected exit 0 for all, 61+ files passing.
- [ ] **Step 2:** Re-run the full route sweep at 360/768/1280 light+dark; expected 0 overflow, 0 contrast failures, 0 page errors, 0 API ≥ 400 on happy paths.
- [ ] **Step 3:** `git status` and `git diff --stat`; confirm only `client/**` and `docs/**` changed; no commit made.

---

## Self-review

- Spec coverage: visual direction → Task 0/1; dashboard → Task 2; lists/forms → Task 3/4 (Groups/Events/Follow-up already verified); navigation → Task 1; responsive/a11y → every task's verify step and Task 5; safety → Global Constraints.
- Placeholder scan: Tasks 3 and 4 fix only measured findings, so their file lists are bounded by Step 1/2 results, not guessed.
- Type consistency: no new types or signatures are introduced.
- Known risk: Task 3 needs local role accounts and a sign-in route that is not demo mode; that is flagged for user confirmation instead of assumed.
