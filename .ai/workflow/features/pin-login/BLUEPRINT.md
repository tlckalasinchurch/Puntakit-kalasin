# BLUEPRINT — login identifier + PIN, and the gates around it

> Written 2026-10-13, after the P0 (starter super-admin PIN) work passed its gates.
> **This is a plan, not an approval.** Per `00_AI_TOOLS_INSTRUCTIONS.md` §3 and the
> project pipeline, chat confirmation alone never authorizes implementation: each phase
> below has an explicit approval gate.

## 0. State to re-verify first thing

Do not trust this file blindly — re-run and compare. Every number below was run on
2026-10-13, not assumed.

```powershell
cd C:\Users\Administrator\Desktop\Work\Puntakit-kalasin\Puntakit-kalasin-main
git log --oneline -3
git status --short
git rev-list --left-right --count origin/main...HEAD
$env:TZ="UTC"; pnpm check
$env:TZ="UTC"; pnpm test
pnpm build
```

Expected on arrival:

| Thing | Value |
|---|---|
| HEAD | `a8170bd` — `docs: replace Clerk instructions with the PIN auth reality` |
| Behind `origin/main` | 0 — **2 commits are not pushed** |
| Working tree | **8 modified + 1 new file (`server/readiness.test.ts`) — the whole of P0 is uncommitted** |
| `pnpm check` | exit 0 |
| `pnpm test` | **60 files / 744 tests**, ~350s |
| `pnpm build` | exit 0 |

The `TZ=UTC` form matters: this box is `SE Asia Standard Time` and CI is UTC. The bash-style
`TZ=UTC pnpm test` in the project docs fails in PowerShell.

## 1. Priority and why

| # | Item | Why first |
|---|---|---|
| A | Commit the P0 work | It is verified but **uncommitted and unpushed**. One `git checkout` away from gone. |
| B | Fix `/admin/users` + `/admin/merge-approvals` client gates | Two missing props. Server already blocks, so this is UX only — cheap, and it removes a confusing dead end. |
| C | P1 — identifier + PIN login | The real work. Removes an O(n) scrypt scan from every login. |
| D | Structural items | Not urgent. Listed so they are not lost. |

Do A before touching anything else. B can ride along in the same commit as C's UI work or
standalone — it is 2 lines.

---

## 2. Item A — commit P0

**Status:** verified green, not committed.

Files:

```
 M CLAUDE.md                          M server/db/bootstrap.ts
 M DEPLOYMENT.md                      M server/readiness.test.ts   (new, untracked)
 M DEPLOYMENT_CHECKLIST_TH.md         M server/db/bootstrap.test.ts
 M MASTER_PROMPT.md                   M server/app.ts
```

Suggested split — or one commit, your call:

- `fix(auth): never seed the starter super-admin PIN outside local PGlite`
- `docs: document the SUPER_ADMIN_PIN_MISSING readiness gate`

**Gate:** explicit instruction before `git commit`. **Never push** without a separate
instruction. Do not stage `Puntakit House Mission*.html` — they are untracked user files.

---

## 3. Item B — two routes have no client gate

`client/src/App.tsx`:

- line 163–167 — `/admin/users` → `<ProtectedRoute>` **with no `allow`**
- line 183–187 — `/admin/merge-approvals` → `<ProtectedRoute>` **with no `allow`**

`ProtectedRoute` with no `allow` means *any signed-in user may open it*
(`client/src/components/ProtectedRoute.tsx:18`). So a `member` who types `/admin/users` gets the
full admin shell and then a wall of 403s, instead of the "คุณไม่มีสิทธิ์เปิดหน้านี้" screen.

**The server is safe** and must not be touched:
- `server/routes/adminUsers.ts:22` — `if (req.user?.role !== "super_admin") return next(new ForbiddenError(...))`

Fix: `allow={SUPER_ADMIN_ROLES}` on both. `/admin/pins` (line 168–172) already does this, which is
why it looks like an oversight rather than a decision.

**Tests:** `client/src/role-gate-contract.test.ts` already greps route gates — extend it rather
than inventing a new harness.

---

## 4. Item C — P1: login by identifier + PIN

### 4.1 The problem, precisely

`server/lib/firstPartyAuth.ts:119–146` — `authenticateWithPin`:

```ts
const candidates = await db.select().from(users)
  .where(and(eq(users.status, "active"), isNotNull(users.pinHash)))
  .limit(1000);
for (const candidate of candidates) {
  if (await verifyPin(pin, candidate.pinHash)) matches.push(candidate);
}
```

One full scrypt verify **per active account**, capped at 1000. Login cost is O(accounts).
At a few hundred members this is visibly slow and is a cheap denial-of-service target — every
attempt costs the server ~N scrypt operations.

### 4.2 The fix

Look the account up by a unique indexed column, then verify exactly one scrypt hash.

`users.email` is already `.unique()` (so it has a unique index) — **no migration required.**

### 4.3 Verify these three things BEFORE designing

Each one can invalidate the approach:

1. **Is `users.email` normalized (trimmed + lowercased) on write?** `server/scripts/set-pin.ts:7`
   lowercases, but the account-creation path is elsewhere. If emails are stored mixed-case, a
   `WHERE email = $1` lookup will miss on case. Check `server/routes/adminUsers.ts`.
2. **How does demo mode sign in on the client?** `requireAuth` short-circuits on
   `PUNTAKIT_DEMO_MODE=1`, but `/api/auth/login` still calls `authenticateWithPin` unconditionally.
   Confirm whether the login page is even reached in demo mode.
3. **Is a PIN-only request still needed?** If any deployed client still posts `{ pin }`, decide
   between a validation error and a compatibility path before changing the schema.

### 4.4 Security requirements — non-negotiable

- **Timing.** Today "no such account" and "wrong PIN" cost the same, because the scan always runs.
  With a lookup, the not-found branch returns early and **becomes a user-enumeration oracle.**
  When the identifier does not resolve, still perform one scrypt verify against a fixed dummy
  hash so the two paths take comparable time. Write a test that asserts both paths run the
  verifier.
- **Generic error.** `GENERIC_LOGIN_ERROR` must stay the single response for unknown identifier,
  wrong PIN and locked account. Never branch the message.
- **Lockout is already per-account** (`pinFailedAttempts`, `pin_locked_until`) — keep using it, and
  keep the `checkSourceLimit` per-source limit. Do not make lockout identifier-based.

### 4.5 Files

| File | Change |
|---|---|
| `server/routes/auth.ts` | `loginSchema`: add `identifier` |
| `server/lib/firstPartyAuth.ts` | replace the scan; add the dummy-verify path |
| `client/src/pages/PinSignInPage.tsx` | add an identifier field |
| `client/src/index.css` | style for it — `.pin-login__*` is keypad-only today |
| `client/src/auth-session-contract.test.ts:71` | **asserts `api.post("/api/auth/login", { pin })` — it breaks the moment the body changes** |
| `server/scripts/set-pin.ts` | see 4.6 |

### 4.6 Decide: may two accounts share a PIN?

Today the code requires a PIN to match exactly one account, and a second match fails closed.
Identifier login makes duplicates harmless for login but weak (two accounts, PIN `111111`).

- Remove the uniqueness rule and warn on `db:set-pin`, **or**
- keep a uniqueness check at PIN-assignment time.

Related: the P0 seed gives every PIN-less super admin the **same** starter PIN, so seeding two of
them currently locks out both. Worth fixing alongside, or explicitly accepting.

### 4.7 Tests required

- correct identifier + correct PIN → 200 + session
- correct identifier + wrong PIN → the generic 401
- **unknown identifier → the same generic 401, and the verifier still ran** (timing)
- locked account (`pin_locked_until` in the future) → generic 401
- suspended account → generic 401
- identifier with different casing → resolves, or is documented as case-sensitive
- missing/blank identifier → validation error with the field name
- the old `{ pin }`-only body → whatever 4.3.3 decided

---

## 5. Item D — structural, deferred

None are urgent. Recorded so they are not lost.

| Item | Where | Note |
|---|---|---|
| Enum values are **TypeScript-only — no `CHECK` constraints** anywhere in the DB | all 14 migrations | bad data can enter the DB directly |
| `attendance_records` has **no unique constraint** | schema | double check-in is possible |
| `latitude` / `longitude` stored as **`text`**, not numeric | `groups`, `mission_activities` | blocks real geo queries |
| **`users_pin_locked_until_idx` exists in migration 0013 but not in `shared/schema.ts`** | migration vs schema | `drizzle.config.ts` sets `strict: true`, so the next `drizzle-kit generate` may drop it |
| Import pipeline has **no L3** — approved imports never reach `members` | import tables | by design so far; needs a decision |
| `CLAUDE.md:46` says `Home.tsx` redirects a member to `/app` | CLAUDE.md | it is `ProtectedRoute` now; already touched once today, low priority |

---

## 6. Decisions needed from the owner

1. **Identifier = email, or `member_no`?** Email is free today (already unique and indexed).
   `member_no` lives on `members`, not `users`, so it needs a join or a new column.
2. **Keep PIN-only login as a fallback, or replace it?** Keeping it preserves the keypad-only UX
   but keeps the O(n) worst case.
3. **Is a second super admin with no PIN acceptable on a local database?** If not, the P0 seed
   should only ever write to the first one.

## 7. Do not

- **Do not push.** Two commits plus P0 are unpushed and that is deliberate.
- **Do not reinstall Clerk.** It is gone from `package.json`, the lockfile and the source; the
  docs that still mentioned it were fixed today. `users.clerk_id` and `users.password_hash`
  survive in the schema as legacy columns — that is not an invitation to bring Clerk back.
- **Do not run `pnpm lint`** — there is no lint script and no ESLint. `pnpm check` is the gate.
- **Do not trust a green `pnpm test` alone.** `--passWithNoTests` means a mis-scoped run reports
  green with zero tests; read the `Test Files` / `Tests` line.
- **Do not delete a root junction** or copy files out of one — see the workspace `AGENTS.md`.