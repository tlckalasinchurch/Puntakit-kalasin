# FaithMap — Integration Architecture

Date: 2026-11-14 · Status: **proposed design, not approved, nothing implemented**.

Purpose: show how the existing parts and the new parts form one product, FaithMap.
This document does not define tables, columns or routes again. `FAITHMAP_TARGET_ARCHITECTURE.md` is the only source for them. Where the two documents differ, `FAITHMAP_TARGET_ARCHITECTURE.md` is correct for the data model and this document must be corrected.

## 1. Principles

1. One product, one application, one database, one sign-in. FaithMap is the product. The existing repository is its technical foundation.
2. One store per fact. A new capability reads existing tables where they hold the fact.
3. A new capability is built only where no existing part holds the fact or the rule.
4. Existing URLs and API paths stay in service.
5. An assignment gives scoped access only. It never gives a global permission.
6. The server enforces every scope rule.

## 2. System view

```
                         FaithMap (one web application)
 ┌───────────────────────────────────────────────────────────────────────┐
 │ Client: React SPA                                                       │
 │   Leadership and staff shell │ Field shell (mobile) │ Member shell      │
 │   LIFF entry (future) opens the same field screens                      │
 ├───────────────────────────────────────────────────────────────────────┤
 │ API: Express, one permission system (roles + assignment scope)          │
 │   existing routers (23)  │  new: /api/mission/*, assignments, cron, line│
 ├───────────────────────────────────────────────────────────────────────┤
 │ PostgreSQL: 27 existing tables  +  proposed tables (additive)           │
 └───────────────────────────────────────────────────────────────────────┘
   Scheduler: Vercel Cron → /api/cron/*      Channels: Web Push, LINE (future)
```

## 3. Integration by capability

"Source" names the document section that holds the detail.

| Capability | Existing part reused | New part | Integration point | Source |
|---|---|---|---|---|
| Organization management | `groups` (body, house mission group), `/org`, `/groups`, `/map` | None | The tree is read as it is. No third level | Phase 0 audit §2 |
| Group assignments | `members`, `users`, `server/lib/groupAccess.ts` | `group_assignments`, scope resolver | The resolver adds assignment scope to the existing leader scope. Existing leader fields keep their effect | Target architecture §4.1, §5 |
| Member management | `members`, `group_members`, `membership_terms`, import flow | None in Phases 1–3 | Assignments point to the same person record. No second identity table | Data mapping §3 |
| Attendance | `attendance_records`, `/care` roster, bulk save | None (decision O3 pending) | The report's attendance step uses the same roster and the same table | Target architecture §4.3 |
| Visitor lifecycle | `members` with status `visitor`, consent columns | `newcomer_tracks` (decision O7 pending) | 1:1 with the visitor's person record | Target architecture §4.8 |
| Weekly reporting | Group, roster, attendance, `media_assets` | `reporting_periods`, `weekly_reports`, period snapshot (O11 pending) | A report belongs to one period and one group. Draft autosave; explicit submit | Target architecture §4.2, §4.3 |
| Review and approval | Assignment scope | `weekly_report_events`, routing rules | Supervisor review → body leader final approval; fallback; blocked state | Target architecture §5.3 |
| Follow-up management | `follow_ups`, `/follow-up` | Added columns, `follow_up_events` | Automatic items use the same table as manual items | Target architecture §4.7 |
| Dashboard and analytics | `/api/org/overview`, existing dashboard | Scoped overview, `body_summaries`, `meeting_briefs` | Numbers are computed from reports and attendance. A missing report is "unknown" | Product requirements §5 |
| Notifications | `push_subscriptions`, service worker | Scheduler routes, sent log | One reminder per person, event and period. Finding X1 must be resolved first | Target architecture §8 |
| LINE and LIFF | PIN session | `line_accounts`, LIFF routes | LIFF opens the same screens and gets the same session cookie | Target architecture §9 |

## 4. Confirmed report workflow

```
Group leader ──► draft (autosave) ──► submit ──► supervisor review ──► body leader final approval ──► mission leadership overview
                                         │              ▲
                                         │              │ request revision (with reason) returns to the group leader
                                         │
                 no usable supervisor ───┴──────────────────────────► body leader final approval

                 no usable body leader ──► Blocked: administrators notified; no skip; no automatic approval
```

- The deadline is on Sunday, Asia/Bangkok. The time of day is not decided (O8). No time is assumed.
- Rules and data: `FAITHMAP_TARGET_ARCHITECTURE.md` §4.3 and §5.3. Permissions: `FAITHMAP_PERMISSION_MATRIX.md` §2.

## 5. Flexible responsibility

The model does not force one supervision structure on all groups.

| Real case | Assignments on the group | Review path |
|---|---|---|
| The body leader supervises the group directly | Group leader only | Body leader |
| A care leader supervises the group | Group leader + care leader (primary) | Care leader → body leader |
| A care leader supervises, a coordinator helps | Group leader + care leader (primary) + coordinator | Care leader, else coordinator → body leader |
| The supervisor has no usable account | As assigned | Body leader (fallback) |
| The body has no usable body leader | As assigned | Blocked |

An assignment gives access to its group only, or to the groups of its body for a body leader, and only while it is active.

## 6. Information architecture (proposed)

The final navigation depends on decision P3 (`FAITHMAP_PRODUCT_TRANSFORMATION.md` §6). This section fixes only what the confirmed requirements need.

| Area | Pages | State |
|---|---|---|
| Mission overview | `/mission`, `/mission/bodies/:id`, `/mission/groups/:id`, `/mission/reports/:id`, `/mission/brief/:id` | New (roadmap Phases 1–3) |
| Weekly report (field) | `/report` | New (roadmap Phase 2) |
| Field work | `/care`, `/follow-up`, `/members`, `/groups` | Existing, kept |
| Directory and map | `/org`, `/groups`, `/map` | Existing, kept |
| Staff work | `/attendance`, `/inbox`, `/reports`, `/import/*`, `/admin/*` | Existing, kept |
| Other existing features | `/events`, `/announcements`, `/ministries`, `/worship`, `/church`, `/feed`, `/media`, `/app/*` | Existing, kept. Position in navigation: P3 |

No existing path is removed or redirected in this design.

## 7. Boundaries between existing and new parts

| Boundary | Rule |
|---|---|
| `mission_submissions` (Inbox) and `weekly_reports` | Separate. The Inbox takes raw messages for staff. The weekly report is the only weekly path for a group leader |
| `/` Operations dashboard and `/mission` overview | Both stay. Which page is the home page for each role: P3 |
| `groups.leader_id` and `group_assignments` | Both give scope in Phase 1. A later, separately approved step can make assignments the only source |
| `/api/org/*`, `/api/dashboard/*` and `/api/mission/overview` | Existing endpoints stay unchanged and church-wide for staff roles. The new endpoint is scoped |
| Manual follow-ups and automatic attention items | One table. Automatic items carry a source key so that a job creates each item once |

## 8. External integrations

| Integration | State today | FaithMap |
|---|---|---|
| Vercel hosting | In use (SOURCE: `vercel.json`) | Kept |
| PostgreSQL provider | Selected by `DATABASE_DRIVER` (SOURCE). Production value UNVERIFIED | Kept |
| Vercel Blob | Allowed in the Content-Security-Policy (SOURCE). Use in production UNVERIFIED | Kept |
| Map tiles (OpenFreeMap, ArcGIS) | Allowed in the Content-Security-Policy | Kept |
| Web Push | Subscription storage exists. Real delivery UNVERIFIED (finding X2) | Verify before reminders |
| LINE | None | Roadmap Phase 5; needs the church's LINE channel |
| Email | None | None planned |

## 9. Pending decisions that this document depends on

O1, O2, O3, O5, O7, O8, O10, O11, O12, O13 (`FAITHMAP_PHASE0_SYSTEM_AUDIT.md` §8.2) and P3, P7 (`FAITHMAP_PRODUCT_TRANSFORMATION.md` §6).
