# FaithMap — Permission Matrix

Date: 2026-11-13 · Revision 2: 2026-11-14
Part 1 is the **current** state, code verified. Part 2 is the **target**, proposed. No permission changes until Part 2 is approved. Revision 2 changed Part 2 only; no permission in the application changed.

Legend: ✔ allowed · ◐ allowed inside own scope · ✖ denied.

## 1. Current state (code verified)

Sources: `shared/roles.ts`, `server/middleware/auth.ts`, `server/lib/groupAccess.ts`, `server/lib/careScope.ts`, route guards.

Scope of `group_leader` today: **write** = groups led directly (`leader_id`, `co_leader_id`, or an active leader-role `group_members` row). **Read** = those groups plus descendant groups (a body leader reads the groups of the body).

| Action | super_admin, admin | staff | ministry_leader | group_leader | viewer | member |
|---|---|---|---|---|---|---|
| Read groups, members, attendance | ✔ | ✔ | ✔ | ◐ read scope | ✔ read-only | ✖ (member portal only) |
| Record attendance (`/api/attendance/check-in`, `/bulk`) | ✔ | ✔ | ✔ | ◐ direct groups, active members only | ✖ | ✖ |
| Consecutive absentees | ✔ | ✔ | ✔ | ◐ | ✔ | ✖ |
| Create activity, submission, follow-up (`CREATE_ROLES`) | ✔ | ✔ | ✔ | ◐ | ✖ | ✖ |
| Review and publish submission (`PRIVILEGED_ROLES`) | ✔ | ✔ | ✔ | ✖ | ✖ | ✖ |
| Read follow-ups | ✔ all | ✔ all | ✔ all | ◐ own, created, or about a led group | ◐ own or created | ◐ own or created |
| Org overview, operations dashboard, reports | ✔ | ✔ | ✔ | ✖ | ✖ | ✖ |
| Edit a group | ✔ | ✖ (not in `GROUP_MANAGE_ANY_ROLES`) | ✔ | ◐ led group | ✖ | ✖ |
| Create or delete a group (`ADMIN_ROLES`) | ✔ | ✖ | ✖ | ✖ | ✖ | ✖ |
| Unmasked member contacts | ✔ | ✔ | ✖ | ◐ phone on own roster | ✖ | ✖ |
| Manage users and roles | super_admin only | ✖ | ✖ | ✖ | ✖ | ✖ |

Facts that affect the target:
- No role separates a group leader, a care leader, a coordinator and a body leader. All are `group_leader`.
- `ministry_leader` is the ministry-team role. `shared/roles.ts` keeps it out of member-level decisions on purpose.
- `staff`, `admin` and `ministry_leader` have church-wide read access. The brief asks that staff roles are not unrestricted (decision O6).

## 2. Target state (proposed)

### 2.1 Model

Access = **role** (account type) + **active assignment** (responsibility for a group or body) + **permission type**.

- No new `USER_ROLES` value. Field people keep the `group_leader` role. Their capabilities come from `group_assignments`.
- An assignment gives access only to its group (or its body's groups for `body_leader`), only while active, and only when the person has a usable account (`FAITHMAP_TARGET_ARCHITECTURE.md` §5.1).
- Mission leadership: how a person gets this status is **pending (O5)**. Options: (a) the `staff` role as a whole, (b) a separate permission for named persons. This matrix does not assume that every `staff` account is mission leadership. The column "Mission leadership" below applies only to persons that O5 defines.
- Mission leadership has overview and tracking access. It is not an approver.
- Existing role sets stay unchanged. New role sets, if any, are added in `shared/roles.ts`.

### 2.2 Capabilities by responsibility

Columns are responsibilities held through active assignments. One person can hold several.

| Permission | Group leader (own group) | Assigned supervisor: care leader or coordinator (assigned groups) | Body leader (groups of own body) | Mission leadership (all bodies) | System administrator |
|---|---|---|---|---|---|
| View group profile, roster, responsibility | ◐ | ◐ | ◐ | ✔ | ✔ |
| Edit permitted group information | ◐ (existing rule) | ✖ | ◐ **new** | ✔ (existing admin rule) | ✔ |
| Record attendance | ◐ (existing) | ✖ | ✖ | existing church-wide rule, unchanged | existing |
| Create and edit own draft (autosave) | ◐ **new** | ✖ | ✖ | ✖ | ✖ |
| Read a draft | ◐ own **new** | ✖ | ✖ | ✖ | ✖ |
| Submit and resubmit weekly report | ◐ **new** | ✖ | ✖ | ✖ | ✖ |
| View submitted weekly reports | ◐ own | ◐ **new** | ◐ **new** | ✔ **new** | ✔ **new** |
| Review, request revision | ✖ | ◐ **new** | ◐ **new** | ✖ | ✖ |
| Final approve | ✖ | ✖ | ◐ **new** | ✖ | ✖ |
| View blocked reports | ✖ | ✖ | ✖ | ✔ **new** | ✔ **new** |
| Body summary: write and send | ✖ | ✖ | ◐ **new** | view only | ✖ |
| Mission overview | ✖ | ✖ | ◐ own body **new** | ✔ | ✔ |
| Meeting brief: generate, read | ✖ | ✖ | ✖ | ✔ **new** | read |
| Follow-up items: view and act | ◐ own group | ◐ assigned groups **new** | ◐ own body **new** | ✔ | existing |
| Newcomer records | ◐ own group **new** | ◐ **new** | ◐ **new** | ✔ **new** | ✖ by default (O6) |
| Manage assignments | ✖ | ✖ | pending (O10) | ✔ **new** | ✔ **new** |
| Manage accounts, PINs | ✖ | ✖ | ✖ | ✖ | super_admin (existing) |

"**new**" marks a permission that does not exist today. Each one needs explicit approval and tests before implementation.

Notes:
- A person in the "Mission leadership" or "System administrator" column who also holds an active body leader assignment approves in that body through the assignment. The column alone gives no approval.
- A system administrator resolves a blocked report by correcting the account or the assignment data. The administrator does not approve the report.

### 2.3 Rules

1. Reviewer resolution: primary supervisor with a usable account → other active supervisors with a usable account → body leader. Supervisor fallback (confirmed): a group without a usable supervisor goes to the body leader automatically and is listed under "groups without a usable supervisor".
2. A person does not review or approve the own submitted report, unless decision O4 allows it (pending).
3. An assignment whose person has no usable account gives nobody access. The interface shows "ยังไม่มีบัญชีผู้ใช้".
4. `group_leader` never receives church-wide access through this design.
5. The existing church-wide access of `admin`, `staff` and `ministry_leader` to existing routes does not change. For the **new** weekly-report review actions, `ministry_leader` is not included unless the church decides otherwise.
6. The server enforces every rule. The client hides controls only as a convenience.
7. Every review, approval and assignment change records actor and time.
8. Final approval (confirmed): only a body leader with an active assignment on the group's body and a usable account approves. `admin`, `super_admin`, `staff`, `ministry_leader` and mission leadership get a 403 on the approve route unless they hold that assignment.
9. Blocked (confirmed): if the body has no body leader with a usable account, the report is blocked and the administrators are notified. No rule skips the approval and no job approves automatically.
10. Draft: only the group leader of the group reads or writes the draft. Autosave is a write by the group leader and follows rule 6. Autosave cannot change the status.
11. Whether the body leader can approve before the supervisor review is pending (O12).

### 2.4 Required permission tests (per new route)

| Case | Expected |
|---|---|
| Group leader autosaves a draft for the own group | 200; status stays `draft`; submission times stay null |
| Group leader autosaves for another group | 403 |
| Supervisor or body leader reads a draft | 404 or 403; the group shows as not submitted |
| Group leader submits twice | 200 both times; one report; one `submit` event; `first_submitted_at` unchanged |
| Group leader submits for the own group | 200 |
| Group leader submits for another group | 403 |
| Supervisor reviews an assigned group | 200 |
| Supervisor reviews a group in the same body that is not assigned | 403 |
| Supervisor acts after the assignment end date | 403 |
| Body leader approves in the own body | 200 |
| Body leader reads or approves in another body | 403 |
| Body leader reads the overview of another body | 403 |
| `viewer` and `member` call any new write route | 403 |
| Request without a session | 401 |
| Cron route without the secret | 401 |
| Responsible person has no linked user account | The assignment is listed; no session exists for the person; routing skips the person |
| Linked account is suspended or has no PIN | Same as no account: routing skips the person |
| Assignment ended (group leader, supervisor or body leader) | 403 on submit, review and approve from the end date |
| User of body A reads a report, the overview or the summary of body B | 403 |
| No supervisor with a usable account | The report appears in the body leader's queue; no supervisor can act; group listed as without a usable supervisor |
| Body leader has no usable account | Report state is blocked; approve by any other user returns 403; the status stays unchanged; administrators are notified once |
| Body leader gets a usable account after the block | Blocked state ends; the body leader approves with 200 |
| User approves a report outside the own scope (other body, or supervisor role only) | 403; no event row |
| `admin`, `super_admin`, `staff` or mission leadership without a body leader assignment calls approve | 403 |
| Request for revision without a reason | 400 |
| Autosave on a report with status `submitted`, `under_review` or `approved` | 409; no change |

## 3. Decisions that this matrix depends on

O2 (assignee identity), O4 (self-review), O5 (how a person becomes mission leadership), O6 (admin and staff access to personal data), O10 (who manages assignments), O12 (order of supervisor review and body approval), O13 (who receives the blocked notice). All are pending. See `FAITHMAP_PHASE0_SYSTEM_AUDIT.md` §5 and §8.
