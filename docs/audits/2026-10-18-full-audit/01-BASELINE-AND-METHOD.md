# 01 — Baseline, environment, and method

## 1. Project identity

| Item | Value |
|---|---|
| Root | `C:/Users/Administrator/Desktop/Work/02-Worktrees/puntakit-claude-redesign` |
| Package | `puntakit-dashboard` |
| Frontend | React SPA — Vite 7, **wouter 3.7.1 (patched)**, Tailwind v4, shadcn/ui (new-york), lucide-react |
| Backend | Express + Drizzle ORM + PostgreSQL/PGlite, Zod, `shared/schema.ts` |
| Package manager | **pnpm 10.4.1**, pinned via `packageManager` |
| Runtime observed | Node v26.11.1 — **CI uses Node 24**; green locally is not proof of green in CI |
| Module type | ESM |

This is **not** a Next.js app. No `app/` or `pages/` routing, no server components.

---

## 2. Git baseline — preserved, untouched

| Item | Value |
|---|---|
| Branch | `fix/import-get-privacy` |
| HEAD | `a2a41e8 fix(import): limit import read endpoints and pages to ADMIN_ROLES` |
| vs `origin/main` (`8b83d5f`) | behind 4, ahead 0 |
| Staged | nothing |
| Unstaged modified | **6 files**, all under `.agents/skills/` (`code-review`, `tdd`) — pre-existing, unrelated to this audit |
| Untracked (non-ignored) | none |
| Local `main` | `0000034` |
| Remote | `https://github.com/tlckalasinchurch/Puntakit-kalasin.git` |

**Three worktrees — the other two were not touched:**
- `…/Puntakit-kalasin/Puntakit-kalasin-main` — `main` @ `0000034`
- `…/02-Worktrees/puntakit-claude-redesign` — **this audit**
- `…/02-Worktrees/puntakit-redesign` — detached HEAD `1f195d7`

**A stash exists and was never touched:**
```
stash@{0}: On redesign/full-app-claude-20261015:
HOLD not-approved: member submission group (BLOCKER 2)
- patch+patches backup in %TEMP%\opencode\puntakit-member-hold
```
The source branch no longer exists locally. This is held unapproved work — do not pop or drop.

**Prior art:** branch `docs/uxui-audit-handoff-20261017` (`b88b2c1`) contains `docs/audits/2026-10-17-uxui-handoff/UXUI-AUDIT-HANDOFF.md` — a Playwright audit based on `main@adf615b`. This audit extends rather than repeats it; its gap list is reproduced in [`06-REMAINING-WORK.md`](06-REMAINING-WORK.md).

---

## 3. Database isolation — five independent proofs

The audit required a running app. `.db_data` holds **40.3 MB / 1175 files** of apparent real data, and the brief forbids modifying database records.

**Path used by the test server:**
```
C:\Users\Administrator\AppData\Local\Temp\opencode\audit-db
```

| # | Check | Result |
|---|---|---|
| 1 | `dotenv-cli` precedence, tested with a sentinel variable | process env **wins** over `.env.local` — verified, not assumed |
| 2 | Real `resolveDatabaseConfig()` run under `dotenv -e .env.local` | with override → temp path; without → `.db_data` |
| 3 | The server's own startup log | `[db] driver=pglite dataDir=C:\…\Temp\opencode\audit-db` |
| 4 | Manifest SHA of the **original** before copy / after copy / **after the server ran migrations** | `b290b639…` identical all three times — 1175 files, 42,216,315 bytes, **zero change** |
| 5 | Manifest SHA of the **copy** after startup | **diverged** — 1176 files, 42,240,891 bytes, `f4d4ae66…` |

Checks 4 and 5 together are decisive: the server demonstrably **wrote** to the copy (copy diverged) while the original stayed byte-identical.

`.env.local` contains **no credential keys** — only `NODE_ENV`, `DATABASE_DRIVER`, `USE_LOCAL_DB`, `PGLITE_DATA_DIR`, `PUNTAKIT_DEMO_MODE`, `VITE_PUNTAKIT_DEMO_MODE`, `API_PORT`. No values were printed.

---

## 4. 🔴 Latent configuration defect found during setup

`vite.config.ts` proxies `/api` to `http://localhost:${process.env.API_PORT || 3001}`, but the `dev:client` script (`vite --host`) runs **without** `dotenv`, so it never reads `.env.local`. `.env.local` sets `API_PORT=3101`.

**Result:** a plain `pnpm dev` starts the API on **3101** while Vite proxies to **3001** — every `/api` call fails. `AGENTS.md` documents the mitigation as "set `API_PORT=3001`", which is now wrong advice because the two files disagree.

For this audit both variables were pinned explicitly in the shell. **No config file was modified.**

Also: `AGENTS.md` claims `.env.local` contains `API_PORT=3001`; it actually contains `3101`.

---

## 5. Method

| Layer | Technique |
|---|---|
| Inventory | Source reading of the router, nav config, role sets, server routes and test files |
| UX / design | Source review of all 34 page components + shared components, against `04-DESIGN-SYSTEM-RULES.md` |
| Browser | Playwright 1.64.1 / Chromium 156, headless, driving the real dev stack through the Vite proxy |
| Contrast | Computed in-page: walk ancestors for the effective background, composite alpha, WCAG relative luminance, threshold chosen by rendered font size and weight |

**Playwright was installed into a temp sandbox** (`%TEMP%\opencode\pw-audit`), **not** the project. `node_modules` and `pnpm-lock.yaml` were never touched.

Every browser measurement is labelled. Two of my own detectors were wrong and are documented in [`05-BROWSER-EVIDENCE.md`](05-BROWSER-EVIDENCE.md) so they are not repeated.

---

## 6. What was deliberately NOT done

| Action | Reason |
|---|---|
| Any code / config / schema / dependency edit | Audit only. Awaiting approval. |
| `pnpm test` (96 files, ~5 min, boots 34 PGlite instances) | Would not change any finding; deferred so it can be run deliberately rather than blindly, as the brief requires |
| `pnpm build`, `pnpm check` | Not needed for an audit; both are CI gates already |
| Seeding a `super_admin` into the isolated copy | Would require writing a DB record; not authorised. Three routes stay NOT VERIFIED |
| Any REA reverse-engineering call | REA's verified capability is shipped-binary / decompilation / runtime-attach analysis. This is a live local web app; forcing it would be theatre |
| Destructive interaction tests (delete, merge, apply, rollback) | Would mutate the isolated copy's data; out of scope without authorisation |

---

## 7. Files created by this audit

All inside the repo, all new, none committed:

```
docs/audits/2026-10-18-full-audit/
  README.md
  01-BASELINE-AND-METHOD.md
  02-ROUTE-AND-NAV-INVENTORY.md
  03-FINDINGS-REGISTER.md
  04-DESIGN-SYSTEM-RULES.md
  05-BROWSER-EVIDENCE.md
  06-REMAINING-WORK.md
```

Outside the repo (scratch, disposable):
```
%TEMP%\opencode\audit-db\            isolated DB copy
%TEMP%\opencode\pw-audit\            Playwright sandbox + scripts + JSON results
%TEMP%\opencode\preflight-backup\    unrelated, from an earlier task
```

**Zero repo files were modified.** One probe file (`probe-config.ts`) was created and deleted inside a single command; `git status` confirms it is gone.
