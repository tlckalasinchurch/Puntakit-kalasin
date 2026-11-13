# 02 — Route, navigation, authorisation and API inventory

**Denominators:** 35 client routes · 11 navigation surfaces · 15 canonical role sets · 119 API endpoints (116 router + 3 app-level) · 96 test files · 34 page components.

Router: `client/src/App.tsx:77-271`. Flat `<Switch>` — **no nested routes and no path parameters anywhere**. 33 pages are `React.lazy`; `NotFound` is the only eager page import (deliberate, so the route fallback never suspends).

---

## 1. Route table

### Auth & public
| Path | Component | Guard | Note |
|---|---|---|---|
| `/login` | `PinSignInPage` | — | redirects signed-in users; full reload on success |
| `/privacy`, `/terms` | static | — | no layout, **no skip link** |

### Member PWA `/app/*` — `MemberAppLayout`, `ProtectedRoute` with **no `allow`**
| Path | Component |
|---|---|
| `/app` | `MemberHome` |
| `/app/events` | `MemberEvents` |
| `/app/group` | `MemberGroup` |
| `/app/reports` | `MemberReports` |
| `/app/attendance` | `MemberAttendance` — 🔴 **orphan, see F-02** |
| `/app/profile` | `MemberProfile` |

API: `portalRouter` at `/api/me`, gated `requireAuth` + `getLinkedMember` per-user scoping (`server/routes/portal.ts:29,32-68`).

### Admin shell
| Path | Component | `allow` set |
|---|---|---|
| `/` | `Home` | `ADMIN_SHELL_ROLES` |
| `/feed` | `Feed` | `ADMIN_SHELL_ROLES` |
| `/memberships` | `Memberships` | `MEMBERSHIP_VIEW_ROLES` |
| `/follow-up` | `FollowUps` | `ADMIN_SHELL_ROLES` |
| `/inbox` | `Inbox` | `CREATE_ROLES` |
| `/import` | `ImportData` | `ADMIN_ROLES` |
| `/care` | `CareToday` | `CREATE_ROLES` |
| `/org` | `OrgChart` | `PRIVILEGED_ROLES` |
| `/admin/users` | `AdminUsers` | `SUPER_ADMIN_ROLES` — **NOT VERIFIED** |
| `/admin/pins` | `PinManagement` | `SUPER_ADMIN_ROLES` — **NOT VERIFIED** |
| `/import/org` | `ImportOrgData` | `SUPER_ADMIN_ROLES` — **NOT VERIFIED** |
| `/import/duplicates` | `ImportDuplicates` | `ADMIN_ROLES` |
| `/import/merge-approvals` | `ImportMergeApprovals` | `ADMIN_ROLES` |
| `/members` | `Members` | `ADMIN_SHELL_ROLES` |
| `/groups` | `Groups` | `ADMIN_SHELL_ROLES` |
| `/map` | `MapPage` | `ADMIN_SHELL_ROLES` |
| `/attendance` | `Attendance` | `ADMIN_SHELL_ROLES` |
| `/profile` | `Profile` | `ADMIN_SHELL_ROLES` |
| `/announcements` | `Announcements` | `ADMIN_SHELL_ROLES` |
| `/events`, `/worship` | `Events` (one lazy chunk) | `ADMIN_SHELL_ROLES` |
| `/church` | `Church` | `ADMIN_SHELL_ROLES` |
| `/ministries` | `Ministries` | `ADMIN_SHELL_ROLES` |
| `/reports` | `Reports` | `PRIVILEGED_ROLES` |
| `/media`, `/settings` | `ComingSoon` stub | `ADMIN_SHELL_ROLES` |

Redirects: `/mission-feed → /feed` only. `/404` plus a catch-all both render `NotFound`.

---

## 2. 🔴 Structural finding — layout nested inside itself

`ProtectedRoute` wraps children in a shell (`ProtectedRoute.tsx:126-128`) **and** 30 page components render their own shell inside it — 24 import `AppLayout`, 6 import `MemberAppLayout`. Every guarded page therefore appears to render the sidebar/topbar/bottom-nav twice with duplicate `#app-main` / `#member-app-main` ids. `RouteErrorBoundary` also nests (`ProtectedRoute.tsx:130` → `AppLayout.tsx:71`).

**Needs browser confirmation** — it is equally likely that the page-level shell is dead code. Logged as Likely, not Observed.

---

## 3. Navigation surfaces

| # | Surface | File |
|---|---|---|
| 1 | Desktop sidebar `navGroups` (15 items, 6 groups) | `layout/Sidebar.tsx:74-138` |
| 2 | `groupLeaderNavGroups` (7 items) | `layout/Sidebar.tsx:149-169` |
| 3 | Admin mobile bottom nav + "เมนู" drawer trigger | `layout/MobileBottomNav.tsx:30-42` |
| 4 | Member bottom nav `NAV_ITEMS` (5 items) | `layout/MemberAppLayout.tsx:37-43` |
| 5 | Page-view tabs `PAGE_VIEW_GROUPS` (4 groups, 10 tabs) | `lib/pageViews.ts:23-54` |
| 6 | Topbar: hamburger, global search, theme toggle, inbox bell, avatar | `layout/Topbar.tsx` |
| 7 | Home quick tiles + "ดูทั้งหมด" | `lib/homeTiles.ts:14-86` |
| 8-9 | Member home Lamb cards / quick actions | `components/lamb/*` |
| 10 | Import wizard stepper | `components/ImportStepper.tsx:18-22` |
| 11 | Legal footer links | `components/LegalLinks.tsx` |
| 12 | **Breadcrumbs** | **NOT FOUND** — `ui/breadcrumb.tsx` exists with zero importers |

**Cross-check result: every nav path resolves to a real route. Zero orphan nav links.** The failures run the other way — routes with no nav entry (see F-02, and `/import/*` sub-pages which are reached only via the stepper).

### Active-route matching is inconsistent by surface
| Surface | Logic |
|---|---|
| Sidebar | exact + 2 special cases + group-head (`Sidebar.tsx:310-314`) |
| Admin bottom nav | **exact only** (`MobileBottomNav.tsx:50`) — no item is ever active on a sub-path |
| Member bottom nav | exact + **prefix for nested** (`MemberAppLayout.tsx:162-164`) — **dead code**, no nested routes exist |
| Page-view tabs | exact (`PageViewTabs.tsx:23`) |

### Role-visibility mismatches (menu stricter than the route, which is safe)
| Item | Menu gate | Route gate |
|---|---|---|
| แอปสมาชิก `/app` | `ADMIN_ROLES` | any signed-in |
| Topbar inbox bell | inline literal duplicating `PRIVILEGED_ROLES` (`Topbar.tsx:68`) | `CREATE_ROLES` |
| Member header → `/` | inline 5-role literal (`MemberAppLayout.tsx:65-70`) | `ADMIN_SHELL_ROLES` |

Two role literals bypass `shared/roles.ts` — the only such instances in the codebase.

### Skip links
Present on both shells (`AppLayout.tsx:44-49` → `#app-main`; `MemberAppLayout.tsx:99-104` → `#member-app-main`). **Absent** on `/login`, `/privacy`, `/terms`, `/404` — no layout, so nothing to skip past.

---

## 4. 🔴 Authorisation map — client-side-only read protection

`ProtectedRoute` is entirely client-side (`ProtectedRoute.tsx:28`). The question per route is whether the **server** independently gates the same data. For these ten, writes are server-gated but the **read is `requireAuth` only**:

| Route | Client gate | Server gate on its read |
|---|---|---|
| `/groups` | `ADMIN_SHELL_ROLES` | `GET /api/groups` — **no role middleware** (`groups.ts:197`) |
| `/map` | `ADMIN_SHELL_ROLES` | same endpoint (`Map.tsx:287`) |
| `/inbox` | `CREATE_ROLES` | `GET /api/submissions` — `requireAuth` only (`submissions.ts:24`) |
| `/announcements` | `ADMIN_SHELL_ROLES` | `requireAuth` only (`announcements.ts:11`) |
| `/events`, `/worship` | `ADMIN_SHELL_ROLES` | `requireAuth` only (`events.ts:11`) |
| `/ministries` | `ADMIN_SHELL_ROLES` | `requireAuth` only (`ministries.ts:11`) |
| `/church` | `ADMIN_SHELL_ROLES` | `requireAuth` only (`churchProfile.ts:13`) |
| `/feed` | `ADMIN_SHELL_ROLES` | `requireAuth` only (`activities.ts:28`) |
| `/follow-up` | `ADMIN_SHELL_ROLES` | row-scope exists; role gate client-only (`followUps.ts:28`) |
| `/media`, `/settings` | — | n/a, stubs |

**13 routes have genuine dual enforcement:** `/`, `/memberships`, `/care`, `/org`, `/members`, `/attendance`, `/reports`, `/import`, `/import/duplicates`, `/import/merge-approvals`, `/import/org`, `/admin/users`, `/admin/pins`.

The project is aware of the principle — `nav-structure-contract.test.ts:9-10` states "hiding an entry never protects a route" and `ProtectedRoute.tsx:18-22` says "the server stays the real enforcement". **Whether the read exposure is acceptable is a product decision, not a code defect.** Group locations are masked for non-privileged roles (`groups.ts:117-146`).

Other auth facts: `super_admin` bypasses every `requireRole` unconditionally (`middleware/auth.ts:60`); `adminUsers.ts:21-24` hand-rolls its gate specifically so `admin` does **not** pass; `requireImportWriter` is deliberately ≠ `requireAdmin`; CSRF protection is app-wide; `hasRole()` denies `undefined`.

---

## 5. API surface

119 endpoints. Full per-endpoint tables were produced and are summarised by router here:

| Router | Path | Blanket guard |
|---|---|---|
| auth | `/api/auth` | none (public login) |
| dashboard | `/api/dashboard` | `requireAuth` |
| reports | `/api/reports` | `+ PRIVILEGED_ROLES` |
| members | `/api/members` | `+ ADMIN_SHELL_ROLES` |
| memberships | `/api/memberships` | `+ MEMBERSHIP_VIEW_ROLES` |
| groups | `/api/groups` | `requireAuth` **only** |
| activities | `/api/activities` | `requireAuth` **only** |
| follow-ups | `/api/follow-ups` | `requireAuth` + row scope |
| submissions | `/api/submissions` | `requireAuth` **only** |
| attendance | `/api/attendance` | `+ ADMIN_SHELL_ROLES` |
| import | `/api/import` | `requireAuth` + per-route reader/writer |
| org, org-data, care | `/api/org`, `/api/org-data`, `/api/care` | `+ PRIVILEGED_ROLES` / `+ SUPER_ADMIN` / `+ CREATE_ROLES` |
| announcements, events, ministries, church-profile | | `requireAuth` **only** (writes `requireAdmin`) |
| admin/users | `/api/admin/users` | hand-rolled `super_admin` |
| me | `/api/me` | `requireAuth` + `getLinkedMember` |

**Client↔server cross-check: every one of ~70 distinct client paths resolves to a real route. Zero orphans, zero 404s in normal flow.**

**11 server endpoints are never called by the client:** `POST /api/members/:id/restore`, `DELETE /api/attendance/:id`, `GET|PUT /api/follow-ups/:id`, `GET /api/submissions/:id`, `POST /api/import/rules/:id/confirm`, `GET /api/me/prayer-requests/my`, and the `GET /api/{announcements,events,ministries}/:id` singles.

---

## 6. Test coverage map

**96 test files** — client 45, server 47, shared 4.

### 🔴 The structural finding
**No test in this repo ever renders a React component.** `vitest.config.ts:6` is `environment: "node"`; zero matches for `@testing-library`, `render(`, `createRoot`, `jsdom` or `happy-dom` anywhere in `client/**`. `@/` is not even aliased, so client tests cannot import a page module.

All 45 client tests read source files as text. ~13 import real helper modules (`lib/date`, `lib/initials`, `lib/cluster`…) — never a page.

**Consequence: a test can pass on a page that throws on first render.** The suite pins source *shape*, not *behaviour*.

### Page coverage
| Tier | Pages | Count |
|---|---|---|
| **1 — no client test names the file at all** | `AdminUsers`, `PinManagement` | 2 |
| **2 — no client test AND no server test behind it** | `Church`, `PinSignInPage`, `Announcements`, `Events`, `Ministries` | 5 |
| 3 — named only for a role-gate or copy assertion | `OrgChart`, `Reports`, `Memberships`, `Inbox`, `ImportMergeApprovals` | 5 |

**Five server modules ship zero tests:** `auth.ts` (login/CSRF/logout route handlers), `announcements.ts`, `events.ts`, `ministries.ts`, `churchProfile.ts`.

### What the suite genuinely guards well
`design-tokens.test.ts` (reads the real CSS, asserts 11 invariants incl. doc sync), `palette-contrast.test.ts` (computes live contrast from actual token values in both themes), `ux-audit-regressions.test.ts` (27 KB, 10 regression batches), plus `design-system-consistency`, `viewport-and-install`, `member-pwa-contract`, `role-gate-contract`, `nav-structure-contract`. These are legitimate; they simply do not cover rendering.
