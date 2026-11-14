# FaithMap — Executive Review

Date: 2026-11-14 · For: the project owner · Purpose: decide on the approval of the FaithMap transformation architecture and the implementation plan.

Status of all work to this date: **documents only**. No application code, database schema, migration, permission, production data or deployment was changed.
Verification level: **code verified** (source code was read). Not test verified. Not preview verified. **Not production verified.**

## 1. What is asked of the owner

1. Approve, change or reject the transformation architecture (§4).
2. Approve, change or reject the implementation plan (§5).
3. Answer the decisions that block the first stages (§8).

An approval of this review permits the next planning step (`/grill`). It does not permit code changes. Code changes for a ticket start only when that ticket has `Status: approved` in its `TICKETS.md`.

## 2. Document set (twelve documents in `docs/`)

| Document | Content | State |
|---|---|---|
| `FAITHMAP_EXECUTIVE_REVIEW.md` | This review | Complete |
| `FAITHMAP_EXISTING_SYSTEM_AUDIT.md` | Audit of 14 areas; product identity inventory; push subscription analysis | Complete |
| `FAITHMAP_PRODUCT_TRANSFORMATION.md` | FaithMap as the only product identity; REUSE / EXTEND / MODIFY / REPLACE / NEW / BLOCKED | Complete |
| `FAITHMAP_INTEGRATION_ARCHITECTURE.md` | How existing and new parts form one product | Complete |
| `FAITHMAP_MIGRATION_AND_REGRESSION_RISKS.md` | Nine sections: impact, migration, compatibility, data integrity, name and URL, rollback, risks, regression tests, cutover | Complete |
| `FAITHMAP_PHASED_IMPLEMENTATION_PLAN.md` | Six sections: rules, stages S0–S8, order, gates, blockers, not planned | Complete |
| `FAITHMAP_PHASE0_SYSTEM_AUDIT.md` | Mission-domain findings F1–F15, gap analysis, decision resolution | Complete |
| `FAITHMAP_PRODUCT_REQUIREMENTS.md` | Requirements R1–R10, metric definitions | Complete |
| `FAITHMAP_TARGET_ARCHITECTURE.md` | Proposed tables, rules, routes | Complete |
| `FAITHMAP_DATA_MAPPING.md` | Field → existing or proposed column | Complete |
| `FAITHMAP_PERMISSION_MATRIX.md` | Current permissions (verified in code) and target permissions | Complete |
| `FAITHMAP_IMPLEMENTATION_ROADMAP.md` | Mission phases 1–5 with acceptance criteria | Complete |

"Complete" means: the document has all its planned sections and no placeholder text. It does not mean that its proposals are approved or built.

## 3. Summary of the audit

- The existing system already has the parts that FaithMap needs as a base: a body → house mission group tree, a member register, attendance entry, follow-up items, PIN sign-in and a role system.
- The product name appears in 14 user-facing places. No table, column, page path or API path contains it. The name change needs no database change and no API change.
- The parts that do not exist: responsible-person assignments, weekly reports with draft and approval, an overview scoped to one body, a meeting brief, a scheduler, a notification sender, and LINE.
- Features outside house mission exist (events, announcements, ministries, worship, church profile, member app). No proposal removes them.

## 4. Architecture for approval

| Item | Proposal | Document |
|---|---|---|
| Product | One product, FaithMap, on the existing repository, database and URL. No second system | Product transformation §1 |
| Organization | Mission leadership → body → house mission group. No third level | Phase 0 audit §2 |
| Responsibility | Assignments of a person to a group with a responsibility and dates. Flexible per group. Scoped access only; no global permission | Target architecture §4.1, §5 |
| Weekly report | Draft with autosave → submit → supervisor review → body leader final approval → leadership overview | Integration architecture §4 |
| Fallback | No usable supervisor → body leader | Target architecture §5.3 |
| Blocked | No usable body leader → blocked, administrators notified, no skip, no automatic approval | Target architecture §5.3 |
| Deadline | Sunday, Asia/Bangkok. Time of day not set | Target architecture §4.2 |
| Data | Additive tables and columns only. No table, column, feature, page path or API path is removed | Migration risks §2 |
| Identity | FaithMap in every user-facing place. Internal identifiers stay where a rename has a cost and no user benefit | Product transformation §4, §5 |

## 5. Implementation plan for approval

| Stage | Content | Database change | Permission change |
|---|---|---|---|
| S1 Readiness | Decisions and read-only production checks | None | None |
| S2 Product identity | FaithMap name in texts, titles, manifest, notification title | None | None |
| S3 Organizational foundation | Assignments | New table | New scoped permissions |
| S4 Weekly reporting | Draft, submit, review, approval, blocked | New tables; two index changes on existing tables | New scoped permissions |
| S5 Mission overview | Scoped overview, meeting brief | New table | New scoped read |
| S6 Member care | Follow-up tracking, newcomers, attention items | Added columns and tables | Scoped |
| S7 LINE and LIFF | Linking, LIFF report, LINE notices | New tables | None new |
| S8 Identity completion | Project documents; optional domain | None | None |

Order: S1 first. S2 and S3 do not depend on each other; their order is decision P9. S4 follows S3. S5 and S6 follow S4. S7 follows S6.
Each stage is released alone, with a written rollback step. Each merge and each deployment needs the owner's approval.

## 6. New result of this review: push notifications

Source code analysis (`FAITHMAP_EXISTING_SYSTEM_AUDIT.md` §6):

- The server cannot send a push message. No push library and no server key exist in the code.
- The subscribe code in the member app saves a **simulated** subscription when the browser gives no real one, and tells the user that notifications are on. That message is false.
- Each press of the button can add one more simulated row to the real table.
- The server accepts any URL as a push endpoint. This is safe only while no sender exists.
- Group leaders and supervisors have no subscribe control at all.

Effect on the plan: earlier documents listed Web Push as an existing channel for reminders. That was wrong and is corrected in all documents. Reminders in S4 use in-app lists as the base channel. Real Web Push is new work and is built only if the owner selects it (decision O14).

Not known: how many simulated rows are in the production table. A read-only count is defined in the audit §6.4. It was not run.

## 7. Effect of the name change on users

Source code analysis (`FAITHMAP_MIGRATION_AND_REGRESSION_RISKS.md` §5.1):

| Component | Effect |
|---|---|
| Existing URLs | None. No path contains the product name |
| Sign-in | None. Cookies, sessions and PINs stay. No user is signed out |
| Web pages | An online user sees the new name at the next page load |
| Installed app | It stays the same app, because the manifest `id`, `start_url` and `scope` do not change. The label and icon on the home screen are refreshed by the device; some devices keep the old label until the user installs again. Not tested on the church's devices |
| Push subscriptions | The name change does not touch them. No subscription can receive a message today in any case (§6) |
| A new domain (optional) | A separate sign-in and a separate installed app on that domain. The old URL must stay in service. Not part of the default plan |

## 8. Decisions

### 8.1 Confirmed

| # | Decision |
|---|---|
| D0 | Care is not an org level. Care leader and coordinator are people assigned to groups |
| D1 | Draft uses autosave. A draft is not a submitted report |
| D2 | The body leader is the final approver |
| D3 | With no usable supervisor, the report goes to the body leader |
| D4 | The deadline is on Sunday, Asia/Bangkok |
| D5 | With no usable body leader: blocked, administrators notified, no skip, no automatic approval |
| D6 | Mission leadership sees the overview. It does not approve by default |
| D7 | Group leader writes and submits; supervisor reviews and requests revision; body leader reviews, requests revision and approves |
| D8 | FaithMap is the only product name. Thai name: ระบบบริหารพันธกิจบ้านและรายงานพันธกิจ. It is not a module of another product. No separate system is built |

### 8.2 Pending — needed before development starts

| # | Decision | Needed for |
|---|---|---|
| GT0 | Approval of the architecture (§4) and the plan (§5) | Everything |
| P1 | Exact display texts; place of the church name | S2 |
| P2 | FaithMap logo and icon files | S2 (a text wordmark is used until then) |
| P5 | Wording of the Privacy and Terms pages (church review) | S2 |
| P9 | Order of S2 and S3 | S2, S3 |
| O1 | Is each `org_level = 'care'` row one house mission group in production? | S3 |
| O2 | Is `members` the identity for assignments? | S3 |
| O5 | Mission leadership: the `staff` role, or a separate permission? | S3 |
| O10 | May a body leader manage assignments in the own body? | S3 |

### 8.3 Pending — needed before later stages

| # | Decision | Needed for |
|---|---|---|
| O8 | Deadline time on Sunday; week start day | S4 |
| O3 | Attendance store for the report | S4 |
| O4 | Self-review and self-approval | S4 |
| O9 | Scheduler runtime | S4 |
| O11 | Period snapshot of expected groups | S4 |
| O12 | Body leader approval before supervisor review | S4 |
| O13 | Recipients of the blocked notice | S4 |
| O14 | Notification channel before LINE: in-app lists only, or also real Web Push | S4 |
| P3 | Menu position of the features outside house mission | S5 |
| O7 | Visitor storage | S6 |
| O6 | Admin and staff access to personal data | After S5 |
| P4, P6, P7, P8 | Member app design; visual redesign; domain and repository name; historical documents | S8 or later |

No answer is assumed for any pending decision in any document.

### 8.4 Unverified

| Item | Reason | Check |
|---|---|---|
| All production data and the production schema | No database access | Read-only queries by an administrator |
| Live state of `https://puntakit-kalasin.vercel.app` | Not opened | Open and sign in |
| Vercel project settings, domains, environment variables, database backup function | No access | Read in the Vercel project |
| Test results on this branch | Not run | CI result or `pnpm check`, `pnpm test`, `pnpm build` |
| Behaviour per role at run time | App not run | Run with one account per role |
| Attendance day boundary error (F7) | Read in code, not reproduced | A test with a morning time in Asia/Bangkok |
| Duplicate attendance rows; duplicate group memberships | No database access | Read-only queries |
| Number of leaders with a usable account | No database access | Read-only query |
| Number of simulated push rows | No database access | Read-only query (audit §6.4) |
| Content of logo and icon images | Images not opened | View the files |
| Refresh of the installed-app label on the church's devices | No device test | Test on one Android and one iOS device after a preview release |
| LINE accounts of the church | No reference in the repository | Ask the church |

### 8.5 Blockers

| Blocker | Blocks | Removed by |
|---|---|---|
| GT0 not given | Any planning step after this review | Owner |
| P1 open | S2 | Owner |
| O1, O2, O5, O10 open; production checks 1 and 4 not run | S3 | Church, owner, administrator |
| Deadline time (O8) and O3, O4, O9, O11, O12, O13, O14 open | S4 | Church, owner |
| Attendance duplicate check not run | Unique index in S4 | Administrator |
| No FaithMap logo files | Logo and icon part of S2 | Owner |
| No LINE channel | S7 | Church |
| No ticket with `Status: approved` | Any code change | Owner |

## 9. Cross-document consistency check (2026-11-14)

Method: a search of all twelve documents for old terms and for decision numbers, and a read of the changed sections.

| Check | Result |
|---|---|
| All documents named in a reference exist | Pass |
| Every decision number in use (D0–D8, O1–O14, P1–P9) is defined | Pass |
| Report status list is the same in the architecture, the data mapping and the Phase 0 audit | Pass |
| Late mark uses `first_submitted_at` in every document | Pass |
| A draft is not counted as submitted in every document | Pass |
| The body leader is the only approver in every document | Pass |
| No document sets a deadline time | Pass |
| No document treats `staff` as mission leadership | Pass |
| No document names a parent product of FaithMap | Pass |
| Statements about Web Push | **Corrected in this review**: 8 documents |
| Document count in the phased plan | Corrected: twelve |

Conflicts found in this review and corrected:

| # | Conflict | Correction |
|---|---|---|
| K13 | Phase 0 audit F13 said "Web Push exists" and gave the path `/api/portal/push/*`. The code has storage only, at `/api/me/push/*`, and no sender | F13 and A12 corrected |
| K14 | The existing-system audit marked push delivery as unverified. The source code shows that no sender exists | X2 changed to a source-code fact; new §6 |
| K15 | The target architecture and the roadmap named Web Push as the reminder channel of Phases 2–4 | In-app lists are the base channel; Web Push depends on decision O14 |
| K16 | The transformation analysis classed Web Push notifications as MODIFY | Split: subscription storage MODIFY; delivery NEW |
| K17 | The phased plan gate GT3 required "real push delivery verified", which cannot pass | GT3 now requires decision O14 and the removal of the simulated path |

Limit of this check: it compares the documents with each other and with the source code. It does not compare them with production.

## 10. Recommendation

The technical view, for the owner's decision:

1. The architecture reuses the existing data and adds to it. No proposal deletes or converts existing data. The risk to existing users is low if the plan is followed.
2. S2 (product identity) has the lowest risk: no database change and no permission change.
3. The largest unknowns are in production, not in the design: O1, the number of leaders with a usable account, and duplicate attendance rows. The read-only checks should run before S3 is specified.
4. The simulated push subscription path should be removed early, independent of the other stages, because it gives users a false message today. This needs an approved ticket; it is not done.
