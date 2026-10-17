# FEATURE-INVENTORY.md

Puntakit capability audit · 2026-10-15 · branch `redesign/full-app-claude-20261015` @ `1eddddb`
Read-only. No source file was edited to produce this.

**Evidence classes used throughout:**
- **[V]** verified in a real browser during this session (local PGlite, real PIN sign-in)
- **[S]** verified in source code
- **[D]** documented in the repo's own audit docs — I did **not** re-run these
- **[U]** unknown / not verified

---

## 0. Source of the numbers

| Claim type | Where it came from |
|---|---|
| Route list, role gates | `client/src/App.tsx`, `shared/roles.ts` **[S]** |
| 63 files / 781 tests | `pnpm test`, run this session **[V]** |
| BLOCKER fixes | Browser-verified this session **[V]** |
| 36-path admin sweep, 0 failures | `docs/UI_ROUTE_TRACKER.md` **[D]** — not re-run by me |
| Token contrast ratios | Computed from hex values with a luminance script **[V]** |

---

## 1. Routes — 37 `<Route path=>`, VERIFIED **[S]**

### Member PWA — `MemberAppLayout`, `.lamb-theme` scope
| Route | Page | Gate |
|---|---|---|
| `/app` | MemberHome | any signed-in |
| `/app/events` | MemberEvents | any signed-in |
| `/app/group` | MemberGroup | any signed-in |
| `/app/reports` | MemberReports | any signed-in |
| `/app/attendance` | MemberAttendance | any signed-in |
| `/app/profile` | MemberProfile | any signed-in |

Bottom nav: 5 real `wouter` links, `min-h-14` (≥56px), `pb-[env(safe-area-inset-bottom)]`.
**There is no `/app/menu` route** — no member "everything" page exists.

### Admin shell — `AppLayout` + `Sidebar` / `MobileBottomNav`
`/` · `/feed` · `/memberships` · `/follow-up` · `/inbox` · `/care` · `/import` · `/org` ·
`/admin/users` · `/admin/pins` · `/import/org` · `/import/duplicates` · `/import/merge-approvals` ·
`/members` · `/groups` · `/map` · `/attendance` · `/profile` · `/announcements` ·
`/events` (+`/worship` alias) · `/church` · `/ministries` · `/reports` · `/media` · `/settings`

### Public
`/login` · `/privacy` · `/terms` · `/404`

---

## 2. Classification

| # | Feature | Route | Class | Evidence |
|---|---|---|---|---|
| 1 | PIN sign-in, first-party, keypad UI | `/login` | **A** | [V] signed in twice this session |
| 2 | Member home + quick actions | `/app` | **A** | [V] rendered, member shell only |
| 3 | Member mission report **create** | `/app/reports` | **A** | [V] POST 201 → toast → list refresh |
| 4 | Member report list | `/app/reports` | **A** (was C) | [V] fixed a bug where it rendered permanently empty |
| 5 | Member events | `/app/events` | **A** | [D] |
| 6 | Member group view | `/app/group` | **B** | [V] card meta contrast weak on new surface |
| 7 | Member profile | `/app/profile` | **C** | [V] contrast failures on action rows |
| 8 | Role-gated admin routes | 24 routes | **A** (was C) | [V] BLOCKER 1 fixed + contract test |
| 9 | Care check-in (`/care`) | `/care` | **A** (was C) | [V] viewer denial verified |
| 10 | Attendance | `/attendance` | **A** | [D] |
| 11 | Follow-up | `/follow-up` | **A** | [D] interaction tested in repo docs |
| 12 | Group management | `/groups` | **A** | [D] |
| 13 | Member directory | `/members` | **A** | [V] rendered |
| 14 | Import (3 routes) | `/import*` | **C** | [D] upload happy path never exercised |
| 15 | Merge approvals | `/import/merge-approvals` | **A** (was C) | [V] gate fixed |
| 16 | Admin user management | `/admin/users` | **A** (was C) | [V] gate fixed |
| 17 | Map | `/map` | **C** | [D] only load tested, no real coordinates |
| 18 | Reports + CSV | `/reports` | **A** | [D] |
| 19 | Announcements / Events / Church / Ministries | 4 routes | **A** | [D] interaction tested |
| 20 | Inbox | `/inbox` | **C** | [U] |
| 21 | Membership lifecycle | `/memberships` | **A** | [D] |
| 22 | Org chart | `/org` | **C** | [U] |
| 23 | Feed / activities | `/feed` | **A** | [D] |
| 24 | Coming-soon placeholders | `/media`, `/settings` | **D** deliberate |
| 25 | Legal | `/privacy`, `/terms` | **A** | [D] |
| 26 | Dark mode | global | **A** | [V] confirmed via `localStorage.theme`, 588 samples |
| 27 | CSV export | `/reports` | **A** | [D] |
| 28 | Notifications | `/inbox`, member bell | **C** | [U] never exercised |
| 29 | Search | `/`, groups, members | **A** | [S] `GlobalSearch.tsx`, `homeLinks.ts` |
| 30 | "Everything" / member menu page | — | **D** | does not exist |
| 31 | Participation count on cards | — | **E** | `maxMembers` + `memberCount` exist in schema **[S]**, but member endpoints' payloads **[U]** |
| 32 | Warm Ivory palette | — | **D** | spec exists, never adopted |
| 33 | ELO / rewards / coach directory / court booking | — | **F** | badminton-only, explicitly out of scope |
| 34 | Clay surfaces beyond `/care` | — | **D** | attempted, reverted this session |

Class key: **A** working · **B** needs UI work · **C** incomplete/unverified · **D** needs a product spec · **E** blocked by data/backend · **F** not applicable.

---

## 3. Authorization boundaries — VERIFIED **[S]**

Roles: `super_admin · admin · ministry_leader · staff · group_leader · viewer · member`

`shared/roles.ts` is the single source; both server and client import it. `requireRole()` always admits `super_admin`. `requireAdmin = requireRole(...ADMIN_ROLES)`.

**Fixed this session and now contract-tested:**
- `SUBMISSION_CREATE_ROLES = [...CREATE_ROLES, "member"]` — a *separate* set, because `CREATE_ROLES` also gates `care.ts`, the activities create, three attendance writes, the follow-up create and the media upload. A tripwire test asserts `CREATE_ROLES` never gains `member`.
- A test asserts no admin-shell route is mounted through a bare `<ProtectedRoute>`.

## 4. Auth boundaries — VERIFIED **[S]**

`requireAuth` order: demo mode → legacy test cookie/JWT (`PUNTAKIT_TEST_AUTH=1`) → `loadSessionUser()`. First-party PIN, scrypt, `puntakit_session` + `puntakit_csrf`. No Clerk. No auth change was made.

---

## 5. Design system — current

79 `--color-*` tokens, light + dark. Locked by `design-tokens.test.ts`: `--color-primary`, `--color-primary-focus`, `--color-primary-on-dark`, `--color-ink`, `--color-canvas`, `--color-canvas-sunken`, `--color-dark-surface`, and `--shadow !== none`.

`.lamb-theme` is an **independent palette scope** on the member shell (`#0A767C` teal). It does not read the global tokens.

Type scale: `type-hero 56`, `type-display-lg 40`, `type-display-md 34`, `type-lead 28/1.35`, `type-body 17/1.47`, `type-caption`, `type-fine` (12px floor).
Font: **Prompt** (`index.css:123`). Sarabun is **not present**.

---

## 6. Open risk carried into this audit

`client/src/index.css` + `client/src/design-tokens.test.ts` currently hold an **uncommitted, un-browser-verified** token change (13 tokens → Minimal Premium). It alters `:root`, which every admin page reads. Gates pass (`design-tokens.test.ts` 10/10, `design-system-consistency` 4/4, `pnpm check` 0) but **no page has been looked at since**. This must be verified or reverted before any further UI work.
