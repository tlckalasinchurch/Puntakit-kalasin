# FEATURE-INVENTORY.md

**Status: AUDITED (read-only). No implementation performed.**
**Audit date:** 2026-10-15
**Worktree:** `02-Worktrees/puntakit-claude-redesign`
**Branch:** `redesign/full-app-claude-20261015` @ `1eddddb` (ahead of `origin/main` by 7)
**Audit location:** `docs/audits/2026-10-15-full-product-ux/` (new; does not overwrite `docs/audits/2026-10-15-badminton-ux/`, `2026-10-15-minimal-premium/`, `2026-10-15-product-audit/`)

---

## 0. Evidence convention

| Tag | Meaning |
|---|---|
| `[RUN]` | I executed this and observed the result |
| `[CODE]` | Read directly from source; the claim is what the code says, not that it behaves correctly at runtime |
| `[DOC]` | A document asserts it; not independently confirmed against code |
| `[INFER]` | Reasoned conclusion; needs confirmation |
| `[NV]` | Not verified |

A route existing is **not** evidence the route works. Runtime behaviour of every route was **not** browser-verified in this audit.

---

## 1. Repository ground truth `[RUN]`

```
git rev-parse --show-toplevel  -> C:/Users/Administrator/Desktop/Work/02-Worktrees/puntakit-claude-redesign
branch                          -> redesign/full-app-claude-20261015 (upstream origin/main, ahead 7)
HEAD                            -> 1eddddb "docs: update handoff with current state and blocker 3"
```

### Worktrees `[RUN]` — 3 exist; `main` untouched

| Path | Branch | HEAD |
|---|---|---|
| `Puntakit-kalasin/Puntakit-kalasin-main` | `main` | `4826739` |
| `02-Worktrees/puntakit-claude-redesign` ← **this worktree** | `redesign/full-app-claude-20261015` | `1eddddb` |
| `02-Worktrees/puntakit-redesign` | `redesign/all-pages-20261014` | `1f195d7` |

### Uncommitted work carried into this audit — 10 modified, 4 untracked `[RUN]`

Nothing was reset, reverted, staged, or overwritten. The audit preserved all of it.

**Modified (+292 / −51):** `client/src/App.tsx`, `client/src/design-tokens.test.ts`, `client/src/index.css`, `client/src/pages/member/MemberReports.tsx`, `client/src/role-aware-ui.test.ts`, `client/src/role-gate-contract.test.ts`, `server/routes/submissions.ts`, `server/routes/submissions.test.ts`, `shared/roles.ts`, `shared/roles.test.ts`

**Untracked:** `docs/audits/` (9 prior files), `referend/*.jpg|png` (3 reference images)

---

## 2. Gate status — the single most important finding `[RUN]`

| Gate | Command | Result |
|---|---|---|
| Type check | `pnpm check` | **PASS** (exit 0, no diagnostics) |
| Client + shared tests | `pnpm vitest run client/ shared/` | **FAIL** — 21 files passed / 1 failed; **245 tests passed / 1 failed** |
| Server tests | `pnpm vitest run server/` | **PASS** — 41 files / **535 tests**, 0 failures (365 s) |

### 2.0 Combined gate result `[RUN]`

| Suite | Files | Tests |
|---|---|---|
| server | 41 passed / 0 failed | **535 passed** |
| client + shared | 21 passed / **1 failed** | 245 passed / 1 failed |
| **Total** | **62 passed / 1 failed** | **780 passed / 1 failed** |

The server suite passing means the **uncommitted** `server/routes/submissions.ts` + `shared/roles.ts` authorization change is covered by its own updated tests. It does **not** mean the change was reviewed or approved — it is still a `server/**` + `shared/roles.ts` modification that the handoff doc explicitly forbids without an owner decision.

### 2.1 The failing test

```
FAIL client/src/ux-audit-regressions.test.ts
  > "brand-spec.md uses the same Sunken colour as index.css"
ux-audit-regressions.test.ts:540
```

**Root cause (verified by reading both files):**

| File | Line | Value |
|---|---|---|
| `client/src/index.css` | 58 | `--color-canvas-sunken: #f1f5f9;` |
| `brand-spec.md` | 38 | `\| Sunken \| `#f2f2f4` \|` |

The uncommitted "Minimal Premium" palette swap in `index.css` changed `--color-canvas-sunken` from `#f2f2f4` to `#f1f5f9` but did **not** update `brand-spec.md`. `ux-audit-regressions.test.ts:535-543` asserts the two files agree.

**This is a P0.** CI (`.github/workflows/ci.yml`) runs `pnpm check` → `pnpm test` → `pnpm build`, so the current tree **fails CI**.

> ⚠️ **Correction to prior audit documents.** `docs/audits/2026-10-15-product-audit/FEATURE-INVENTORY.md` states "Gates pass". That claim is **false for the current tree** `[RUN]`. It also self-flags the risk ("no page has been looked at since"), which was correct.

---

## 3. Route inventory `[CODE]`

**37 `<Route path="…">` entries + 1 catch-all (`component` form, matches `*`) = 38 route slots.**
Verified by extracting every `path="…"` from `client/src/App.tsx`.

Router is `wouter` `Switch`. Matching is **exact** (trailing slash optional) — `wouter` builds `^<pattern>/?$` when `loose` is falsy, and `<Route>` does not pass `loose` `[CODE, node_modules verification]`.

### 3.1 Public / auth

| Route | Component | Guard | Notes |
|---|---|---|---|
| `/login` | `PinSignInPage` | none | PIN keypad; `window.location.assign("/")` after success (full reload, not SPA nav) |
| `/privacy` | `Privacy` | none | public |
| `/terms` | `Terms` | none | public |

### 3.2 Member PWA — `/app/*`

All guarded by `<ProtectedRoute>` with **no `allow=`** (any signed-in role).

| Route | Component | Lines |
|---|---|---|
| `/app` | `MemberHome` | 552 |
| `/app/events` | `MemberEvents` | 400 |
| `/app/group` | `MemberGroup` | 313 |
| `/app/reports` | `MemberReports` | 240 |
| `/app/attendance` | `MemberAttendance` | 337 |
| `/app/profile` | `MemberProfile` | 577 |

### 3.3 Admin shell

| Route | Component | `allow=` set | Lines |
|---|---|---|---|
| `/` | `Home` | `ADMIN_SHELL_ROLES` | 1045 |
| `/feed` | `Feed` | `ADMIN_SHELL_ROLES` | 950 |
| `/mission-feed` | `<Redirect to="/feed" />` | **none** | — |
| `/memberships` | `Memberships` | `MEMBERSHIP_VIEW_ROLES` | 200 |
| `/follow-up` | `FollowUps` | `ADMIN_SHELL_ROLES` | 269 |
| `/inbox` | `Inbox` | `ADMIN_SHELL_ROLES` | 642 |
| `/import` | `ImportData` | `PRIVILEGED_ROLES` | 407 |
| `/care` | `CareToday` | `CREATE_ROLES` ⚠️ *(uncommitted change; was `ADMIN_SHELL_ROLES`)* | 362 |
| `/org` | `OrgChart` | `PRIVILEGED_ROLES` | 397 |
| `/admin/users` | `AdminUsers` | `SUPER_ADMIN_ROLES` ⚠️ *(uncommitted; previously ungated)* | 472 |
| `/admin/pins` | `PinManagement` | `SUPER_ADMIN_ROLES` | 229 |
| `/import/org` | `ImportOrgData` | `ADMIN_ROLES` | 219 |
| `/import/duplicates` | `ImportDuplicates` | `PRIVILEGED_ROLES` | 571 |
| `/import/merge-approvals` | `ImportMergeApprovals` | `PRIVILEGED_ROLES` ⚠️ *(uncommitted; previously ungated)* | 285 |
| `/members` | `Members` | `ADMIN_SHELL_ROLES` | 1266 |
| `/groups` | `Groups` | `ADMIN_SHELL_ROLES` | 1291 |
| `/map` | `MapPage` | `ADMIN_SHELL_ROLES` | 571 |
| `/attendance` | `Attendance` | `ADMIN_SHELL_ROLES` | 1197 |
| `/profile` | `Profile` | `ADMIN_SHELL_ROLES` | 160 |
| `/announcements` | `Announcements` | `ADMIN_SHELL_ROLES` | 293 |
| `/events` | `Events` | `ADMIN_SHELL_ROLES` | 592 |
| `/worship` | `Events` (alias of `/events`) | `ADMIN_SHELL_ROLES` | — |
| `/church` | `Church` | `ADMIN_SHELL_ROLES` | 210 |
| `/ministries` | `Ministries` | `ADMIN_SHELL_ROLES` | 278 |
| `/reports` | `Reports` | `PRIVILEGED_ROLES` | 208 |
| `/media` | `ComingSoon` **stub** | `ADMIN_SHELL_ROLES` | 45 |
| `/settings` | `ComingSoon` **stub** | `ADMIN_SHELL_ROLES` | 45 |
| `/404` | `NotFound` | none | 32 |
| *(no path — `*`)* | `NotFound` | none | 32 |

⚠️ marks the three route-gate changes present in the **uncommitted** `App.tsx` diff.

### 3.4 Layout ownership — clarification

`ProtectedRoute.tsx:124-128` defines a `wrap()` function that selects `AppLayout` vs `MemberAppLayout`, but passes it **only** to `RouteErrorBoundary`. `RouteErrorBoundary.tsx:35` returns `this.props.children` unchanged unless an error was caught; `wrap` is used only to place the error message inside a shell (documented at `RouteErrorBoundary.tsx:10-13`).

**Conclusion: there is no double-shell rendering bug.** Pages own their shell; the boundary re-supplies one only on the error path. *(This corrects an initial automated reading of the same code, which wrongly inferred a double-wrap.)*

---

## 4. Member-facing features

| Feature | Route(s) | Data source | Class |
|---|---|---|---|
| Home dashboard | `/app` | `GET /api/me/portal` | **A** |
| Event browsing + RSVP | `/app/events` | `GET /api/events`, `/api/announcements`, `/api/me/events/my` | **A** |
| RSVP dual CTA (สนใจ / จะมา) | `/app`, `/app/events` | `POST|DELETE /api/me/events/:id/register` | **A** — "สนใจ" is deliberately client-only, pinned by `member-events-rsvp.test.ts` |
| Prayer request | `/app` (`PrayerRequestModal`) | `POST /api/me/prayer-requests` | **A** |
| Care-group view + roster | `/app/group` | `GET /api/me/group` | **A** |
| Personal attendance history | `/app/attendance` | `GET /api/me/attendance` (hard `.limit(50)`) | **A** |
| Mission report submit + list | `/app/reports` | `GET/POST /api/submissions` | **B / C** — see §7.1 |
| Profile edit | `/app/profile` | `GET/PUT /api/me/profile` | **A** |
| Push notification subscribe | `/app`, `/app/profile` | `POST /api/me/push/subscribe` | **C** — `send-test` is simulation-only, returns a hardcoded payload and sends nothing |
| Member QR pass | `/app` | `qrToken` from `/api/me/portal` | **B** — thin meta |
| "Everything" / Menu hub | — | — | **D** — the wireframe's centrepiece; **no `/app/menu` route exists** |
| Member notification inbox | — | — | **D** — members have no inbox; `/inbox` is `ADMIN_SHELL_ROLES` |

---

## 5. Admin-facing features

| Feature | Route(s) | Classification |
|---|---|---|
| Role-aware work dashboard | `/` | **A** |
| Member directory (search/filter/paging/CRUD/CSV/QR) | `/members` | **A** |
| Group & body management | `/groups` | **A** |
| Attendance: live check-in, QR scan, absentees, reports | `/attendance` | **A** |
| Care-group roster check-in | `/care` | **C** — gate mismatch fixed but **uncommitted** |
| Mission activity feed (draft→review→publish→archive) | `/feed` | **A** |
| Submission review inbox | `/inbox` | **A** |
| Follow-up pastoral tasks | `/follow-up` | **A** |
| Membership lifecycle (วิสามัญ/สามัญ, payment) | `/memberships` | **C** — feature doc lists 9 open blockers; migration `0012` not verified applied in production |
| Org chart | `/org` | **A** |
| Church map (Leaflet + markercluster) | `/map` | **A** |
| Events / Announcements / Ministries / Church profile | `/events`, `/worship`, `/announcements`, `/ministries`, `/church` | **A** |
| Reports + 4 CSV exports | `/reports` | **A** |
| Excel import pipeline (L1/L2, duplicates, 4-eyes merge) | `/import`, `/import/org`, `/import/duplicates`, `/import/merge-approvals` | **C** — `docs/UI_ROUTE_TRACKER.md` states the upload happy path was **never exercised** |
| User & role administration | `/admin/users` | **C** — gate fixed but uncommitted |
| PIN management | `/admin/pins` | **A** |
| Media library | `/media` | **D** — `ComingSoon` stub |
| Settings | `/settings` | **D** — `ComingSoon` stub |

---

## 6. Shared layouts & navigation `[CODE]`

### Admin shell
- `AppLayout.tsx` (45) — skip link → `#app-main`, `<Sidebar>`, `<Topbar>`, `<main id="app-main">`, `<MobileBottomNav>`
- `Sidebar.tsx` (342) — **6 nav groups, 21 items** (admin sees 19, staff 18, ministry_leader 17, viewer 12; corrected 2026-10-16 from 17); off-canvas below `lg`, shown as a two-column tile grid since commit `2265a89`; a separate focused `groupLeaderNavGroups` (6 items) for `group_leader`
- `Topbar.tsx` (138) — hamburger, global search (`hidden` below `sm`), theme toggle, notification bell → `/inbox` (polls every 60 s, caps badge at `9+`), account avatar
- `MobileBottomNav.tsx` (85) — role-dependent items (`group_leader` gets 3, default gets 4) + a trailing "เมนู" drawer button

### Member PWA shell
- `MemberAppLayout.tsx` (171) — 60 px sticky header, **5-item bottom nav**, `max-w-[600px]` (widened to `max-w-[1440px]` on `/app` only)
- Nav: `หน้าแรก /app` · `รายงาน /app/reports` · `กลุ่ม /app/group` · `กิจกรรม /app/events` · `ฉัน /app/profile`
- Active state uses **prefix matching** (`:130-132`), unlike the admin nav's exact match

### Navigation active-state inconsistency `[CODE]`
- `Sidebar.tsx:305-308` — exact match, **plus** two special cases: `/events` also lights up on `/worship`, and `/import` lights up on any `/import/*`
- `MobileBottomNav.tsx:49` — **exact match only**. So `/import/duplicates` lights the sidebar's Import entry but **nothing** in the bottom bar.
- `MemberAppLayout.tsx:130-132` — **prefix match**, so a future `/app/reports/:id` would light "รายงาน"

---

## 7. Existing business workflows

### 7.1 Mission submission → review → publish `[CODE]`
```
member POST /api/submissions          (uncommitted: SUBMISSION_CREATE_ROLES now includes "member")
  → Inbox (reviewer) GET /api/submissions?status=new
  → PUT /api/submissions/:id/status   (new→reviewing→needs_info|approved|rejected)
  → POST /api/submissions/:id/publish  → creates a DRAFT mission_activities row
  → Feed PUT /api/activities/:id/status (draft→pending_review→published→archived)
```

### 7.2 Attendance `[CODE]`
`/attendance` (4 tabs: live check-in · QR scan · absentees · reports) and `/care` (care-group roster, bulk save via `POST /api/attendance/bulk`). Statuses `present | online | leave | absent`.

### 7.3 Membership lifecycle `[CODE]`
`membership_terms` with a partial unique index on `status='open'`; decisions close the current term and open the next **atomically**; payment recorded only by `MEMBERSHIP_PAYMENT_ROLES`.

### 7.4 Excel import with four-eyes merge `[CODE]`
upload → L1 raw rows → L2 normalization + quarantine → duplicate decisions (append-only) → merge plans → **second reviewer required** (cannot approve your own) → apply.

### 7.5 Prayer request `[CODE]`
`POST /api/me/prayer-requests`. Copy contract (`prayer-request-copy-contract.test.ts`) forbids promising a team received the request.

---

## 8. API endpoints & data models relevant to this audit

### Member-facing endpoints (`server/routes/portal.ts`, gate `requireAuth` only)
| Endpoint | Returns |
|---|---|
| `GET /api/me/portal` | user, member + `qrToken`, careGroup, 3 recent announcements, 5 upcoming events with `isRegistered`, `attendanceStats{totalAttended,lastAttended}` |
| `GET /api/me/attendance` | own attendance rows, **hard `.limit(50)`** |
| `GET /api/me/group` | own care group + fellows (name/nickname/avatar/role only) |
| `GET/PUT /api/me/profile` | own member DTO; update schema **excludes** `role` and `membershipStatus` |
| `GET /api/me/events/my` | registered events |
| `POST/DELETE /api/me/events/:id/register` | RSVP |

**Key gap for reference-pattern mapping:** there is **no** member-facing endpoint for "my reports" (detail or list scoped to me beyond `GET /api/submissions`, which shows all my rows), **no** notification-read state, and **no** notification delivery record despite `push_subscriptions` existing.

### Data model highlights (`shared/schema.ts`, 902 lines, 24 tables)
`users`, `user_sessions`, `audit_logs`, `members`, `announcements`, `events`, `ministries`, `church_profile`, `groups`, `group_members`, `attendance_records`, `event_registrations`, `prayer_requests`, `push_subscriptions`, `mission_activities`, `mission_activity_participants`, `mission_activity_media`, `follow_ups`, `mission_submissions`, `import_batches`, `import_source_rows`, `normalization_rules`, `import_row_norm`, `import_duplicate_decisions`, `import_merge_plans`, `membership_terms`, `media_assets`

Migrations `0000`–`0012` (13 files).

---

## 9. Authentication & authorization boundaries `[CODE]`

### 7 roles
`super_admin · admin · ministry_leader · group_leader · staff · member · viewer` (`shared/schema.ts:30-38`)

### `requireAuth` resolution order (`server/middleware/auth.ts:22-55`)
1. **Demo mode** — requires `PUNTAKIT_DEMO_MODE=1` **and** `NODE_ENV!=="production"` **and** `PUNTAKIT_TEST_AUTH!=="1"`
2. **Legacy test cookie/JWT** — requires `PUNTAKIT_TEST_AUTH=1` **and** non-production
3. **Production** — `loadSessionUser()`: sha256 of the `puntakit_session` cookie → `user_sessions` ⋈ `users`, requiring `revokedAt IS NULL` and `expiresAt > now()`

`createApp()` **throws at construction** if `NODE_ENV=production` and `PUNTAKIT_TEST_AUTH=1` or `PUNTAKIT_DEMO_MODE=1` (`server/app.ts:69-74`).

### PIN controls (`server/lib/firstPartyAuth.ts`)
- scrypt `N=32768, r=8, p=1`, 16-byte salt, 64-byte key
- **>12 attempts / 60 s per IP** → `RATE_LIMIT_EXCEEDED`
- **5 failures per account** → `pinLockedUntil = now + 15 min`
- A PIN must match **exactly one** account; 0 or ≥2 matches fail closed
- `requireRole` **always admits `super_admin`**, listed or not (`auth.ts:60`)

### CSRF
Cookie `puntakit_csrf` (non-httpOnly) + header `x-csrf-token`, compared with `timingSafeEqual`. Skipped for GET/HEAD/OPTIONS and entirely when `PUNTAKIT_TEST_AUTH=1` or demo mode. Mismatch → **401**.

### Contact-data masking
Single rule `canSeeMemberContacts`: `CONTACT_VISIBLE_ROLES` (super_admin, admin, staff) **or** the requester is that member's `assignedLeaderId`. Applied consistently across `members`, `groups` roster, `/api/care` roster, `/api/attendance` list and qr-scan.

---

## 10. Observed authorization inconsistencies `[CODE]` — reported, NOT fixed

These are facts about the code. **No fix is proposed or applied here**; each needs explicit authorization.

| # | Observation | Location |
|---|---|---|
| A1 | `GET /api/groups` requires only `requireAuth`, while its sibling `GET /api/groups/:id` requires `ADMIN_SHELL_ROLES`. A `member`-role account is refused group detail but **is** served the group list. | `server/routes/groups.ts:30,195` vs `:301` |
| A2 | `GET /api/dashboard/summary` returns church-wide counts to any authenticated role; only `recentMembers` is role-gated. | `server/routes/dashboard.ts:29-74,113` |
| A3 | `GET /api/announcements` and `/api/announcements/:id` apply **no status filter**, so drafts are readable by any authenticated role. The member portal endpoint *does* filter to published. | `server/routes/announcements.ts:13-27` vs `server/routes/portal.ts:86` |
| A4 | `/api/admin/users` uses an inline `req.user?.role !== "super_admin"` check rather than the canonical `SUPER_ADMIN_ROLES` set (which the server never imports). | `server/routes/adminUsers.ts:21-24` |
| A5 | `POST /api/me/events/:id/register` parses `eventRegistrationSchema` but **silently ignores** parse failure instead of returning 400; the note is dropped. | `server/routes/portal.ts:420,457,477` |
| A6 | Two parallel hardcoded role lists duplicate `shared/roles.ts` content: `canViewFullGroupRosterRole` and `OFFICE_ROLES`. | `server/routes/groups.ts:149-151`; `server/lib/membershipScope.ts:31` |
| A7 | CSV-injection guard is applied on the `reports.ts` export path only; `members.ts` and `attendance.ts` build CSV inline without it. | `server/lib/csv.ts:11-17` vs `server/routes/members.ts:315-352` |

---

## 11. Existing tests & documented specifications

### Test suites `[CODE]`
- **Client: 18 files** — all `.test.ts`, **zero `.test.tsx`**. There is **no jsdom and no React Testing Library**, so no client test renders React.
- **Shared: 4 files** · **Server: 41 files**

> ⚠️ **Load-bearing consequence:** `tsconfig.json` has `"exclude": ["**/*.test.ts"]`, so **`pnpm check` never parses test files**. A syntactically broken test passes `tsc` and fails only at `pnpm test`. This explains why a red test can sit undetected behind a green `pnpm check`.

### Most client tests are **static source scans**, not render tests `[CODE]`
They regex over file text. This proves *a string exists*, not that a component renders. A prior audit (`03-LOGICAL-ARCHITECTURE.md`) records a concrete instance: the member report list passed every contract test while rendering permanently empty.

### Design-change contract tests (these constrain any UI work)
| Test | Enforces |
|---|---|
| `design-tokens.test.ts` | exact `:root` hexes; retired navy palette banned; `--shadow` must be a real `rgba()`; no hardcoded `bg-[var(--color-primary)] text-[var(--color-on-dark)]`; ≥4.5:1 text contrast in light **and** dark |
| `design-system-consistency.test.ts` | no raw Tailwind palette utilities; shared state components may not be redeclared; no `!important` dark overrides; **no text below 12 px** |
| `premium-shell-contract.test.ts` | `pk-*` classes stay opt-in and **admin-only**; `.pk-glass` in exactly 2 files; reduced-motion override required |
| `ux-audit-regressions.test.ts` | broadest net: page titles, `min-h-11`, focus rings, `ListPager`, URL state, Thai error copy, legal links, viewport zoom, **and the `brand-spec.md` ↔ `index.css` Sunken sync** |
| `nav-structure-contract.test.ts` | Thai nav labels + per-item role gates |
| `role-gate-contract.test.ts` | every admin-shell `<ProtectedRoute>` must carry `allow=` from `shared/roles.ts` |

### Documented product specifications `[CODE]`

| Artifact | Status |
|---|---|
| `.ai/workflow/features/pin-login/BLUEPRINT.md` | **NOT APPROVED** — "This is a plan, not an approval." 3 open owner decisions. |
| `GRILL.md` / `SPEC.md` / `TICKETS.md` | **Do not exist anywhere in the repo.** Zero tickets are at `Status: approved`. |
| `docs/features/membership-lifecycle.md` | 9 open blockers; migration `0012` not verified applied; **not merged, not deployed** |
| `docs/superpowers/plans/2026-10-15-puntakit-full-app-redesign.md` | Task 0 Step 2 decision recorded (`ACCENT_ONLY`); Tasks 1–5 unchecked |
| `docs/audits/2026-10-15-*/` (9 files) | Audit only; explicitly "nothing implemented" |
| `referend/Puntakit — Wireframe …md` | Wireframe proposal; **no approval marker, no ticket** |

**Conclusion: no feature in this repository currently has an approved specification.** Every proposal below is therefore a proposal, not an implementation task.

---

## 12. Components & design tokens — summary (detail in `MINIMAL-DESIGN-SYSTEM.md`)

- The real design system is **`client/src/components/DesignSystem.tsx` (899 lines)**, not `components/ui/`.
- `client/src/components/ui/` holds 53 shadcn files, but **only 7 are actually imported by app code**.
- `LoadingStates.tsx` (170) provides 7 skeletons; `ConfirmDialog.tsx` (89) provides confirmation.
- 79 `--color-*` declarations; `.lamb-theme` is an **independent palette scope** that does not follow `--color-primary`.

---

## 13. Classification summary

| Class | Count (examples) |
|---|---|
| **A** Existing & working (code-verified) | 24 admin/member features — directory, groups, attendance, feed, inbox, follow-ups, events, announcements, ministries, church profile, org chart, map, reports, PIN mgmt, member portal, RSVP, prayer requests, profile |
| **B** Existing, needs UX/UI improvement | member QR pass meta, member card density, status-chip inconsistency, nav active-state mismatch, hand-rolled pager vs `ListPager`, shadcn primitives unused while pages hand-roll classes |
| **C** Existing, incomplete / not verified | `/care` gate (uncommitted), `/admin/users` gate (uncommitted), member report form (uncommitted), import upload happy path (never exercised), `/map` with real coordinates (never exercised), membership lifecycle in production, push `send-test` (simulation only), production behaviour of all routes |
| **D** Enhancement requiring a product spec | `/app/menu` hub, member notifications/inbox, media library, settings, bottom-nav restructure, "Recommended/Featured" curation |
| **E** Unsupported by current data/backend | notification read-state & delivery log, member-scoped report detail endpoint, announcement read receipts, per-member event attendance confirmation, any cross-church aggregation |
| **F** Not applicable to Puntakit | ELO ratings, court booking, court fees, coach marketplace, match randomizer/team randomizer, scoreboard, achievements/rewards/points, level quiz, badminton activity tracking |

---

## 14. Honest status

| Item | Status |
|---|---|
| Route/page/API/schema/auth inventory | **AUDITED** — read from source |
| Working-tree gate status | **TESTED** — `pnpm check` PASS; `pnpm test` **63 files / 781 tests PASS**; `pnpm build` PASS. *(Was 1 failure; fixed by Batch 1 — see `LOGIN-REWRITE-RECORD.md`.)* |
| Runtime behaviour of any route | **NOT VERIFIED** — no browser used in this audit |
| Production behaviour | **NOT VERIFIED** — no production access, by policy |
| Any feature "implemented" by this audit | **NONE** — read-only |
| Next step | **WAITING FOR APPROVAL** |