# FaithMap — Product Transformation Analysis

Date: 2026-11-14 · Status: **proposed, not approved, nothing implemented**.
Evidence: `FAITHMAP_EXISTING_SYSTEM_AUDIT.md` (identity inventory I1–I14, identifiers T1–T11) and `FAITHMAP_PHASE0_SYSTEM_AUDIT.md` (findings F1–F15, gaps A, B, C).

## 1. Product identity (confirmed by the owner)

| Item | Value |
|---|---|
| Product name | **FaithMap** |
| Thai name | ระบบบริหารพันธกิจบ้านและรายงานพันธกิจ |
| Definition | A complete house mission management platform |

Rules:
1. FaithMap is the only product name. No screen shows "Puntakit" as a product name.
2. FaithMap is not a module of another product. No document or screen describes a parent product.
3. No second system is built. The existing repository, database, API and components are the technical foundation of FaithMap.
4. "Puntakit" can stay in internal technical identifiers where a rename has a cost and no user benefit (§5). An internal identifier is not a product name.
5. The existing repository name and the existing URL are technical facts. They do not set the product name.

In this document set, "the existing system" means the code and data in the repository. It is not a product.

## 2. Classification method

| Class | Meaning |
|---|---|
| REUSE | Works for FaithMap as it is |
| EXTEND | Keep, and add a capability |
| MODIFY | Change the existing part |
| REPLACE | The existing part does not fit; a different part takes its place. The old data is kept |
| NEW | Does not exist |
| BLOCKED | Cannot proceed; the reason and the owner are given |

## 3. Capabilities

The detail of each row is in the gap named in the last column (`FAITHMAP_PHASE0_SYSTEM_AUDIT.md` §4).

| FaithMap capability | Class | Existing part | Change | Gap |
|---|---|---|---|---|
| Body → house mission group tree | REUSE | `groups`, `/org`, `/api/org/overview` | None | A1 |
| Group profile, photos, map | REUSE | `groups`, `media_assets`, `/map` | None | A2, A10 |
| Wording of the org model | MODIFY | UI labels | "Care" shown as a person's responsibility, never as a unit | B1 |
| Responsible-person assignments | NEW | — | `group_assignments` | C1 |
| Imported leader names as text | MODIFY | `groups.description` lines | Link to a person by human confirmation; keep the text | B8 |
| Group change history | EXTEND | `audit_logs` | Before and after values | B2 |
| Member register | REUSE | `members`, `group_members`, `/members` | None | A3 |
| Member transfer history | MODIFY | Unique index on `group_members` | Partial index, after a production pre-check | B3 |
| Visitor lifecycle | EXTEND | `members` with status `visitor` | `newcomer_tracks` | B6 |
| Attendance entry | REUSE | `attendance_records`, `/care`, `/attendance` | None | A4 |
| Attendance uniqueness and day boundary | MODIFY | Check in code; server-time day | Unique index; Asia/Bangkok day | B4 |
| Consecutive absence | REUSE | `/api/attendance/absentees` | None | A5 |
| Weekly mission report with draft autosave | NEW | — | `reporting_periods`, `weekly_reports` | C2, C3 |
| Supervisor review, body leader final approval, blocked state | NEW | — | `weekly_report_events`, routing rules | C4 |
| Body summary | NEW | — | `body_summaries` | C5 |
| Raw field messages for staff (Inbox) | REUSE | `mission_submissions`, `/inbox` | None. It is not the weekly report | F4 |
| Mission activity record and Feed | REUSE | `mission_activities`, `/feed` | Optional link from a report | A6 |
| Follow-up | EXTEND | `follow_ups`, `/follow-up` | Type, priority, result, history | B5 |
| Automatic attention items | NEW | — | Job over existing data | C8 |
| Leadership dashboard | REPLACE | `/` Operations dashboard as the main view of the mission work | Mission Overview takes that function. The existing dashboard and its API stay available. Which page opens first for each role is decision P3 | C7, B7 |
| Overview scoped to one body | NEW | Church-wide endpoints only | Scoped endpoints | B7 |
| Meeting brief | NEW | — | `meeting_briefs` | C6 |
| Sign-in, sessions, roles | REUSE | PIN auth, `USER_ROLES` | None | A8 |
| Scope from assignments | EXTEND | `server/lib/groupAccess.ts` | One resolver; no global permission from an assignment | C1 |
| Scheduler | NEW | — | Vercel Cron routes | C9 |
| Subscription storage for Web Push | MODIFY | `push_subscriptions`, subscribe route, service-worker handler | Remove the simulated subscription path and the false success message | X1, audit §6 |
| Web Push delivery | NEW (if decision O14 selects it) | None: no sender and no server key exist | Key pair, sender, sent log, endpoint host check | X2, audit §6 |
| LINE and LIFF | NEW | — | `line_accounts`, LIFF routes | C10–C12 |
| LINE channel of the church | BLOCKED | — | The church must own a LINE Official Account, a LINE Login channel and a LIFF app | — |

Features outside house mission (finding X4): events, announcements, ministries, worship, church profile, the member shell, Excel import, membership lifecycle. Class: **REUSE, position pending (decision P3)**. This analysis removes none of them. Whether FaithMap shows each one in its navigation is a decision of the owner.

## 4. Product identity changes

Each row refers to the inventory in `FAITHMAP_EXISTING_SYSTEM_AUDIT.md` §3.1.

| # | Place | Class | Proposed change |
|---|---|---|---|
| I1 | Default browser title | MODIFY | "FaithMap" plus the Thai name. Exact text: decision P1 |
| I2 | Per-page browser title | MODIFY | "<page> · FaithMap" |
| I3 | iOS home-screen title | MODIFY | "FaithMap" |
| I4 | PWA manifest: name, short name, description | MODIFY | FaithMap name and the FaithMap definition. `id`, `start_url` and `scope` stay unchanged, so an installed app stays the same app |
| I5 | Wordmark in the admin shell | MODIFY | "FaithMap". The line with the church name: decision P1 |
| I6 | Sign-in page: wordmark, labels, instruction | MODIFY | "FaithMap" in all four texts. One test asserts the old alt text and changes in the same pull request |
| I7 | Logo file | BLOCKED | No FaithMap logo exists in the repository. The owner supplies it (decision P2). Until then the text wordmark is used and the old image is not shown |
| I8 | App icons | BLOCKED | Same as I7. First check whether the present icons show the old name |
| I9 | Member shell wordmark | MODIFY | "FaithMap". The lamb mascot is a design asset, not a product name; it stays unless the owner decides otherwise (decision P4) |
| I10 | Push notification title | MODIFY | "FaithMap" in the service worker and in the server route |
| I11 | Attendance export field | MODIFY | The real church name or "FaithMap": decision P1 |
| I12, I13 | Privacy and Terms pages | MODIFY | "ระบบ FaithMap". These are legal texts; the church reviews the wording (decision P5) |
| I14 | Import page file-name hint | MODIFY | Neutral file name in the hint. The import accepts any file name |
| — | Dashboard, navigation labels, page headings | REUSE | No product name appears in them today. Labels change only for the org wording (B1) and the new pages |
| — | Loading and error states, API messages | REUSE | No product name appears in them |
| — | Email templates | — | None exist |
| — | Project documents (`CLAUDE.md`, `PRODUCT.md`, `brand-spec.md`, `design.md`, `AGENTS.md`, `MASTER_PROMPT.md`, `DEPLOYMENT.md`) | MODIFY | State FaithMap as the product. Keep technical facts. `CLAUDE.md` is the instruction file for development tools and must stay accurate |
| — | Historical documents `PUNTAKIT_*.md` | REUSE | Records of past work. See T11 in §5 |

Design system: the tokens in `client/src/index.css` (Premium Teal palette, Prompt typeface) are not a product name. A visual redesign for FaithMap is a separate decision (P6). Without that decision the existing design system stays.

## 5. Internal technical identifiers — impact analysis

No identifier in this table is renamed without this analysis and an approved ticket.

| # | Identifier | Effect of a rename | Database | API | Imports | External | Deployment | Proposal |
|---|---|---|---|---|---|---|---|---|
| T1 | Cookies `puntakit_session`, `puntakit_csrf` | Every signed-in user is signed out once. A dual-read period is needed to avoid that | None | Request headers and cookies | 2 server files, 1 client file | None | None | **Keep.** Not visible to users |
| T2 | `PUNTAKIT_*` environment variables | A missed variable disables demo mode, test auth or the media directory | None | None | Server, Vite config, 45 test files | None | Vercel settings and local `.env.local` must change at the same time | **Keep.** A later rename needs a period that reads both names |
| T3 | Browser storage keys | Each user loses the sidebar state and the remembered group once | None | None | 2 client files | None | None | **Keep** |
| T4 | Service-worker cache name | A new name clears the old cache at activation. That is the designed update path | None | None | 1 file | None | None | **Change with a version step** when the precached files change (new icons). Not a branding item by itself |
| T5 | Browser event name | None for users | None | None | Client only | None | None | **Keep** |
| T6 | Hash salt `puntakit-seed-v1` | Imported rows get different ids. A new import then creates duplicates of existing rows | **Data integrity risk** | None | 1 file | None | None | **Never change** |
| T7 | Demo account `demo@puntakit.local` | Local development and the seed script stop working until all places change | Local only | None | Server, seed, tests | None | None | **Keep** |
| T8 | Package name | None at run time | None | None | None | None | None | Optional. Low value |
| T9 | Temporary directory prefix | None | None | None | 1 file | None | None | **Keep** |
| T10 | Repository name; URL `puntakit-kalasin.vercel.app` | Repository: GitHub redirects the old name, but CI settings, the Vercel link and local clones need a check. URL: see `FAITHMAP_MIGRATION_AND_REGRESSION_RISKS.md` §5 | None | Same-origin API | None | Vercel–GitHub link; installed apps; push subscriptions | Vercel project | **Keep the old URL in service in every case.** A new name or domain is decision P7 |
| T11 | Document names `PUNTAKIT_*.md` | 5 code comments and `CLAUDE.md` point to these names | None | None | Comments only | None | None | **Keep the names.** Add a short note at the top of each file: historical record, the product is FaithMap. Decision P8 |

Table names, column names and API paths contain no product name (audit §2.3, §2.4). The transformation needs no rename in the database or in the API.

## 6. Pending decisions of the transformation

No answer is assumed. The mission-workflow decisions O1–O13 are in `FAITHMAP_PHASE0_SYSTEM_AUDIT.md` §8.

| # | Decision | Effect while open | Owner |
|---|---|---|---|
| P1 | Exact display texts: title, the line under the wordmark, the place of the church name "คริสตจักรชีวิตสุขสันต์กาฬสินธุ์" | The identity pull request cannot be written | Owner |
| P2 | FaithMap logo and icon files | I7 and I8 stay blocked; a text wordmark is used | Owner |
| P3 | Position of the features outside house mission in FaithMap navigation | The navigation design cannot be final. No feature is removed in any case | Owner + church |
| P4 | Member shell: keep the lamb design and the `/app` shell under the FaithMap name? | Member shell texts change only in the name | Owner |
| P5 | Wording of the Privacy and Terms pages | Legal texts keep the old name until reviewed | Church |
| P6 | Visual redesign for FaithMap, or keep the existing design system | The existing design system stays | Owner |
| P7 | A FaithMap domain, a new Vercel project name, a new repository name | The old URL stays the only URL | Owner |
| P8 | Historical documents: keep names with a note, or rename | Names stay | Owner |
| P9 | Order: identity change before, with or after roadmap Phase 1 | See `FAITHMAP_PHASED_IMPLEMENTATION_PLAN.md` | Owner |

## 7. Result against the definition of done

| Requirement | State |
|---|---|
| FaithMap is the only product identity | Proposed for every user-facing place (§4). Not implemented |
| No parent product | Stated in §1; the earlier wording in `FAITHMAP_PRODUCT_REQUIREMENTS.md` §1 is corrected |
| Reusable capabilities identified | §3 |
| Required changes identified | §3, §4, §5 |
| No loss of existing data in any proposal | No table, column, feature, URL or API path is removed |
