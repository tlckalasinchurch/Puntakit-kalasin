# Handoff — Puntakit UI cleanup (2026-10-15)

Branch `redesign/full-app-claude-20261015`, based on `f515860`. Read `docs/superpowers/plans/2026-10-15-puntakit-full-app-redesign.md` first (plan + approved decisions). Reply in Thai. Label claims VERIFIED / ASSUMPTION / BLOCKER / NEXT.

## Rules
- No commit/push/merge/deploy unless the user asks in that session. No production or Neon access; never set `DATABASE_URL`. Local PGlite only.
- Do not change business logic, API contracts, auth/authorization, schema, `server/**`, `shared/schema.ts|validation.ts|roles.ts`.
- Do not change existing design tokens. `--color-primary: #315c2b` is locked by `client/src/design-tokens.test.ts`. Decision: keep tokens (Option C); new tokens are allowed (`--color-primary-ink` was added).
- No new dependencies. No mock data. No UI that looks usable but does nothing. Logic/permission problems go in as BLOCKERs while you continue with safe UI work.

## Environment
- pnpm 10 is on PATH (no corepack). pnpm forwards a literal `--`, so do not pass `--` to `pnpm db:set-pin`.
- Preview: Vite `http://localhost:3100`, API `http://localhost:3101`. `concurrently` fails here, so start two processes:
  - API (real PIN auth): `PUNTAKIT_DEMO_MODE=0 pnpm exec dotenv -e .env.local -- tsx watch server/index.ts`
  - Vite: `API_PORT=3101 pnpm exec vite --host --port 3100`
- `.env.local` (gitignored, no secrets): `NODE_ENV=development`, `DATABASE_DRIVER=pglite`, `USE_LOCAL_DB=true`, `PGLITE_DATA_DIR=./.db_data`, `PUNTAKIT_DEMO_MODE=1`, `VITE_PUNTAKIT_DEMO_MODE=1`, `API_PORT=3101`. Recreate it if missing. Demo mode always resolves to `demo@puntakit.local` (admin), so run the API with `PUNTAKIT_DEMO_MODE=0` to sign in as other roles.
- Traps:
  - PGlite opens one data dir from two processes without an error but the data diverges. Stop the API before touching `.db_data` or running `db:set-pin`.
  - `pnpm db:set-pin <email> <6 digits>` succeeds and then hangs (existing behaviour). Wrap it in `timeout 45`.
  - `curl` mangles Thai on Windows. Send Thai through a UTF-8 Node `fetch` script.
  - Drizzle generates `id` client-side, so raw SQL inserts must supply a UUID.
  - The demo user row is not created by code. A fresh `.db_data` needs a raw insert of `demo@puntakit.local` with role `admin`.
- Local test users to recreate if `.db_data` is gone: `member-test@puntakit.local` (role `member`, linked member record with the same email), `leader-test@puntakit.local` (role `group_leader`, set as `leader_id` of one care group). Set PINs yourself with `db:set-pin`; do not write PINs into docs.
- Login UI: `/login`, press the keypad buttons (aria-label `เลข N`) for 6 digits, then press "เข้าสู่ระบบ". It does not auto-submit.
- Playwright + Chromium: `C:\Users\Administrator\.claude\skills\playwright-skill\node_modules`. Run scripts with `node`, `NODE_PATH` set to that folder and `MSYS_NO_PATHCONV=1`. The earlier helper scripts lived in a session scratchpad and are gone; rewrite them. Useful ones: a route sweep (overflow, console/network errors, `h1`, targets under 44px, contrast, 390/768/1280 light plus 390/1280 dark), a per-role `storageState` login, a link-bounce/404 checker, a forced-500 error-state probe, a dialog probe.

## Done (VERIFIED in browser and tests)
- Attendance "มา/ลา" buttons 44px (`min-w-11`).
- Home: duplicate search hidden from `sm` up; internal "Phase 4" wording removed; "ทางลัดของฉัน" merged into "ทำต่อได้เลย" (`client/src/lib/homeLinks.ts`, `HomeMyWork` `extraLinks`).
- Groups / Events / Follow-up: audited (empty, 500 error, populated, dialogs, contrast light + dark). No change needed.
- Dark-mode contrast: `.login-card p.login-sub`, Lamb theme variables (`--lamb-canvas|surface|mint|primary|ink`) with `.lamb-theme` on `MemberAppLayout`, new `--color-primary-ink`, error text moved to `--color-error-ink` app-wide (same hex in light mode).
- Dead or bouncing links: `/app/reports/new` CTAs replaced with a disabled "เร็วๆ นี้" state; the member "ดูแผนที่" card hidden for roles that cannot open `/map`; group category shown via `CATEGORY_LABELS`.
- a11y: `h1` added to `/app` hero and to the route-denied screen (`EmptyState.headingLevel`); notification button 44px.
- Gates on this commit: `pnpm check` 0, `pnpm build` 0, `pnpm test` 63 files / 766 tests pass.

## BLOCKERs (owner decisions, do not fix yourself)
1. `/admin/users` and `/import/merge-approvals` have no `allow=` in `App.tsx`, so a `member` sees the admin sidebar there. No data leaks; the pages show an in-page denial. Fixing it is an authorization change.
2. No member report form exists, and `POST /api/submissions` is limited to `CREATE_ROLES` (members excluded).

## Remaining
1. Write `docs/UI_ROUTE_TRACKER.md` from measured results (route, page, roles, layout/components, UI state, issues, fix, browser-verified, regression test). Routes are in `client/src/App.tsx`; role sets in `shared/roles.ts`.
2. Investigate `/import/duplicates`: `page.goto(..., networkidle)` timed out at 390 dark (cause unknown, may just be slow).
3. Interaction testing on the remaining admin pages (forms, confirm dialogs, success/error toasts, double-submit): `/follow-up` status buttons, `/import*`, `/church`, `/ministries`, `/announcements`, `/reports`, `/map`, `/settings`, `/media`.
4. Roles not yet checked: `staff`, `ministry_leader`, `viewer`, `super_admin` (create local users only, with `DATABASE_URL` unset and the API stopped first). Checked so far: admin, group_leader, member.
5. Keyboard/focus, Thai text wrapping, tablet 768 and 200% zoom on forms. Look at real screenshots, not just numbers.
6. Review `git diff` per file for the mechanical `--color-error` to `--color-error-ink` swap (Events, Map, Feed, Members, Ministries, Announcements, Inbox, CareToday and others).

## Per-batch routine and report
Identify route + issue, fix, review diff, check in the browser (390/768/1280, light + dark, console and network), test the interaction, run `pnpm check` plus the relevant vitest files (add or update a test with every behaviour change; never weaken one to make it pass), update the tracker, report: phase/batch, routes inspected / fixed / browser-verified out of total, issues, files changed, test/build results, preview URL, blockers, next step.
