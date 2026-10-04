# Puntakit — authorization audit (2026-10-04)

Branch `claude/user-roles` (PR #36), base `main` at `9d8b3a4`. Method: read every route module in
`server/routes/` and the auth middleware; no production access. Status: **CODE VERIFIED**, not production verified.
This file contains no member data.

## How "assigned care group" is defined
There is no separate assignment table. A user leads a group when `groups.leader_id` or `groups.co_leader_id`
equals the user id (`/admin/users` sets `leader_id`). `members.user_id` links a member to an account;
`groups.leader_member_id` (picked in `/groups`) is a display field and grants no rights.
A member belongs to a care group through an active `group_members` row.

## Findings (before the fix)
| # | Severity | Finding | Reach |
|---|---|---|---|
| F1 | Critical | `attendance` router had no role gate except DELETE. Any signed-in account could list all attendance records with phone numbers (`GET /`, `/absentees`, `/export`) and write check-ins for any member (`/check-in`, `/bulk`, `/qr-scan`). | New Clerk sign-ups are provisioned as `member`. |
| F2 | Critical | `GET /api/groups/:id` and `/:id/members` returned the full roster with unmasked phone numbers to any signed-in role. | Same. |
| F3 | High | `group_leader` could edit any member (`PUT /api/members/:id`), including `assignedLeaderId` (which unmasks contact data) and the care group, and export all members as CSV. | Any group leader. |
| F4 | High | `GET /api/care/groups/:id/roster` returned any care group's roster (phone, LINE id) to a `group_leader`. | Any group leader. |
| F5 | High | `GET /api/members`, `/:id`, `/check-duplicate` served the whole directory to every signed-in role (contact fields masked; name, area, status visible). | Roles `member`, `viewer`, `group_leader`. |
| F6 | High | A `group_leader` could add any member to a group they lead (pulling that person into scope) and change protected fields of their group (`leader_id`, `co_leader_id`, parent, level, privacy, status). | Any group leader. |
| F7 | Medium | `group_leader` could create or move activities and follow-ups to any group, and attach any member as participant or subject. | Any group leader. |
| F8 | Medium | `GET /api/dashboard/summary` returned the 5 newest members (name, status, area) to every role. Group list and detail returned leader account emails to every role. | Every signed-in role. |
| F9 | Medium | `PUT /api/admin/users/:id/care-groups` silently replaced an existing leader. | Super admin action. |
| F10 | Info | `BOOTSTRAP_ADMIN_EMAILS` promotes a verified primary email to `super_admin` only when the account is not already admin or super_admin. It never demotes. Demoting a listed address to `staff` or lower is undone at the next sign-in; demoting it to `admin` sticks. (The PR #36 description said "re-promotes" without this detail.) | Operational note. |
| F11 | Info | A `group_leader` may publish activities of a group they lead (comment in `activities.ts` says otherwise). `viewer` keeps read access to directory lists. Not changed. | Business rules. |

## Endpoint matrix after the fix
`DIR` = super_admin, admin, staff, ministry_leader, viewer (read all). `PRIV` = super_admin, admin, staff, ministry_leader.
`GL` = group_leader, limited to the groups they lead and the members who are active in them.
`member` role = no access to the endpoints below unless noted.

| Endpoint | Who | Scope | Enforcement |
|---|---|---|---|
| `GET /api/members`, `/:id`, `/check-duplicate` | DIR, GL | GL: members active in led groups; out of scope = 404 / empty | `requireRole` + `scopedMemberIds` condition |
| `GET /api/members/export/csv` | PRIV, GL | GL: led members only | same |
| `PUT /api/members/:id` | PRIV-update roles, GL | GL: in-scope member; cannot change care group or `assignedLeaderId` | handler check |
| `GET /api/groups` | any signed-in | all groups (no roster); leader email only for PRIV | field mask |
| `GET /api/groups/:id`, `/:id/members` | DIR, GL | GL: led groups only (403 otherwise); phone masked except super_admin, admin, staff, leading GL | handler check |
| `PUT /api/groups/:id` | PRIV-manage, GL | GL: led group; protected fields rejected if changed | `verifyGroupManagementAccess` + field check |
| `POST/PUT/DELETE /api/groups/:id/members…` | PRIV-manage, GL | GL: led group; cannot add a member who is active in another care group | handler check |
| `GET /api/care/groups`, `/groups/:id/roster` | CREATE roles | GL: led care groups only | handler check |
| `GET /api/attendance`, `/absentees` | DIR, GL | GL: records of in-scope members | condition |
| `POST /api/attendance/check-in`, `/bulk`, `/qr-scan` | CREATE roles | GL: in-scope members, led groups only | handler check |
| `GET /api/attendance/summary`, `/export` | PRIV | org-wide | `requireRole` |
| `POST/PUT /api/activities`, `/api/follow-ups` | CREATE roles | GL: group must be led; participants and subject in scope; owner = self | handler check |
| `GET /api/dashboard/summary` | any signed-in | counts for all; `recentMembers` only for DIR | field mask |
| `/api/admin/users…` | super_admin | — | handler check (admin gets 403) |

Not changed: `org`, `reports`, `import`, `orgData` (PRIV or admin only), `portal` (own record), events, announcements, ministries, church profile (admin writes).

## Changes made (phase 3)
- `server/lib/careScope.ts` (new): one definition of "assigned" and the scope helpers.
- `shared/roles.ts`: `DIRECTORY_ROLES`, `CONTACT_VISIBLE_ROLES`.
- `members.ts`, `groups.ts`, `attendance.ts`, `care.ts`, `activities.ts`, `followUps.ts`, `dashboard.ts`: role gates and scope checks as in the matrix above.
  `verifyGroupManagementAccess` no longer accepts "leader of the group through a linked member row"; only `leader_id` / `co_leader_id` count.
- `care.ts`: new `GET /api/care/groups` (the care groups the caller may check in). `CareToday.tsx` reads it instead of `/api/org/overview`, which a group leader cannot call.
- `adminUsers.ts` + `AdminUsers.tsx`: giving a care group to someone else returns 409 with the group and current leader; the page asks, then resends with `replaceExisting: true`.
- `activities.test.ts`: the create step now makes the creator lead the group first (the old test relied on a leader filing for a group they did not lead), then withdraws the leadership so the "no longer leads the group" cases still run.

## Behaviour changes to know about
- Role `member` now gets 403 on the member, group-roster and attendance endpoints and an empty `recentMembers`. The member app does not call them (it uses `/api/me/*`).
- Role `viewer` is unchanged except that phone numbers in rosters, attendance rows and the attendance export are masked, and leader account emails are hidden.
- A group leader's `PUT /api/members/:id` can no longer set `careGroupId` or `assignedLeaderId`.

## Tests
`server/routes/tenantScope.test.ts` (13 tests, real PGlite, synthetic fixtures). With the four route files reverted to `main`, 10 of the 13 fail; with the fix all pass.

## Not covered
- Production: Clerk sign-in, Neon `db.batch` atomicity (NOT VERIFIED IN PRODUCTION), real data volumes.
- A `member` or `viewer` can still find a phone number by searching digits in `GET /api/members?search=` (masked output, but the filter matches the stored value). Not changed.
- `group_leader` may publish activities of their own group (existing rule).
- `staff` and `ministry_leader` see all members, as before.
- `members.user_id` and `groups.leader_member_id` grant no rights.
