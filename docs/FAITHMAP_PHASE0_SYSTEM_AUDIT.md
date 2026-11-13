# FaithMap — Phase 0 System Audit

Date: 2026-11-13
Scope: FaithMap System Blueprint §12 Phase 0 (System Audit, Data Mapping, Permission Matrix, Implementation Decision Record).
Status: Audit complete. All decisions in §5 are **proposed**. No code, migration or permission change is part of this document.

Method: static reading of `shared/schema.ts`, `shared/roles.ts`, `server/lib/{groupAccess,careScope,membershipScope,audit}.ts` and `server/routes/*.ts` on branch `claude/magical-cerf-lkrjyt`. I did not run the app, read production data or test a LINE account.

---

## 1. Findings summary

| # | Finding | Effect on blueprint |
|---|---|---|
| F1 | The org tree has **two** levels: `groups.org_level` is `body` or `care` (`GROUP_ORG_LEVELS`). In the UI, `care` is called **พันธกิจ**. | The blueprint has three levels: บอดี้ → แคร์ → กลุ่มพันธกิจบ้าน. The repo has no separate "แคร์" level above the house group. See D1. |
| F2 | There is no `care_leader` or `body_leader` role. Both are `group_leader`. Scope comes from leadership: `groups.leader_id`, `groups.co_leader_id`, or an active `group_members` row with role `leader`/`assistant_leader` (`server/lib/groupAccess.ts`). | Body/care leader separation exists only as data, not as roles. This matches the blueprint guardrail "do not add roles without review". |
| F3 | Read scope includes descendants (`getViewableGroupIds`). Write scope is direct groups only (`getLedGroupIds`). | A body leader can read care groups below the body but cannot write. This matches the blueprint review ladder for reading. |
| F4 | `mission_submissions` has **no `group_id`**, no week/period field and no `not_held` state. Statuses: `new, reviewing, needs_info, approved, rejected`. Sources: `manual, line, import, system`. | Confirms the blueprint note. A weekly report cannot be linked to a group or to a week today. |
| F5 | Submission review (`PUT /:id/status`, `POST /:id/publish`) is limited to `PRIVILEGED_ROLES` (`super_admin, admin, staff, ministry_leader`). `group_leader` can only create, and reopen its own rejected item. | A care leader cannot review reports today. The 4-step review ladder (§4.2) needs a permission change. See D4. |
| F6 | There is no weekly report round entity (no "week", "cycle" or "deadline" table). | `not_submitted` cannot be computed. "Not submitted" is the absence of a row for (group, week). See D2. |
| F7 | `attendance_records` has `group_id`, `service_type` (`care_group` exists), `status` (`present, absent, leave, online`), `check_in_method`. Duplicate protection is in code only (same member + service type + day [+ group]). There is **no unique index**. | Reusable for weekly attendance. Concurrent submissions can write duplicate rows. See D7. |
| F8 | `GET /api/attendance/absentees?threshold=N` returns consecutive absentees over the last N recorded dates. It is scoped for `group_leader`. | Module D rule "absent 2 weeks" can reuse this endpoint. No new table needed. |
| F9 | Visitors are stored in `members` with `membership_status = 'visitor'`. `members.consent_given` and `consent_date` exist. | The blueprint requires visitor data to stay separate from the member registry until consent. Current design contradicts this. See D5. |
| F10 | `follow_ups` exists: `title, note, subject_member_id, subject_group_id, activity_id, owner_id, due_at, status (open, in_progress, completed, cancelled), completed_at`. No result field and no per-row history table. | Module F is mostly covered. "Result" and "history" are missing. See D6. |
| F11 | History: `audit_logs` stores `action`, `entity_type`, `entity_id` and `details`. `UPDATE_GROUP` stores only the **sent (new)** values, not the previous values. `group_members` has `joined_at`/`left_at`, but a unique index on (`group_id`, `member_id`) means a re-join reuses one row. | Leader changes, parent (body) moves and member transfers cannot be reconstructed reliably. Blueprint §3 "keep history" is not met. See D3. |
| F12 | LINE: no adapter, no LINE Login, no LIFF, no ID token verification. `members.line_id` is a free-text field. `mission_submissions.source = 'line'` is reserved only. | Phase 5 is greenfield. Blueprint rule "verify LINE ID token on server" has no existing code to conflict with. |
| F13 | Notifications: `push_subscriptions` and Web Push (`/api/portal/push/subscribe`, `/push/send-test`) exist. No scheduler or cron job exists. | Saturday open / Sunday reminder needs a scheduler. See D8. |
| F14 | Overview data: `GET /api/org/overview` (bodies, care groups, member counts) and `GET /api/dashboard/operations` are limited to `PRIVILEGED_ROLES`. `GET /api/reports/summary` exists. | Mission Overview (§6) can extend these. A `group_leader` cannot open them today. |
| F15 | `media_assets` supports `mission_photo` with `group_id`. `mission_activities` has `group_id`, `occurred_at`, `story`, place and coordinates, plus participants and media tables. | Activity part of the weekly report (date, place, story, photos) can reuse `mission_activities`. |

---

## 2. Data mapping (blueprint → existing schema)

| Blueprint item | Existing source | Status |
|---|---|---|
| Body | `groups` where `org_level = 'body'` | Exists |
| Care (แคร์) | `groups` where `org_level = 'care'` | Exists, but see D1 for the third level |
| House group (กลุ่มพันธกิจบ้าน) | Same as care, or a child of care with `org_level = NULL` | **Undecided (D1)** |
| Group ID, name, meeting day/time, place, coordinates, photos | `groups.id, name, meeting_day, meeting_time, meeting_location, latitude, longitude, avatar_url, cover_url`; `media_assets.kind = 'group_photo'` | Exists |
| Group leader | `groups.leader_id` (user), `groups.leader_member_id` (display only, not a permission) | Exists |
| Coordinator | `groups.co_leader_id` | Exists |
| Mission type | `groups.category` | Exists; values may need review |
| Operational status | `groups.status` (`active, paused, closed`) | Exists |
| Member list | `group_members` | Exists |
| Leader / move history | `audit_logs` (new values only) | **Gap (D3)** |
| Weekly report header (group, week, status, submitter, reviewer, timestamps, late flag) | — | **Gap (D2)** |
| Activity (date, place, story, scripture, photos) | `mission_activities` + `mission_activity_media` | Exists; no scripture field (store in `story` or add a field — D2) |
| Attendance (present/absent) | `attendance_records` with `service_type = 'care_group'` | Exists |
| Newcomer / returning attendee | `members.membership_status = 'visitor'`; no "returning" flag | **Partial (D5)** |
| Consecutive absence | `/api/attendance/absentees` | Exists |
| Follow-up item | `follow_ups` | Exists; no result field (D6) |
| Approval record (who, when) | `mission_submissions.reviewed_by_id, reviewed_at` (one level only) | **Partial (D4)** |
| Audit log | `audit_logs` | Exists; incomplete before-values (D3) |
| LINE identity | `members.line_id` (free text, unverified) | **Gap (Phase 5)** |
| Notifications | `push_subscriptions` (Web Push) | Partial; no scheduler (D8) |

---

## 3. Permission matrix (current state, verified in code)

Legend: ✔ allowed · ◐ allowed within own scope · ✖ denied. "Own scope" for `group_leader`: write = groups led directly; read = groups led plus descendants.

| Action | super_admin / admin | staff | ministry_leader | group_leader | viewer | member |
|---|---|---|---|---|---|---|
| Read directory (groups, members, attendance) | ✔ | ✔ | ✔ | ◐ read | ✔ read-only | ✖ (portal only) |
| Create mission activity / submission / follow-up (`CREATE_ROLES`) | ✔ | ✔ | ✔ | ◐ | ✖ | ✖ |
| Review / approve / publish submission (`PRIVILEGED_ROLES`) | ✔ | ✔ | ✔ | ✖ | ✖ | ✖ |
| Record attendance (`/check-in`, `/bulk`) | ✔ | ✔ | ✔ | ◐ direct groups only | ✖ | ✖ |
| See consecutive absentees | ✔ | ✔ | ✔ | ◐ | ✔ | ✖ |
| Org overview `/api/org/*`, Operations dashboard | ✔ | ✔ | ✔ | ✖ | ✖ | ✖ |
| Unmasked member contacts | ✔ | ✔ | ✖ | ◐ own roster (phone) | ✖ | ✖ |
| Membership decisions (`MEMBERSHIP_DECIDE_ROLES`) | ✔ | ✔ | ✖ | ◐ direct groups only | ✖ | ✖ |
| Manage users and roles | super_admin only | ✖ | ✖ | ✖ | ✖ | ✖ |

### Blueprint role → existing role (proposed mapping, needs confirmation)

| Blueprint role | Proposed existing role | Gap |
|---|---|---|
| ผู้รับผิดชอบกลุ่ม (group leader) | `group_leader`, leads the house group | None for submit. Must not see other groups. |
| หัวหน้าแคร์ (care leader) | `group_leader`, leads the care group | Cannot review submissions today (F5). |
| หัวหน้าบอดี้ (body leader) | `group_leader`, leads the body group | Reads descendants. Cannot review or certify today. |
| หัวหน้าทีม ศบ. (ministry team lead) | `admin` or `staff` | Needs a decision. `ministry_leader` is the ministry-team role and is deliberately kept out of member-level data (`shared/roles.ts`, D32). |
| ผู้ดูแลระบบ (system admin) | `super_admin` | Blueprint: admin must not see all personal data automatically. Today `admin` sees unmasked contacts. Changing that is a separate decision. |

---

## 4. Not verified

- Production data: how many groups exist per level, and whether real house groups sit under care groups. I did not read any database.
- Whether `groups.category` values match the blueprint "mission type".
- Client UI behaviour for each role. I read server code only.
- LINE Official Account, LIFF app and channel settings. None are referenced in this repo.
- Real-time behaviour of concurrent attendance writes (F7 is a code-reading finding, not a reproduced bug).

---

## 5. Implementation Decision Record (proposed — needs approval)

Each decision lists the recommendation first. Nothing is implemented until the decision is approved.

**D1 — Org tree depth.**
Question: Is one แคร์ the same as one กลุ่มพันธกิจบ้าน, or does one แคร์ contain several house groups?
- Option A (recommended if 1:1): keep two levels. A house group is a `care` row. No migration.
- Option B (if 1:N): add a third level as `care` children with a new `org_level` value (for example `house`). Needs a migration and updates to `shared/orgView.ts`, `careScope` and the org overview.
Blocker: needs real church data to answer.

**D2 — Weekly report entity.**
Recommendation: add one table, for example `weekly_reports`, keyed by (`group_id`, `week_start`) with a unique index. Fields: `status` (`submitted, under_review, needs_revision, approved, not_held`), `activity_id` (link to `mission_activities`), `submitted_by_id`, `submitted_at`, `is_late`, `reviewed_by_id`, `reviewed_at`, `review_note`. `not_submitted` is **computed** (no row for that group and week), never stored. This separates "not submitted" from "not held" (blueprint Module B rule).
Alternative: add `group_id` and `week_start` to `mission_submissions`. Not recommended: submissions are a raw inbox for unstructured input, and its status set has a different meaning.

**D3 — Change history.**
Recommendation: change `logAudit` callers for groups and group membership to store both `before` and `after` values. Consider a small `group_assignments` history table (group, parent, leader, valid_from, valid_to) only if the audit log is not sufficient for reports.

**D4 — Review ladder permissions.**
Recommendation: allow a `group_leader` to review a weekly report only for groups in its **read** scope and below its own level (care leader reviews house groups; body leader certifies care summaries). Do not add new roles. Add a set in `shared/roles.ts` and permission tests for every step. This is a permission expansion and needs explicit approval (blueprint §15).

**D5 — Visitors and newcomers.**
Question: Must visitors move out of `members`?
- Option A (recommended): keep `members` with `membership_status = 'visitor'`, hide visitor rows from the member registry by default, and restrict visitor detail to the care scope until `consent_given = true`. No migration.
- Option B: a separate `visitors` table with promotion to `members`. Needs a migration and an import path.

**D6 — Follow-up result and history.**
Recommendation: add a `result` text field to `follow_ups`, and write an audit entry with before/after on each status change. Use `follow_ups` for system-generated items (missing report, absence ≥ 2 weeks). Generation must be idempotent: one open item per (subject, reason, week).

**D7 — Attendance duplicates.**
Recommendation: add a unique index on (`member_id`, `service_type`, `group_id`, service date), after a check for existing duplicates in production data. Needs approval because it touches existing data.

**D8 — Scheduler and notifications.**
Recommendation: decide the runtime first (Vercel Cron calling an authenticated API route, or an external scheduler). Reuse Web Push for in-app reminders. LINE messages wait for Phase 5.

**D9 — หัวหน้าทีม ศบ. role.**
Question: `admin` or `staff`? Recommendation: `staff`, so that the team lead does not get user-management or delete rights.

---

## 6. Proposed next step

1. The church answers D1, D5 and D9 (business questions).
2. The owner approves or changes D2, D3, D4, D6, D7 and D8 (technical decisions).
3. Run the repository feature pipeline for Phase 1–2: `/grill weekly-report` → `/spec` → `/tickets`. Implementation starts only after a ticket is set to `Status: approved` in `TICKETS.md`.
