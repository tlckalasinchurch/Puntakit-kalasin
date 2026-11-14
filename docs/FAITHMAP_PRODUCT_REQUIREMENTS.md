# FaithMap — Product Requirements

Date: 2026-11-13 · Revision 2: 2026-11-14 · Status: proposed, needs approval. Nothing in this document is implemented.
Source: FaithMap Product Transformation Master Brief, and the four decisions confirmed in the architecture review of 2026-11-14 (`FAITHMAP_PHASE0_SYSTEM_AUDIT.md` §8).
Evidence and gaps: `FAITHMAP_PHASE0_SYSTEM_AUDIT.md`.

## 1. Purpose

Leadership must know the real state of every house mission group: who is responsible, what happened this week, who needs care, and which task has which owner. The product is **FaithMap** (ระบบบริหารพันธกิจบ้านและรายงานพันธกิจ). FaithMap is the only product name; it is not a module of another product. It is built on the existing repository, database and website as its technical foundation, plus LINE and LIFF later. It is not a second website and not a chat system. See `FAITHMAP_PRODUCT_TRANSFORMATION.md` §1.

## 2. Terms

| Term | Thai | Meaning |
|---|---|---|
| Body | บอดี้ | Organizational unit that contains house mission groups |
| House mission group ("group") | กลุ่มพันธกิจบ้าน | The unit that meets weekly. Stored as `groups.org_level = 'care'` |
| Group leader | ผู้รับผิดชอบกลุ่ม | Person who runs the group and submits the report |
| Care leader | หัวหน้าแคร์ | A **person** assigned to supervise one or more groups. Not a unit |
| Coordinator | ผู้ประสานงาน | A person assigned to help supervise selected groups |
| Body leader | หัวหน้าบอดี้ | Person responsible for all groups in one body |
| Mission leadership | หัวหน้าทีม ศบ. | Person or team that sees all bodies |
| Assignment | การมอบหมาย | A dated link between a person, a group and a responsibility |
| Primary supervisor | ผู้ดูแลหลัก | The one active assignment that reviews a group's report first |
| Reporting period | รอบรายงาน | One week with a start, an end and a deadline |
| Draft | ฉบับร่าง | A report that the group leader has started and not sent. A draft is not a submitted report |
| Submitted report | รายงานที่ส่งแล้ว | A report that the group leader sent with the send action. Its status is not `draft` |
| Usable account | บัญชีที่ใช้งานได้ | The person has a linked user account that is active and can sign in (see `FAITHMAP_TARGET_ARCHITECTURE.md` §5.1) |
| Blocked | ติดขัด | A submitted report whose body has no body leader with a usable account. Nobody can give the final approval |

## 3. Users and main tasks

| User | Device | Main tasks |
|---|---|---|
| Group leader (often elderly, low digital skill) | Phone, LINE | Check attendance; write the weekly report (saved automatically as a draft); submit it; see the report status |
| Assigned supervisor | Phone or desktop | Review reports of assigned groups; request revision; coordinate follow-up |
| Body leader | Desktop or phone | See all groups in the body; review reports; request revision; give the final approval; send the body summary |
| Mission leadership | Desktop | See all bodies; read the meeting brief; track open issues. Mission leadership does not approve reports |
| System administrator | Desktop | Accounts, PINs, configuration |

## 4. Functional requirements

### Module 1 — Mission Directory
- R1.1 Each group has: id, name, body, location, address, coordinates, meeting day and time, status, photos, members.
- R1.2 Each group shows its responsible people: group leader, primary supervisor, additional supervisors, coordinator, each with name and photo.
- R1.3 An active group has at least one responsible person. The system lists every active group that has none.
- R1.4 A person can hold several assignments. One person has one identity record.
- R1.5 An assignment has a responsibility, start date, end date and history. A change ends the old assignment and starts a new one. History is never overwritten.
- R1.6 A group can move to another body. The move is recorded with date and actor.
- R1.7 A supervisor profile shows name, photo, responsibility, body, supervised groups, active state and assignment history.
- R1.8 The directory shows newly started groups and inactive groups.

### Module 2 — Mission Operations
- R2.1 A weekly activity records: date, location, responsible person, activity type, teaching topic, passage (optional), prayer, fellowship, other activity, atmosphere, photos, follow-up needs, next-week plan.
- R2.2 The system shows five separate states for a group and a week: activity held · activity not held (confirmed) · report not submitted · report under review · group inactive.
- R2.3 The system never infers "not held" from a missing report.

### Module 3 — Weekly Mission Report
- R3.1 One report per active group per reporting period.
- R3.2 A reporting period has: week id, start, end, deadline. The deadline is on Sunday in the Asia/Bangkok time zone (confirmed). The time of day is not decided (pending O8).
- R3.3 Stored report statuses: draft · submitted · under review · needs revision · approved. Display states computed from them: not submitted (no report, or a draft only) · confirmed not held (a submitted report with held = no) · blocked (R7.7).
- R3.4 Missing reports are computed from the expected group list of the period. A group is missing when it has no submitted report. A draft does not count as submitted. No placeholder report records.
- R3.5 A report after the deadline is accepted and marked late. The mark uses the time of the first submission. A later resubmission does not change the mark. The mark cannot be removed.
- R3.6 Report content: activity (R2.1), attendance (regular members present and absent, first-time visitors, returning visitors, total), follow-up needs, next week (plan, people to follow up, support needed).
- R3.7 Each report records submitter, time, reviewer, changes with old and new values, approver, approval time.
- R3.8 A double submission never creates a second report. A repeated send action on a report that is already submitted changes nothing and adds no history entry.
- R3.9 Draft autosave (confirmed): the system saves the report automatically while the group leader writes. Autosave never submits the report and never changes the status from draft.
- R3.10 The group leader can leave and return to the draft, on the same or another device, and continue. Only the explicit send action submits the report.
- R3.11 A draft is visible to the group leader only. Supervisors, body leaders and leadership see the group as "not submitted".
- R3.12 The system keeps the time of the first submission and the time of the latest submission as two separate values.
- R3.13 "Confirmed not held" is a submitted report. The group is not missing.
- R3.14 A request for revision needs a reason. The group leader sees the reason, edits the report and sends it again. Autosave during the edit does not send it.

### Module 4 — Member and Attendance
- R4.1 Each group has a member register with join and leave dates.
- R4.2 Attendance values: present, absent, leave, online.
- R4.3 One attendance record per member, group and service day.
- R4.4 The system shows: absent 1 week (display only) · absent 2 consecutive weeks (creates a follow-up item) · absent longer (item goes to the responsible supervisor).
- R4.5 A week with no recorded attendance for the group is "unknown", not "absent".
- R4.6 The system does not label a person inactive and does not assume a reason for absence. A reason is stored only when it is known and appropriate, with restricted access.

### Module 5 — Newcomer Follow-up
- R5.1 A first-time visitor record has: first visit date, first group, welcomer, follow-up owner, later attendance, contact history, result, next follow-up date.
- R5.2 Statuses: first visit · awaiting follow-up · contacted · returned · ongoing care · follow-up completed.
- R5.3 A visitor who does not return the next week creates a follow-up item.
- R5.4 A visitor is not a full member and gets no account without consent and confirmation.

### Module 6 — Follow-up and Action Tracking
- R6.1 An item has: type, related group or person, description, owner, priority, due date, status, action history, result, completion date.
- R6.2 A notification does not complete an item. Completion needs a recorded result.
- R6.3 Automatic items are created once per cause (no duplicates).

### Weekly workflow
- R7.1 Saturday: the period opens; group leaders are notified; expected groups are listed.
- R7.2 Sunday: group leader submits → assigned supervisor reviews and can request revision → body leader reviews, can request revision, and gives the final approval → body leader sends the body summary → mission leadership reads the overview and tracks the situation.
- R7.3 Supervisor fallback (confirmed): the reviewer is resolved from active assignments. If the group has no supervisor (care leader or coordinator) with a usable account and an active assignment, the report goes to the body leader automatically.
- R7.6 Final approval (confirmed): only the body leader of the group's body approves a report. Mission leadership and system administrators do not approve by default. A person approves only through an active body leader assignment.
- R7.7 Blocked (confirmed): if the body has no body leader with a usable account, a submitted report shows the state "Blocked" and the system notifies the administrators. The system never skips the approval step and never approves in place of the body leader. The state ends when a body leader with a usable account exists; that person then approves.
- R7.8 Whether the body leader can approve before the assigned supervisor has reviewed is not decided (pending O12).
- R7.4 Sunday evening: the system creates a meeting brief with ten sections (organization overview, body overview, report status, activities, attendance, absentee follow-up, newcomer follow-up, groups needing support, issues, actions for next week).
- R7.5 A stored meeting brief keeps its content and timestamp. Later reports do not change it.

### Mission Overview
- R8.1 The leadership home page shows: organization summary, body cards, attention list, weekly summary.
- R8.2 Every number shows its period and has one definition (§5).
- R8.3 Drill-down path: Organization → Body → Group → Weekly report → Attendance → Member follow-up. Each page links back to its parent.

### Access
- R9.1 Access = role + active assignment + group scope + permission type (view, create, edit, submit, review, request revision, approve, manage assignments).
- R9.2 The server enforces scope. The client only mirrors it.
- R9.3 No person reads data of a body or group outside the own scope.

### LINE and LIFF
- R10.1 LINE sends reminders, task links and status messages.
- R10.2 LIFF supports attendance, report submission and status view.
- R10.3 The server verifies the LINE identity. A LINE user id from the client is never trusted.
- R10.4 Account linking needs a signed-in session and a confirmation by the user.

## 5. Metric definitions

All metrics apply to one reporting period unless stated.

| Metric | Definition |
|---|---|
| Bodies | Groups with `org_level = 'body'`, not deleted |
| Active groups | House mission groups with status `active`, not deleted, started on or before the period end |
| Expected reports | Active groups in the period. For a past period the list must not change when a group's status or body changes later (proposal: period snapshot, pending O11) |
| Reports submitted | Expected groups that have a submitted report (held or not held): status submitted, under review, needs revision or approved. A draft is not counted |
| Missing reports | Expected reports minus reports submitted. A group with a draft only is missing |
| Groups that held a mission | Submitted reports with held = yes |
| Confirmed not held | Submitted reports with held = no |
| Blocked reports | Submitted, not approved reports whose body has no body leader with a usable account |
| Attendance | Sum over submitted held reports only. Groups without a submitted report are excluded and shown as "unknown" |
| New visitors | People with a first visit date inside the period |
| Returning visitors | Visitors present in the period whose first visit was in an earlier period |
| Members | Active `group_members` rows of active groups, counted by distinct person |
| Open follow-ups | Follow-up items with status open or in progress, at the time of viewing |
| Late report | `first_submitted_at` after the period deadline. `last_submitted_at` is not used |

## 6. User experience requirements

Group leader (mobile): Thai text at large size, touch targets at least 48 px, one task per screen, at most three steps to submit, group and roster prefilled, plain words, a clear message for each validation error, no charts. The screen shows when the draft was last saved, and shows clearly that a draft is not sent. If an automatic save fails, the screen says so and keeps the text. The send button cannot be used twice for one send.

Leadership (desktop): the existing design system (`client/src/index.css`, `brand-spec.md`), summary first, detail by drill-down, names and photos on responsibility data, empty and error states on every list.

## 7. Out of scope

Social network, chat, finance, assessment of personal faith, a replacement website, a rigid Body → Care → Group hierarchy, automatic member accounts for visitors.

## 8. Quality requirements

Type check, tests and build pass in CI for each change. Each permission has a test inside and outside scope. Each migration is additive and reviewed before it is written. A test is reported as passed only when it was run.
