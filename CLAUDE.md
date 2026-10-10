# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Session continuity (read before doing anything)

The user does not want context re-explained. Start with `/brief`. These files are loaded into every session (Claude Code reads only `CLAUDE.md` when both it and `AGENTS.md` exist, so `AGENTS.md` must be imported):

@AGENTS.md
@.ai/HANDOFF.md
@.ai/CURRENT.md

- **Notes are not evidence.** Verify `git status --short`, the branch and HEAD before acting; when notes and the repo disagree, the repo wins — report the difference.
- **Detail on demand, not by default:** `.ai/DECISIONS.md` (decisions that must not be re-asked), `.ai/PROJECT.md` (index of where the truth lives), `.ai/CHANGELOG.md` (verified history), and the ordered plan `PUNTAKIT_NEXT_SESSION_PLAN_2026-10-10.md`.
- **Recall, don't guess:** use auto memory and these files for earlier decisions; if a memory names a file, function or flag, confirm it exists before relying on it.
- **Update memory when it matters:** after meaningful progress or a durable decision run `/wrap`; before ending a session run `/handoff` (if it opens the personal skill that writes to the temp directory, follow `.agents/skills/handoff/SKILL.md` by hand). Record unresolved questions and blockers explicitly. Resume unfinished work; don't repeat finished work.
- **Never** claim something is committed, pushed, deployed or verified in production unless a command in the current session proved it. **Never** store secrets or personal data in memory files. Do not commit, push, merge or deploy unless the user approves it separately.
- Skills live in `.agents/skills/` (committed source); `.claude/skills/*` are local junctions to them (gitignored). Native auto memory is machine-local; `.ai/` is the project-file memory.

**`AGENTS.md` is the authoritative rulebook** for every agent in this repo (ownership zones, invariants, doc-update mapping, Definition of Done, forbidden actions). This file only adds orientation and does not restate its rules. When a doc disagrees with code, the code wins — fix the doc in the same change. Anything you cannot verify gets written up as `NOT VERIFIED`.

## Project

Puntakit Kalasin is a Thai-first church operations app ("Ministry Operating System") for one church; data is members' personal information. `MissionActivity` in `shared/schema.ts` is the core object — Feed, Timeline, Map and Operations (`/`) are lenses over it, not separate tables. Product scope: `PRD.md`. Architecture and risk register: `ARCHITECTURE.md`. Doc map: `docs/README.md`.

Thai UI vocabulary: **พันธกิจ** = care group (`/groups`, `org_level = 'care'`), **บอดี้** = the level above (`org_level = 'body'`), **ฝ่ายงาน** = ministry team (`/ministries`). Code/API names stay `care`/`body`/`ministry`.

## Commands

pnpm only (`packageManager` is pinned and `wouter` is patched via `patchedDependencies`).

```bash
pnpm dev            # Vite client + Express API together (concurrently)
pnpm check          # tsc --noEmit — the only static gate (no ESLint)
pnpm test           # vitest run (server/**, shared/**, client/** *.test.ts)
pnpm build          # vite build → dist/public, esbuild server/index.ts → dist/index.js
pnpm vitest run server/routes/members.test.ts   # single file
pnpm vitest run -t "name of test"               # single test by name
pnpm db:generate | db:migrate                   # drizzle; reads .env.local (`:env` variants don't)
```

Merge gate (same as `.github/workflows/ci.yml`, Node 24): `pnpm install --frozen-lockfile && pnpm check && pnpm test && pnpm build`.

**Run tests with `TZ=UTC`** to match CI — the suite is timezone-sensitive (date-only values). In PowerShell: `$env:TZ='UTC'; pnpm test`.

Vitest (`vitest.config.ts`) runs in a node env with `PUNTAKIT_TEST_AUTH=1` (cookie/JWT auth instead of Clerk) and PGlite as the database; demo mode is forced off.

## Local dev traps

- **Ports:** `server/index.ts` listens on `PORT || API_PORT || 3000`, Vite also defaults to :3000 and proxies `/api` to `API_PORT || 3001`. Set `API_PORT=3001` in `.env.local` or the two processes collide.
- **No Clerk keys locally →** demo mode (dev only): `DATABASE_DRIVER=pglite`, `USE_LOCAL_DB=true`, `PGLITE_DATA_DIR=./.db_data`, `PUNTAKIT_DEMO_MODE=1`, `VITE_PUNTAKIT_DEMO_MODE=1`. It provisions `demo@puntakit.local` as `admin`; change that row's role to test role-gated UI — but stop the dev server first, since PGlite will open the same data dir from a second process with no lock error while the server keeps serving stale rows. A `member` is redirected from `/` to the member PWA at `/app`.
- More in `docs/PUNTAKIT_AGENT_GUIDE.md`.

## Architecture (big picture)

- **Three source roots joined by aliases**: `client/src` (`@/*`), `shared` (`@shared/*`), `server` (relative imports, outside the Vite graph). Aliases must match between `vite.config.ts` and `tsconfig.json`.
- **Deploy shape**: Vercel serves the static client plus a single serverless function, `api/index.ts`, which wraps the Express app from `server/app.ts`. `server/index.ts` is only the local/Node startup (DB bootstrap, static `dist/public` + SPA fallback, graceful shutdown).
- **Client**: React 19 SPA with `wouter` routing (not Next.js). `App.tsx` provider chain: `ErrorBoundary > ClerkProvider (skipped in demo mode) > ThemeProvider > AuthProvider > Router`. Two shells: admin `AppLayout` (sidebar + topbar) and `MemberAppLayout` for `/app/*` (`pages/member/`). Shared UI building blocks live in `components/DesignSystem.tsx`; `components/ui/` is generated shadcn.
- **Server**: `server/app.ts` mounts one router per domain under `/api/<domain>` (`server/routes/<domain>.ts` with a sibling `.test.ts`), plus the Svix-verified Clerk webhook (raw body parsed before `express.json()`), `/api/health` (liveness) and `/api/ready` (DB readiness). Responses use a single envelope: `{success:true, data}` / `{success:false, error:{code,message,details?}}` via the central error handler and `server/lib/errors.ts`.
- **Auth/RBAC**: Clerk in production, mapped to the local `users` row. Guards in `server/middleware/auth.ts` (`requireAuth`, `requireRole`, `requireAdmin`); role sets in `shared/roles.ts` are imported by both server and client so UI gates mirror server gates.
- **Data**: Drizzle over Postgres; driver chosen in `server/db/config.ts` by `DATABASE_DRIVER` (`neon` | `postgres` | `pglite`), production fails fast instead of falling back to PGlite. `shared/schema.ts` is the schema source of truth, SQL migrations in `server/db/migrations`. `bootstrapDatabase()` auto-migrates PGlite; remote DBs migrate only with `DB_AUTO_MIGRATE=true` or `pnpm db:migrate`.
- **Styling**: Tailwind v4, CSS-first (no `tailwind.config.js`). `client/src/index.css` `:root` is the design-token source of truth; read `DESIGN_SYSTEM.md` before UI work. Many design rules are enforced by contract tests in `client/src/*.test.ts` (tokens, no Tailwind palette classes, no duplicated shared components, UX-audit regressions, role-gate/auth contracts) — the table in `AGENTS.md` §7 maps each rule to its test. Those tests read `brand-spec.md` and `design.md` at fixed root paths; don't move or rename them.
- **Manus leftovers**: the debug-collector/storage-proxy plugins in `vite.config.ts` and `client/public/__manus__` are scaffolding-platform plumbing; `vite-plugin-manus-runtime` is intentionally disabled (see the comment in `vite.config.ts`). Leave them alone unless the task is about them.
