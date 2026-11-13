# FaithMap — Target Architecture

Date: 2026-11-13 · Status: **proposed design, not approved, nothing implemented**.
Column names and types are a draft for review. The `/spec` step sets the final form. No migration is written from this document.

## 1. Principles

1. Keep the stack: React SPA, Express API, Drizzle, PostgreSQL, first-party PIN sessions, Vercel.
2. Keep one permission system: `USER_ROLES`, role sets in `shared/roles.ts`, middleware in `server/middleware/auth.ts`.
3. Role is who a person is in the system. Assignment is which groups the person is responsible for. Scope comes from assignments.
4. Additive schema changes only. No existing table is dropped or repurposed.
5. One store per fact: one attendance table, one follow-up table, one identity table for people (`members`).
6. History is appended, not overwritten.
7. Computed, not stored: "not submitted", "late", attendance totals.

## 2. Domain model

```
members (person) ──< group_assignments >── groups (house mission group) >── groups (body)
                                               │
reporting_periods ──< weekly_reports >─────────┘
                          │  ├──< weekly_report_events   (append-only)
                          │  └──  attendance_records     (existing, by group + service day)
                          │
reporting_periods ──< body_summaries >── groups (body)
reporting_periods ──< meeting_briefs  (frozen snapshot)

members ──1:1── newcomer_tracks
follow_ups (existing, extended) ──< follow_up_events (append-only)
users ──1:1── line_accounts          (Phase 5)
```

## 3. Existing tables kept as they are

`users`, `user_sessions`, `members`, `groups` (two levels: `body`, and `care` = house mission group), `group_members`, `attendance_records`, `mission_activities` and children, `mission_submissions` (staff Inbox, untouched), `media_assets`, `audit_logs`, `push_subscriptions`.

## 4. Proposed tables

### 4.1 `group_assignments` — Phase 1

| Column | Note |
|---|---|
| `id` | |
| `group_id` → groups | A house mission group, or a body for `body_leader` |
| `member_id` → members | The person. Access applies through `members.user_id` when a user is linked |
| `responsibility` | `group_leader`, `care_leader`, `coordinator`, `body_leader` |
| `is_primary` | True for the primary supervisor of a house mission group |
| `starts_on`, `ends_on` | `ends_on` null = active |
| `note`, `created_by_id`, `ended_by_id`, `created_at` | |

Rules:
- Partial unique index: one active `is_primary` row per group.
- Partial unique index: one active row per (group, member, responsibility).
- A row is ended, never reassigned to another person.
- Transition: `groups.leader_id` / `co_leader_id` and leader-role `group_members` rows keep their current effect on scope. Phase 1 adds assignments as a further scope source. A later, separately approved step can make assignments the only source.

### 4.2 `reporting_periods` — Phase 2

`id`, `week_start` (date, unique), `week_end`, `opens_at`, `deadline_at`, `created_at`. Week boundary and deadline time are open (O8). All dates use Asia/Bangkok.

### 4.3 `weekly_reports` — Phase 2

| Column | Note |
|---|---|
| `id`, `period_id`, `group_id` | Unique (period, group) |
| `held` | Yes or no. No = "confirmed not held" |
| `status` | `submitted`, `under_review`, `needs_revision`, `approved` |
| `activity_date`, `place_label` | Prefilled from the group |
| `teaching_topic`, `bible_passage`, `prayer_note`, `fellowship_note`, `other_activity_note`, `atmosphere_note` | Free text, all optional except one activity description when held |
| `next_week_plan`, `support_needed`, `other_note` | |
| `first_time_visitor_count`, `returning_visitor_count` | Derived from visitor attendance when people are recorded; typed only when names are unknown |
| `not_held_reason` | Optional, when held = no |
| `submitted_by_id`, `submitted_at`, `updated_at` | |
| `activity_id` → mission_activities | Optional. Set when leadership publishes the report as a Feed story |

Display status: no row → "ยังไม่ส่ง"; held = no → "ยืนยันว่าไม่ได้จัด"; else the review status. Late = `submitted_at > deadline_at`, computed.
Attendance: existing `attendance_records` with `service_type = 'care_group'`, the group and the activity date. Photos: existing `media_assets` (`mission_photo`, group).

### 4.4 `weekly_report_events` — Phase 2

Append-only: `id`, `report_id`, `actor_id`, `action` (`submit`, `resubmit`, `start_review`, `request_revision`, `approve`, `edit`), `from_status`, `to_status`, `note`, `changes` (JSON: field → old, new), `created_at`.

### 4.5 `body_summaries` — Phase 2

`id`, `period_id`, `body_group_id`, unique (period, body); `issues_note`, `support_note`, `other_note`, `sent_by_id`, `sent_at`. Counts are computed at read time.

### 4.6 `meeting_briefs` — Phase 3

`id`, `period_id`, `generated_at`, `generated_by_id`, `payload` (JSON, frozen), `data_scope_note`. Rows are never updated. A period can have several briefs; each keeps its timestamp.

### 4.7 `follow_ups` extension and `follow_up_events` — Phase 4

New columns on `follow_ups`: `kind` (`missing_report`, `group_inactive`, `absence`, `newcomer`, `group_info`, `support_request`, `manual`), `priority` (`normal`, `high`), `result` (text), `source_key` (text; partial unique index while the item is open).
`follow_up_events`: `id`, `follow_up_id`, `actor_id`, `action`, `from_status`, `to_status`, `note`, `created_at`.

### 4.8 `newcomer_tracks` — Phase 4

1:1 with a `members` row whose `membership_status = 'visitor'`: `member_id` (unique), `first_visit_on`, `first_group_id`, `welcomed_by_member_id`, `owner_member_id`, `status` (`first_visit`, `awaiting_follow_up`, `contacted`, `returned`, `ongoing_care`, `completed`), `next_follow_up_on`, `result_note`.

### 4.9 Changes to existing structures (each needs a production pre-check)

- `attendance_records`: service day in Asia/Bangkok and a unique index on member, service type, group, service day (gap B4).
- `group_members`: partial unique index, as already decided in `PUNTAKIT_MISSION_DOMAIN_PLAN.md` Q8 (gap B3).

### 4.10 `line_accounts` and `notification_log` — Phase 5

`line_accounts`: `user_id` (unique), `line_user_id` (unique), `linked_at`, `unlinked_at`.
`notification_log`: `user_id`, `event_key` (unique per user), `channel`, `sent_at`.

## 5. Scope resolution (server)

One resolver, one place (extends `server/lib/groupAccess.ts`):

```
resolveMissionScope(user) →
  all            for mission leadership roles (O5)
  { submit:  groups where user has an active group_leader responsibility (or leads today, F3)
    review:  groups where user has an active care_leader / coordinator / body_leader assignment
    approve: groups whose body the user leads
    view:    union of the above plus all groups of a body the user leads }
```

Rules:
- Every list query filters by the resolved group ids in SQL. No filtering in the client.
- A route that takes a group id or report id checks membership in the scope and returns 403 otherwise.
- An ended assignment gives no access from the end date.
- A `group_leader` role without any assignment or led group sees nothing (current behaviour, kept).

Reviewer of a report: active primary supervisor → else other active supervisors → else body leader. A person does not review the own submitted report unless decision O4 allows it.

## 6. API surface (proposed)

| Route | Purpose | Phase |
|---|---|---|
| `GET/POST /api/groups/:id/assignments`, `POST /api/assignments/:id/end` | Responsibility data and history | 1 |
| `GET /api/supervisors/:memberId` | Supervisor profile | 1 |
| `GET /api/mission/periods/current` | Current period and the caller's expected groups | 2 |
| `GET/PUT /api/mission/reports/:periodId/:groupId` | Read or save a draft of the group's report | 2 |
| `POST /api/mission/reports/:id/{submit,review,request-revision,approve}` | Status changes; each writes an event | 2 |
| `GET/PUT /api/mission/bodies/:id/summary/:periodId`, `POST …/send` | Body summary | 2 |
| `GET /api/mission/overview?periodId=` | Scoped overview | 3 |
| `POST /api/mission/briefs`, `GET /api/mission/briefs/:id` | Meeting brief snapshot | 3 |
| `GET /api/mission/newcomers`, `PUT /api/mission/newcomers/:memberId` | Newcomer tracking | 4 |
| `POST /api/cron/{open-period,remind,attention-items}` | Scheduler, secret header | 2–4 |
| `POST /api/line/link`, `POST /api/line/session` | LINE linking and session exchange | 5 |

Existing routes stay: `/api/care/*`, `/api/attendance/*`, `/api/follow-ups/*`, `/api/org/*`, `/api/submissions/*`.

## 7. Client

Admin shell (`AppLayout`), existing design tokens:

| Route | Page | Phase |
|---|---|---|
| `/mission` | Mission Overview (leadership home for this domain) | 3 |
| `/mission/bodies/:id` | Body page: groups, report status, responsibility, summary | 1–3 |
| `/mission/groups/:id` | Group page: profile, responsible people, history, reports | 1–2 |
| `/mission/reports/:id` | Report detail and review | 2 |
| `/mission/brief/:id` | Printable meeting brief | 3 |

Group leader (mobile, later also inside LIFF):

| Route | Page | Phase |
|---|---|---|
| `/report` | "รายงานสัปดาห์นี้": three steps — เช็กชื่อ → เล่าสิ่งที่ทำ → ส่ง. Shows status after sending | 2 |

The attendance step reuses the `/care` roster and bulk save. Navigation changes need the confirmation already required by `PUNTAKIT_IMPLEMENTATION_PLAN.md` (Phase 8).

## 8. Scheduler and notifications

Vercel Cron calls `/api/cron/*` with a secret header. Jobs: open the period (Saturday), remind missing groups (Sunday, times from O8), create attention items (after the deadline). Each job is idempotent and finishes inside the 60 s function limit. Channel in Phases 2–4: Web Push and in-app lists. Phase 5 adds LINE.

## 9. LINE and LIFF (Phase 5)

- Linking: the user signs in with PIN, opens the LIFF link page, the client sends the LIFF ID token, the server verifies it with LINE (signature, channel id, expiry) and stores `line_user_id`. The user confirms on screen.
- Later LIFF opens: the server exchanges a verified ID token for the normal `puntakit_session` cookie. No second session system.
- `vercel.json` CSP gets the exact LINE hosts that the SDK needs. Each host is reviewed.

## 10. Security

- Scope checks on the server for every new route, with tests inside and outside scope.
- CSRF and session rules of `server/lib/firstPartyAuth.ts` apply to all new write routes.
- Contact masking keeps the existing rule (`maskSensitiveData`).
- Absence notes, newcomer data and meeting briefs are restricted to the responsible people and leadership.
- Every status change, assignment change and brief generation writes an audit or event row with actor and time.

## 11. What this design does not do

No new `USER_ROLES` value. No rename of stored `org_level` values. No change to `mission_submissions`. No removal of existing pages. No change to the design system.
