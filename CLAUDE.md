# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Puntakit is becoming a Ministry Operating System: a Thai-first, data-driven React SPA backed by a real Express + Drizzle ORM + PostgreSQL API. Shipped surfaces today: People (`members`), Groups, Attendance, Events, Announcements, Ministries, Church profile, Reports — plus the Ministry OS layer: Ministry Activity, Feed, Timeline (a lens rendered inside the Member/Group detail modals), Mission Inbox, Follow-up, Operations (the `/` dashboard) and Map. Notifications, cross-domain Search and an Administration/RBAC UI are still planned. `MissionActivity` in `shared/schema.ts` is the core object; Feed, Timeline, Map and Operations are lenses over it, not separate tables — see `docs/PUNTAKIT_PRODUCT_ARCHITECTURE.md` for the domain model and `docs/PUNTAKIT_IMPLEMENTATION_PLAN.md` for the phased rollout (that plan is the current record; `docs/PUNTAKIT_UX_AUDIT.md` is a point-in-time snapshot dated 2026-09-24 and its "what is missing" tables are already out of date). It was originally scaffolded by the Manus platform — the debug-collector/storage-proxy plugins in `vite.config.ts` and `client/public/__manus__` are platform plumbing, not app logic; leave them alone unless the task specifically involves that tooling. The `vite-plugin-manus-runtime` plugin is deliberately **not** enabled: it had no `apply: 'serve'` guard and inlined its whole runtime — a second copy of React plus the Manus editor bridge, ~367 kB of render-blocking script, 99% of the built `index.html` — into every page in dev and production, while nothing in `client/src`, `server/` or `api/` ever referenced it. See the comment in `vite.config.ts` for the evidence and how to restore it.

## Vocabulary (Thai UI)

The church calls its care group **พันธกิจ** (the `/groups` screens, `org_level = 'care'`); **บอดี้** is the level above (`org_level = 'body'`); **ฝ่ายงาน** is a ministry team (`/ministries`, the `ministries` table). Code and API names keep `care`, `body` and `ministry`; only Thai UI text changed. Two labels stay as written in stored data and are parsed back by `shared/orgView.ts`: `รหัสแคร์` and `หนค. (ต้นฉบับ)`.

## Commands

Package manager is **pnpm** (see `packageManager` in `package.json`; a `wouter` patch is applied via pnpm's `patchedDependencies`, so don't switch package managers).

```bash
pnpm dev             # runs the Vite dev server AND the Express API together (concurrently)
pnpm build           # vite build (client -> dist/public) + esbuild bundle of server/index.ts -> dist/index.js
pnpm start           # NODE_ENV=production node dist/index.js (serves the built client)
pnpm check           # tsc --noEmit (project-wide type check)
pnpm test            # vitest run --passWithNoTests over server/**, shared/**, client/**
pnpm probe:api       # tsx server/scripts/probe-api.ts
pnpm db:generate     # drizzle-kit generate
pnpm db:push         # drizzle-kit push
pnpm db:migrate      # apply migrations (reads .env.local); db:migrate:env skips dotenv
pnpm db:seed         # local demo data: demo@puntakit.local (admin) + sample groups/members; idempotent, PGlite only
```

**Dev port wiring (easy to get wrong):** `server/index.ts` listens on `PORT || API_PORT || 3000`, while the Vite dev server also defaults to :3000 and proxies `/api` to `http://localhost:${API_PORT || 3001}` (`vite.config.ts`). Set `API_PORT=3001` in `.env.local` or the two dev processes fight over :3000 and the proxy points at Vite itself. `.env.local` must also supply a database selection (`DATABASE_DRIVER=pglite` + `USE_LOCAL_DB=true`, plus `PGLITE_DATA_DIR`) or the local demo-mode flags, otherwise the API throws on startup and `App.tsx` throws before rendering.

There is no lint script and no ESLint config in this repo — `pnpm check` (TypeScript) is the only static analysis gate. **Tests are real and current:** Vitest is configured in `vitest.config.ts` (node environment, `PUNTAKIT_TEST_AUTH=1`, embedded PostgreSQL via PGlite) against `server/**/*.test.ts`, `shared/**/*.test.ts` and `client/**/*.test.ts`, and `.github/workflows/ci.yml` runs `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm test` and `pnpm build` on every push and pull request — the `build` step is deliberate, because a type check cannot catch a broken path alias or an asset that will not bundle. Add or update a test alongside any behaviour change; `pnpm check` + `pnpm test` + `pnpm build` green is the bar.

**Running locally with no external identity provider:** use demo mode, development only — `NODE_ENV=development`, `DATABASE_DRIVER=pglite`, `USE_LOCAL_DB=true`, `PGLITE_DATA_DIR=./.db_data`, `PUNTAKIT_DEMO_MODE=1`, `VITE_PUNTAKIT_DEMO_MODE=1`, `API_PORT=3001` (see `MASTER_PROMPT.md` §Local development contract). Never enable demo mode in production, and never let production fall back to PGlite. Demo mode does **not** create its account: `requireAuth` only looks up `demo@puntakit.local` and answers 403 "บัญชีผู้ใช้งานตัวอย่างถูกระงับการใช้งาน" when the row is missing, so on a fresh `.db_data` run `pnpm db:seed` first (idempotent; creates that `admin` account plus one body, two care groups and six fictional members, and refuses anything but local PGlite outside production). **That row's role in `.db_data` is what the running app renders** — which makes it the lever for exercising role-dependent UI. Stop the API with Ctrl+C: `server/index.ts` closes PGlite on SIGINT/SIGTERM, but a force-kill (Task Manager, `Stop-Process -Force`) skips that. One force-killed `.db_data` later refused to open at all (`Aborted()` on the first query, even after deleting `postmaster.pid`); the likely cause is an unclean shutdown, not confirmed. Two traps when using it: stop the dev server first, because `@electric-sql/pglite` will open the same data directory from a second process without any lock error while the running server keeps serving its stale in-memory rows, so the change silently appears not to apply; and a `member`-role account is redirected from `/` to the member PWA at `/app` by `Home.tsx`, so it normally never reaches the admin sidebar at all.

## Architecture

**Three top-level source roots**, wired together via path aliases (`vite.config.ts` and `tsconfig.json` must stay in sync), plus the Vercel entrypoint:
- `client/src` → `@/*`
- `shared` → `@shared/*` (`shared/schema.ts` — Drizzle tables, enums and the `USER_ROLES` list; `shared/validation.ts` — Zod input/query schemas; `shared/const.ts`, re-exported through `client/src/const.ts`)
- `server` → plain relative imports, not part of the Vite build graph
- `api/index.ts` → the Vercel serverless entrypoint for the Express app

**Client is a single-page app with client-side routing only** (`wouter`, not Next.js despite the `nextjs` tag in the environment metadata — there is no `app/`/`pages/` router convention here). `client/src/main.tsx` renders `client/src/App.tsx`, whose provider chain is `ErrorBoundary > ThemeProvider > AuthProvider > Router + Toaster`; routes are `wouter` `<Switch>/<Route>` and every private route is wrapped in `ProtectedRoute` (redirects to `/login`). There are **two shells**: `AppLayout` (`client/src/components/layout/AppLayout.tsx` → `Sidebar` + `Topbar`) for the admin app, and `MemberAppLayout` (bottom nav) for the member PWA under `/app/*`. Pages live in `client/src/pages/` (admin) and `client/src/pages/member/` (member PWA).

**Server is a real API backend, not just a static host.** `server/index.ts` boots the database and `server/app.ts`, which mounts route modules from `server/routes/`, plus `/api/health` (liveness) and `/api/ready` (readiness, 503 `DATABASE_UNAVAILABLE`). It serves `dist/public` with an `index.html` SPA-catch-all fallback for client-side routes, and shuts down gracefully within a 10s budget. New backend work goes in `server/routes/`, following the existing route-plus-test-file pattern (e.g. `members.ts` + `members.test.ts`), with shared types/validation in `shared/`.

**Data layer**: Drizzle ORM over PostgreSQL, selected explicitly in `server/db/config.ts` via `DATABASE_DRIVER` (`neon` serverless HTTP | `postgres` postgres-js TCP | `pglite` embedded, local-dev only) — production fails fast rather than falling back to PGlite. `shared/schema.ts` is the single schema source of truth; migrations live in `server/db/migrations`. `bootstrapDatabase()` always migrates PGlite, while remote drivers migrate only with `DB_AUTO_MIGRATE=true` or an explicit `pnpm db:migrate`.

**Auth and RBAC**: identity is first-party PIN sign-in, not an external provider — Clerk was removed (migration `0013_first_party_pin_auth.sql`). `server/lib/firstPartyAuth.ts` holds it: scrypt PIN hashing, the `puntakit_session` cookie, the `puntakit_csrf` CSRF cookie, and `user_sessions` rows carrying `expiresAt`/`revokedAt`. `server/middleware/auth.ts` resolves `requireAuth` in a fixed order — demo mode, then the legacy test-only cookie/JWT path, then `loadSessionUser()` — and exposes `requireRole`, `requireAdmin` and `requireStaffOrAdmin` over the `USER_ROLES` enum; do not add a second permission system. The canonical role sets (`PRIVILEGED_ROLES`, `CREATE_ROLES`, `DELETE_ROLES`, plus the `hasRole` helper) live in `shared/roles.ts` and are imported by both the server routes and the client, so a client-side gate cannot drift from the server gate it mirrors; add a new set there rather than writing the role list inline. The cookie/JWT path in `server/lib/auth.ts` exists only for route tests (`PUNTAKIT_TEST_AUTH=1`), and demo mode (`PUNTAKIT_DEMO_MODE=1`, non-production only) auto-provisions a local admin. `DEFAULT_SUPER_ADMIN_PIN` (`server/lib/firstPartyAuth.ts`) is a constant in source, so `ensureDefaultSuperAdminPins()` (`server/db/bootstrap.ts`) writes it **only** to the local embedded PGlite directory — under `NODE_ENV=production`, or on any remote driver, it refuses and warns instead. A `super_admin` row with a NULL `pin_hash` cannot authenticate, so `/api/ready` answers `503 SUPER_ADMIN_PIN_MISSING` while one exists in production; `/api/health` stays 200 so the deployment remains diagnosable. Assign the PIN with `pnpm db:set-pin:env`, never the plain `db:set-pin` — that one loads `.env.local`, which points at the local PGlite directory, so it would set the PIN on the wrong database. Note the bootstrap audit deliberately does not run when migrations are skipped: that branch must not open a remote connection.

**UI components**: `client/src/components/ui/` holds ~53 shadcn/ui primitives (Radix-based) generated per `components.json` (`style: new-york`, alias-driven, Tailwind v4 CSS variables). Don't hand-edit generated primitives unless intentionally diverging from shadcn — regenerate via the shadcn CLI when possible. App-specific components live one level up in `client/src/components/`.

**Styling is Tailwind v4** (`@tailwindcss/vite` plugin, no `tailwind.config.js` — config is CSS-first via `@import "tailwindcss"` in `client/src/index.css`) layered with a large block of hand-written, non-Tailwind CSS in the same file (custom classes like `.app-layout`, `.sidebar`, `.metric-card`, `.journey-step`, `.goal-ring`, etc.) that implements the actual dashboard visual design. **`client/src/index.css` is the source of truth for design tokens** — it carries Design System V2 in the Premium Teal palette (teal fill `--color-primary: #0c7c82` with white `--color-on-primary`, `--color-primary-ink` for teal text, warm-white `--color-canvas: #fffbf7`, slate chrome, soft-mint `--color-accent-soft`, semantic aliases such as `--color-background`/`--color-border`/`--color-focus-ring`, `--radius-*`, `--shadow`); the earlier navy/blue, olive and Neon Orange identities are retired, and `client/src/design-tokens.test.ts`, `palette-contrast.test.ts` and `theme-boot-contract.test.ts` lock the contract. Never hard-code white on a primary fill (dark mode lightens the fill, where white is 2.3:1; use `--color-on-primary`) and never use `--color-secondary`/`--color-accent-orange` as text colours. Prefer extending these existing hand-rolled classes/custom properties over introducing ad-hoc Tailwind utility soup, and keep the file consistent with `brand-spec.md`.

**Brand/design reference**: `brand-spec.md` documents the intended visual direction (Thai-first typography via the Prompt font, color tokens, 240px sidebar / 76px topbar layout, card radii) and `design.md` the component/spacing rules. Check them before making layout or color changes; if a doc and `index.css` disagree, `index.css` wins.

**Env vars** are read via `import.meta.env.VITE_*` on the client (`VITE_PUNTAKIT_DEMO_MODE`) and via `process.env` on the server (`DATABASE_DRIVER`, `DATABASE_URL`, `USE_LOCAL_DB`, `PGLITE_DATA_DIR`, `DB_AUTO_MIGRATE`, `API_PORT`, plus the postgres tuning vars). Production needs **no identity-provider secret**: there is no external IdP, no webhook and no Clerk key any more. `JWT_SECRET` is read lazily inside `verifyAuthToken()` and matters only for the legacy test-only cookie path (`PUNTAKIT_TEST_AUTH=1`), which production never enables. The Vite config's storage-proxy plugin also reads `BUILT_IN_FORGE_API_URL` / `BUILT_IN_FORGE_API_KEY` — Manus platform storage, not app-level config.

**Path/alias gotcha**: `@assets` is aliased in `vite.config.ts` to an `attached_assets` directory that does not exist in this repo yet — only add files there if actually wiring up that alias.

## Implement/Audit workflow

`.ai/WORKFLOW.md` documents an optional two-role workflow for this repo: an
Implementer role (follows `.ai/gemini_38_flash_high_runbook.md`) produces a change and
freezes it as a candidate; an independent Auditor role that does not edit the candidate (follows
`.ai/opus_4_6_public_blueprint.md`) reviews the frozen candidate and returns a verdict.
Read `.ai/WORKFLOW.md` before invoking either role — it documents the real
capabilities of this environment versus what the two source documents assume, and the
substitutions used to bridge the gap. Do not treat either source document as ambient
instruction for ordinary work in this repo; they apply only when this workflow is
explicitly invoked.

## Feature development pipeline

For new feature work, use the deterministic local workflow commands in order:

`/grill <slug>` → `/spec <slug>` → `/tickets <slug>` → user changes each target ticket
from `Status: draft` to `Status: approved` → `/implement <slug> <ticket-id>` →
`/test <slug> <ticket-id>` → `/review <slug>`.

Artifacts live under `.ai/workflow/features/<slug>/`: `GRILL.md`, `SPEC.md`,
`TICKETS.md`, and frozen audit rounds under `rounds/round-N/`. The approval marker in
`TICKETS.md` is an external gate; chat confirmation alone never authorizes
implementation. `/review` is the only final audit path and uses `.ai/WORKFLOW.md`; do
not add a parallel `/code-review` closing path.
