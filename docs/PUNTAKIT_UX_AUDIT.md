# Puntakit UX / Product Audit

Date: 2026-09-24
Baseline commit: `b77341f` (main, PR #4 merged)

## Purpose

This audit records the actual state of the repository before any Ministry
Operating System (OS) work starts. It separates fact from assumption. Every
claim below is checked against the code, not against `CLAUDE.md`.

## 1. `CLAUDE.md` is out of date

`CLAUDE.md` says the server is "a minimal Express static host" with "no
routes, database, or business logic" and that all data is mock data inline
in page components. This is false for the current repository.

The real state:

- `server/db/` has a Drizzle client, a pglite bootstrap for local dev, and
  a config module with explicit driver selection.
- `server/routes/` has 9 route modules: `auth`, `members`, `groups`,
  `attendance`, `events`, `announcements`, `ministries`, `churchProfile`,
  `dashboard`, plus `portal` (member-facing).
- `shared/schema.ts` defines 12 real tables with foreign keys and indexes:
  `users`, `userSessions`, `auditLogs`, `members`, `announcements`,
  `events`, `ministries`, `churchProfile`, `groups`, `groupMembers`,
  `attendanceRecords`, `eventRegistrations`, `prayerRequests`,
  `pushSubscriptions`.
- Route modules `attendance.test.ts`, `groups.test.ts`, `members.test.ts`,
  `portal.test.ts` exist and run under `vitest run --passWithNoTests`.
- `package.json` has `db:generate`, `db:push`, `db:migrate`,
  `db:seed-admin` scripts. Migrations live under `server/db/migrations`.

**Action taken as part of this audit:** `CLAUDE.md` will be corrected in a
follow-up commit so it stops telling future sessions (Claude or human) that
the backend does not exist. This is a documentation fix, not a product
change, and is safe to do immediately.

## 2. Existing domain model (from `shared/schema.ts`)

| Table | Role today |
|---|---|
| `users` | Login identity + role (`super_admin`…`viewer`) + session. Real RBAC, 7 roles. |
| `members` | The person record. Has `assignedLeaderId`, `area`, `group` (free-text, not FK), `membershipStatus`, consent fields, soft delete (`deletedAt`). |
| `groups` | Cell/ministry groups. Has leader/co-leader, category, privacy, geo (`latitude`/`longitude` as text), meeting schedule, soft delete. |
| `groupMembers` | Join table, `member ↔ group`, with role and status. |
| `attendanceRecords` | Per-member, per-date, linked to `groupId` and/or `eventId`, with check-in method (manual/QR/self-QR/kiosk). |
| `events` | Church-wide events/services, category, status. |
| `eventRegistrations` | RSVP join table, `event ↔ user/member`. |
| `ministries` | Flat list: name, description, leader (free text), status. Not linked to groups or people beyond a text field. |
| `announcements` | Draft/published content, author. |
| `prayerRequests` | Has `isConfidential` flag — the one place privacy is already modeled explicitly. |
| `auditLogs` | Generic `entityType`/`entityId`/`action` log, already action-agnostic — this is the natural home for OS-wide audit trail. |
| `pushSubscriptions` | Web push registration. |
| `churchProfile` | Single-row org profile. |

**Audit finding:** there is no activity/event-log table that represents
"something happened" independent of attendance or announcements. Nothing
in the schema plays the role of `MissionActivity` from the OS brief.
`auditLogs` is close in shape (append-only, entity-typed) but it is a
system audit trail, not ministry content — reusing it for ministry
activity would leak system events into the Feed and vice versa. They
should stay separate.

**Audit finding:** `members.group` is a free-text field, separate from
`groupMembers`. This is a duplication risk already present in the schema,
not something the OS work introduces.

**Audit finding:** `ministries` has no foreign key to `groups` or
`members`. The relationship between Church → Ministry → Group → Member
that the OS brief asks about does not exist yet in data; it is currently
implied only by page layout.

## 3. Navigation / IA today

From `client/src/components/layout/Sidebar.tsx`, current desktop nav
(Thai labels, translated):

```
หน้าหลัก        Home            /
แอพสมาชิก (PWA)  Member app      /app         (badge: PWA)
สมาชิก          Members         /members
กลุ่มแคร์        Care groups     /groups
เช็คชื่อ/เข้าร่วม  Attendance      /attendance
การนมัสการ      Worship         /events
การประกาศ       Announcements   /announcements
คริสตจักร       Church          /church
พันธกิจ         Ministries      /ministries
รายงาน          Reports         /reports        (ComingSoon stub)
สื่อ/เอกสาร      Media           /media          (ComingSoon stub)
โปรไฟล์         Profile         /profile
ตั้งค่า          Settings        /settings       (ComingSoon stub)
```

There is a second, parallel route tree at `/app/*` for a member-facing PWA
(`MemberHome`, `MemberEvents`, `MemberGroup`, `MemberAttendance`,
`MemberProfile`), separate layout from the admin dashboard.

**Audit finding:** the app is already two navigation surfaces (admin
dashboard + member PWA) reading the same tables through different route
modules (`server/routes/*.ts` vs `server/routes/portal.ts`). Any OS
navigation model has to account for both, not just the desktop admin
sidebar the reference brief assumes.

**Audit finding:** `/reports`, `/media`, `/settings` are `ComingSoon`
placeholders already reserved in routing — they are natural landing spots
for `Reports` and `Administration` OS surfaces, no new route needed to
start.

## 4. Design system

`design.md` and `brand-spec.md` already exist and were the basis of PR #4
(commit `16b7b2c`), which added `LoadingStates.tsx` (skeletons for table,
card, list, form, KPI) and rewrote large parts of `index.css`. The current
palette is navy/blue (`--navy`, `--blue`, `--ink`, `--chart-1..6`), not the
warm burnt-orange/vanilla palette requested for the OS. Tailwind v4 is
CSS-first (no `tailwind.config.js`); tokens live as CSS custom properties
in `client/src/index.css`.

**Audit finding:** adopting the warm palette means editing the CSS custom
properties in one place (`:root` in `index.css`) and re-validating every
hand-rolled class (`.metric-card`, `.journey-step`, `.goal-ring`, etc.)
against the new tokens — not introducing a second, parallel token set.

## 5. What exists vs. what the OS brief asks for

| OS brief item | Status |
|---|---|
| People | Exists (`members` + `users`), needs relationship cleanup (`members.group` free text). |
| Groups | Exists, solid schema, missing link to `ministries`. |
| Attendance | Exists, already links member/group/event. |
| Events | Exists. |
| Ministries | Exists but shallow (no FKs). |
| Feed | Does not exist. Zero references in `client/src`. |
| Ministry Activity | Does not exist as a table or concept. |
| Timeline | Does not exist as a reusable view; nothing to reuse yet. |
| Places / Map | `client/src/components/Map.tsx` exists; `groups.latitude/longitude` exist; not wired into a map surface today (need to confirm `Map.tsx` usage). |
| Mission Inbox | Does not exist. No LINE integration anywhere in repo. |
| Follow-up | Does not exist as a table. `members.status` (`ต้องติดตาม` / `ติดตามแล้ว`) is the only existing "needs follow-up" signal, and it is a two-state flag on the person, not a task with an owner/due date. |
| Operations | `dashboard.ts` route + `Home.tsx` exist today as a metrics dashboard — this is the closest existing surface to "Operations" and should evolve rather than be duplicated. |
| Reports | `ComingSoon` stub. |
| Notifications | `pushSubscriptions` table exists (infrastructure only, no notification-sending logic found yet). |
| Search | Not found in `client/src`. |
| Administration | `/settings` `ComingSoon` stub; RBAC exists server-side (`USER_ROLES`), no admin UI for it yet. |
| Audit / Security | `auditLogs` table exists and is already used generically. |

## 6. Conclusion for planning

The repository is much further along than the reference brief assumes —
this is not a greenfield "add Feed" task, and it is also not the
mock-data toy `CLAUDE.md` currently describes. The honest starting point
is: a working RBAC'd church CRUD app with a real Postgres schema, no
activity/timeline/follow-up/inbox concept yet, and an out-of-date CLAUDE.md.

See `docs/PUNTAKIT_PRODUCT_ARCHITECTURE.md` for the proposed OS domain
model built on top of this, and `docs/PUNTAKIT_IMPLEMENTATION_PLAN.md` for
the phased rollout.
