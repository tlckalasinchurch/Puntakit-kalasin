# FaithMap — Phase 0 System Audit and Gap Analysis

Date: 2026-11-13 (revision 2, same day as revision 1) · Revision 3: 2026-11-14
Input: FaithMap Product Transformation Master Brief; four decisions confirmed in the architecture review of 2026-11-14 (§8.1).
Status: Audit and gap analysis complete. Every proposal is **proposed only**. No revision of this file changed application code, a migration, a permission or data.
Revision 3 adds §8 (decision resolution) and §9 (conflicts between documents), and updates C3, C4, §5, §6 and §7. No new code reading, test run or database read was done for revision 3, except one check of the `users` columns `status` and `pin_hash` in `shared/schema.ts`.

Related documents (one topic each, no duplicated tables):

| Document | Content |
|---|---|
| `FAITHMAP_PRODUCT_REQUIREMENTS.md` | Requirements with IDs and metric definitions |
| `FAITHMAP_TARGET_ARCHITECTURE.md` | Proposed tables, API, scope resolution, UI routes |
| `FAITHMAP_DATA_MAPPING.md` | Brief field → existing or proposed column |
| `FAITHMAP_PERMISSION_MATRIX.md` | Current matrix (verified) and target matrix (proposed) |
| `FAITHMAP_IMPLEMENTATION_ROADMAP.md` | Phases, acceptance criteria, approval gates |
| `FAITHMAP_EXISTING_SYSTEM_AUDIT.md` | Whole-system audit by area; product identity inventory (added 2026-11-14) |
| `FAITHMAP_PRODUCT_TRANSFORMATION.md` | FaithMap as the only product identity; REUSE / EXTEND / MODIFY / REPLACE / NEW / BLOCKED; decisions P1–P9 |
| `FAITHMAP_INTEGRATION_ARCHITECTURE.md` | How existing and new parts form one product |
| `FAITHMAP_MIGRATION_AND_REGRESSION_RISKS.md` | Migration, compatibility, rollback, regression tests, cutover |
| `FAITHMAP_PHASED_IMPLEMENTATION_PLAN.md` | Stages S0–S8 around the roadmap phases |

Product identity: the product is FaithMap. Where this file says "the repo" or names existing code, it means the technical foundation, not a product.

Revision 1 of this file contained a data mapping and a permission matrix. Those sections moved to the documents above. Revision 1 also assumed a Body → Care → Group tree. The brief corrects that (§2).

## 1. Method and limits

Verified by reading code on branch `claude/magical-cerf-lkrjyt`: `shared/schema.ts`, `shared/roles.ts`, `shared/orgView.ts`, `server/lib/{groupAccess,careScope,membershipScope,audit}.ts`, `server/routes/{submissions,attendance,followUps,care,org,dashboard,groups,portal}.ts`, `client/src/App.tsx` (route list), `.github/workflows/ci.yml`, `vercel.json`, and `docs/PUNTAKIT_MISSION_DOMAIN_PLAN.md`.

Level of verification: **code verified** only. Not test verified, not preview verified, not production verified. I did not run the app, run the tests, or read any database.

Not verified:
- Production data: number of bodies and groups, whether each `org_level = 'care'` row is one house mission group, existing duplicate attendance rows, existing `group_members` duplicates.
- Client behaviour per role (I read the route list and the API calls of four pages, not every page).
- Any LINE Official Account, LIFF app or channel configuration. The repo references none.

## 2. Corrected organizational model

Brief: Mission Leadership (หัวหน้าทีม ศบ.) → Body (บอดี้) → House Mission Group (กลุ่มพันธกิจบ้าน). Care (แคร์) is **not** a level. A Care Leader (หัวหน้าแคร์) and a Coordinator (ผู้ประสานงาน) are **people assigned to groups**.

Repo state:
- `groups.org_level` has two values: `body` and `care`. A `care` row has `parent_group_id` → a `body` row. The Thai UI already calls a `care` row "พันธกิจ" (CLAUDE.md, Vocabulary).
- So the repo already stores a two-level tree. The stored value `care` is a legacy label for "house mission group". The tree depth matches the brief.
- The supervising people are **not** modelled. The imported care leader name and coordinator name are text lines inside `groups.description` (`หนค. (ต้นฉบับ)`, `ผู้ประสานงาน (ต้นฉบับ)`, parsed by `shared/orgView.ts`). `groups.leader_member_id` is display only and grants no permission (`server/lib/groupAccess.ts`).

Conclusion: no hierarchy change is needed. The missing part is a **flexible assignment model** (gap C1). Revision 1 decision D1 (third org level) is withdrawn.

## 3. Revalidated findings

| # | Finding (code verified) |
|---|---|
| F1 | Two-level tree as in §2. `GET /api/org/overview` returns head, bodies, groups per body and unassigned groups. |
| F2 | `USER_ROLES`: `super_admin, admin, ministry_leader, group_leader, staff, member, viewer`. No supervisor, care-leader or body-leader role. |
| F3 | A user leads a group through `groups.leader_id`, `groups.co_leader_id`, or an active `group_members` row with role `leader`/`assistant_leader` for the member linked by `members.user_id`. Read scope adds descendant groups. Write scope is direct groups only. |
| F4 | `mission_submissions` has no `group_id`, no period, no "not held" state. It is a raw inbox that publishes into `mission_activities`. `PUNTAKIT_MISSION_DOMAIN_PLAN.md` §9 already decided to leave it untouched and add `weekly_reports` (decision Q12). |
| F5 | Review and publish of submissions: `PRIVILEGED_ROLES` only. A `group_leader` cannot review. |
| F6 | No reporting period, deadline, snapshot or meeting-brief entity exists. |
| F7 | `attendance_records`: statuses `present, absent, leave, online`; duplicate check in code only; no unique index. The same-day window uses `Date.setHours(0,0,0,0)` in server local time. On Vercel the server runs in UTC, so the window is not the Asia/Bangkok day. Not reproduced; code reading only. |
| F8 | `/care` page (`CareToday.tsx`) already does group attendance: `GET /api/care/groups`, `GET /api/care/groups/:id/roster` (members, today's marks, consecutive misses), `POST /api/attendance/bulk`. `GET /api/attendance/absentees` lists consecutive absentees with scope for `group_leader`. |
| F9 | Visitors are `members` rows with `membership_status = 'visitor'`. `consent_given` and `consent_date` exist. No first-visit date, welcomer or newcomer status exists. |
| F10 | `follow_ups` has title, note, subject member/group, activity, owner, due date, status, completed date. It has no issue type, priority, result or history. |
| F11 | `audit_logs` exists. `UPDATE_GROUP` stores only the sent values, not the previous values. `group_members` has a full unique index on (`group_id`, `member_id`), so leave → rejoin reuses one row. The fix (partial unique index, decision Q8) is written at `server/db/pending/0010_group_members_history.sql` and is not applied. Its production pre-check has not been run. |
| F12 | LINE: no adapter, no ID-token verification, no LIFF. `members.line_id` is unverified free text. `vercel.json` Content-Security-Policy does not allow LINE hosts. |
| F13 | Web Push exists (`push_subscriptions`, `/api/portal/push/*`). `vercel.json` has no `crons`. No scheduler exists. |
| F14 | Deployment: Vercel serverless function `api/index.ts` (max 60 s), static client from `dist/public`. CI runs install, `pnpm check`, `pnpm test`, `pnpm build` on every push and pull request. 97 test files exist (47 server, 4 shared, 46 client; counted 2026-11-14. Revision 2 said 55, which was wrong). |
| F15 | Overview and operations endpoints (`/api/org/*`, `/api/dashboard/operations`) are church-wide and limited to `PRIVILEGED_ROLES`. They have no per-body scope. |

## 4. Gap analysis

Priority: P1 = Phase 1, P2 = Phase 2, and so on (see the roadmap).

### A. Existing — reuse without changes

| # | Capability | Where |
|---|---|---|
| A1 | Body → group tree, unassigned-group detection | `groups.org_level`, `parent_group_id`, `/api/org/overview` |
| A2 | Group profile: name, meeting day/time/place, coordinates, status, photos | `groups`, `media_assets` |
| A3 | Group member register | `group_members` |
| A4 | Attendance statuses and bulk group check-in screen | `attendance_records`, `/care`, `/api/attendance/bulk` |
| A5 | Consecutive-absence calculation | `/api/attendance/absentees`, care roster |
| A6 | Mission activity record with participants, photos, place | `mission_activities` and child tables |
| A7 | Private media storage with authorised read | `media_assets`, `/api/media/:id` |
| A8 | PIN sign-in, sessions, CSRF, role middleware | `server/lib/firstPartyAuth.ts`, `server/middleware/auth.ts` |
| A9 | Scope helpers for led and viewable groups | `server/lib/groupAccess.ts`, `careScope.ts` |
| A10 | Group map | `/map` |
| A11 | Audit log table and writer | `audit_logs`, `server/lib/audit.ts` |
| A12 | Web Push subscriptions | `push_subscriptions` |

### B. Improvement required

**B1 — Vocabulary of the org model** · P1
- Business problem: "care" reads as an org level. Leaders will misread screens.
- Existing: stored value `care`; UI text "พันธกิจ"; API names `careGroups`, `/api/care/*`.
- Proposal: keep stored values and API names. Fix documents and UI text only. A rename of the stored value has no user benefit.
- Database: none. API: none. Permission: none.
- UI/UX: labels "กลุ่มพันธกิจบ้าน", "หัวหน้าแคร์" shown as a person, never as a unit.
- Security risk: none.
- Regression tests: `shared/labels.test.ts` updated for any changed label.

**B2 — Group change history** · P1
- Business problem: leader changes and body moves cannot be reconstructed.
- Existing: `UPDATE_GROUP` audit row with new values only.
- Proposal: write `before` and `after` in the audit details for group updates and membership changes. Assignment history comes from C1, not from the audit log.
- Database: none (details is text JSON). API: none. Permission: none. UI/UX: group history list in the group detail.
- Security risk: audit details can contain contact data; keep the existing read gate.
- Regression tests: group update writes both values; body move is recorded.

**B3 — Member transfer history** · P4
- Business problem: a member who leaves and rejoins loses the first period.
- Existing: full unique index; decision Q8; pending SQL not applied.
- Proposal: apply the existing plan. Run the production pre-check first (`GET /api/import/precheck/group-members`).
- Database: index swap in one migration. API: move = leave + join. Permission: none. UI/UX: transfer history in member detail.
- Security risk: low. Data risk: blocked if the pre-check reports duplicates.
- Regression tests: join → leave → rejoin gives two rows; one active row per pair.

**B4 — Attendance uniqueness and day boundary** · P2
- Business problem: duplicate rows and wrong-day matching distort attendance and absence counts.
- Existing: F7.
- Proposal: (1) read-only audit of production duplicates; (2) compute the service day in Asia/Bangkok; (3) add a unique index on member, service type, group and service day after cleanup is approved.
- Database: one new date column or expression index; unique index. API: `check-in` and `bulk` become upserts on the unique key. Permission: none. UI/UX: none.
- Security risk: none. Data risk: cleanup of existing duplicates needs approval.
- Regression tests: concurrent writes produce one row; a 06:00 Bangkok check-in lands on the Bangkok date.

**B5 — Follow-up as action tracking** · P4
- Business problem: an item has no type, priority, result or history, so leadership cannot see whether it was handled.
- Existing: F10.
- Proposal: add `kind`, `priority`, `result`, `source_key` to `follow_ups`; add an append-only `follow_up_events` table.
- Database: additive columns and one table; partial unique index on `source_key` for open items. API: status change writes an event; result required on completion. Permission: unchanged rule, extended by assignments (C1).
- UI/UX: `/follow-up` shows type, priority, history.
- Security risk: absence reasons are sensitive; restrict the note to owner, assigned supervisors and leadership.
- Regression tests: one open item per source key; event row per change; out-of-scope read denied.

**B6 — Visitor and newcomer record** · P4
- Business problem: first-time visitors are not tracked after the first visit.
- Existing: F9. Visitors sit in the member register.
- Proposal: keep visitors in `members` (no duplicate identity table). Add a 1:1 `newcomer_tracks` table for first-visit facts and status. Hide visitors from the default member register. Never create a user account for a visitor.
- Database: one additive table. API: newcomer list within scope. Permission: visible to the group's responsible people and leadership only.
- UI/UX: newcomer list per group and per body.
- Security risk: personal data without consent; store the minimum (name or nickname, optional phone), mask contact data by the existing rule.
- Regression tests: visitor not returned by the default member list; cross-body read denied.

**B7 — Overview scope for body leaders** · P3
- Business problem: a body leader cannot open any overview today.
- Existing: F15.
- Proposal: new overview endpoints take a scope (all bodies for leadership, own body for a body leader). Existing endpoints stay unchanged.
- Database: none. API: new routes. Permission: new scoped read; needs approval.
- UI/UX: body page. Security risk: cross-body leakage; every query filters by resolved scope on the server.
- Regression tests: body leader of body A gets 403 or empty data for body B.

**B8 — Leader identity stored as text** · P1
- Business problem: imported care leaders and coordinators are names in a text field. They cannot be shown with a photo or given scoped access.
- Existing: `groups.description` lines; `leader_member_id` display only.
- Proposal: link each name to a `members` row by human confirmation, then create assignments (C1). Never match by name automatically. Keep the original text lines.
- Database: none beyond C1. API: assignment endpoints. Permission: access exists only when the member has a linked user.
- UI/UX: a "link person" step in group management.
- Security risk: a wrong link gives the wrong person access; require confirmation and audit.
- Regression tests: an assignment whose member has no user grants no access.

**B9 — Admin access to personal data** · decision
- Business problem: the brief limits admin access to "explicit administrative permissions".
- Existing: `admin` and `staff` see unmasked contacts church-wide.
- Proposal: no change in Phases 1–3. A reduction changes existing behaviour and needs its own decision (O6).

### C. New development

**C1 — Flexible supervisor assignments** · P1
- Business problem: the system does not know who supervises each group, so it cannot route a report for review or show responsibility.
- Existing: none (F2, B8).
- Proposal: table `group_assignments` (group, member, responsibility, is_primary, starts_on, ends_on, note, created_by, ended_by). Responsibilities: `group_leader`, `care_leader`, `coordinator`, `body_leader`. A row is never updated to a different person; it is ended and a new row starts.
- Database: one table; partial unique index for one active primary per group. No change to `groups.leader_id` in Phase 1.
- API: list, create, end assignment; supervisor profile (groups supervised, history).
- Permission: manage = mission leadership (definition pending, O5); a body leader for groups in the own body is pending (O10). Assignment adds scoped access only; it never grants global access.
- UI/UX: responsibility panel with names and photos on group and body pages; list "groups without a supervisor".
- Security risk: privilege gain through a wrong assignment; audit every change; end date removes access at once.
- Regression tests: scope from active assignment only; ended assignment gives no access; one primary per group.

**C2 — Reporting periods** · P2
- Business problem: no week exists in data, so "missing" cannot be computed.
- Proposal: table `reporting_periods` (week_start, week_end, opens_at, deadline_at). Created by the scheduler each Saturday, or on first use.
- Database: one table, unique `week_start`. API: current and past periods. Permission: read for all field roles.
- UI/UX: the week label on every report screen and number.
- Security risk: none. Regression tests: one period per week; Bangkok week boundary.

**C3 — Weekly group report** · P2
- Business problem: one reliable report per group per week, with "not held" separate from "not submitted".
- Existing: decision Q12 proposed `weekly_reports`; not built.
- Proposal: table `weekly_reports`, unique (period, group). Fields: `held` (yes/no), `status` (`draft, submitted, under_review, needs_revision, approved`), activity date and place, teaching topic, passage, prayer, fellowship, other activity, atmosphere, next-week plan, support needed, visitor counts, submitter, `first_submitted_at`, `last_submitted_at`, `revision_reason`, `approved_by_id`, `approved_at`. Draft autosave (confirmed, D1): autosave writes a `draft` row and never submits. Late = `first_submitted_at` after the period deadline, computed and never edited. "Not submitted" = expected group with no row or with a `draft` row; no placeholder rows. A report with held = no is a submitted report. Attendance reuses `attendance_records` (the `/care` flow), linked by group and service day. This replaces the `weekly_report_attendance` table of Q12 and needs approval (O3).
- Database: one table; optional `weekly_report_id` on `attendance_records`.
- API: get or autosave my group's report for the period; submit; resubmit after revision. Idempotent on (period, group); a repeated submit changes nothing.
- Permission: submit = active `group_leader` responsibility on that group.
- UI/UX: three large steps on mobile: attendance → what happened → send. Prefilled group, date, place, roster.
- Security risk: submit for a group not led; server checks the assignment. Double tap; unique key makes it safe.
- Regression tests: autosave keeps status `draft`; a draft counts as missing; a repeated submit creates no second report and no second event; `first_submitted_at` does not change at resubmit; late flag from `first_submitted_at`; not-held report has no attendance requirement.

**C4 — Review chain and review history** · P2
- Business problem: reports need a check by the assigned supervisor, then the body leader, with a trace.
- Existing: F5 (wrong roles for this purpose).
- Proposal: table `weekly_report_events`, append-only (report, actor, action, from status, to status, note, changed values before/after). The reviewer is resolved from active assignments: primary supervisor with a usable account first, then another supervisor with a usable account. Supervisor fallback (confirmed, D3): if none exists, the report goes to the body leader automatically. The body leader is the final approver (confirmed, D2); body leader approval is the "approved" state. If the body has no body leader with a usable account, the report is blocked and the administrators are notified; nobody approves in place of the body leader (confirmed, D5). Mission leadership does not approve (confirmed, D6).
- Database: one table. API: review, request revision, approve.
- Permission: **new scoped permission**: review within assigned groups; approve within own body. Needs explicit approval. No change to `PRIVILEGED_ROLES`.
- UI/UX: review queue per reviewer; revision note shown to the submitter.
- Security risk: review outside scope; approval by a role without a body leader assignment; self-review (O4, pending).
- Regression tests: one test per actor and action, inside and outside scope; the cases in `FAITHMAP_PERMISSION_MATRIX.md` §2.4.

**C5 — Body summary** · P2
- Business problem: the body leader sends one consolidated summary to leadership.
- Proposal: table `body_summaries`, unique (period, body): issues, support needed, note, `sent_at`, `sent_by`. Counts are computed, never typed.
- Database: one table. API: read computed summary, save notes, send. Permission: body leader of that body.
- UI/UX: one page per body per week. Security risk: cross-body read.
- Regression tests: counts equal the submitted report rows (drafts excluded); body B leader cannot read body A.

**C6 — Meeting brief snapshot** · P3
- Business problem: the Sunday-evening brief must not change when late reports arrive.
- Proposal: table `meeting_briefs` (period, generated_at, generated_by, frozen JSON payload). Late reports show in the live view with a "late" mark. A new brief is a new row; old rows are never changed.
- Database: one table. API: generate, list, read. Permission: leadership roles.
- UI/UX: printable brief with the ten sections of the brief, timestamp and data scope.
- Security risk: the payload holds names of people who need care; same gate as the live view.
- Regression tests: a late report does not alter a stored brief; the brief can be rebuilt from recorded data as of its timestamp.

**C7 — Mission Overview page** · P3
- Business problem: leadership needs one page for "what is happening this week".
- Existing: `/` Operations dashboard and `/org` chart cover parts.
- Proposal: a new overview composed from C2–C6, with the four sections of the brief. A missing report counts as "unknown", never as zero.
- Database: none. API: scoped overview endpoint. Permission: B7.
- UI/UX: summary numbers with period label, body cards with leader photo, attention list, weekly summary. Drill-down Organization → Body → Group → Report.
- Security risk: B7. Regression tests: totals exclude missing reports from attendance averages.

**C8 — Automatic attention items** · P4
- Business problem: absence ≥ 2 weeks, a newcomer who does not return, a missing report must become an owned task.
- Proposal: a job creates `follow_ups` rows with `kind` and `source_key` (B5). Owner = primary supervisor, else body leader. One week absent is display only. No status label is put on the person.
- Database: B5. API: none new. Permission: none new.
- UI/UX: items appear in the attention list. Security risk: sensitive inference; wording stays factual ("ขาด 2 สัปดาห์ติดต่อกัน").
- Regression tests: idempotent run; no item when attendance was not recorded for the group (unknown is not absent).

**C9 — Scheduler** · P2
- Business problem: Saturday opening, Sunday reminders and the deadline need a clock.
- Proposal: Vercel Cron → authenticated `POST /api/cron/*` routes (secret header). Jobs are idempotent.
- Database: none. API: cron routes. Permission: secret only, no user session.
- Security risk: public endpoint; reject without the secret; no data in the response.
- Regression tests: missing secret → 401; double run → no duplicates.

**C10 — LINE account linking** · P5
- Business problem: reminders and LIFF need a verified LINE identity.
- Proposal: table `line_accounts` (user, LINE user id unique, linked_at). The server verifies the LIFF ID token with LINE and checks the channel id. Linking requires an existing signed-in session (PIN) and a confirmation step. `members.line_id` stays a display field.
- Database: one table. API: link, unlink, token exchange for a session.
- Permission: a user links only the own account.
- Security risk: account takeover through a forged id; never accept a LINE user id from the client.
- Regression tests: forged token rejected; wrong channel rejected; second user cannot claim a linked id.

**C11 — LIFF screens** · P5
- Proposal: routes inside the existing SPA that reuse C3 screens. No second frontend.
- Database: none. API: none new. Permission: same as web.
- Security risk: CSP in `vercel.json` must allow the LIFF SDK and LINE API hosts; review each added host.
- Regression tests: build passes; LIFF route without a session shows the link flow.

**C12 — LINE notifications** · P5
- Proposal: Messaging API push from the scheduler: period opened, report missing, revision requested, approved. A sent-log table prevents repeats. A notification never closes a task.
- Database: one sent-log table. API: none public. Security risk: channel token in server environment only; no personal data of other people in a message.
- Regression tests: one message per (user, event, period).

## 5. Outstanding decisions

A recommendation in this table is not a decision. The status of each item is in §8. Revision 3 added O11–O13 and changed the rows O4, O5, O8 and O10.

| # | Decision | Recommendation | Owner |
|---|---|---|---|
| O1 | Is each `org_level = 'care'` row exactly one house mission group in production data? | Confirm by a read-only count and a review with the church. All later phases depend on this. | Church + owner |
| O2 | Assignee identity: `members` row (recommended) or `users` row? | `members`. Many supervisors have no account; access applies only when a user is linked. | Owner |
| O3 | Attendance for the weekly report: reuse `attendance_records` (recommended) or the separate table of decision Q12? | Reuse. One attendance store; `/care` and absence logic keep working. | Owner |
| O4 | May a person review or approve the own submitted report? This includes a body leader who is also the leader of a group. | Pending. With "no", a report submitted by the body leader has no approver and is blocked. | Church |
| O5 | How does a person become mission leadership: the `staff` role as a whole, or a separate permission for named persons? | Pending. No answer is assumed. Revision 2 recommended `staff`; that recommendation is not a decision, and the documents do not treat every `staff` account as mission leadership. | Church |
| O6 | Reduce `admin`/`staff` access to personal data? | Separate decision after Phase 3. | Church |
| O7 | Visitors: keep in `members` plus `newcomer_tracks` (recommended) or a separate visitor table? | Keep in `members`. | Owner |
| O8 | Deadline: the day (Sunday) and the time zone (Asia/Bangkok) are confirmed (D4). Pending: the time of day, and the week start day. | Needs the church's meeting time. No time is assumed. | Church |
| O9 | Scheduler runtime | Vercel Cron. | Owner |
| O10 | May a body leader manage assignments in the own body? | Pending. Revision 2 recommended "own body only"; not confirmed. | Church |
| O11 | Store the expected groups of each period (`reporting_period_groups`), so that a later change of group status or body does not change past periods? | Proposed in `FAITHMAP_TARGET_ARCHITECTURE.md` §4.2.1. Pending. | Owner |
| O12 | Can the body leader approve before the assigned supervisor has reviewed? | Pending. The data model supports both answers. | Church |
| O13 | Who receives the notice of a blocked report: system administrators only, or also mission leadership? | Pending. | Church |

## 6. Implementation risks

| Risk | Effect | Control |
|---|---|---|
| O1 answered wrongly | Reports attach to the wrong unit | Resolve O1 before any Phase 1 ticket |
| Scope logic spread over three helper files | A new route forgets a scope check | One resolver for assignment scope; permission test per route |
| New scoped permissions | Unintended access | Approval gate per permission; tests inside and outside scope |
| Unique index on existing attendance data | Migration fails or needs cleanup | Read-only production audit first |
| Supervisors without usable accounts | Assignment exists but nobody can review | Show "no account" on the assignment; supervisor fallback to the body leader (confirmed) |
| Body leader without a usable account | Reports of the whole body cannot be approved | Blocked state and administrator notice (confirmed); production check 4 in `FAITHMAP_DATA_MAPPING.md` §7 before Phase 2 |
| Draft counted as submitted | Missing reports are hidden from leadership | One definition of "submitted" (status other than `draft`) in every query; test |
| Current group state used for past periods | Past counts change after a group is paused or moved | Period snapshot (O11) |
| Day boundary in UTC | Attendance on the wrong day | Fix before weekly reports depend on dates |
| Serverless limit (60 s) | Long cron job fails | Small idempotent jobs |
| LINE hosts in CSP | Wider script surface | Add exact hosts only, in Phase 5 |
| Two workflows for field input (`mission_submissions` and weekly reports) | User confusion | Weekly report is the only path for group leaders; Inbox stays for staff |

## 7. Approval request

Approve, change or reject: (1) the corrected model in §2, (2) the proposed tables in `FAITHMAP_TARGET_ARCHITECTURE.md`, (3) the target permissions in `FAITHMAP_PERMISSION_MATRIX.md`, (4) the pending decisions in §8.2. After approval, work starts with `/grill` for Phase 1. Implementation of a ticket starts only when its marker in `TICKETS.md` is `Status: approved`.

## 8. Decision resolution (revision 3)

### 8.1 Confirmed decisions

Source: the owner's statement of 2026-11-14 after the architecture review. D0 comes from the master brief.

| # | Decision | Applied in |
|---|---|---|
| D0 | Care is not an org level. Care leader and coordinator are people assigned to groups. | §2; all documents |
| D1 | Draft uses autosave. An autosaved draft is not a submitted report. | Requirements R3.9–R3.12; architecture §4.3; data mapping §2.1 |
| D2 | The body leader is the final approver. | Requirements R7.6; architecture §5.3; permission matrix §2.2, rule 8 |
| D3 | Supervisor fallback: with no supervisor that has a usable account and permission, the report goes to the body leader automatically. | Requirements R7.3; architecture §5.3; permission matrix rule 1 |
| D4 | The deadline is on Sunday, Asia/Bangkok time zone. | Requirements R3.2; architecture §4.2 |
| D5 | If the body leader has no usable account, the report is blocked and the administrators are notified. No step is skipped and nobody approves in place of the body leader. | Requirements R7.7; architecture §5.3; permission matrix rule 9 |
| D6 | Mission leadership sees the overview and tracks the situation. It is not a final approver by default. | Requirements §3, R7.2; permission matrix §2.2 |
| D7 | Roles in the report flow: group leader writes and submits; supervisor reviews and requests revision; body leader reviews, requests revision and approves. | Permission matrix §2.2 |

### 8.2 Pending decisions

No answer is assumed for any row.

| # | Open point | Effect while open | Blocks |
|---|---|---|---|
| O1 | Is each `org_level = 'care'` row one house mission group in production? Not checked. | Assignments and reports can attach to the wrong unit. | Phase 1 |
| O2 | Is `members` the identity for assignments? | The key column of `group_assignments` cannot be fixed. | Phase 1 |
| O5 | `staff` as mission leadership, or a separate permission? | The leadership scope and the "manage assignments" permission cannot be specified. | Phase 1 |
| O10 | May a body leader manage assignments in the own body? | The guard of the assignment routes cannot be specified. | Phase 1 |
| O8 | Deadline time on Sunday; week start day. | `deadline_at`, the late mark and the reminder times have no value. | Phase 2 |
| O3 | Reuse `attendance_records` for the weekly report, or the separate table of Q12? | Attendance step of the report cannot be specified. | Phase 2 |
| O4 | Self-review and self-approval. | A report submitted by a body leader can be blocked. | Phase 2 |
| O9 | Scheduler runtime. | Period opening and reminders have no clock. | Phase 2 |
| O11 | Period snapshot of expected groups. | Past-period counts follow the current group state. | Phase 2 |
| O12 | Body leader approval before supervisor review. | The approve guard cannot be specified. | Phase 2 |
| O13 | Recipients of the blocked notice. | The notice has no recipient list. | Phase 2 |
| O6 | Reduce `admin` and `staff` access to personal data. | Current church-wide access stays. | After Phase 3 |
| O7 | Visitors in `members` plus `newcomer_tracks`, or a separate table. | Newcomer schema cannot be specified. | Phase 4 |

### 8.3 Unverified findings

| Finding | Level today | Check needed |
|---|---|---|
| Each `care` row is one house mission group (O1) | Not verified | Read-only count per `org_level` and body, and confirmation by the church |
| Attendance day window uses UTC on Vercel (F7) | Code reading only; not reproduced | A test with an Asia/Bangkok morning time |
| Duplicate `attendance_records` rows exist or not | Not verified | Read-only production query |
| Duplicate `group_members` pairs exist or not | Not verified | `GET /api/import/precheck/group-members` (read-only, admin) |
| How many group leaders, supervisors and body leaders have a usable account | Not verified | Read-only production query |
| Client behaviour for each role | Partly read (route list and four pages) | Run the app with each role |
| LINE Official Account, LINE Login channel, LIFF app | No reference in the repo | Confirmation by the church |
| Test suite passes on this branch | Not run in this work | CI result, or `pnpm check`, `pnpm test`, `pnpm build` |

No production system was read for any revision of this document.

### 8.4 Implementation blockers

| Blocker | Blocks | Removed by |
|---|---|---|
| O1, O2, O5, O10 pending | `/grill mission-assignments` (Phase 1) | Decisions by the church and the owner |
| Production checks 1 and 4 not run (`FAITHMAP_DATA_MAPPING.md` §7) | Phase 1 design of data linking | An admin runs the read-only checks |
| Proposed tables and target permissions not approved (§7) | Any migration; any permission change | Owner approval |
| No ticket has `Status: approved` | Any implementation | The owner sets the marker in `TICKETS.md` |
| Deadline time not set (O8) | Phase 2 spec | Decision by the church |
| O3, O4, O9, O11, O12, O13 pending | Phase 2 spec | Decisions |
| Attendance duplicate check not run | Unique index migration (Phase 2) | Read-only production query |
| Body leaders without a usable account (number unknown) | Approval in those bodies after Phase 2 goes live | Accounts and assignments created by an administrator |

## 9. Conflicts between documents found in revision 3

| # | Conflict | Resolution |
|---|---|---|
| K1 | The architecture API had "save a draft", but no document had a `draft` status. | `draft` added to the status list in all documents. |
| K2 | "Submitted" and "missing" were defined by the existence of a report row. A draft row would count as submitted. | Submitted = status other than `draft`. Missing = no row or a `draft` row. |
| K3 | One column `submitted_at` served the late mark and the latest submission. A resubmission would change the late mark. | `first_submitted_at` and `last_submitted_at`. Late uses the first. |
| K4 | The permission matrix gave mission leadership "review" and "approve"; the resolver gave it `all`; R7.2 ended with "mission leadership reviews". This conflicts with D2 and D6. | Leadership has view only. Approval is for the body leader. |
| K5 | Permission matrix §2.1 and O5 named `staff` as mission leadership. | O5 is pending. No document assumes `staff`. |
| K6 | The fallback rule checked for an assigned supervisor only. Matrix rule 3 said an assignment without an account gives no access. A report could wait for a person who cannot sign in. | Routing uses supervisors with a usable account. |
| K7 | No document covered a body without a usable body leader. | Blocked state, D5. |
| K8 | Approver and approval time existed only in the event history; the data mapping listed them as report data. | `approved_by_id`, `approved_at` on the report, and an `approve` event. |
| K9 | The revision note existed only as an event note. | `revision_reason` on the report; history stays in events. |
| K10 | "Expected groups" was computed from current group rows, while R7.5 requires stable history. | Period snapshot proposed (O11, pending). |
| K11 | The matrix showed O10 as an allowed permission for the body leader, while O10 was open. | The cell shows "pending (O10)". |
| K12 | O8 mixed a confirmed part (Sunday) and open parts. | O8 split: day and time zone confirmed; time and week start pending. |
