# FaithMap — Implementation Roadmap

Date: 2026-11-13 · Status: proposed. No phase after Phase 0 has started.

## 1. Rules for every phase

1. One phase = one or more small pull requests. Phases are not combined in one pull request.
2. Workflow per feature: `/grill <slug>` → `/spec <slug>` → `/tickets <slug>` → the owner sets `Status: approved` on a ticket in `TICKETS.md` → `/implement` → `/test` → `/review`.
3. Gate for every change: `pnpm check`, `pnpm test`, `pnpm build` pass in CI.
4. A migration is written only after its schema is reviewed in the spec. Migrations are additive.
5. A change to existing data or a unique index needs a read-only production check first, and approval.
6. A new permission needs approval and tests inside and outside scope.
7. No merge and no deploy without explicit approval.
8. Each report of results states the level: code verified, test verified, preview verified or production verified.

## 2. Phases

### Phase 0 — System audit · done (code verified)

Output: `FAITHMAP_PHASE0_SYSTEM_AUDIT.md`, this document set.
Open before Phase 1: decisions O1, O2, O5, O10 and the four read-only production checks in `FAITHMAP_DATA_MAPPING.md` §7.

### Phase 1 — Organizational foundation

Scope: `group_assignments`; responsibility panel on group and body pages; supervisor profile; assignment history; "groups without a supervisor" list; audit rows with before and after values; wording fix (care leader is a person).
Feature slug: `mission-assignments`.

Acceptance criteria:
- A group shows its group leader, primary supervisor and additional supervisors with name and photo.
- A change of supervisor keeps the old assignment with its end date.
- One person can hold assignments on several groups with one identity record.
- A group can have only a body leader as supervisor, with no care leader and no coordinator.
- The list of active groups without a responsible person is correct.
- A body move is recorded with old and new body.

Regression tests: existing group, care and org route tests stay green; assignment scope tests; ended assignment gives no access; one active primary per group.
Does not include: any report workflow, any change to `groups.leader_id` behaviour.

### Phase 2 — Weekly reporting

Scope: `reporting_periods`, `weekly_reports`, `weekly_report_events`, `body_summaries`; mobile report flow (attendance → what happened → send); review queue; body approval; late mark; attendance day boundary and uniqueness (after the production check); scheduler for period opening and Web Push reminders.
Feature slugs: `weekly-report`, `report-review`, `attendance-integrity`.

Acceptance criteria:
- A group leader submits a report in three steps without typing group, date or member names.
- The same group and week never has two reports. A double tap is safe.
- "ยังไม่ส่ง" and "ยืนยันว่าไม่ได้จัด" are separate in every list and count.
- A report after the deadline is accepted and marked late.
- The assigned supervisor sees only assigned groups. A group without a supervisor goes to the body leader.
- Request for revision returns the report to the group leader with a note. Each step is in the history with actor and time.
- Two concurrent attendance saves for one member and day create one record.

Regression tests: the permission cases in `FAITHMAP_PERMISSION_MATRIX.md` §2.4; `/care` attendance tests; absentee tests; submissions (Inbox) tests unchanged.

### Phase 3 — Mission overview

Scope: scoped overview endpoint; `/mission` page with four sections; body page; drill-down; `meeting_briefs` snapshot and printable brief.
Feature slugs: `mission-overview`, `meeting-brief`.

Acceptance criteria:
- Leadership sees all bodies on one page. Each number shows its period.
- A body leader sees only the own body.
- A missing report is shown as unknown and is excluded from attendance totals.
- Path Organization → Body → Group → Report works in both directions.
- A stored brief does not change when a late report arrives. The brief shows generation time and data scope.

Regression tests: totals against fixture data; snapshot immutability; cross-body access denied; existing `/` dashboard tests unchanged.

### Phase 4 — Member care

Scope: `follow_ups` columns and `follow_up_events`; `newcomer_tracks`; automatic attention items (absence of 2 weeks, newcomer not returned, missing report); `group_members` history index (after the existing pre-check).
Feature slugs: `follow-up-tracking`, `newcomer-care`, `absence-attention`.

Acceptance criteria:
- A member absent 2 consecutive recorded weeks produces exactly one open item with an owner.
- A week without recorded attendance does not count as absence.
- A first-time visitor who does not return the next week produces one item.
- An item cannot be completed without a result. Its history shows every change.
- A visitor does not appear in the default member register and has no account.
- No screen labels a person inactive or gives a reason that was not recorded.

Regression tests: idempotent job runs; scope tests for newcomer data; follow-up route tests; membership tests.

### Phase 5 — LINE and LIFF

Scope: `line_accounts`; server-side ID-token verification; link and unlink flow; LIFF entry to the Phase 2 report flow; LINE reminders and status messages with a sent log; CSP update.
Feature slugs: `line-linking`, `liff-report`, `line-notify`.
Prerequisite outside the repo: a LINE Official Account, a LINE Login channel and a LIFF app owned by the church.

Acceptance criteria:
- A forged or foreign-channel ID token is rejected.
- A LINE account links to one user only, after sign-in and confirmation.
- A group leader opens the report from a LINE message and submits it.
- A reminder is sent once per person, event and period.

Regression tests: token verification with fixtures; all Phase 2 tests through the LIFF route; no secret in the client bundle.

## 3. Order and dependencies

```
O1, O2 ─► Phase 1 ─► Phase 2 ─► Phase 3
                        │           
                        └────────► Phase 4 ─► Phase 5
```

Phase 3 and Phase 4 both need Phase 2. Phase 5 needs Phase 2 and can start after it, but its value is higher after Phase 4.

## 4. Approval gates

| Gate | Needed before | Approver |
|---|---|---|
| G0 Decisions O1, O2, O5, O10 | Phase 1 grill | Church + owner |
| G1 Schema of `group_assignments` | First Phase 1 migration | Owner |
| G2 New scoped permissions (review, approve, manage assignments) | Phase 1 and 2 implementation | Church + owner |
| G3 Decisions O3, O4, O8, O9 | Phase 2 spec | Church + owner |
| G4 Production duplicate check for attendance | Unique index migration | Owner |
| G5 Navigation change | Phase 3 UI | Owner |
| G6 Decision O7; `group_members` pre-check | Phase 4 | Owner |
| G7 LINE channel ownership and CSP hosts | Phase 5 | Church + owner |
| Every merge and deploy | — | Owner |

## 5. Not planned

A third org level, new `USER_ROLES` values, changes to `mission_submissions`, a second attendance store, a replacement frontend, automatic member accounts for visitors.
