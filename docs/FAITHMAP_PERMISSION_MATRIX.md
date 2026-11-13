# FaithMap — Permission Matrix

Date: 2026-11-13
Part 1 is the **current** state, code verified. Part 2 is the **target**, proposed. No permission changes until Part 2 is approved.

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
- An assignment gives access only to its group (or its body's groups for `body_leader`), only while active.
- Mission leadership is a role decision (O5). Recommendation: `staff`.
- Existing role sets stay unchanged. New role sets, if any, are added in `shared/roles.ts`.

### 2.2 Capabilities by responsibility

Columns are responsibilities held through active assignments. One person can hold several.

| Permission | Group leader (own group) | Assigned supervisor: care leader or coordinator (assigned groups) | Body leader (groups of own body) | Mission leadership (all bodies) | System administrator |
|---|---|---|---|---|---|
| View group profile, roster, responsibility | ◐ | ◐ | ◐ | ✔ | ✔ |
| Edit permitted group information | ◐ (existing rule) | ✖ | ◐ **new** | ✔ (existing admin rule) | ✔ |
| Record attendance | ◐ (existing) | ✖ | ✖ | existing church-wide rule, unchanged | existing |
| Create and edit own weekly report | ◐ **new** | ✖ | ✖ | ✖ | ✖ |
| Submit weekly report | ◐ **new** | ✖ | ✖ | ✖ | ✖ |
| View weekly reports | ◐ own | ◐ **new** | ◐ **new** | ✔ **new** | ✔ **new** |
| Review, request revision | ✖ | ◐ **new** | ◐ **new** | ✔ **new** | ✖ |
| Approve | ✖ | ✖ | ◐ **new** | ✔ **new** | ✖ |
| Body summary: write and send | ✖ | ✖ | ◐ **new** | view only | ✖ |
| Mission overview | ✖ | ✖ | ◐ own body **new** | ✔ | ✔ |
| Meeting brief: generate, read | ✖ | ✖ | ✖ | ✔ **new** | read |
| Follow-up items: view and act | ◐ own group | ◐ assigned groups **new** | ◐ own body **new** | ✔ | existing |
| Newcomer records | ◐ own group **new** | ◐ **new** | ◐ **new** | ✔ **new** | ✖ by default (O6) |
| Manage assignments | ✖ | ✖ | ◐ own body **new** (O10) | ✔ **new** | ✔ **new** |
| Manage accounts, PINs | ✖ | ✖ | ✖ | ✖ | super_admin (existing) |

"**new**" marks a permission that does not exist today. Each one needs explicit approval and tests before implementation.

### 2.3 Rules

1. Reviewer resolution: primary supervisor → other active supervisors → body leader. A group without a supervisor is reviewed by the body leader and is listed under "groups without an assigned supervisor".
2. A person does not review or approve the own submitted report, unless decision O4 allows it.
3. An assignment whose person has no linked user account gives nobody access. The interface shows "ยังไม่มีบัญชีผู้ใช้".
4. `group_leader` never receives church-wide access through this design.
5. The existing church-wide access of `admin`, `staff` and `ministry_leader` to existing routes does not change. For the **new** weekly-report review actions, `ministry_leader` is not included unless the church decides otherwise.
6. The server enforces every rule. The client hides controls only as a convenience.
7. Every review, approval and assignment change records actor and time.

### 2.4 Required permission tests (per new route)

| Case | Expected |
|---|---|
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

## 3. Decisions that this matrix depends on

O2 (assignee identity), O4 (self-review), O5 (leadership role), O6 (admin and staff access to personal data), O10 (who manages assignments). See `FAITHMAP_PHASE0_SYSTEM_AUDIT.md` §5.
