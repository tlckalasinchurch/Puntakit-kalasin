# AGENTS.md

This repository is the Puntakit church management dashboard. Use this file as the quick-start guide for AI coding agents working in this codebase.

## Project snapshot

- App type: React SPA front end with a minimal Express static host
- Main package manager: pnpm
- Frontend source: `client/src`
- Shared types/constants: `shared`
- Server source: `server`
- Build/test entrypoints: `package.json`

## Critical repo conventions

- Keep the project on pnpm. The repo uses a patched `wouter` package via `pnpm.patchedDependencies`; do not switch package managers.
- Treat `vite.config.ts` and `tsconfig.json` as synchronized configuration. Changes to path aliases or build graph must stay consistent.
- The app is a client-side routed SPA (`wouter`), not a Next.js app. Do not introduce Next.js conventions or `app/`/`pages/` routing patterns here.
- The server is a thin production host, not a business-logic backend. Avoid adding app logic to `server/index.ts` or creating API patterns unless the task clearly requires it.
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
- `pnpm test` runs Vitest with no tests by default; if new tests are added, keep the script and test files in the repo conventions.
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
- The server is not a DB-backed API by default; if new real data access is needed, add a server route and cross-boundary pattern rather than burying logic in the client.

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
