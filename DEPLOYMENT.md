# Deployment notes

The application is a React/Vite dashboard served by an Express API (`server/`). The API
talks to PostgreSQL through Drizzle ORM using one of three explicit drivers.

## Database drivers

| `DATABASE_DRIVER` | Client | Use case |
| --- | --- | --- |
| `neon` | `@neondatabase/serverless` (HTTP) | Neon serverless Postgres (production default) |
| `postgres` | `postgres` (postgres-js TCP pool) | Any other PostgreSQL (self-hosted, Supabase pooler, ...) |
| `pglite` | `@electric-sql/pglite` (embedded) | Local development only — **rejected in production** |

Driver resolution lives in `server/db/config.ts` and is validated before any connection
is opened (`server/db/client.ts`). `USE_LOCAL_DB=true` is a shortcut for `DATABASE_DRIVER=pglite`.

Fail-fast rules:

- `NODE_ENV=production` without `DATABASE_URL` → startup aborts, **never** falls back to PGlite.
- `NODE_ENV=production` with `USE_LOCAL_DB=true` → startup aborts.
- `NODE_ENV=production` with `DATABASE_DRIVER=pglite` → startup aborts.
- Outside production, when neither `DATABASE_URL` nor `DATABASE_DRIVER` is set, the server
  logs a warning and uses the embedded PGlite database.

## Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_DRIVER` | recommended | `neon` \| `postgres` \| `pglite` (explicit is best) |
| `DATABASE_URL` | production | `postgresql://...` or the Neon `https://` HTTP endpoint |
| `USE_LOCAL_DB` | dev only | `true` selects PGlite; rejected in production |
| `PGLITE_DATA_DIR` | dev only | data directory, default `./.db_data` |
| `DB_AUTO_MIGRATE` | optional | `true` runs migrations on startup for `neon`/`postgres` |
| `POSTGRES_MAX_CONNECTIONS` | optional | pool size, default `10` |
| `POSTGRES_IDLE_TIMEOUT_SECONDS` | optional | default `20` |
| `POSTGRES_CONNECT_TIMEOUT_SECONDS` | optional | default `10` |
| `POSTGRES_SSL` | optional | `require` \| `allow` \| `prefer` \| `verify-full` \| `no-verify` \| `disable` |
| `VITE_CLERK_PUBLISHABLE_KEY` | yes | Clerk publishable key used by the browser |
| `CLERK_SECRET_KEY` | yes | Clerk secret used by the API to verify sessions |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | no | Next.js name; not read by this Vite app |

Real values must stay in the hosting provider's secret store and must never be committed.
`.env.example` is a placeholder only. PGlite (embedded) is always migrated on startup;
remote drivers only migrate when `DB_AUTO_MIGRATE=true` or when `pnpm db:migrate` runs.

## Vercel environment setup

For this React/Vite project, add the following variables in the Vercel project
settings for **Production** (and Preview/Development if those environments are used):

```text
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
```

After changing environment variables, redeploy. `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
is a Next.js convention and is intentionally ignored by this frontend.

No other Clerk variable is required by the current code. Add
`CLERK_WEBHOOK_SIGNING_SECRET` only when webhook synchronization is implemented.

## Local development with PGlite

```bash
# .env.local (gitignored)
DATABASE_DRIVER=pglite
USE_LOCAL_DB=true
PGLITE_DATA_DIR=./.db_data

pnpm install
pnpm db:migrate     # bootstrap the embedded database (idempotent)
pnpm dev            # Vite client + Express API; server migrates automatically
```

## Production with Neon

```bash
# environment provided by the platform / secret store
NODE_ENV=production
DATABASE_DRIVER=neon
DATABASE_URL=postgresql://<user>:<password>@<endpoint>.neon.tech/<db>?sslmode=require
VITE_CLERK_PUBLISHABLE_KEY=pk_live_<your-key>
CLERK_SECRET_KEY=sk_live_<your-key>

pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
pnpm db:migrate:env   # applies server/db/migrations with the ambient environment
pnpm start
```

`pnpm start` boots the Express server, applies/sees the schema via `bootstrapDatabase()`,
then listens. `SIGINT`/`SIGTERM` stop the HTTP server, drain in-flight requests and close
the database connection (10s graceful-shutdown budget).

## Pre-deployment verification

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
```
