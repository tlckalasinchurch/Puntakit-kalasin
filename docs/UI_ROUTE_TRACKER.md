# UI route tracker (2026-10-15)

Branch `redesign/full-app-claude-20261015`. Measured against the local PGlite database only, never production.

## How the numbers were measured

- Tool: Playwright + Chromium driving the Vite preview at http://localhost:3100 with the API at http://localhost:3101.
- Each route was opened five times: 390, 768 and 1280 px in light theme, 390 and 1280 px in dark theme.
- Per run: horizontal overflow, interactive targets under 44 x 44 px, text contrast under WCAG AA, console errors, page errors, and HTTP 4xx/5xx responses.
- Admin results below come from a fresh sweep of all 36 paths after the last commit (`ce1f2bc`): 180 runs, 0 failures, 0 overflow, 0 small targets, 0 contrast findings, 0 errors.
- `group_leader` and `member` were swept earlier on 32 paths each (160 runs each) and re-scanned after the fixes on the affected routes only. They were not fully re-swept after `ce1f2bc`.
- `staff`, `ministry_leader`, `viewer` and `super_admin` were not run in a browser. Their access is derived from `shared/roles.ts` and `client/src/App.tsx` only (ASSUMPTION: the server enforces the same sets).

## Role sets (from `shared/roles.ts`)

| Set | Roles |
| --- | --- |
| PRIVILEGED | super_admin, admin, staff, ministry_leader |
| ADMIN_SHELL | super_admin, admin, ministry_leader, group_leader, staff, viewer |
| ADMIN | super_admin, admin |
| SUPER_ADMIN | super_admin |
| MEMBERSHIP_VIEW | super_admin, admin, staff, group_leader |
| none (any signed-in user) | every role, including member |

## Routes

Browser-verified column: A = admin (fresh sweep), L = group_leader, M = member (earlier sweep).

| Route | Page | Allowed roles | Browser-verified | Notes |
| --- | --- | --- | --- | --- |
| `/login` | PinSignInPage | public | A | Redirects to `/` when already signed in. Dark contrast of the sub-line fixed. |
| `/privacy`, `/terms` | Privacy, Terms | public | A | Dark contrast fixed (was 1.07:1). |
| `/404` and unknown paths | NotFound | public | A | |
| `/` | Home | ADMIN_SHELL | A, L | Duplicate search hidden from `sm` up, "Phase 4" wording removed, shortcuts merged into "ทำต่อได้เลย". |
| `/feed` | Feed | ADMIN_SHELL | A, L | `/mission-feed` redirects here. |
| `/memberships` | Memberships | MEMBERSHIP_VIEW | A, L | |
| `/follow-up` | FollowUps | ADMIN_SHELL | A, L | Interaction tested: status change sends one request on double click, success toast, cancelled items can be reopened. |
| `/inbox` | Inbox | ADMIN_SHELL | A | |
| `/care` | CareToday | ADMIN_SHELL | A, L | |
| `/import` | ImportData | PRIVILEGED | A | Rendering only. Upload and import steps not exercised. |
| `/import/org` | ImportOrgData | ADMIN | A | Rendering only. |
| `/import/duplicates` | ImportDuplicates | PRIVILEGED | A | Earlier 20 s `networkidle` timeout did not reproduce (5 of 5 runs pass; each API call fires once). |
| `/import/merge-approvals` | ImportMergeApprovals | none | A | BLOCKER 1: no `allow=`. |
| `/org` | OrgChart | PRIVILEGED | A | |
| `/admin/users` | AdminUsers | none | A | BLOCKER 1: no `allow=`. |
| `/admin/pins` | PinManagement | SUPER_ADMIN | A | Admin sees the in-page denial, as designed. |
| `/members` | Members | ADMIN_SHELL | A, L | Uses DateField (calendar fix applies). |
| `/groups` | Groups | ADMIN_SHELL | A, L | Audited: empty, 500, populated, dialogs. |
| `/map` | MapPage | ADMIN_SHELL | A | List view and search not interaction-tested beyond load. |
| `/attendance` | Attendance | ADMIN_SHELL | A, L | "มา/ลา" buttons widened to 44 px. Uses DateField. |
| `/profile` | Profile | ADMIN_SHELL | A | |
| `/announcements` | Announcements | ADMIN_SHELL (write: ADMIN) | A | Interaction tested: validation beside fields, one POST on double click, toast, delete confirm cancel and confirm. Write controls hidden for non-admin. |
| `/events`, `/worship` | Events | ADMIN_SHELL (write: ADMIN) | A, L | Audited earlier. Both paths render the same page. |
| `/church` | Church | ADMIN_SHELL (write: ADMIN) | A | Interaction tested: required-name error, one PUT on double click, toast. Fields disabled for non-admin. |
| `/ministries` | Ministries | ADMIN_SHELL (write: ADMIN) | A | Interaction tested: create and delete with double click, confirm dialog. |
| `/reports` | Reports | PRIVILEGED | A | Date picker and one CSV export tested (download works, no toast). Calendar fixed. |
| `/media`, `/settings` | ComingSoon | ADMIN_SHELL | A | Placeholder pages with a back link. |
| `/app` | MemberHome | any signed-in | A, L, M | `h1` added to the hero. Dark theme via `.lamb-theme`. |
| `/app/events` | MemberEvents | any signed-in | A, L, M | |
| `/app/group` | MemberGroup | any signed-in | A, L, M | Shows category label instead of raw `cell`. |
| `/app/reports` | MemberReports | any signed-in | A, L, M | Report CTA is disabled with "เร็วๆ นี้" (BLOCKER 2). |
| `/app/attendance` | MemberAttendance | any signed-in | A, L, M | |
| `/app/profile` | MemberProfile | any signed-in | A, L, M | |

## Fixes made (all committed locally, not pushed)

- `ffed134`: dark-mode contrast (login sub-line, Lamb theme, `--color-primary-ink`, error text via `--color-error-ink`), dead `/app/reports/new` links, member map card hidden for roles that cannot open `/map`, group category label, `h1` on the member home and the denied screen, notification button 44 px, merged home shortcuts, attendance targets, Home duplicate search.
- `ce1f2bc`: toasts lifted above the mobile bottom nav; date picker chevrons no longer pure blue, nav and day buttons 44 px, today highlighted with `--color-primary-ink`.

## Regression tests

`client/src/role-aware-ui.test.ts` (map card roles, no `/app/reports/new`, `h1`s, toast offset, date picker overrides), `client/src/design-tokens.test.ts` (locked tokens, `--color-primary-ink`), `client/src/ux-audit-regressions.test.ts` (error-ink regex), `client/src/lib/homeLinks.test.ts` (shortcut merge). Last full run: 63 files, 768 tests passed.

## Open items

- BLOCKER 1: `/admin/users` and `/import/merge-approvals` have no `allow=`, so a `member` sees the admin sidebar there. Pages show an in-page denial and fetch no data. Fixing it changes authorization, so it is an owner decision.
- BLOCKER 2: there is no member report form, and `POST /api/submissions` excludes members (`CREATE_ROLES`).
- Not yet done: import upload flow, `/map` interactions, `staff`/`ministry_leader`/`viewer`/`super_admin` in a browser, 200% zoom on forms, Thai line-wrapping review, per-file review of the `--color-error` to `--color-error-ink` diff.
- Known and left alone: the calendar caption shows a Gregorian year ("ตุลาคม 2026") by design (`DateField.tsx` comment), while other screens show the Buddhist year. Browser Thai word-break can split "พัน/ธกิจ" (engine behavior). CSV export gives no toast.
