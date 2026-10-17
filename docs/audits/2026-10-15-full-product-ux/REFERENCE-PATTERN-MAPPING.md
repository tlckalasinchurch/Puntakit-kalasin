# REFERENCE-PATTERN-MAPPING.md

**Status: AUDITED (read-only). No implementation performed.**

---

## 0. What the reference actually is — read this first

The `referend/` directory holds **4 artifacts of 2 different kinds**. Conflating them would mean auditing Puntakit against a proposal of Puntakit `[CODE]`.

| File | Kind |
|---|---|
| `0005c9ac-…jpg` | **Badminton reference app — Home screen** (the actual reference) |
| `b32f2143-…jpg` | **Badminton reference app — Discover screen** (the actual reference) |
| `1c7794f0-…png` | **A Puntakit redesign mockup** (6 Thai mobile screens) — *not* the reference |
| `Puntakit — Wireframe …md` | **A Puntakit wireframe proposal** (tracked in git) — *not* the reference |

**Only 2 reference screens exist.** Both are static images of one consumer app. Neither shows a second screen, a transition, or a completed task. Therefore:

> **No multi-step flow in the reference can be verified.** Every "flow" below is a *single-screen layout observation*. Claiming otherwise would be fabrication.

**Also: this is an adaptation, not a clone.** The reference is a court-booking consumer marketplace. Puntakit is a church ministry operating system with pastoral care, membership lifecycle and a four-eyes data-import pipeline. The reference is a **visual-technique donor, not an information-architecture donor.**

---

## 1. Observed reference patterns

### Screenshot A — Home
1. Greeting + subtitle; inbox icon with a numeric badge
2. A wide **hero banner** with a headline, a sub-line, and a large numeric counter tile
3. **Horizontal card carousel** ("Newly Opened Groups") — cards with image, tag pills, capacity `👤 1/25`, title, date, location, price
4. A single wide **"Featured" row**
5. A **"Coaches" list** with avatar, name, credential line, trust badges, price, contact icons, "See All"
6. **Bottom nav with a raised centre action button**

### Screenshot B — Discover
7. A dismissible **promo banner** with a "Details" CTA
8. **"What do you want to do?"** — 3 large primary action cards, one with a live count badge
9. **Grouped tool grids** under section headings ("Play & Compete", "Club tools", "Community & Rewards") — small icon tiles with **New / Hot / Brand new** badges
10. Same hero banner repeated, same bottom nav

### Dominant visual traits
Green primary, saturated gradient hero, emoji-heavy iconography, pill badges everywhere, 5-item bottom nav with centre FAB.

---

## 2. Pattern-by-pattern mapping

### P-01 · Home dashboard with a clear primary action

| | |
|---|---|
| **Observed** | Screenshot A: a greeting, then one hero banner carrying the single most important number ("33 groups/parties") |
| **Puntakit capability exists?** | **Yes.** `client/src/pages/Home.tsx` (1045 lines), `GET /api/dashboard/summary`, `GET /api/dashboard/operations` |
| **Components** | `Home.tsx`, `components/home/HomeMyWork.tsx`, `components/OrgSnapshot.tsx`, `components/DesignSystem.tsx` (`PageHeader`, `SectionHeader`, `StatusChip`, `EmptyState`) |
| **User problem it would solve** | Puntakit's home already uses per-section `{loading|error|success}` (`Home.tsx:146-213`) so a failed request never masquerades as zero — better than the reference. But it presents **many** sections of similar weight; the reference makes **one** number unmistakable. |
| **Data/API available?** | **Yes, entirely.** `dashboard/operations` already returns `pendingSubmissionsCount`, `openFollowUpsCount`, `overdueFollowUpsCount`. |
| **Auth/privacy risk** | **Real.** `GET /api/dashboard/summary` is church-wide for any authenticated role (observation A2). Promoting "one big number" to the top of the page increases exposure of church-wide counts to roles that should not see them. Any change must resolve the scope first. |
| **Needs a new spec?** | Promoting an existing metric to a hero slot = **UI change, no spec**. Adding a *new* aggregated metric = **needs spec + backend**. |
| **Classification** | **B** (existing, needs hierarchy work) |

### P-02 · Discoverable groups and event listings

| | |
|---|---|
| **Observed** | Screenshot A: "Newly Opened Groups" carousel; Screenshot B: "Find Groups" with a count badge |
| **Puntakit capability exists?** | **Yes.** `/groups` (`Groups.tsx`, 1291), `/events` (`Events.tsx`), `/map` (`Map.tsx`), and member-side `/app/group`, `/app/events` |
| **User problem** | `GET /api/groups` returns all live groups with **no pagination** `[CODE]`. `/groups` renders a `GroupCard` grid with a `FilterDisclosure` and debounced search, but there is no "newly opened" or "recommended" ordering. |
| **Data/API available?** | **Partially.** `groups` has `startDate`, `createdAt`, `isOpen`, `maxMembers`, `memberCount`, `category`, `status`. A "recently opened" ordering is derivable **client-side from data already returned** — **no schema change needed**. "Recommended" would need a scoring rule = **needs spec**. |
| **Auth/privacy risk** | **High.** A1: `GET /api/groups` serves any authenticated role including `member`, while `GET /api/groups/:id` does not. Broadening the list surfaces more groups to `member`. Must resolve A1 before this ships. |
| **Needs a new spec?** | "Recently opened" ordering = no. "Recommended"/"Featured" curation = **yes**. |
| **Classification** | **B** (ordering) / **D** (curation) |

### P-03 · Cards with dates, locations, participant info and statuses

| | |
|---|---|
| **Observed** | Cards carry date, location, capacity `1/25`, and tag pills simultaneously |
| **Puntakit capability exists?** | **Yes, and already close.** `GroupCard` shows name/category/area; `Event` cards show date/location; `Attendance` shows status; `MemberCard` shows membership status |
| **Components** | `components/groups/GroupCard.tsx`, `components/members/MemberCard.tsx`, `components/DesignSystem.tsx` (`StatusChip`) |
| **Real gap** | **Card density is inconsistent, not absent.** `StatusChip` tone maps are **duplicated per page**: `MembershipStatus` is copy-pasted in `Members.tsx:54` and `MemberDetailModal.tsx:32`; `GroupStatus` in `components/groups/types.ts:130` and `pages/Map.tsx`. `absent` is **`neutral`** in `MemberAttendance.tsx:139` but **`--color-error`** in `Attendance.tsx:151` — the same datum, opposite meaning. |
| **Data/API available?** | **Yes.** No new data needed. |
| **Auth/privacy risk** | Low — presentation only. **But** `components/members/MemberCard.tsx` is contractually barred from phone/email/address (`membership-ui.test.ts`). A "richer card" must not breach that. |
| **Needs a new spec?** | No — consolidation + consistency is pure UI. |
| **Classification** | **B** |

### P-04 · Persistent communities/clubs vs individual sessions

| | |
|---|---|
| **Observed** | The reference separates a persistent "Club" from dated one-off "Groups/Parties" |
| **Puntakit equivalent — already present and stronger** | `groups.orgLevel` = `body \| care \| null` with `parentGroupId` self-FK; `events` with `eventDate`; `attendance_records.serviceType` = `sunday_service \| care_group \| prayer_meeting \| youth_service \| special_event` `[CODE]` |
| **Surfaced by** | `/org` (`OrgChart.tsx`) renders the body→care-group hierarchy; `GET /api/org/overview` returns `head`, `totals`, `bodies[]`, `unassignedCareGroups` |
| **User problem it would solve** | **None outstanding.** The two-level concept is fully modelled and already has a UI. The real problem is **discoverability**: `/org` is `PRIVILEGED_ROLES`-only, so `group_leader` cannot see the hierarchy they sit inside. |
| **Data/API available?** | **Yes** — `GET /api/org/overview` exists but is gated `PRIVILEGED_ROLES`. |
| **Auth/privacy risk** | **High.** Widening `/org` or `/api/org/overview` to `group_leader` is an **authorization change** requiring explicit approval + tests. |
| **Needs a new spec?** | Widening access = **yes, explicitly**. |
| **Classification** | **A** (modelling) / **D** (access) |

### P-05 · Member profiles and activity history

| | |
|---|---|
| **Observed** | A "Profile" tab with avatar, name, role, and personal stats |
| **Puntakit capability exists?** | **Yes.** `/app/profile` (577 lines) + `GET/PUT /api/me/profile`; `/app/attendance` (`GET /api/me/attendance`) |
| **Real gaps** | 1. `GET /api/me/attendance` has a **hard `.limit(50)`** with no pagination `[CODE]` — history silently truncates. 2. `PUT /api/me/profile` **excludes** `role` and `membershipStatus`, so a member **cannot see their own pastoral-care status**, which is exactly the information a reference-style profile would surface. |
| **Data/API available?** | History: **yes**, but needs pagination. Care status: **the data exists** (`members.status` = `"ติดตามแล้ว"` / `"ต้องติดตาม"`, `membership_terms`) but is **not exposed on any `/api/me/*` route**. |
| **Auth/privacy risk** | **High.** Exposing `members.status` to a member reveals a pastoral judgement *about them*. This is a **sensitive domain decision, not a UI decision.** It must never be silently inferred. |
| **Needs a new spec?** | **YES — mandatory** for anything touching care status. Pagination on `/api/me/attendance` = no spec needed (it already returns only the caller's own rows). |
| **Classification** | **C** (truncation) / **D** (care-status visibility) |

### P-06 · Administrative tools and grouped utilities

| | |
|---|---|
| **Observed** | Screenshot B: grids of tool tiles grouped under headings, with New/Hot badges |
| **Puntakit capability exists?** | **Yes — already implemented, differently.** `Sidebar.tsx` has **6 nav groups / 21 items** (หลัก · งานดูแล · สื่อสารและกิจกรรม · คริสตจักร · ผู้ดูแลระบบ · บัญชีของฉัน), plus a focused 6-item set for `group_leader`. Items visible per role: super_admin 21, admin 19, staff 18, ministry_leader 17, viewer 12, group_leader 6 (corrected 2026-10-16 from "17 items"; `[RUN]` in a browser for admin and group_leader, derived from `shared/roles.ts` for the rest) |
| **Components** | `components/layout/Sidebar.tsx:74-185`, `MobileBottomNav.tsx:27-38` |
| **User problem** | On **mobile** (`<lg`) the sidebar is a hidden drawer reached via a hamburger / trailing "เมนู" button. Up to 21 destinations (staff: 18) behind a drawer is a real discoverability cost, especially for `staff` who only need a handful. The cost is having to open the drawer and scroll a single-column list — not a duplicated menu: the drawer and the desktop Sidebar share one `navGroups` array. **Status:** Pilot G-10 changed `Sidebar.tsx` only, below `lg`, to a two-column tile grid (commit `2265a89`). Not yet checked: keyboard/focus order in the mobile drawer and a component render test. |
| **Data/API available?** | **Yes** — this is pure information architecture. |
| **Auth/privacy risk** | **Must preserve exactly.** `nav-structure-contract.test.ts` and `role-gate-contract.test.ts` pin every Thai label and role set. A tile grid must render from the **same** `navGroups` data, never a second hand-maintained list. |
| **Needs a new spec?** | Re-presenting existing entries = no. **Adding** a "Tools" hub page = yes. |
| **Classification** | **B** |

### P-07 · Summary statistics and analytics

| | |
|---|---|
| **Observed** | The reference shows exactly one number (33). It shows **no** analytics. |
| **Puntakit capability exists?** | **Substantially more.** `GET /api/reports/summary` (members/groups/attendance/events by status, attendance rate, date range); `GET /api/dashboard/operations`; `GET /api/attendance/summary` (incl. `recentTrends(6)`); `/reports` with 4 CSV exports |
| **Real gaps** | `--chart-1..6` are declared in `index.css:104-109` and **never referenced anywhere** `[CODE]`. `components/ui/chart.tsx` (recharts) is **never imported**. There is **no charting on any page** — analytics are text/number only. |
| **Data/API available?** | **Data: yes.** `reports/summary` already returns per-status breakdowns and `attendanceRate`. |
| **Auth/privacy risk** | **High.** `/reports` is `PRIVILEGED_ROLES`; `/api/attendance/summary` likewise. A chart on a page reachable by `group_leader` could leak church-wide aggregates. Any chart must stay behind the existing gate. |
| **Needs a new spec?** | Rendering **already-fetched** numbers visually = no spec. Any **new** metric = spec + backend. **Adding a charting dependency needs approval** (`recharts` is present but unused; no new installs without approval). |
| **Classification** | **B** (presentation) / **D** (new metrics) |

### P-08 · Notifications and status feedback

| | |
|---|---|
| **Observed** | An inbox icon with a numeric badge |
| **Puntakit capability exists?** | **Partially, and asymmetrically.** Admin: `Topbar.tsx` bell → `/inbox`, polls `GET /api/submissions?status=new&limit=50` every 60 s, caps at `9+`, **swallows errors so it never shows a fake count** `[CODE]`. Members: `push_subscriptions` + `subscribe` exist, but **no inbox and no badge at all**. |
| **Real gaps** | 1. **Members have no notification surface** — only a push-subscribe toggle. 2. `POST /api/me/push/send-test` **returns a hardcoded payload and sends nothing** `[CODE]`. 3. No notification read-state, no delivery log. 4. **CSV export gives no toast** (recorded as known-and-left-alone in `docs/UI_ROUTE_TRACKER.md`). |
| **Data/API available?** | Read-state = **no** (would need a schema change → prohibited without approval). Delivery log = **no**. Member inbox = **no**. |
| **Auth/privacy risk** | **High.** `Topbar` gates the bell on `canReviewSubmissions`. Any member-facing inbox must respect `SUBMISSION_CREATE_ROLES` scoping — a member must only ever see **their own** rows (the server already enforces this: non-reviewers see own only `[CODE]`). |
| **Needs a new spec?** | **YES** — any persisted read-state or new inbox is a spec + schema decision. |
| **Classification** | **C** / **E** |

### P-09 · Search, filters and categorized listings

| | |
|---|---|
| **Observed** | A search field + filter chips |
| **Puntakit capability exists?** | **Yes, and this is a strength.** `GlobalSearch` (Cmd/Ctrl+K, hidden below `sm`; `/` renders a prominent variant for small screens); `Members`/`Groups` use 300 ms debounce + request-sequence guards; `FilterDisclosure` collapses filters below `sm`; `Members` keeps `q/area/status/membershipStatus/page/member` in the URL; `Feed`/`Inbox`/`FollowUps` use `ListPager` |
| **Real gap** | **Inconsistency, not absence.** `Members.tsx:880-907` hand-rolls its own pager while three other pages use the shared `ListPager`. `Map.tsx` has a **third** copy of the `GroupStatus` tone map. |
| **Data/API available?** | **Yes**, all of it. |
| **Auth/privacy risk** | `check-duplicate` and `export/csv` are role-gated; keep them so. |
| **Needs a new spec?** | No — consolidation only. |
| **Classification** | **B** |

### P-10 · Mobile navigation and responsive layout

| | |
|---|---|
| **Observed** | 5-item bottom nav with a **raised centre FAB** |
| **Puntakit capability exists?** | **Yes.** Two separate bottom bars: admin `MobileBottomNav` (`lg:hidden`, role-dependent) and member `MemberAppLayout` (always visible, 5 items). Off-canvas sidebar below `lg`. Safe-area insets handled in **all four** places. `Toaster` `mobileOffset` clears the bar. |
| **Real gaps** | 1. **Active-state logic differs across three navigations** — exact (`MobileBottomNav:49`), exact + 2 special cases (`Sidebar:305-308`), prefix (`MemberAppLayout:130-132`). `/import/duplicates` therefore highlights **nothing** in the bottom bar. 2. **There is a three-way conflict about what the member nav should be** — see §3. |
| **Data/API available?** | N/A — pure UI. |
| **Auth/privacy risk** | Low, **but** `MobileBottomNav` already branches on role — any change must keep `group_leader` seeing only its 3 items, pinned by `nav-structure-contract.test.ts`. |
| **Needs a new spec?** | Fixing active-state logic = no. **Changing the member nav's composition = YES (product decision).** |
| **Classification** | **B** |

---

## 3. The bottom-nav conflict — a product decision, not a UI decision

Three different member bottom navigations are documented/built simultaneously `[CODE]`:

| Source | Items |
|---|---|
| **Code today** (`MemberAppLayout.tsx:37-43`) | หน้าแรก `/app` · รายงาน `/app/reports` · กลุ่ม `/app/group` · กิจกรรม `/app/events` · ฉัน `/app/profile` — **5** |
| **Mockup PNG** (`1c7794f0-…png`) | หน้าแรก · กิจกรรม · **แผนที่** · กลุ่ม · โปรไฟล์ — **5** |
| **Wireframe `.md`** (§3) | วันนี้ · พันธกิจ · คน · เมนู — **4** |

Three problems compound this:
1. The wireframe adds a **map tab**, but `/map` is `ADMIN_SHELL_ROLES` — a `member` tapping it would be **denied**. The mockup is internally inconsistent with the current role model.
2. The wireframe's design is built around a **`/app/menu` route that does not exist** `[CODE]`.
3. `member-events-rsvp.test.ts` pins member PWA behaviour; `premium-shell-contract.test.ts` forbids `pk-*` in any member file.

> **Recommendation: do not implement any bottom-nav change until the owner names the target.** This cannot be resolved by a designer or by an agent.

---

## 4. What must NOT be carried over

| Reference concept | Why it does not belong |
|---|---|
| ELO / skill rating | No competitive ranking exists or is appropriate |
| Court booking, court fees, ฿ prices | Puntakit is not a venue marketplace; **no pricing data exists** |
| Coach marketplace, credentials, contact icons | No coach entity in 24 tables |
| Match/team randomizer, scoreboard | No match model; **fabricating statistics is prohibited** |
| Achievements, redeem rewards, points, leaderboards | Gamification of pastoral care is a product judgement, not a UI one |
| Level quiz | No quiz data |
| "Hot / New / Featured / Brand new" badges | Decorative badges with **no backing metric** would be fabricated data |
| Emoji-heavy iconography | Conflicts with the brand (`brand-spec.md`) and the icon-size scale in `lib/icon-sizes.ts` |
| Saturated gradient hero banners | Explicitly against `design.md` ("no meaningless gradients") |

---

## 5. Mapping summary

| Pattern | Exists? | Class | Needs spec? |
|---|---|---|---|
| P-01 Home primary action | Yes | B | No (existing metric) |
| P-02 Group/event discovery | Yes | B / D | No (recent) / Yes (curated) |
| P-03 Rich cards + statuses | Yes, inconsistent | B | No |
| P-04 Persistent vs one-off | Yes (stronger) | A / D | Yes (access) |
| P-05 Profile + history | Partial | C / D | Yes (care status) |
| P-06 Grouped admin tools | Yes (sidebar) | B | No |
| P-07 Statistics | Data yes, no charts | B / D | No (render) / Yes (new metric) |
| P-08 Notifications | Admin only | C / E | **Yes** |
| P-09 Search & filters | Yes (strong) | B | No |
| P-10 Mobile navigation | Yes | B | Yes (composition) |

**Net:** of 10 patterns, **7 are presentation work on existing capability**, **3 require a product specification** (curation, care-status visibility, notification state), and the member bottom-nav composition is blocked on an owner decision.