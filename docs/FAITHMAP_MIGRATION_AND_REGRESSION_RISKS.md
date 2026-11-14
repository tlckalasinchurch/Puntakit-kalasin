# FaithMap — Migration and Regression Risks

Date: 2026-11-14 · Status: **proposed, not approved, nothing implemented**.
Related: `FAITHMAP_PRODUCT_TRANSFORMATION.md` (what changes), `FAITHMAP_TARGET_ARCHITECTURE.md` (proposed tables), `FAITHMAP_PHASED_IMPLEMENTATION_PLAN.md` (order).

All statements about production are UNVERIFIED unless marked. No production system was read for this document.

## 1. Impact by area

| Area | Change in the proposal | Impact | Data loss |
|---|---|---|---|
| Existing users | No change to `users`, PINs, sessions or roles. Cookie names stay | No user signs in again because of the transformation. Users see a new product name | None |
| Existing groups | No change to `groups` rows or to `org_level` values. New rows in `group_assignments` point to groups | Group pages show responsible people. Depends on decision O1 | None |
| Members | No change to `members`. Visitors get an optional 1:1 `newcomer_tracks` row (Phase 4). Partial unique index on `group_members` (Phase 4, after a pre-check) | Default member list hides visitors (Phase 4). This is a visible behaviour change | None. No row is deleted or merged |
| Attendance history | No change to existing rows. A unique index and an Asia/Bangkok service day are added (Phase 2) | Existing duplicate rows, if any, block the index until the owner approves a cleanup. Past records can sit on a different calendar day than the Bangkok day (F7) | None without an approved cleanup. A cleanup needs its own approval and a backup |
| Existing reports | `mission_submissions`, `mission_activities` and `/reports` stay unchanged | The weekly report is a new, separate record. No old report is converted | None |
| Permissions | Existing role sets stay. New scoped permissions come from assignments | A wrong assignment gives a person access to one group or one body. No global permission is created | None |
| Database | Additive tables and columns. Two index changes on existing tables | Each migration is reviewed before it is written. Index changes need a production pre-check | None |
| API contracts | No existing path is removed or changed in shape. New paths under `/api/mission/*`, `/api/groups/:id/assignments`, `/api/cron/*`, `/api/line/*` | Existing clients keep working. `check-in` and `bulk` attendance become upserts (Phase 2); the response shape must stay the same | None |
| External integrations | None today except hosting, storage and map tiles. LINE is new (Phase 5) | Content-Security-Policy gets LINE hosts in Phase 5 only | None |
| Production deployment | Same Vercel project and URL. One new `crons` entry (Phase 2). New environment variables for the cron secret and LINE | A missing secret makes the cron routes answer 401; no data effect | None |

## 2. Migration strategy

1. **Additive first.** Each phase adds tables and columns. No phase drops or renames a table, a column or an enum value.
2. **No backfill by guess.** Imported leader names (text in `groups.description`) are linked to a person only by a human confirmation. No name matching by the system.
3. **Existing scope stays in force.** `groups.leader_id`, `co_leader_id` and leader rows in `group_members` keep their effect. Assignments are an added source of scope.
4. **Pre-check before each index change.** Read-only queries in `FAITHMAP_DATA_MAPPING.md` §7. The migration is written only after the result is known.
5. **Weekly reporting starts at a cutover week.** No reporting period is created for a past week. The first period is the week in which Phase 2 goes live. Past weeks stay without a period; the overview shows them as "before FaithMap reporting", not as missing.
6. **Identity change is text and assets only.** It needs no migration.
7. **One phase, small pull requests, one migration per pull request at most.**

## 3. Backward compatibility

| Item | Rule |
|---|---|
| URLs of pages | Every existing path stays (list in `FAITHMAP_EXISTING_SYSTEM_AUDIT.md` §2.2) |
| API paths | Every existing path stays, with the same request and response shape |
| Sign-in | Same PIN, same cookies (`puntakit_session`, `puntakit_csrf`) |
| Installed app (PWA) | Same origin, same manifest `id`, `start_url` and `scope`. The installed app stays installed. The name on the home screen can stay the old one until the device refreshes the manifest or the user installs again (platform behaviour; UNVERIFIED on the church's devices) |
| Push subscriptions | Bound to the origin and to the service-worker registration. A name change does not touch them. Note: no row can receive a message today, because no sender exists (audit §6) |
| Browser storage | Same keys; preferences stay |
| Environment variables | Same names |
| Stored `org_level` values | Same values (`body`, `care`) |
| Import ids | The hash salt in `server/lib/orgDataset.ts` never changes, so a repeated import matches existing rows |

## 4. Data integrity plan

| Control | When |
|---|---|
| Backup or provider snapshot of the production database, with a confirmed restore path | Before each migration that touches an existing table. UNVERIFIED: which backup function the production database has |
| Read-only pre-check with a recorded result | Before the `attendance_records` and `group_members` index changes |
| Row counts of `users`, `members`, `groups`, `group_members`, `attendance_records`, `follow_ups`, `mission_activities`, `mission_submissions` before and after | Each migration |
| Unique constraints for new rules (one report per period and group; one active primary per group; one open automatic item per cause) | In the migration that creates the table |
| Append-only history (`weekly_report_events`, `follow_up_events`); frozen `meeting_briefs` | Enforced in the server routes and tested |
| Migration test on an embedded database (PGlite) in CI, then on a preview database | Before production |
| No destructive SQL without a separate approval | Always |

## 5. Product name, URL and domain

| Case | Effect | Plan |
|---|---|---|
| Name change only, same URL | No access effect. Old bookmarks work | Default case of this proposal |
| A FaithMap domain is added to the same Vercel project (decision P7) | Both URLs serve the same application. A user on the new domain signs in again there (cookies belong to one host). An installed app and its push subscriptions belong to the old origin; the new domain is a separate install | Keep the old URL in service with full function. Do not redirect the old URL until the owner decides and users are informed |
| The old URL is redirected to a new domain | Installed apps open the redirect target outside their scope; push subscriptions of the old origin stop being useful; every user signs in again | Not proposed. Needs its own plan and approval |
| Repository rename | GitHub redirects the old name. The Vercel–GitHub link, CI and local clones need a check | Not required for the product. Decision P7 |

Rule: the product name change never makes the existing URL or an existing user account unusable.

### 5.1 Effect of the identity change by component (source code analysis)

Class: SOURCE for the code facts. Device behaviour is platform behaviour and is UNVERIFIED on the church's devices.

| Component | Code fact | Effect of the name change | Action in the identity stage |
|---|---|---|---|
| Page shell (`index.html`) | The service worker serves HTML network-first; the cache answers only offline | An online user sees the new title at the next load. An offline user sees the old shell until the next online load | None |
| Manifest | `/manifest.json` is served network-first. `id`, `start_url` and `scope` are `/` | The browser reads the new name at its next manifest check. The app identity (`id`) does not change, so the installed app is the same app | Keep `id`, `start_url`, `scope` unchanged |
| Installed app name and icon | Set by the device at install time | The device decides when to refresh them. Some platforms refresh after a manifest change; some keep the old label until the user installs again | Tell users that the old label can stay and how to install again. Do not promise an automatic change |
| Icons | Fixed file paths in the manifest and in the precache list | A new image under the same path can stay hidden behind a device cache | Use new file names for new icons and step the cache version |
| Service worker | Any byte change in `sw.js` installs a new worker; it calls `skipWaiting`. Old caches are deleted at activation when the cache name changes | The notification title in `sw.js` changes at the next visit. This is the designed update path | Step the cache version only when the precache list changes |
| Manifest shortcuts | Two shortcuts point to `/app` and `/app/events`, with Thai labels and no product name | No change needed for the name. Their fit with FaithMap is part of decision P3 | None |
| Authentication | Cookies `puntakit_session` and `puntakit_csrf` have no domain attribute (host-only), `SameSite=Lax`, `Secure` in production. Sessions are rows in `user_sessions` | No effect. No user is signed out. PINs do not change | Keep the cookie names |
| API access | No cross-origin setting exists in `server/app.ts`; the client calls the API on its own origin | No effect on the same URL. A second domain on the same deployment works as its own origin with its own sign-in | None |
| Push subscriptions | Stored per endpoint; bound to origin and service worker | No effect from the name change | None in the identity stage |
| Existing URLs | 37 page paths and 23 API routers; none contains the product name | No path changes | A test or check list that every path still answers |
| Browser storage | Keys `theme`, `puntakit.sidebar.collapsed`, `puntakit.careGroup` | No effect if the keys stay | Keep the keys |

## 6. Rollback plan

| Change type | Rollback |
|---|---|
| Identity texts and assets | Revert the pull request and redeploy, or promote the previous Vercel deployment. No data effect |
| Service-worker cache version | Roll forward with a new version. A cache name is never reused for different content |
| New page or route behind a role check | Revert the pull request. Rows already written in new tables stay in place and are not read |
| Additive migration (new table or column) | Do not drop in an emergency. Revert the application code; the unused table or column stays. A later, approved migration removes it if needed |
| Unique index on existing data | Drop the index (no data change). The cleanup that preceded it is **not** reversible without the backup; therefore a cleanup needs a backup and its own approval |
| Attendance service-day change | Keep the original timestamp column unchanged. The service day is an added value, so the old reading stays possible |
| Scheduler | Remove the `crons` entry and redeploy. Jobs are idempotent, so a partial run leaves no duplicate |
| LINE linking | Disable the routes by configuration. `line_accounts` rows stay; PIN sign-in is not affected |

Each phase must state its rollback step in its `SPEC.md` before a ticket is approved.

## 7. Risks

| # | Risk | Effect | Likelihood | Control |
|---|---|---|---|---|
| R1 | O1 is answered wrongly | Assignments and reports attach to the wrong unit | Unknown until the production check | Check and church confirmation before Phase 1 |
| R2 | A new route misses a scope check | A person reads another body's data | Medium | One resolver; a test inside and outside scope per route |
| R3 | A wrong person is linked to an imported name | Wrong person gets access to a group | Medium | Human confirmation; audit row; end date removes access at once |
| R4 | A draft is counted as submitted | Missing reports are hidden | Low | One definition in every query; test |
| R5 | The body leader has no usable account | Reports of a body stay blocked | Unknown (production check 4) | Blocked list; administrator notice; accounts prepared before Phase 2 goes live |
| R6 | Deadline time not decided | Late marks and reminders cannot be configured | Certain while O8 is open | Decision before the Phase 2 spec |
| R7 | Existing duplicate attendance rows | The unique index cannot be created | Unknown | Read-only check; cleanup only with approval and backup |
| R8 | Attendance day boundary in UTC | Attendance on the wrong day; wrong absence counts | Likely on Vercel (code reading; not reproduced) | Fix and test before reports use dates |
| R9 | Identity change breaks a test or a precached file | CI fails, or an installed app shows a missing icon | Medium | Change the asserting test in the same pull request; cache version step with new icons |
| R10 | The old name stays in a place not in the inventory | Mixed product names | Medium | Search step in the identity ticket; a test that fails on the old name in user-facing client files |
| R11 | A technical identifier is renamed without analysis | Sign-outs, broken demo mode, duplicate imported rows | Low if the plan is followed | The keep list in `FAITHMAP_PRODUCT_TRANSFORMATION.md` §5; `puntakit-seed-v1` never changes |
| R12 | Two input paths confuse group leaders (Inbox and weekly report) | Reports go to the wrong place | Medium | The field menu shows the weekly report only |
| R13 | A cron job exceeds 60 s | Reminders or period opening fail | Low | Small idempotent jobs |
| R14 | No push sender exists, and the subscribe code saves simulated rows (findings X1, X2; audit §6) | A reminder by Web Push reaches nobody; users were told that notifications are on | Certain in code; number of affected rows unknown | Decision O14; remove the simulated path by an approved ticket; in-app lists as the base channel |
| R15 | Features outside house mission lose their menu entry without a decision | Users cannot find an existing feature | Medium | No navigation change without decision P3 |
| R16 | Legal pages name a product that no longer matches | Unclear terms for users | Low | Church review (P5) in the identity phase |
| R17 | A visible behaviour change in an existing list (visitors hidden, Phase 4) | Staff think data is lost | Medium | A filter that shows visitors; release note |

## 8. Regression test plan

Gate for every change: `pnpm check`, `pnpm test`, `pnpm build` in CI. A result is reported as passed only when it was run.

| Layer | Tests |
|---|---|
| Existing suite | All 97 existing test files stay green in every pull request |
| Identity | The sign-in contract test with the new alt text; a new test that finds no "Puntakit" in user-facing client text, the manifest, `index.html` and the service-worker notification title; the design-token tests unchanged |
| Auth and session | Existing auth tests unchanged; cookie names unchanged |
| Permissions | The cases in `FAITHMAP_PERMISSION_MATRIX.md` §2.4 for every new route; existing route guards unchanged |
| Organization and assignments | Existing group, care and org route tests; assignment scope; ended assignment; one primary per group |
| Attendance | Existing `/care` and absentee tests; concurrent save creates one row; Bangkok day boundary |
| Weekly report | Autosave keeps `draft`; idempotent submit; first and last submission times; late mark; fallback; blocked; approval by the body leader only |
| Existing reporting | Inbox (`submissions`) tests and `/api/reports` tests unchanged |
| API contracts | Response shape of existing endpoints unchanged, with a test where one exists today |
| Migration | Each migration applies on an empty embedded database and on a copy with existing rows in CI |
| Manual check on a preview deployment | Sign-in, home page per role, one group page, one attendance save, installed app opens. Reported as "preview verified" only when done |

## 9. Production cutover strategy

1. Each phase is deployed alone. No phase is combined with another in one release.
2. Before a release: CI green, preview deployment checked, backup confirmed for a migration release, rollback step written.
3. Identity release: one deployment. Users see the FaithMap name at the next page load. Inform the leaders before the release, so that the new name is not read as a different or false system.
4. Phase 1 release: assignments start empty. Staff link people to groups over time. No group loses its present leader scope.
5. Phase 2 release: starts at a week boundary. Before the first period opens: the deadline time is configured (O8), body leaders have usable accounts, group leaders are informed. The first week can run with a small set of groups if the owner decides so; that choice is not made here.
6. After a release: check `/api/health` and `/api/ready`, sign in as one account per role, read the row counts of §4.
7. Each merge and each deployment needs the explicit approval of the owner.

Level of this plan: design only. No step in this section was run.
