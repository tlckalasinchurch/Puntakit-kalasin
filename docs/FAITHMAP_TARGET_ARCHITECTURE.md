# FaithMap — Target Architecture

Date: 2026-11-13 · Revision 2: 2026-11-14 · Status: **proposed design, not approved, nothing implemented**.
Revision 2 applies the four confirmed decisions (draft autosave, body leader as final approver, supervisor fallback, Sunday deadline in Asia/Bangkok). Pending decisions are marked with their number from `FAITHMAP_PHASE0_SYSTEM_AUDIT.md` §8.
Column names and types are a draft for review. The `/spec` step sets the final form. No migration is written from this document.

## 1. Principles

1. Keep the stack: React SPA, Express API, Drizzle, PostgreSQL, first-party PIN sessions, Vercel. The stack is the technical foundation of one product, FaithMap (`FAITHMAP_INTEGRATION_ARCHITECTURE.md`).
2. Keep one permission system: `USER_ROLES`, role sets in `shared/roles.ts`, middleware in `server/middleware/auth.ts`.
3. Role is who a person is in the system. Assignment is which groups the person is responsible for. Scope comes from assignments.
4. Additive schema changes only. No existing table is dropped or repurposed.
5. One store per fact: one attendance table, one follow-up table, one identity table for people (`members`).
6. History is appended, not overwritten.
7. Computed, not stored: "not submitted", "late", "blocked", attendance totals.
8. A draft is not a submission. Only the explicit submit action changes a draft to a submitted report.
9. The approval step has one owner, the body leader. No rule in the system skips it or replaces the approver.

## 2. Domain model

```
members (person) ──< group_assignments >── groups (house mission group) >── groups (body)
                                               │
reporting_periods ──< reporting_period_groups >┤   (proposed snapshot of expected groups, O11)
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

`id`, `week_start` (date, unique), `week_end`, `opens_at`, `deadline_at`, `created_at`. All dates use Asia/Bangkok.

Deadline: `deadline_at` is on the Sunday of the period, Asia/Bangkok (confirmed). The time of day is **not decided** (pending O8). The value is configuration, not a constant in code. No default time is assumed in this design. The week start day is also pending (O8).

#### 4.2.1 `reporting_period_groups` — Phase 2 (proposed, pending O11)

Problem: "expected groups" computed from the current `groups` rows changes past periods when a group is paused, closed or moved to another body later.

Proposal: when a period opens, the system writes one row per expected group: `period_id`, `group_id`, `body_group_id` (the body at that time), `created_at`; unique (period, group). A group that starts inside an open period gets a row at that time. Rows are not changed after the period deadline.

- These rows are the expected list. They are not report placeholders: a row holds no report content and no status.
- Past periods read the body of a group from this table, not from `groups.parent_group_id`.
- Alternative: derive the past state from `audit_logs`. The audit rows hold new values only today (audit finding F11), so this alternative is not reliable for existing data.
- If O11 is rejected, past-period counts follow the current group state, and that limit must be shown in the overview.

### 4.3 `weekly_reports` — Phase 2

| Column | Note |
|---|---|
| `id`, `period_id`, `group_id` | Unique (period, group) |
| `held` | Yes or no. No = "confirmed not held" |
| `status` | `draft`, `submitted`, `under_review`, `needs_revision`, `approved`. A new row starts as `draft` |
| `activity_date`, `place_label` | Prefilled from the group |
| `teaching_topic`, `bible_passage`, `prayer_note`, `fellowship_note`, `other_activity_note`, `atmosphere_note` | Free text, all optional except one activity description when held |
| `next_week_plan`, `support_needed`, `other_note` | |
| `first_time_visitor_count`, `returning_visitor_count` | Derived from visitor attendance when people are recorded; typed only when names are unknown |
| `not_held_reason` | Optional, when held = no |
| `submitted_by_id` | The user who sent the report |
| `first_submitted_at` | Time of the first submit. Set once. Never changed by a resubmission. Null while `draft` |
| `last_submitted_at` | Time of the latest submit or resubmit. Equal to `first_submitted_at` after the first submit |
| `revision_reason` | Reason of the latest request for revision. Required by that action. Earlier reasons stay in `weekly_report_events` |
| `approved_by_id`, `approved_at` | The body leader who gave the final approval, and the time. Null until approved |
| `updated_at` | Time of the latest save, including autosave |
| `activity_id` → mission_activities | Optional. Set when leadership publishes the report as a Feed story |

Rules:
- **Autosave** writes field values and `updated_at` only. It never changes `status`, `first_submitted_at` or `last_submitted_at`. It is allowed only while `status` is `draft` or `needs_revision`, and only for the group leader of the group.
- **Submit** is a separate action. `draft` → `submitted` sets `first_submitted_at` and `last_submitted_at`. `needs_revision` → `submitted` sets `last_submitted_at` only.
- **Idempotent submit:** a submit on a row whose status is `submitted`, `under_review` or `approved` returns the current row, changes nothing and writes no event. The status change is one conditional update, so two concurrent submits produce one change.
- **Submitted report** = a row with status other than `draft`. A report with `held` = no and status other than `draft` is a submitted report ("confirmed not held").
- **Missing report** = an expected group of the period with no row, or with a `draft` row.
- **Late** = `first_submitted_at > deadline_at`, computed. `last_submitted_at` is never used for the late mark.
- **Approve** sets `status = approved`, `approved_by_id` and `approved_at`. Only the body leader of the group's body can do it (§5.2).
- An approved report is not edited. A correction after approval is out of scope of this revision.

Display state: no row or `draft` → "ยังไม่ส่ง" (the group leader sees "ฉบับร่าง" on the own report); submitted with held = no → "ยืนยันว่าไม่ได้จัด" plus the review status; "ติดขัด" (blocked) by the rule in §5.2; else the review status.
Attendance: existing `attendance_records` with `service_type = 'care_group'`, the group and the activity date. Photos: existing `media_assets` (`mission_photo`, group).

### 4.4 `weekly_report_events` — Phase 2

Append-only: `id`, `report_id`, `actor_id`, `action` (`submit`, `resubmit`, `start_review`, `supervisor_reviewed`, `request_revision`, `approve`, `edit`), `from_status`, `to_status`, `note`, `changes` (JSON: field → old, new), `created_at`.

- No route updates or deletes an event row.
- Autosave of a `draft` writes no event. Events start at the first submit. A `resubmit` event holds the changed fields with old and new values.
- A `request_revision` event holds the reason in `note`. The same text is copied to `weekly_reports.revision_reason`.
- `supervisor_reviewed` records that an assigned supervisor finished the review. It does not approve the report.

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

### 5.1 Usable account

An assignment gives access only when its person has a usable account: `members.user_id` is set, `users.status = 'active'`, and `users.pin_hash` is not null. These three columns exist today (code verified in `shared/schema.ts`; a null `pin_hash` cannot sign in). An assignment without a usable account is shown, and it gives nobody access.

### 5.2 Resolver

One resolver, one place (extends `server/lib/groupAccess.ts`):

```
resolveMissionScope(user) →
  { submit:  groups where user has an active group_leader responsibility (or leads today, F3)
    review:  groups where user has an active care_leader / coordinator / body_leader assignment
    approve: groups whose body the user leads through an active body_leader assignment
    view:    union of the above plus all groups of a body the user leads;
             all groups for mission leadership (how a person becomes mission leadership is pending, O5) }
```

Mission leadership gets `view` only. It gets no `review` and no `approve` from the leadership status. A leadership person who also holds a body leader assignment approves in that body through the assignment.

Rules:
- Every list query filters by the resolved group ids in SQL. No filtering in the client.
- A route that takes a group id or report id checks membership in the scope and returns 403 otherwise.
- An ended assignment gives no access from the end date.
- A `group_leader` role without any assignment or led group sees nothing (current behaviour, kept).

### 5.3 Routing of a submitted report

1. Supervisor step: the active primary supervisor with a usable account → else another active supervisor (care leader or coordinator) with a usable account.
2. Supervisor fallback (confirmed): if step 1 finds nobody, the report goes to the body leader directly. The group is listed under "groups without a usable supervisor".
3. Final approval: the body leader of the group's body, with an active assignment and a usable account. Nobody else approves.
4. Blocked (confirmed): if the body has no body leader with a usable account, the report is blocked. The stored `status` does not change. The state is computed at read time and ends when a usable body leader exists. The system notifies the administrators once per report (recipient list pending, O13). No role, including `admin` and `super_admin`, approves in place of the body leader, and no job approves automatically.
5. Routing is computed at read time from active assignments, so a change of assignment takes effect at once.

Pending rules:
- O12: can the body leader approve before the supervisor recorded `supervisor_reviewed`? The data model supports both answers.
- O4: a person does not review or approve the own submitted report unless decision O4 allows it. If a body leader is also the group leader that submitted the report, and O4 stays "no", that report has no approver and is blocked.

## 6. API surface (proposed)

| Route | Purpose | Phase |
|---|---|---|
| `GET/POST /api/groups/:id/assignments`, `POST /api/assignments/:id/end` | Responsibility data and history | 1 |
| `GET /api/supervisors/:memberId` | Supervisor profile | 1 |
| `GET /api/mission/periods/current` | Current period and the caller's expected groups | 2 |
| `GET/PUT /api/mission/reports/:periodId/:groupId` | Read the group's report; autosave (creates the `draft` row on first save; never submits) | 2 |
| `POST /api/mission/reports/:id/submit` | Submit or resubmit; idempotent (§4.3) | 2 |
| `POST /api/mission/reports/:id/{review,request-revision,approve}` | Review actions; each writes an event; `approve` is for the body leader only | 2 |
| `GET /api/mission/reports/blocked` | Blocked reports, for administrators and mission leadership | 2 |
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
| `/report` | "รายงานสัปดาห์นี้": three steps — เช็กชื่อ → เล่าสิ่งที่ทำ → ส่ง. Saves the draft automatically and shows the last save time. Reopens the draft on return. Shows status after sending | 2 |

The attendance step reuses the `/care` roster and bulk save. Navigation changes need the confirmation already required by `PUNTAKIT_IMPLEMENTATION_PLAN.md` (Phase 8).

## 8. Scheduler and notifications

Vercel Cron calls `/api/cron/*` with a secret header. Jobs: open the period (Saturday) and write the expected group list (§4.2.1, O11), remind groups without a submitted report (Sunday, Asia/Bangkok; times depend on the deadline time, pending O8), notify administrators of blocked reports, create attention items (after the deadline). A group with a draft only still gets the reminder. Each job is idempotent and finishes inside the 60 s function limit. Channel in Phases 2–4: Web Push and in-app lists. Phase 5 adds LINE.

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

No new `USER_ROLES` value (unless decision O5 selects one). No rename of stored `org_level` values. No change to `mission_submissions`. No removal of existing pages. No change to the design system. No approval by mission leadership or administrators in place of the body leader. No automatic approval.
