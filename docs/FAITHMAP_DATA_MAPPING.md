# FaithMap — Data Mapping

Date: 2026-11-13 · Revision 2: 2026-11-14 · Status: existing columns are **code verified** in `shared/schema.ts`; proposed columns are a draft (see `FAITHMAP_TARGET_ARCHITECTURE.md`). No proposed table or column exists in the database.

Legend: **E** = exists, reuse · **I** = exists, needs improvement · **N** = new (proposed).

## 1. Organization and directory

| Brief item | Source | State |
|---|---|---|
| Body | `groups` row, `org_level = 'body'` | E |
| House mission group | `groups` row, `org_level = 'care'` (legacy value), `parent_group_id` → body | E (confirm O1) |
| Group id, name | `groups.id`, `name` | E |
| Location, address | `groups.meeting_location`, `area` | E |
| Coordinates | `groups.latitude`, `longitude` (text) | E |
| Meeting day, time | `groups.meeting_day`, `meeting_time` | E |
| Operational status | `groups.status` (`active, paused, closed`) | E |
| Newly established group | `groups.start_date`, `created_at` | E |
| Group photos | `groups.avatar_url`, `cover_url`; `media_assets.kind = 'group_photo'` | E |
| Group leader | `groups.leader_id` (user), leader-role `group_members` row | E; history N via `group_assignments` |
| Imported care leader and coordinator names | Text lines in `groups.description` (`หนค. (ต้นฉบับ)`, `ผู้ประสานงาน (ต้นฉบับ)`), parsed by `shared/orgView.ts` | I — link to a person by human confirmation |
| Primary supervisor, additional supervisors, coordinator | `group_assignments` | N |
| Assignment role, start, end, active state, history | `group_assignments.responsibility`, `starts_on`, `ends_on` | N |
| Body leader | `groups.leader_id` / `leader_member_id` on the body row | E; history N via `group_assignments` |
| Move between bodies | `groups.parent_group_id`; audit row with new value only | I — audit before and after |
| Group history | `audit_logs` (`UPDATE_GROUP`) | I |
| Regular members | `group_members` (status `active`) | E |
| Group on map | `/map`, group coordinates | E |
| Supervisor profile: name, photo | `members.name`, `members.avatar_url` | E |
| Supervisor profile: groups, history | `group_assignments` | N |

## 2. Weekly report

| Brief item | Source | State |
|---|---|---|
| Week id, start, end, deadline | `reporting_periods`. `deadline_at` is on Sunday, Asia/Bangkok (confirmed); time of day pending (O8) | N |
| Expected groups of a period | `reporting_period_groups` (period, group, body at that time), written when the period opens (proposed, pending O11). Without it: computed from current `groups` rows, which changes past periods | N |
| Body of a group in a past period | `reporting_period_groups.body_group_id` (pending O11) | N |
| Report (one per group per period) | `weekly_reports`, unique (period, group) | N |
| Held or not held | `weekly_reports.held` | N |
| Review status | `weekly_reports.status` (`draft`, `submitted`, `under_review`, `needs_revision`, `approved`) | N |
| Submitter | `weekly_reports.submitted_by_id` | N |
| Review history, field changes | `weekly_report_events` (append-only) | N |

### 2.1 Draft, submission and approval

| Item | Source | State |
|---|---|---|
| Draft | `weekly_reports` row with `status = 'draft'`. Created by the first autosave | N |
| Autosave time | `weekly_reports.updated_at`. Autosave changes no status and no submission time | N |
| Submitted report | `weekly_reports` row with `status` other than `draft` | N (query) |
| First submission time | `weekly_reports.first_submitted_at`. Set once at `draft` → `submitted`. Never changed | N |
| Latest submission time | `weekly_reports.last_submitted_at`. Set at each submit and resubmit | N |
| Resubmission count and times | `weekly_report_events` rows with action `resubmit` | N (query) |
| Not submitted (missing report) | Computed: expected group with no row, or with a `draft` row | N (query) |
| Confirmed not held | Submitted report with `held = false`. Counted as submitted, not as missing | N (query) |
| Late mark | Computed: `first_submitted_at > reporting_periods.deadline_at` | N (query) |
| Revision reason (latest) | `weekly_reports.revision_reason` | N |
| Revision reasons (all) | `weekly_report_events.note` where action = `request_revision` | N |
| Supervisor review | `weekly_report_events` row with action `supervisor_reviewed`, actor and time | N |
| Final approver, approval time | `weekly_reports.approved_by_id`, `approved_at`; also an `approve` event | N |
| Current reviewer | Computed from active `group_assignments` and usable accounts (architecture §5.3) | N (query) |
| Blocked | Computed: submitted, not approved report whose body has no body leader with a usable account | N (query) |
| Usable account | `members.user_id` set, `users.status = 'active'`, `users.pin_hash` not null | E (query) |

Difference between the two submission times:

| | `first_submitted_at` | `last_submitted_at` |
|---|---|---|
| Set when | The first submit | Every submit and resubmit |
| Changes after a revision | No | Yes |
| Used for | Late mark; "submitted on time" counts | "Updated after review" display; order of the review queue |
| Value while `draft` | Null | Null |

### 2.2 Report content

| Brief item | Source | State |
|---|---|---|
| Activity date, location | `weekly_reports.activity_date`, `place_label` (prefilled from the group) | N |
| Activity type | Existing `MISSION_ACTIVITY_TYPES` values, when the report is published as an activity | E |
| Teaching topic, passage, prayer, fellowship, other, atmosphere | `weekly_reports` text columns | N |
| Photos | `media_assets` (`mission_photo`, `group_id`) | E |
| Next-week plan, support needed, other information | `weekly_reports` text columns | N |
| Follow-up needs | `follow_ups` rows linked to the group or person | E + I |
| Story for the Feed | `mission_activities` through `weekly_reports.activity_id` | E |
| Raw LINE or manual messages for staff | `mission_submissions` (unchanged, separate workflow) | E |
| Body summary | `body_summaries` | N |
| Meeting brief snapshot and timestamp | `meeting_briefs` | N |

## 3. Members and attendance

| Brief item | Source | State |
|---|---|---|
| Member identity | `members` | E |
| Current group | `group_members` active row (`members.group` is legacy text) | E |
| Membership status | `members.membership_status` | E |
| Attendance record | `attendance_records` (`member_id`, `group_id`, `date`, `service_type = 'care_group'`, `status`) | E |
| Present, absent, leave, online | `ATTENDANCE_STATUSES` | E |
| No duplicate attendance | Code check only | I — unique index after a production audit |
| Service day | `date` timestamp, day window in server time | I — Asia/Bangkok day |
| Regular members present and absent in a report | Computed from `attendance_records` for the group and activity date | E (query) |
| Total attendance | Computed | E (query) |
| First participation date | First `attendance_records.date` of the person; for visitors `newcomer_tracks.first_visit_on` | E / N |
| Last attendance date | Latest `present` or `online` record | E (query) |
| Consecutive absence | `/api/attendance/absentees`, care roster | E |
| Group transfer history | `group_members.joined_at`, `left_at`; full unique index blocks rejoin | I — pending plan Q8 |

## 4. Newcomers

| Brief item | Source | State |
|---|---|---|
| Visitor identity | `members` row, `membership_status = 'visitor'`, `consent_given = false` | E |
| First participation date, first group | `newcomer_tracks.first_visit_on`, `first_group_id` | N |
| Welcoming person, follow-up owner | `newcomer_tracks.welcomed_by_member_id`, `owner_member_id` | N |
| Newcomer status | `newcomer_tracks.status` | N |
| Subsequent attendance | `attendance_records` | E |
| Contact history, result, next date | `follow_ups` + `follow_up_events`; `newcomer_tracks.next_follow_up_on` | I / N |
| Returning visitor | Visitor present in a period after the first-visit period | N (query) |
| Consent for membership | `members.consent_given`, `consent_date` | E |

## 5. Follow-up and action tracking

| Brief item | Source | State |
|---|---|---|
| Description | `follow_ups.title`, `note` | E |
| Related person or group | `follow_ups.subject_member_id`, `subject_group_id` | E |
| Owner | `follow_ups.owner_id` | E |
| Due date, status, completion date | `follow_ups.due_at`, `status`, `completed_at` | E |
| Issue type | `follow_ups.kind` | N (column) |
| Priority | `follow_ups.priority` | N (column) |
| Result | `follow_ups.result` | N (column) |
| Action history | `follow_up_events` | N |
| No duplicate automatic items | `follow_ups.source_key`, partial unique index | N (column) |
| Legacy two-state flag | `members.status` (`ติดตามแล้ว`, `ต้องติดตาม`) — not migrated; still gated by `PUNTAKIT_IMPLEMENTATION_PLAN.md` Phase 4 | E, untouched |

## 6. Identity, LINE, notifications

| Brief item | Source | State |
|---|---|---|
| Account | `users` (PIN), `user_sessions` | E |
| Person ↔ account | `members.user_id` | E |
| LINE display id | `members.line_id` (free text, unverified) | E, display only |
| Verified LINE identity | `line_accounts.line_user_id` | N (Phase 5) |
| Web Push | `push_subscriptions` | E |
| Sent-message log | `notification_log` | N (Phase 5) |
| Audit trail | `audit_logs` | E |

## 7. Data that must be checked in production before design is final

1. Count of `groups` rows per `org_level` and the number of `care` rows per body (O1). A count does not answer O1 alone; the church must confirm that each row is one house mission group.
2. Duplicate `attendance_records` for the same member, service type, group and Bangkok day.
3. The existing pre-check `GET /api/import/precheck/group-members` (read-only, admin).
4. Number of group leaders, care leaders, coordinators and body leaders that have a `members` row and a usable account. This shows how many groups use the supervisor fallback and how many bodies start as blocked.

All four are read-only. None was run for this document or for revision 2.
