# AGENTS.md

This repository is the Puntakit church management dashboard. Use this file as the quick-start guide for AI coding agents working in this codebase.

## Project snapshot

- App type: React SPA (Vite) front end plus a real Express + Drizzle ORM + PostgreSQL API
- Main package manager: pnpm
- Frontend source: `client/src`
- Shared types/constants: `shared`
- Server source: `server`
- Build/test entrypoints: `package.json`

## Critical repo conventions

- Keep the project on pnpm. The repo uses a patched `wouter` package via `pnpm.patchedDependencies`; do not switch package managers.
- Treat `vite.config.ts` and `tsconfig.json` as synchronized configuration. Changes to path aliases or build graph must stay consistent.
- The app is a client-side routed SPA (`wouter`), not a Next.js app. Do not introduce Next.js conventions or `app/`/`pages/` routing patterns here.
- The server is a real API backend, not a static host. Keep `server/index.ts` limited to startup, static hosting and graceful shutdown; put business logic in `server/routes/` as a route module plus a matching `.test.ts`, with shared types and Zod schemas in `shared/`.
- Authentication is Clerk-only in production (`@clerk/express` middleware). The cookie/JWT path exists solely for route tests (`PUNTAKIT_TEST_AUTH=1`). Authorization reuses the `USER_ROLES` enum through `requireRole`/`requireAdmin`, with the canonical role sets defined once in `shared/roles.ts` for both server and client — do not invent a second permission system or write a role list inline.
- Vendor / platform plumbing from Manus (`vite-plugin-manus-runtime`, storage proxy/debug plugins, `client/public/__manus__`) is not core app logic. Leave it alone unless the task explicitly involves that integration.
- Use the existing design system tokens in `client/src/index.css` and the brand guidance in `brand-spec.md` before creating new UI colors, layout rules, or spacing patterns.

## Commands

Run the repo’s actual scripts from the root:

```bash
pnpm install
pnpm dev
pnpm build
pnpm start
pnpm preview
pnpm check
pnpm test
pnpm format
```

Notes:

- There is no dedicated lint script; `pnpm check` is the project’s main static verification step.
- `pnpm test` runs the Vitest suite from `vitest.config.ts` (with `PUNTAKIT_TEST_AUTH=1` and an embedded PostgreSQL/PGlite database) over `server/**/*.test.ts`, `shared/**/*.test.ts`, and `client/**/*.test.ts`. Add or update tests alongside any behaviour change.
- `.github/workflows/ci.yml` runs `pnpm install --frozen-lockfile`, then `pnpm check` and `pnpm test` on every push and pull request — treat a green CI run as the verification gate.
- Database scripts exist under the server tooling (`db:*`) and should be used for schema migrations or admin seeding when relevant.

## Architecture

### Frontend

- `client/src` is the app root and should be treated as the primary UI workspace.
- Pages live under `client/src/pages` and compose the shared shell via the layout components.
- UI primitives in `client/src/components/ui` are generated shadcn-style components; prefer them and regenerate via the project tooling instead of hand-editing generated files unless the task intentionally changes that system.
- App-specific components live one level above in `client/src/components`.
- Styling is Tailwind v4 with a large custom stylesheet in `client/src/index.css`; prefer extending existing CSS custom properties and classes rather than creating ad-hoc utility-heavy styling.

### Shared data and server boundaries

- Shared constants/types belong in `shared` and should be used across client/server boundaries.
- The server is DB-backed: Drizzle ORM over PostgreSQL, with `shared/schema.ts` as the single schema source of truth and migrations in `server/db/migrations`. Never bury real data access in the client — add a server route instead.

## Working expectations

- Before writing new implementation code, read the project guidance in [CLAUDE.md](CLAUDE.md) and relevant docs such as [brand-spec.md](brand-spec.md), [design.md](design.md), and [DEPLOYMENT.md](DEPLOYMENT.md).
- Keep changes scoped and consistent with existing repo patterns.
- Favor small, cohesive edits over broad rewrites.
- For frontend UI work, consult the product brand and visual tokens before changing layout, colors, or spacing.
- For a new feature or bugfix, prefer a test-first workflow when adding code paths.

## Useful references

- [CLAUDE.md](CLAUDE.md) — primary repo guidance
- [brand-spec.md](brand-spec.md) — visual direction and design tokens
- [design.md](design.md) — product/design discussion and constraints
- [DEPLOYMENT.md](DEPLOYMENT.md) — deployment and environment notes
- [package.json](package.json) — scripts, dependencies, and tooling
- [.ai/WORKFLOW.md](.ai/WORKFLOW.md) — optional multi-role implementation/audit workflow when explicitly invoked

## Guardrails for AI agents

- Do not rewrite the project around a different framework or architecture unless the task explicitly requires it.
- Do not add new package managers or lockfile conventions.
- Do not edit platform vendor files unless the task is specifically about that integration.
- Do not invent new UI patterns that conflict with the repo’s existing brand system.
- When unsure, prefer the repo’s existing implementation patterns over introducing a new abstraction.
