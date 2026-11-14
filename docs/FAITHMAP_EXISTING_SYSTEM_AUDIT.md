# FaithMap — Existing System Audit

Date: 2026-11-14 · Status: read-only audit. This work changed no application code, schema, migration, permission or data.

Scope: the whole existing repository (`tlckalasinchurch/Puntakit-kalasin`) as the technical foundation of FaithMap, and every place that shows a product name.
The mission-domain findings F1–F15 and the gap analysis are in `FAITHMAP_PHASE0_SYSTEM_AUDIT.md`. This document does not repeat them. It adds the areas that the Phase 0 audit did not cover.

## 1. Evidence classes

Each statement in this document has one class.

| Class | Meaning |
|---|---|
| SOURCE | Read in the source code on branch `claude/magical-cerf-lkrjyt` on 2026-11-14 |
| SCHEMA | Read in `shared/schema.ts` and `server/db/migrations`. This is the schema in code, not the production database |
| PRODUCTION | Observed in the production system |
| ASSUMPTION | Not read anywhere; stated as a working assumption |
| UNVERIFIED | Could not be checked in this work; the reason is given |

No statement in this document has the class PRODUCTION. I did not open `https://puntakit-kalasin.vercel.app`, did not read the production database, and did not read the Vercel project settings. I did not run the application or the tests.

## 2. Audit by area

### 2.1 Application architecture — SOURCE

- One repository, one deployable application. React single-page application (`client/src`, router `wouter`), Express API (`server/`), Drizzle ORM, PostgreSQL. Shared types and validation in `shared/`.
- Vercel entry point: `api/index.ts` (one serverless function, 60 s limit). Static client from `dist/public`.
- Two user shells: the admin shell (`AppLayout`, sidebar and top bar) and the member shell (`MemberAppLayout`, routes under `/app`).
- Package manager: pnpm. Package name: `puntakit-dashboard`.

### 2.2 Frontend routes and navigation — SOURCE

Routes in `client/src/App.tsx` (37 paths):

| Group | Paths |
|---|---|
| Public | `/login`, `/privacy`, `/terms`, `/404` |
| Home and overview | `/`, `/org`, `/map`, `/reports` |
| People and groups | `/members`, `/memberships`, `/groups`, `/care` |
| Work | `/attendance`, `/follow-up`, `/inbox`, `/events`, `/worship` |
| Content | `/feed`, `/mission-feed`, `/announcements`, `/media` |
| Church | `/church`, `/ministries` |
| Administration | `/admin/users`, `/admin/pins`, `/import`, `/import/org`, `/import/duplicates`, `/import/merge-approvals`, `/settings`, `/profile` |
| Member shell | `/app`, `/app/attendance`, `/app/events`, `/app/group`, `/app/profile`, `/app/reports` |

Navigation (`client/src/components/layout/Sidebar.tsx`): two menus. The staff menu has หน้าหลัก, สมาชิก, พันธกิจ, เช็คชื่อ, การติดตาม, กิจกรรม, ฟีดและข่าวสาร, ข้อมูลคริสตจักร, รายงาน, ข้อมูลที่ส่งเข้ามา, ผู้ใช้และสิทธิ์, จัดการ PIN บอดี้, นำเข้าจาก Excel, แอปสมาชิก, โปรไฟล์. The group-leader menu has หน้าหลัก, งานวันนี้, การติดตาม, สมาชิกของฉัน, สถานะสมาชิก, กลุ่มของฉัน, โปรไฟล์.

UNVERIFIED: the exact menu that each role sees at run time. Reason: I read the menu definitions; I did not run the application with each role.

### 2.3 Backend APIs and services — SOURCE

23 routers in `server/app.ts`: `/api/auth`, `/api/dashboard`, `/api/reports`, `/api/members`, `/api/member-cards`, `/api/memberships`, `/api/media`, `/api/home`, `/api/groups`, `/api/activities`, `/api/follow-ups`, `/api/submissions`, `/api/attendance`, `/api/import`, `/api/org-data`, `/api/org`, `/api/care`, `/api/admin/users`, `/api/me`, `/api/announcements`, `/api/events`, `/api/ministries`, `/api/church-profile`. Also `/api/health` and `/api/ready`.

No route path contains a product name.

### 2.4 Database schema and relations — SCHEMA

27 tables in `shared/schema.ts`:

| Domain | Tables |
|---|---|
| Identity | `users`, `user_sessions`, `audit_logs` |
| People and groups | `members`, `groups`, `group_members`, `membership_terms` |
| Attendance | `attendance_records` |
| Mission activity | `mission_activities`, `mission_activity_participants`, `mission_activity_media`, `mission_submissions`, `follow_ups` |
| Church content | `announcements`, `events`, `event_registrations`, `ministries`, `church_profile`, `prayer_requests` |
| Media and push | `media_assets`, `push_subscriptions` |
| Import | `import_batches`, `import_source_rows`, `normalization_rules`, `import_row_norm`, `import_duplicate_decisions`, `import_merge_plans` |

- No table name and no column name contains a product name.
- Latest migration: `0013_first_party_pin_auth.sql`. One SQL file waits in `server/db/pending/` (`0010_group_members_history.sql`) and is not applied.
- UNVERIFIED: that the production database has exactly this schema. Reason: no database access in this work.

### 2.5 Authentication and user roles — SOURCE

- First-party PIN sign-in (`server/lib/firstPartyAuth.ts`). Session cookie `puntakit_session`, CSRF cookie `puntakit_csrf`, table `user_sessions`.
- `users.status` has `active` and `suspended`. A user with a null `pin_hash` cannot sign in.
- Roles (`USER_ROLES`): `super_admin`, `admin`, `ministry_leader`, `group_leader`, `staff`, `member`, `viewer`.
- No external identity provider. No email is sent by the system: no mail library is in the server code or in `package.json`.

### 2.6 Permissions and data scope — SOURCE

See `FAITHMAP_PERMISSION_MATRIX.md` Part 1 (current state) and findings F2, F3, F5, F15. No change.

### 2.7 Group management — SOURCE, SCHEMA

See F1 and gaps A1, A2, B1, B2, B8. Two levels are stored: `body`, and `care` (the house mission group).

### 2.8 Member management — SOURCE, SCHEMA

- `members` holds the person, with `membership_status` (includes `visitor`) and consent columns. `group_members` holds group membership. `membership_terms` and the `/memberships` page hold a membership lifecycle.
- An Excel import flow exists with duplicate decisions and merge plans (`/import/*`, six import tables).
- See F9 and F11 for the limits.

### 2.9 Attendance — SOURCE, SCHEMA

See F7 and F8. Two screens write attendance: `/attendance` (staff) and `/care` (group leader). One table stores it.

### 2.10 Existing reporting — SOURCE

- `/reports` and `/api/reports`: church-wide reports for staff roles.
- `/inbox` and `mission_submissions`: raw field messages that staff review and publish into `mission_activities` (F4, F5).
- `/app/reports`: a page in the member shell.
- No weekly report per group exists (F6).

### 2.11 Dashboard and analytics — SOURCE

- `/` is the Operations dashboard (`/api/dashboard`, `/api/home`). `/org` is the organization chart (`/api/org/overview`). `/map` shows groups on a map.
- All are church-wide and limited to staff roles (F15).

### 2.12 LINE and LIFF readiness — SOURCE

See F12. No LINE code exists. The Content-Security-Policy in `vercel.json` allows no LINE host.
UNVERIFIED: whether the church has a LINE Official Account or a LINE Login channel. Reason: the repository holds no reference.

### 2.13 Deployment and environment — SOURCE

- `vercel.json`: build `vite build`, output `dist/public`, rewrites `/api/*` to the function and all other paths to `index.html`. No `crons` entry.
- Environment variables with the old product name: `PUNTAKIT_DEMO_MODE`, `VITE_PUNTAKIT_DEMO_MODE`, `PUNTAKIT_TEST_AUTH`, `PUNTAKIT_MEDIA_DIR`.
- UNVERIFIED: the Vercel project name, its domains, its environment variables and its database provider settings. Reason: no access to the Vercel project in this work.
- UNVERIFIED: the live state of `https://puntakit-kalasin.vercel.app`. Reason: not opened in this work.

### 2.14 Testing and CI/CD — SOURCE

- 97 test files: 47 in `server/`, 4 in `shared/`, 46 in `client/`. (`FAITHMAP_PHASE0_SYSTEM_AUDIT.md` F14 said 55 before this audit; the count is corrected there.)
- CI (`.github/workflows/ci.yml`): install, `pnpm check`, `pnpm test`, `pnpm build` on every push and pull request.
- 45 test files contain the string "puntakit". Most use it in environment variable names or the demo account. One test asserts a brand string: `client/src/pin-login-contract.test.ts` expects `alt="โลโก้ Puntakit"`.
- UNVERIFIED: that the test suite passes on this branch. Reason: not run in this work.

## 3. Product identity inventory

### 3.1 Places that show a product name to a user — SOURCE

| # | Place | File | Text today |
|---|---|---|---|
| I1 | Browser title (default) | `client/index.html` | "Puntakit Kalasin - คริสตจักรชีวิตสุขสันต์กาฬสินธุ์" |
| I2 | Browser title (per page) | `client/src/hooks/usePageTitle.ts` | "<page> · Puntakit Kalasin" |
| I3 | iOS home-screen title | `client/index.html` (`apple-mobile-web-app-title`) | "Puntakit" |
| I4 | PWA manifest name, short name, description | `client/public/manifest.json` | "Puntakit Kalasin - …", "Puntakit", "ระบบบริหารคริสตจักรและแอพพลิเคชันสมาชิก …" |
| I5 | Wordmark in the admin shell | `client/src/components/layout/Logo.tsx` | "Puntakit" + church name |
| I6 | Sign-in page: logo, wordmark, label, instruction | `client/src/pages/PinSignInPage.tsx` | "Puntakit", "โลโก้ Puntakit", "เกี่ยวกับ Puntakit", "…เข้าสู่ระบบ Puntakit" |
| I7 | Logo file | `client/public/puntakit-logo.jpg` | Image of the old mark |
| I8 | App icons | `client/public/icon*.png`, `icon.svg`, `apple-touch-icon.png`, `favicon-32.png` | UNVERIFIED: whether the images show the old name. Reason: images not opened |
| I9 | Member shell wordmark | `client/src/pages/member/MemberHome.tsx`, `client/src/components/lamb/LambHero.tsx` | "Puntakit" |
| I10 | Push notification title | `client/public/sw.js`, `server/routes/portal.ts` | "Puntakit Kalasin" |
| I11 | Attendance export | `client/src/pages/Attendance.tsx` | `church: "Puntakit Kalasin"` |
| I12 | Privacy page | `client/src/pages/Privacy.tsx` | "ระบบ Puntakit" (2 places) |
| I13 | Terms page | `client/src/pages/Terms.tsx` | "ระบบ Puntakit" (2 places) |
| I14 | Import page hint | `client/src/pages/ImportOrgData.tsx` | "puntakit_dataset.json" (a file name) |

Not found: an email template (the system sends no email), a product name in a loading state, in the error boundary, in the not-found page or in an API error message.
UNVERIFIED: product names inside stored data (for example `church_profile` rows or announcement text). Reason: no database access.

### 3.2 Internal technical identifiers with the old name — SOURCE

| # | Identifier | Where | Seen by a user |
|---|---|---|---|
| T1 | Cookies `puntakit_session`, `puntakit_csrf` | Server auth, `client/src/lib/api.ts` | No (browser tools only) |
| T2 | Environment variables `PUNTAKIT_*`, `VITE_PUNTAKIT_DEMO_MODE` | Server, Vite, tests, Vercel settings | No |
| T3 | Browser storage keys `puntakit.sidebar.collapsed`, `puntakit.careGroup` | Client | No |
| T4 | Service-worker cache `puntakit-pwa-v3` | `client/public/sw.js` | No |
| T5 | Browser event `puntakit:unauthorized` | Client | No |
| T6 | Hash salt `puntakit-seed-v1` | `server/lib/orgDataset.ts` (`derivedId`) | No. It fixes the ids of imported rows |
| T7 | Demo account `demo@puntakit.local` | Server, seed script, tests | Development only |
| T8 | Package name `puntakit-dashboard` | `package.json` | No |
| T9 | Temporary directory prefix `puntakit-import-` | `server/lib/missionImport.ts` | No |
| T10 | Repository name, Vercel URL | GitHub, Vercel | The URL is seen by users |
| T11 | Document names `PUNTAKIT_*.md` (15 files), `Puntakit-Role-Based-Pages.md`, `puntakit-dashboard-ops.skill` | `docs/`, root; 5 references from code comments; references from `CLAUDE.md` | No |

Impact analysis of each identifier: `FAITHMAP_PRODUCT_TRANSFORMATION.md` §5.

## 4. Additional findings

| # | Finding | Class |
|---|---|---|
| X1 | `client/src/lib/pwa.ts` registers a simulated push subscription (endpoint `https://push.puntakit.org/sub-…`, keys `mock-key`, `mock-auth`) when the browser has no real push setup. The row goes to the real `push_subscriptions` table. | SOURCE |
| X2 | The server cannot send a push message. No push library is in `package.json`, no server key is read anywhere, and `push_subscriptions` is used by one route only (subscribe). Detail: §6 | SOURCE |
| X3 | The domain `puntakit.org` in X1 | UNVERIFIED: ownership not checked |
| X4 | The product has features outside house mission: events, announcements, ministries, worship, church profile, feed, the member shell. | SOURCE |
| X5 | The description in the PWA manifest calls the product a church administration system and member application. This differs from the FaithMap definition. | SOURCE |

X1 and X2 matter for FaithMap notifications: the existing system has no working push channel. See §6 and `FAITHMAP_MIGRATION_AND_REGRESSION_RISKS.md` risk R14.

## 5. Summary of what is not verified

1. Everything about production: data, schema state, live URL, Vercel settings.
2. Run-time behaviour for each role.
3. Test results on this branch.
4. Content of icon and logo image files.
5. Product names inside stored data.
6. The content of the production table `push_subscriptions` (number of real and simulated rows).
7. LINE accounts of the church.

## 6. Push subscription analysis (source code)

Class of every statement in this section: SOURCE, unless marked. No code was changed.

### 6.1 What the code does

| Step | Code | Behaviour |
|---|---|---|
| Entry | `MemberHome.tsx`, `MemberProfile.tsx` (member shell only) | A button calls `subscribeToPushNotifications()`. The admin and field shell has no such button |
| Browser subscribe | `client/src/lib/pwa.ts` lines 72–78 | Calls `pushManager.subscribe({ userVisibleOnly: true })` **without** an application server key. A failure is caught and ignored |
| Real subscription saved | lines 80–91 | Posts the endpoint and keys. If a key is missing it sends the text `test-p256dh` or `test-auth` |
| Simulated subscription saved | lines 93–100 | If the browser gave no subscription, posts endpoint `https://push.puntakit.org/sub-<time>` with keys `mock-key`, `mock-auth`, and returns success |
| User message | `MemberHome.tsx` line 178 | Shows "เปิดรับการแจ้งเตือนของคริสตจักรเรียบร้อยแล้ว" in both cases |
| Server store | `server/routes/portal.ts` `POST /api/me/push/subscribe` | Validates that the endpoint is a URL and the keys are not empty. Inserts a row, or moves an existing endpoint to the calling user |
| Server test route | `POST /api/me/push/send-test` | Returns a JSON text. It sends nothing |
| Service worker | `client/public/sw.js` `push` handler | Can show a notification if a push message arrives. Default link `/app` |
| Sender | — | Does not exist |

### 6.2 Risk points

| # | Risk point | Effect |
|---|---|---|
| PS1 | No sender and no server key pair | No notification can be sent today. A design that "reuses Web Push" has nothing to reuse except a table |
| PS2 | Subscribe without an application server key | Browsers that require the key reject the call, and the code then saves a simulated row. Which browsers reject it is platform behaviour; not tested in this work |
| PS3 | Simulated rows in the real table | Test data in a production workflow. A future sender posts to a host that the project does not control (X3) |
| PS4 | A new simulated row at every button press (the endpoint contains the time) | The table grows without limit; one user can have many false rows |
| PS5 | Success message for a simulated subscription | The user believes that notifications are on. This is false |
| PS6 | Placeholder keys `test-p256dh`, `test-auth` on a real endpoint | A message to that row cannot be encrypted |
| PS7 | A subscription made without a server key cannot be used with a key later | When real push is built, every existing browser subscription must be removed and made again |
| PS8 | The server accepts any URL as endpoint from any signed-in user | When a sender exists, the server would send requests to a URL chosen by a user. This is a server-side request forgery risk |
| PS9 | An endpoint row moves to the user who posts it last | Correct for a shared device. With PS8 it lets one user take over another user's row if the endpoint is known |
| PS10 | No removal of dead subscriptions | Rows stay after a browser revokes them |
| PS11 | Only the member shell offers the button | Group leaders and supervisors, who use the other shell, cannot subscribe. They are the people FaithMap must remind |
| PS12 | The test route names an icon `/pwa-192.png` that is not in `client/public` | No effect today; the route sends nothing |

### 6.3 Proposed correction (not implemented; needs decision O14 and an approved ticket)

Step A can be done alone and has value without real push.

- **A. Stop false data and false messages.** Remove the simulated path and the placeholder keys. Return "not available" when the browser gives no subscription. Show a true message. (PS3–PS6)
- **B. Decide the channel (O14).** In-app lists only until LINE, or real Web Push.
- **C. If real Web Push is selected:**
  1. A key pair for the server: the public key to the client, the private key in the server environment only.
  2. Subscribe with the public key. Remove and renew subscriptions that were made without it. (PS2, PS7)
  3. A sender on the server, with a sent log (one message per person, event and period).
  4. Accept only endpoints on the known push-service hosts. (PS8, PS9)
  5. Delete a row when the push service answers that the subscription is gone. (PS10)
  6. A subscribe control in the field shell. (PS11)
  7. Tests: no simulated row can be created; endpoint host check; one message per event; dead row removed.
- **D. Existing rows.** First a read-only count (§6.4). Deletion of simulated rows is a production data change and needs its own approval.

### 6.4 Read-only production check (not run)

Count the rows of `push_subscriptions` in three groups: endpoint on host `push.puntakit.org`; keys equal to `mock-key`, `mock-auth`, `test-p256dh` or `test-auth`; all other rows. Count distinct users in each group. The check reads only.
