# Puntakit Product Architecture — Ministry Operating System

Date: 2026-09-24
Status: Phase 1 (Mission Activity data layer + API) implemented and verified
against a real embedded PostgreSQL instance (PGlite). See §"Phase 1 —
implemented" below for what actually shipped, versus the rest of this
document, which stays a proposal for Phase 2+. See
`docs/PUNTAKIT_IMPLEMENTATION_PLAN.md` for what ships in which phase.

## Product hierarchy

```
PUNTAKIT
└── Ministry Operating System
    ├── People            (existing: members, users)
    ├── Groups            (existing: groups, groupMembers)
    ├── Ministry Activity  (new)
    ├── Feed              (new — view over Ministry Activity)
    ├── Timeline          (new — reusable view over Ministry Activity)
    ├── Places / Map      (existing geo fields, no surface yet)
    ├── Mission Inbox      (new)
    ├── Follow-up          (new)
    ├── Attendance         (existing: attendanceRecords)
    ├── Events             (existing: events, eventRegistrations)
    ├── Ministries         (existing, needs FK to groups)
    ├── Operations         (evolves from existing dashboard.ts + Home.tsx)
    ├── Reports            (evolves from ComingSoon stub)
    ├── Notifications       (evolves from pushSubscriptions)
    ├── Search             (new, cross-domain)
    └── Administration      (evolves from ComingSoon /settings stub)
```

Feed is not the product. Dashboard is not the product. `MissionActivity`
is the core object; every surface above is a lens on it plus the existing
People/Group/Attendance/Event tables. This follows the audit finding in
`docs/PUNTAKIT_UX_AUDIT.md` §2: no activity table exists today, and the
existing `auditLogs` table is not reused for it (system audit trail vs.
ministry content must stay separate).

## Phase 1 — implemented (actual, not hypothetical)

What shipped is smaller than the illustrative schema later in this document
("New domain model" below), on purpose — per the plan's own instruction to
prefer the smallest schema that proves the core loop and evolve later.
Differences from the original proposal, and why:

- **No `visibility` enum column.** The original draft proposed
  `church`/`leaders`/`private`. Dropped — authorization is enforced through
  the existing `USER_ROLES` RBAC (role checks in
  `server/routes/activities.ts`), the same pattern `server/routes/groups.ts`
  and `server/routes/members.ts` already use, per the explicit instruction
  not to invent a second permission system. Status (`draft`/
  `pending_review`) already gates visibility for unreviewed content; a
  separate visibility axis can be added later if a real need appears.
- **No `missionSubmissions` (Mission Inbox) or `followUps` tables.** Out of
  scope for Phase 1 by instruction — the goal was to prove the core
  `MissionActivity` object works end to end, not build every downstream
  domain at once.
- **Location is columns on the activity, not a `Place` entity**
  (`placeLabel`, `latitude`, `longitude` — same shape as `groups`' existing
  location columns). No separate `locations` table; nothing yet needs one.
- **`missionActivityMedia` kept as a real table**, not a JSON column, since
  ordering (`sortOrder`) and a `kind` enum (image/video) are genuine
  one-to-many needs and the codebase already uses join/child tables for
  this shape everywhere else (`groupMembers`, `eventRegistrations`).

### Actual schema (3 tables, additive migration `0004_clumsy_legion.sql`)

```
mission_activities
  id, type (enum), status (enum: draft|pending_review|published|archived),
  title, story, occurred_at, group_id (FK -> groups, nullable, set null),
  place_label, latitude, longitude,
  created_by_id (FK -> users, nullable, set null — matches members/groups
  convention), deleted_at (soft delete), created_at, updated_at
  indexes: type, status, group_id, occurred_at, created_by_id, deleted_at

mission_activity_participants  (join: activity <-> member)
  id, activity_id (FK cascade), member_id (FK cascade), created_at
  unique(activity_id, member_id)

mission_activity_media
  id, activity_id (FK cascade), url, kind (image|video), sort_order,
  created_at
```

Why each table exists, what it relates to, and delete behavior:

| Table | Why it exists | Relates to | On delete of parent |
|---|---|---|---|
| `mission_activities` | Nothing today represents "something happened" — see audit §2. Core Feed/Timeline/Map source. | `groups` (optional), `users` (author) | Group deleted → `group_id` set null (activity survives, matches how `attendanceRecords.groupId` already behaves). User deleted → `created_by_id` set null (matches `members.createdById`/`groups.createdById`). |
| `mission_activity_participants` | A person's Timeline needs to find every activity they were part of; many-to-many is real (one visit, several people). | `mission_activities`, `members` | Either side deleted → row cascades (matches `groupMembers`/`eventRegistrations`). |
| `mission_activity_media` | Photo-first capture is core to the product; ordering and image/video kind are real needs, not speculative. | `mission_activities` | Activity deleted → media cascades. |

### Lifecycle (explicit, enforced server-side)

```
draft ──────────┬──> pending_review ──> published ──> archived
                └──────────────────────────────────┘
archived ──> draft   (explicit restore, not automatic)
```

Implemented as a `STATUS_TRANSITIONS` map in `server/routes/activities.ts`
— any status not listed as a valid next state for the current status is
rejected with `400 VALIDATION_ERROR`. Arbitrary status *values* are
separately rejected by the Zod enum in
`missionActivityStatusUpdateSchema`.

### Authorization (reuses existing RBAC, no new permission system)

- **Create:** `super_admin`, `admin`, `staff`, `ministry_leader`,
  `group_leader`.
- **Read:** privileged roles (`super_admin`, `admin`, `staff`,
  `ministry_leader`) see every activity. Everyone else sees published
  activities, their own activities regardless of status, and — for
  `group_leader` — activities tied to a group they actually lead (checked
  against `groups.leaderId`/`coLeaderId`, not just their role name).
  Anything else returns `404`, not `403`, so an unreviewed submission's
  existence isn't leaked to someone who shouldn't see it.
- **Edit / manage:** privileged roles, the activity's own creator, or a
  `group_leader` who leads that activity's group.
- **Publish specifically:** requires a privileged role or leadership of
  the activity's group — a field worker (`group_leader` on a group they
  don't lead, or any `CREATE_ROLES` member submitting) can move a draft to
  `pending_review` but cannot self-publish. This directly implements the
  brief's "AI/field submissions are draft, human review publishes" rule,
  ahead of Mission Inbox/AI even existing, by putting the same gate on the
  manual path.
- **Delete (soft):** `super_admin`, `admin`, `ministry_leader` only —
  matches `groups.ts`'s delete gating.
- Every mutating action calls the existing `logAudit()` helper
  (`MISSION_ACTIVITY_CREATED`, `MISSION_ACTIVITY_UPDATED`,
  `MISSION_ACTIVITY_STATUS_CHANGED`, `MISSION_ACTIVITY_SOFT_DELETED`),
  writing to the existing `auditLogs` table — no new audit mechanism.

### API surface (`server/routes/activities.ts`, mounted at `/api/activities`)

- `GET /` — list, role-filtered, supports `type`, `status`, `groupId`,
  `memberId` (participant), `startDate`/`endDate`, `search`, pagination.
  This is the query Feed will read from in Phase 2 — no separate Feed
  table needed.
- `GET /:id` — detail with joined group name, creator name, participants
  (joined member names), and ordered media.
- `POST /` — create (draft by default), accepts `participantMemberIds` and
  `media` inline.
- `PUT /:id` — update core fields and/or replace the participant/media set.
- `PUT /:id/status` — the lifecycle transition endpoint described above.
- `DELETE /:id` — soft delete.

### Verification actually performed

- `pnpm check` — passes (one real type error found and fixed: a `Set`
  spread needing `Array.from` under this project's `tsconfig` target).
- `pnpm test` — **125/125 pass**, including a new
  `server/routes/activities.test.ts` (17 tests) that runs the full loop
  against a real embedded PostgreSQL instance (PGlite, migrated with the
  actual generated SQL — not a mock): create → persist → fetch →
  authorization (401/403/404 cases) → group relation → participant
  relation → two different lifecycle-transition paths (privileged
  publish, and a genuine group-leader self-publish) → invalid-transition
  rejection → audit log rows asserted directly against the database →
  soft delete → post-delete 404. Two pre-existing tests in
  `server/db/bootstrap.test.ts` needed a one-line update (hardcoded
  migration count 4 → 5, since this change adds migration `0004`) — fixed,
  not skipped.
- `pnpm build` — passes (`vite build` + `esbuild` server bundle). Pre-existing
  warnings only (undefined `VITE_ANALYTICS_*` env vars, a >500kB client
  chunk) — both predate this change and are unrelated to it.
- **Not tested:** a live Neon/Postgres connection. No `DATABASE_URL`
  credential is available in this environment, and the plan's own rule is
  not to require production credentials. PGlite is Postgres-compatible and
  runs the same generated SQL migration, which is the strongest
  verification available without a live database; a real Neon/Postgres run
  is recommended before this ships to production.

## Source of truth

| Domain | Source of truth (table) | Notes |
|---|---|---|
| Person | `members` (+ `users` for login identity) | unchanged |
| Group | `groups` | unchanged |
| Group membership | `groupMembers` | unchanged |
| Attendance | `attendanceRecords` | unchanged |
| Event | `events`, `eventRegistrations` | unchanged |
| Ministry (org unit) | `ministries` | gains `groupId` FK (nullable, additive) |
| Ministry activity | `missionActivities` (new) | see below |
| Activity media | `missionActivityMedia` (new) | see below |
| Activity participants | `missionActivityParticipants` (new, join table) | links activity ↔ member |
| Raw field submission | `missionSubmissions` (new) | pre-publish inbox item |
| Follow-up task | `followUps` (new) | |
| System/security audit | `auditLogs` | unchanged, stays system-only |

Feed, Timeline, Map, and Operations are **read models**, not new tables:
- Feed = `missionActivities` filtered/sorted by `occurredAt`.
- Timeline (person/group/place) = `missionActivities` filtered by
  participant/group/place FK, merged with `attendanceRecords` for that
  same subject where useful (e.g., "attended Sunday service" as a
  timeline entry) — read-only join, not a copy.
- Map = `missionActivities`/`groups` with non-null location, respecting
  visibility rules in §Security.
- Operations = aggregates over `missionSubmissions` (pending review),
  `followUps` (open/overdue), `missionActivities` (recent), `groups`
  (no activity in N days) — the same aggregation `server/routes/dashboard.ts`
  already does for metrics today, extended with these new signals.

## New domain model (original proposal — superseded by §"Phase 1 —
implemented" above for what actually shipped; kept here as the forward
plan for `missionSubmissions`/`followUps` in later phases)

```ts
// shared/schema.ts additions — illustrative, not final column list

export const MISSION_ACTIVITY_TYPES = [
  "house_mission", "mission_visit", "bible_study", "prayer", "worship",
  "fellowship", "testimony", "evangelism", "pastoral_visit", "outreach",
  "ministry_update", "other",
] as const;

export const MISSION_ACTIVITY_STATUSES = [
  "draft", "pending_review", "published", "archived",
] as const;

export const MISSION_ACTIVITY_SOURCES = [
  "manual", "line", "import", "system",
] as const;

export const missionActivities = pgTable("mission_activities", {
  id: id(),
  type: text("type", { enum: MISSION_ACTIVITY_TYPES }).notNull(),
  status: text("status", { enum: MISSION_ACTIVITY_STATUSES })
    .notNull().default("draft"),
  source: text("source", { enum: MISSION_ACTIVITY_SOURCES })
    .notNull().default("manual"),
  title: text("title").notNull(),
  story: text("story"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  groupId: text("group_id").references(() => groups.id, { onDelete: "set null" }),
  visibility: text("visibility", { enum: ["church", "leaders", "private"] })
    .notNull().default("church"),
  latitude: text("latitude"),
  longitude: text("longitude"),
  placeLabel: text("place_label"),
  createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const missionActivityMedia = pgTable("mission_activity_media", {
  id: id(),
  activityId: text("activity_id").notNull()
    .references(() => missionActivities.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  kind: text("kind", { enum: ["image", "video"] }).notNull().default("image"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const missionActivityParticipants = pgTable(
  "mission_activity_participants",
  {
    id: id(),
    activityId: text("activity_id").notNull()
      .references(() => missionActivities.id, { onDelete: "cascade" }),
    memberId: text("member_id").notNull()
      .references(() => members.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("mission_activity_participant_uniq").on(t.activityId, t.memberId)]
);

export const MISSION_SUBMISSION_STATUSES = [
  "new", "reviewing", "needs_info", "approved", "rejected",
] as const;

export const missionSubmissions = pgTable("mission_submissions", {
  id: id(),
  status: text("status", { enum: MISSION_SUBMISSION_STATUSES })
    .notNull().default("new"),
  source: text("source", { enum: MISSION_ACTIVITY_SOURCES })
    .notNull().default("line"),
  rawText: text("raw_text"),
  rawMediaUrls: text("raw_media_urls"), // JSON array, kept simple until an adapter exists
  submittedByLabel: text("submitted_by_label"), // e.g. LINE display name, not a users FK
  publishedActivityId: text("published_activity_id")
    .references(() => missionActivities.id, { onDelete: "set null" }),
  reviewedById: text("reviewed_by_id").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const FOLLOW_UP_STATUSES = [
  "open", "in_progress", "completed", "cancelled",
] as const;

export const followUps = pgTable("follow_ups", {
  id: id(),
  status: text("status", { enum: FOLLOW_UP_STATUSES }).notNull().default("open"),
  subjectMemberId: text("subject_member_id").references(() => members.id, { onDelete: "cascade" }),
  subjectGroupId: text("subject_group_id").references(() => groups.id, { onDelete: "cascade" }),
  activityId: text("activity_id").references(() => missionActivities.id, { onDelete: "set null" }),
  ownerId: text("owner_id").references(() => users.id, { onDelete: "set null" }),
  dueAt: timestamp("due_at", { withTimezone: true }),
  note: text("note"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

Every new table above answers the brief's own required question ("why
does it exist, what existing entity cannot represent this"):
- `missionActivities` — nothing today represents "something happened,"
  as distinct from attendance (a roll-call) or an announcement (broadcast
  text). Needed as the Feed/Timeline/Map source of truth.
- `missionActivityMedia` — one-to-many photos per activity; a text[] or
  JSON column would work for MVP and is the leaner alternative — **flag
  for Phase 1 decision**, not settled here.
- `missionActivityParticipants` — reuses the same join-table shape as
  `groupMembers`/`eventRegistrations` already in the schema; lets a
  Person's Timeline show activities they were part of.
- `missionSubmissions` — the brief requires a Mission Inbox distinct from
  published activity, with review states. Publishing copies/promotes a
  submission into a `missionActivities` row (`publishedActivityId` links
  them) rather than duplicating the data model.
- `followUps` — `members.status` (`ต้องติดตาม`/`ติดตามแล้ว`) is a
  two-state flag on a person; it cannot express "who owns this, by when,"
  which the brief explicitly asks for. A real table is justified.

**Reused, not duplicated:** `ministries` gets one additive nullable FK
(`groupId`) to express Church → Ministry → Group without a new table.
`groups.latitude`/`longitude` already exist and are reused for Map, no
new location table for groups. `attendanceRecords` is reused as-is for
the Attendance domain and referenced (not copied) into Timeline views.

## Information architecture (proposed, to validate — see §7 of the brief)

The current sidebar (`docs/PUNTAKIT_UX_AUDIT.md` §3) already has 12 items
plus a parallel `/app/*` member PWA. The OS brief's own hypothesis
(Feed/Groups/People/Map/More on mobile) should be validated against real
task frequency, not assumed. Proposed grouping, building on today's nav
rather than replacing it outright:

```
Primary (always visible):
  Feed            /feed        (new landing page, replaces or sits beside Home)
  Groups          /groups      (existing)
  People          /members     (existing, relabeled)
  Map             /map         (new)

Secondary ("More" on mobile, full sidebar on desktop):
  Timeline        (rendered inline on Person/Group/Place pages, not a
                   standalone nav item — per brief §6, "not every domain
                   needs a top-level nav item")
  Mission Inbox   /inbox        (new)
  Follow-up       /follow-up    (new)
  Attendance      /attendance   (existing)
  Events          /events       (existing, currently labeled "worship")
  Ministries      /ministries   (existing)
  Operations      /operations   (evolves from Home.tsx dashboard)
  Reports         /reports      (evolves from ComingSoon)
  Announcements   /announcements (existing)
  Church          /church       (existing)
  Administration  /settings     (evolves from ComingSoon)
  Profile         /profile      (existing)
```

This is a hypothesis for Phase 3 (see implementation plan), not a Phase 1
change — reshuffling live navigation is a highly visible, user-facing
change and should wait until Feed/Activity actually exist to navigate to.

## Security model

- All new tables get server-side authorization in the corresponding
  `server/routes/*.ts` module, following the existing RBAC pattern
  (`USER_ROLES` checked server-side, not UI-hidden only — matches current
  code, e.g. `server/routes/members.ts` pattern to confirm and replicate).
- `missionActivities.visibility` (`church`/`leaders`/`private`) gates Feed
  and Map queries at the query layer, not by hiding cards client-side.
- `missionSubmissions.rawText`/media may contain unreviewed, unverified
  field content — never expose it on Feed/Map until `status = approved`
  and it is promoted to a `missionActivities` row.
- Confidential prayer requests (`prayerRequests.isConfidential`) stay out
  of Feed/Timeline entirely — Feed only ever reads from
  `missionActivities`, never from `prayerRequests`.

## What this document intentionally leaves open

- Exact column list for `missionActivityMedia` (JSON column vs. join
  table) — small, reversible, decide at implementation time.
- Whether `followUps` needs its own notification trigger table or reuses
  `pushSubscriptions` directly — decide when Notifications phase starts.
- LINE adapter design — out of scope until a real LINE channel/credential
  exists; `missionSubmissions.source` already reserves room for it without
  committing to an integration now.
