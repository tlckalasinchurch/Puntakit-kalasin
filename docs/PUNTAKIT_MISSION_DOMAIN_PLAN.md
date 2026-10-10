# Puntakit — Mission Domain Plan

Status: **PARTIALLY IMPLEMENTED.** Phase 1 (read-only source audit) and Phase 2
(L1/L2 import infrastructure: migration `0008_import_audit`, the normalization
engine, the `/api/import` routes, and the read-only `group_members` pre-check)
are built and tested. Migration step 2 onward is still proposed only.

Date: 2026-10-02 · revised 2026-10-03 · annotated 2026-10-09 (documentation only)
Scope: งานพันธกิจบ้าน (mission groups) from the Excel registration workbooks
Source data: 6 churches · 8 `.xlsx` files · 8 distinct sha256 · 674 member rows
across 75 worksheets · ~23 groups · 0 coordinates

> **2026-10-09 annotation — PROPOSED, not accepted, not implemented.** The product
> owner described a three-level organisation (body → a new middle "แคร์" level →
> the existing `care` level, which the UI calls "พันธกิจ"; about 6 / 20 / 52
> units, about 49 operating) with role-scoped access, a weekly report that
> confirms whether the group actually met, and goals/statistics rolled up from
> that data. Those figures are **NOT VERIFIED**: the source workbooks and the
> sample report are not on the machine that reviewed this, they disagree with the
> "~23 groups" above (the audit counted 72 member sheets), and "20" cannot be
> checked against the database at all because the middle level does not exist in
> it. The organisation direction is **conditional on a production check (Q24)
> that has not been done.**
> The requirements — and the single terminology table — live in
> [`ADR 002`](./adr/adr-002.md) (levels, terminology, production check),
> [`ADR 003`](./adr/adr-003.md) (scoped permissions, `team_lead`, personal data) and
> [`ADR 004`](./adr/adr-004.md) (weekly report workflow, metric definitions).
> This plan does not repeat them. Where it disagrees with them, the places are
> marked **[ADR-conflict]** below; nothing else in this plan was changed. No
> schema, migration or code was touched.

## Decision log

| # | Decision | Answer |
|---|---|---|
| Q1 | Source of truth | Content-verified: เมือง 2(1) = exact duplicate of เมือง 2 (79/79 identical); เมือง 1 New = เมือง 1 + one non-member sheet (131/131 identical) |
| Q2 | Member identity | UUID identity; `nickname` is the display value; `realName` nullable; never derive one from the other |
| Q3 | Group aggregate | Option A — extend the existing `groups` table |
| Q4 | Prompt vs code | Codebase wins for stack (recharts, sonner, brand tokens) |
| Q5 | Checkbox meaning | Do not interpret. Store raw + convention + provenance; semantics only after a human confirms |
| Q6 | Sparse checkbox fields | Store, report completeness, do not force into UI |
| Q7 | Map | No coordinates exist. Humans place pins. Never derive |
| Q8 | Membership history | **Decided 2026-10-03.** Keep `group_members` as the source of truth; swap its full unique index for `UNIQUE (group_id, member_id) WHERE left_at IS NULL` so join → leave → rejoin is possible. No new table |
| Q9 | `members.name` | Phased migration: add `realName`, derive `displayName`, retire `name` last |
| Q10 | `members.group` | Stays legacy text, retired last. It is not repointed at a new table — the partial unique index is what makes the backfill into `group_members` possible, and `members.group` retires after that history is real |
| Q11 | Excel-only member fields | New `mission_member_details` (1:1) |
| Q12 | Weekly report | New `weekly_reports` / `weekly_report_attendance` / `weekly_report_activities` |
| Q13 | Geography | Flat `areas` table |
| Q14 | Org levels *(proposed 2026-10-09, conditional on Q24)* | Three levels: `body` → a new middle level ("แคร์", technical name undecided) → existing `care` (UI "พันธกิจ"). `careGroupId` keeps its meaning; no UI label with an existing church decision is changed. See ADR 002 |
| Q15 | Scoped access *(proposed 2026-10-09)* | Scope = real group leadership (`leaderId`, `coLeaderId`) + `parentGroupId` hierarchy; read/create/update/approve/export/delete separated; new `team_lead` role (requirements recorded, not created); no `admin` as team lead; statistician role deferred. See ADR 003 |
| Q16 | Weekly report workflow *(owner-confirmed 2026-10-09; ADR still proposed)* | `draft → submitted → needs_revision \| acknowledged` + `superseded`; submitters are the leaders defined by `getLedGroupIds`; the middle-level leader acknowledges or returns it; body leader and team lead read only. See ADR 004 |
| Q17 | Headline metric *(owner-confirmed 2026-10-09; ADR still proposed)* | Official figure = acknowledged reports that say the group met; pending acknowledgement shown separately; denominator = `active` groups; "no report" is never counted as "did not meet". See ADR 004 |
| Q18 | Report week *(owner-confirmed 2026-10-09; ADR still proposed)* | Monday–Sunday, Thai time, `weekStart` stored as a plain date. See ADR 004 |
| Q19 | Report versions *(owner-decided 2026-10-09: option "ก"; ADR still proposed; **design unproven**)* | Two partial unique indexes — one current non-draft version, and one open draft, per group per week — with an atomic "supersede the old version, then promote the draft" submit; a returned (`needs_revision`) report is also revised through a new version. See ADR 004 |

*Q14–Q19 are this log's own numbering; they are not the question numbers used in the 2026-10-09 working session. The ADRs hold the authoritative wording and the Open decisions.*

## Standing rules

```
NEVER DERIVE BIRTH DATE FROM AGE.
NEVER USE NICKNAME AS REAL IDENTITY.
NEVER USE NICKNAME TO FILL REAL NAME.
NEVER USE GROUP NAME TEXT AS RELATIONSHIP IDENTITY.
NEVER TURN UNKNOWN DATA INTO FACT.
```

---

## Implementation status (revised 2026-10-03)

| Item | State | Where |
|---|---|---|
| Phase 1 — read-only source audit | **Done.** 8 files, 75 worksheets, 674 member rows, every sha256 verified | `docs/PUNTAKIT_MISSION_SOURCE_AUDIT.md`, `server/scripts/audit-mission-workbooks.ts` |
| L1/L2 tables + migration | **Done.** `0008_import_audit` is additive only and does not touch `group_members` | `shared/schema.ts`, `server/db/migrations/0008_import_audit.sql` |
| Normalization engine | **Done.** 7 rules at `NORMALIZATION_VERSION = 1`; bad values are quarantined, never guessed | `server/lib/missionImport.ts` |
| `/api/import` routes | **Done.** upload · batches · preview · report · duplicates · rule confirm | `server/routes/import.ts` |
| Step 0 pre-check | **Written and reachable in production** — `GET /api/import/precheck/group-members` (admin) runs the same read-only function against the live Neon database | `server/lib/groupMembersPreCheck.ts`, `server/routes/import.ts`, `server/scripts/pre-migration-check.ts` |
| `0010_group_members_history` | **Dry-run SQL written** at `server/db/pending/0010_group_members_history.sql`; not applied, gated on step 0 | §13 |
| Migration steps 2, 4–7 and the whole L3/L4 surface | **Not started** | — |

At this revision `pnpm check` is clean and `pnpm test` reports 26 files / 303
tests green.

Two things deliberately do not exist yet: a promotion path from L2 into L3, and
any meaning attached to `1` or `/` (Q5). The importer stops at "recorded
faithfully and reported", which is the honest state of this data.

---

## 1. Final Domain Model

Four layers. Each layer knows nothing about the one above it.

### L1 — Raw Source (append-only)

Verbatim cells exactly as they appear in the workbook. Never edited, never
overwritten. This layer is what makes every later decision reversible.

- `import_batches` — one per uploaded file
- `import_source_rows` — one per member row, holding every original cell value
- `import_source_cells` — optional, only if a cell-level audit trail is required

### L2 — Normalized (opaque)

Structural cleanup only: trim, case-fold, type-coerce, detect layout variant.
**No business meaning is assigned here.** The checkbox codes stay opaque because
their semantics are unconfirmed (Q5).

- `normalization_rules` — the versioned rule set that produced this layer
- `import_row_norm` — one row per source row, values normalized but still opaque

### L3 — Business

The organisation as it actually is. No knowledge of Excel exists here. This is
what every screen and every API reads.

- `areas`, `groups`, `members`, `group_members` (existing table, made
  history-capable), `mission_member_details`, `weekly_reports`,
  `weekly_report_attendance`, `weekly_report_activities`, plus everything
  already present (`missionActivities`, `attendanceRecords`, …)

### L4 — User-Facing

Thai labels and vocabulary, in `shared/labels.ts`. Changing a label is a
one-line change that propagates everywhere.

---

## 2. Final Database Schema

### New tables

```ts
// ── L1 raw ──────────────────────────────────────────────
import_batches
  id, sourceFileName, fileChecksum, layoutVariant, checkboxConvention,
  sheetName, rowCount, memberCount,
  importedById → users, createdAt

import_source_rows
  id, batchId → import_batches,
  sheetName, excelRow, team,
  rawFullName, rawNickname, rawAge, rawOccupation, rawWorkplace,
  rawMarital, rawBeliefYear, rawResponse, rawParticipation, rawGoal,
  rawMaritalCheckbox, rawResponseCheckbox,
  rawParticipationCheckbox, rawGoalCheckbox,
  createdAt                     -- append only, no updatedAt on purpose

// ── L2 normalized ───────────────────────────────────────
normalization_rules
  id, version, fieldKey, layoutVariant, ruleKind, fromPattern, toCode,
  confidence, confirmedById → users, confirmedAt, createdAt

import_row_norm
  id, sourceRowId → import_source_rows,
  fullName, nickname, age, occupation, workplace, beliefYear,
  maritalCode, responseCode, participationCode, goalCode,  -- opaque strings
  normalizedAt

// ── L3 business ─────────────────────────────────────────
areas
  id, province, district, subdistrict, village,
  displayName, normalizedName, createdAt, updatedAt
  UNIQUE (normalizedName)

// ── L3 business — no new membership table ───────────────
group_members                              (existing; migration 0010 alters it)
  id, groupId → groups, memberId → members,
  role, status, joinedAt, leftAt, createdAt, updatedAt   -- already present
  UNIQUE (group_id, member_id)                          -- dropped
  UNIQUE (group_id, member_id) WHERE left_at IS NULL    -- replaces it, partial

mission_member_details
  memberId → members UNIQUE (1:1),
  occupation, workplace, ageAtRegistration,
  maritalStatusCode, beliefYear,
  responseAttitudeCode, participationCode, missionGoalCode,
  createdAt, updatedAt

weekly_reports
  id, groupId → groups,
  weekStart, weekEnd,
  submittedBy → members, submittedByUserId → users,
  attendanceCount, notes, status, submittedAt, createdAt, updatedAt
  UNIQUE (group_id, week_start)

weekly_report_attendance
  id, weeklyReportId → weekly_reports, memberId → members,
  attendanceStatus, createdAt
  UNIQUE (weekly_report_id, member_id)

weekly_report_activities
  id, weeklyReportId → weekly_reports,
  activityType, description, createdAt
```

> **[ADR-conflict] `weekly_reports` as written above cannot serve ADR 004.**
> It has no field saying whether the group met, no reviewer, and its
> `UNIQUE (group_id, week_start)` forbids keeping a superseded version beside the
> current one (§9 asks for both). ADR 004 therefore proposes — as design notes,
> **not DDL** — a `held` flag (+ optional reason), reviewer/review time/return
> note, and `version` / `supersedes_id` / `superseded_at`. A single
> `UNIQUE (group_id, week_start) WHERE superseded_at IS NULL` would collide while a
> new draft exists beside the current version, so the owner chose **two** partial
> unique indexes (ADR 004, option "ก"): one current **non-draft** version per
> group per week (`… WHERE superseded_at IS NULL AND status <> 'draft'`) and one
> open draft per group per week (`… WHERE status = 'draft'`). Submitting a new
> version supersedes the old one first and then promotes the draft, in one atomic
> write. **This design is unproven** — there is no DDL and no test, and the repo's
> only partial-index test (`pendingMigration0010.test.ts`) covers a single index.
> Nothing was built.

### New columns on existing tables

```ts
groups:
  groupKind        text default 'care_group'   -- discriminator, see §18
  teamCode         text                        -- "A".."G" from the workbook
  villageName      text
  coordinatorName  text                        -- NOT a users FK
  coordinatorPhone text
  areaId           → areas
  latitude / longitude   -- currently text, migrate to numeric (see §15)

members:
  realName         text   -- nullable, the true ชื่อ-สกุล
```

---

## 3. Relationship Diagram

```
users ──────────────┐
 (Clerk identities)  │
      │              │ importedById
      │              ▼
      │        import_batches ──1:N── import_source_rows ──1:1── import_row_norm
      │                                                          │
      │                                                    (validation + dedup)
      │                                                          ▼
      ▼                                                       members
areas ──1:N── groups ──1:N── group_members ──N:1── members
            │                        │
            │                        └── leftAt = NULL      → current membership
            │                        └── leftAt IS NOT NULL → history
            │ 1:1
            ▼
     mission_member_details

groups ──1:N── weekly_reports ──1:N── weekly_report_attendance ──N:1── members
                    │
                    └──1:N── weekly_report_activities

groups ──1:N── attendance_records      (existing — reused unchanged)
groups ──1:N── mission_activities      (existing — reused unchanged)
```

**What the diagram makes explicit**

- Membership is an association with history, not a column.
- `mission_member_details` is 1:1 and carries only workbook-sourced facts.
- Weekly attendance reuses `members`, never a snapshot copy.
- `attendance_records` and `weekly_reports` are different things: one records
  observed attendance on a known date, the other is a self-reported weekly
  summary. They are not duplicates and must not be merged.

---

## 4. Legacy Fields to Deprecate

| Table | Field | Why it is legacy | Retirement |
|---|---|---|---|
| `members` | `name` | Implies a real full name; 96% of imported rows have none | Last, after §Q9 phase 2 |
| `members` | `group` | Text, not a relation — blocks all membership history | After `group_members` carries a real `left_at` history (§13 step 5) |
| `members` | `area` | Duplicates `groups.area`, ignores residence vs group area | After `residenceAreaId` exists |
| `members` | `role` | Thai free text defaulting to "สมาชิก" | Migrate to `USER_ROLES` |
| `groups` | `area` | Free text, filtered by `ILIKE` | After `areaId` is populated |
| `groups` | `latitude` / `longitude` | Stored as `text`, not numeric | Migrate to `numeric(9,6)` |
| `groups` | `category` | Closed enum of 14 care-group values | Mission groups use `groupKind` |

**Rule while these remain:** no new feature may depend on them. Existing read
paths keep working until the migration phase explicitly repoints them.

---

## 5. Excel → Raw Source Mapping

One `import_source_rows` row per member row. Values stored exactly as read.

| Excel header | Raw column | Observed state |
|---|---|---|
| `ที่` | `sequence` | 1..N |
| `ชื่อ-สกุล` | `rawFullName` | **4% filled** |
| `ชื่อเล่น` | `rawNickname` | 100% filled |
| `อายุ` | `rawAge` | 80% filled |
| `อาชีพ (ระบุ)` | `rawOccupation` | free text |
| `สถานที่เรียน / ทำงาน` | `rawWorkplace` | free text, often "บ้าน…, ตำบล…" |
| `สถานภาพครอบครัว` + legend cols | `rawMaritalCheckbox` | 12% filled |
| `วันรับเชื่อ` | `rawBeliefYear` | 87% filled, bare 4-digit year |
| `ท่าทีการตอบสนอง` + legend cols | `rawResponseCheckbox` | 18% filled |
| `การเข้าร่วมกลุ่ม` + legend cols | `rawParticipationCheckbox` | 27% filled |
| `เป้าหมายในการสร้าง` | `rawGoal` | 94% filled, 17 spellings |
| row 1 title | `team`, sheet name | group name + team code |

**Column layouts (3 confirmed variants)** — detected per sheet, never assumed:

| Variant | Detected on | Nickname | Age | Believ | Response | Particip | Goal |
|---|---|---|---|---|---|---|---|
| A | 7 workbooks | AA | AB | AI | AJ | AM | AQ |
| B | 7 workbooks | AA | AB | AH | AI | AL | AP |
| C | `หนองบัว` in the New file | C | D | K | L | O | S |

Detection is by **header text**, not column letter, so a future layout shift
still resolves.

**Two checkbox conventions coexist:** the marker is the literal `1` in most
workbooks and the literal `/` in at least one. Both are recorded on the batch
row as `checkboxConvention`, and the raw value is kept verbatim either way.
## 6. Raw → Normalized Mapping

Normalization is structural only. It never decides meaning.

| Step | Rule | Example |
|---|---|---|
| Trim | strip ends, collapse inner whitespace | `" หนู  "` → `"หนู"` |
| Coerce age | numeric only, reject non-numeric | `"60.0"` → `60` |
| Coerce year | 4-digit year, reject future years | `"2021.0"` → `2021` |
| Marker | record convention, keep value verbatim | `1` / `/` both preserved |
| Goal spelling | cluster by similarity, keep the raw variant | `ผู้เชื่อผุกพัน` joins the `ผู้เชื่อผูกพัน` cluster, original retained |
| Area parse | split `workplace` when it embeds a locality | `"บ้านหนองบัว ,ตำบลโพนทอง"` → village + subdistrict, original retained |

Every rule is a row in `normalization_rules` with a version and a confidence.
An unconfirmed rule has `confirmedById = NULL`, and its output stays in L2 only
— it is **not** promoted into `members` or `mission_member_details`.

The goal field yields **17 raw variants**. Until a human confirms which clusters
are real, `mission_goal_code` stays opaque.

---

## 7. Normalized → Business Mapping

Promotion from L2 into L3 happens only through an explicit, confirmed step.

| Normalized | Business target | Rule |
|---|---|---|
| `nickname` | `members.nickname` | Direct. Never into `realName` |
| absent real name | `members.realName = NULL` | Never inferred |
| `age` | `mission_member_details.ageAtRegistration` | Never converted to `birthDate` |
| `occupation` | `mission_member_details.occupation` | Direct |
| `workplace` | `mission_member_details.workplace` | Raw string preserved |
| `beliefYear` | `mission_member_details.beliefYear` | Year only, no fabricated date |
| `maritalCode` | `mission_member_details.maritalStatusCode` | **Blocked** until confirmed |
| `responseCode` | `mission_member_details.responseAttitudeCode` | **Blocked** until confirmed |
| `participationCode` | `mission_member_details.participationCode` | **Blocked** until confirmed |
| `goalCode` | `mission_member_details.missionGoalCode` | **Blocked** until confirmed |
| sheet name + team | `groups.name`, `groups.teamCode` | With a collision report |
| group locality | `areas` → `groups.areaId` | New or matched by `normalizedName` |
| group membership | `group_members` | `joinedAt` unknown → NULL, not `now()`; one active row per pair only |

**The four blocked mappings are the honest state of this project.** They live in
L1 and L2, appear in the import preview as
`พบ convention = 1 / พบ convention = / / ยังไม่ยืนยัน semantic meaning`, and
simply do not become domain values yet.

---

## 8. Duplicate Detection Strategy

**Nickname is never an identity.** Measured: 375 distinct nicknames across 662
rows; 201 names appear more than once; 488 rows are involved. `"นาง"` appears 12
times at six different ages.

> **Stale baseline.** Those duplicate-signal counts were measured on the 662-row
> set that Phase 1 later corrected to **674**. They are recorded as measured, not
> adjusted. Recompute them on the verified 674-row set before the review queue is
> built — a review queue scored against the wrong row count is a review queue
> with wrong numbers in it.

Duplicate detection produces a **review queue**, never an automatic merge.

| Signal | Weight | Note |
|---|---|---|
| Same nickname | required | Entry condition only |
| Same area | strong | Same village is the strongest real signal |
| Same age ±2 | strong | Age drifts, so a tolerance band is used |
| Same group | strong | |
| Same workplace | weak | Often "บ้าน…" + the same subdistrict |
| Same belief year | weak | |

| Score | Action |
|---|---|
| All strong signals match | Flag `likely_duplicate`, **not** merged by default |
| Nickname + one strong signal | Flag `possible_duplicate` |
| Nickname only | Import as separate records |

A human merges or keeps them apart. Every decision is written to the audit log
with the evidence that produced it.

**Import report wording:** `Skipped: 0 — no record is ever silently dropped.`

---

## 9. Weekly Report Workflow

`mission_submissions` is deliberately untouched: it is a LINE/message review
queue that publishes into `mission_activities`. Weekly reporting is a different
workflow and gets its own tables.

```
group leader / group member
        │
        ▼
  ┌─ STEP 1 ─ รายงานพันธกิจบ้าน · สัปดาห์ 2–8 ต.ค. 2569
  │          วันนี้มีผู้เข้าร่วมกี่คน?   [ − ] 7 [ + ]
  │
  ├─ STEP 2 ─ ใครเข้าร่วม?  ☑ สมาชิก A  ☐ สมาชิก B …
  │           preselected from the group's CURRENT memberships
  │
  ├─ STEP 3 ─ กิจกรรม   ☑ เยี่ยมเยียน  ☑ ศึกษาพระคัมภีร์ …
  │
  └─ STEP 4 ─ หมายเหตุ  [____________]
                    [ บันทึกรายงาน ]
        │
        ▼
weekly_reports (draft → submitted → acknowledged)
        ├── weekly_report_attendance  (one row per ticked member)
        └── weekly_report_activities (one row per ticked activity)
```

| Rule | Detail |
|---|---|
| One report per group per week | `UNIQUE (group_id, week_start)` — editing updates, never duplicates — **[ADR-conflict]** superseded by ADR 004: one *current non-draft* version plus at most one open draft per group per week; editing a submitted, acknowledged or returned report creates a new version |
| `attendanceCount` | Derived from attendance rows, never typed |
| `weekEnd` | Derived from `weekStart + 6 days` |
| Step 2 roster | Only `leftAt IS NULL` members; someone who left mid-week is added by explicit search and flagged `after_leave` |
| Editing a submitted report | Superseded, old version kept |

> **[ADR-conflict] differences recorded in ADR 004 (2026-10-09; ADR still
> proposed):** status gains `needs_revision` (the middle-level leader returns a
> report); that leader — not `GROUP_MANAGE_ANY_ROLES` — acknowledges; the
> overview shows "not submitted" but the detail view separates "no row" from
> "draft"; the report records whether the group actually met; **submitters are
> the leaders defined by `getLedGroupIds`, not "any current member"** (owner
> decision Q26); **the week is Monday–Sunday, Thai time, `weekStart` a plain
> date** (Q28) — the example week above, 2–8 ต.ค. 2569, runs Friday to Thursday
> and no longer applies. Version handling (Q29) is resolved by ADR 004's two
> partial unique indexes (design unproven; see §2 note). While a revision is a
> draft, the acknowledged current version still counts as the official figure;
> when the revision is submitted the group moves from "acknowledged" to "pending
> acknowledgement" until it is acknowledged again.

| Question answered | Source |
|---|---|
| Which groups reported this week? | `weekly_reports` where `weekStart = ?` |
| Which did not? | active mission groups MINUS the above |
| How many attended? | `SUM(attendanceCount)` |
| Who attended? | `weekly_report_attendance` |
| Trend | grouped by `weekStart` |

---

## 10. Membership History Workflow

```
join:    INSERT group_members { groupId, memberId, joinedAt }
leave:   UPDATE … SET leftAt = now(), status='inactive'      (never DELETE)
move:    leave(old) then join(new)  — two rows, not one UPDATE
rejoin:  a new row; the previous row keeps its own leftAt
```

- Partial unique index `UNIQUE (group_id, member_id) WHERE left_at IS NULL`:
  one current membership per group, unlimited history.
- "Currently in group X" → `WHERE left_at IS NULL`.
- "Has ever been in group X" → a plain lookup across all rows.

**Decided 2026-10-03: `group_members` stays the source of truth.** The table
already carries `joined_at`, `left_at`, `role` and `status`. Exactly one thing
blocks history: `uniqueIndex(group_members_group_member_uniq)` on
`(group_id, member_id)` rejects a second row for the same pair, and that is
exactly what re-entry is. So the fix is a **constraint swap, not a new table**.

- **No `group_memberships` table is created.** Every endpoint and response
  shape keeps reading `group_members`, so membership history is a purely
  additive improvement and no screen has to be repointed.
- The swap happens **inside one migration**: drop the full unique index and
  create the partial one in the same transaction. Dropping the old index and
  leaving the table without a replacement is forbidden — it opens a window in
  which duplicate active memberships can appear.

**The gate is a pre-check, and it is written but unrun.**
`server/lib/groupMembersPreCheck.ts` inspects five conditions read-only —
duplicate `(group_id, member_id)` pairs, rows that already carry a `left_at`,
duplicate active rows, `status` contradicting `left_at`, and orphan references —
and reports `migrationBlocked`. **It has not been run against production yet**,
but the blocker is no longer credentials: `GET /api/import/precheck/group-members`
(admin only) calls the very same function inside the deployed app, where the Neon
connection already exists. See §13 step 0 and "Open blocker". No DDL touching
`group_members` ships before its report is clean.

---


---


## 11. Area Model

```
areas
  id, province, district, subdistrict, village,
  displayName,      -- "หมู่บ้านหนองบัว · ต.โพนทอง · อ.เมือง · จ.กาฬสินธุ์"
  normalizedName,   -- uniqueness key: trimmed, collapsed, suffix-normalised
  createdAt, updatedAt
  UNIQUE (normalizedName)
```

Flat by design. The real dataset is one province, ~23 groups; a hierarchy would
add joins and screens that nobody uses. `displayName` is assembled in the
database layer so the UI never concatenates by hand.

> **Clarification (2026-10-09):** "flat" here means the *geographic* `areas`
> table. It says nothing about the *organisation* hierarchy (three levels, see
> ADR 002), which is a different thing and lives in `groups.parentGroupId`. The
> "~23 groups" premise is **[ADR-conflict]** with the owner's figure of about 52
> (NOT VERIFIED — see the annotation at the top).

**Group area ≠ member residence — they are separate columns and are never
forced equal.**

| Column | Meaning |
|---|---|
| `groups.areaId` | Where the group meets |
| `members.residenceAreaId` | Where the member lives (nullable; added only if the business needs it) |

Normalisation of `normalizedName` must strip trailing-space noise and the
observed naming drift: `คำเม็ก ` vs `คำเม็ก`, `หมู่` vs `ม.` vs `หมู`,
`หนองแวง หมู่ 8` vs `หนองแวงหมู่ 9 กลุ่ม 1`. It must **not** merge
`โคกกลาง` with `โคกกลาง (ผาเสวย)` — the data cannot tell whether those are one
group split or three groups, so that stays a review item.

Unconfirmed deduplication produces a *review list*, not a skip.


---

## 12. Import Validation Rules

Applied to L1 → L2 → L3. Nothing is promoted on a failed rule; it is reported.

### Structural

| Rule | Action on failure |
|---|---|
| Header row must resolve all 11 fields | Reject the sheet, report the missing headers |
| Layout variant must be A/B/C or newly detected | Reject the sheet |
| Nickname non-empty | Reject the row — it defines a member |
| Age numeric, 0–120 | Quarantine the row, keep it in L1 |
| Belief year within 1800–current | Quarantine |

### Semantic (blocked until confirmed)

| Rule | Action |
|---|---|
| Checkbox marker ∈ {`1`, `/`} | Record the convention; **do not** map to a domain value |
| Goal value ∈ a confirmed cluster | Otherwise store the raw variant in L2 only |
| Area parse yields a village | Otherwise keep the raw workplace string |

### Collision

| Rule | Action |
|---|---|
| Two sheets resolve to the same group name | Report both, create neither, await a human |
| Group name already exists | Match and report; never silently merge |
| Duplicate active membership (group, member) | Report; never insert a second active row |

### Completeness report (required output of every import)

```
Field                  Filled   Empty
Nickname                 100%      0%
Full name                 4%     96%
Age                       80%     20%
Occupation                …        …
Marital status            12%     88%
Response attitude         18%     82%
Group participation       27%     73%
Mission goal              94%      6%

Imported:   674 members
Skipped:    0            ← never silently dropped
Flagged:    488  possible duplicates (review list, not merged)
Warnings:   7  records missing village
Errors:     3  invalid records
Blocked:    4  checkbox fields — semantics unconfirmed
```

---

## 13. Migration Order

| # | Migration | Depends on |
|---|---|---|
| **0** | **Pre-check (no migration)** — count duplicate `(group_id, member_id)` in production; count members where `group IS NOT NULL` | nothing |
| 1 | `0008_import_audit` — `import_batches`, `import_source_rows`, `normalization_rules`, `import_row_norm` — **done** | 0 |
| 1b | `0009_import_duplicate_decisions` — append-only log of human duplicate-review decisions (`import_duplicate_decisions`); **done**. It took the number `0009`, so every later migration in this table moves up by one when it is generated: `mission_domain` becomes `0010`, `group_members_history` `0011`, and so on. Only the file names change; the order and the dependencies do not | 1 |
| 2 | `0009_mission_domain` — `areas`, `mission_member_details`, `members.realName`, `groups.groupKind/teamCode/villageName/coordinatorName/coordinatorPhone/areaId` | 1 |
| 3 | `0010_group_members_history` — constraint swap **on the existing table**, in one migration: drop `group_members_group_member_uniq`, create `UNIQUE (group_id, member_id) WHERE left_at IS NULL` | 0 |
| 4 | `0011_weekly_reports` — the three weekly tables | 2 |
| 5 | `0012_backfill_memberships` — set `left_at = NULL` for current rows and flag every row whose `status` contradicts it; idempotent, row-count verified | 3 |
| 6 | `0013_group_coords_numeric` — `latitude`/`longitude` `text` → `numeric(9,6)`, guarded so non-numeric values are nulled and reported, never truncated | 0 |
| 7 | Application phase — read paths repointed one screen at a time (§17) | 3,5 |

**Step 0 is a gate.** No DDL touching `group_members` runs until it reports
clean. If it finds duplicates, a human resolves them first. The check itself is
**written** — `server/lib/groupMembersPreCheck.ts`, 6 tests, strictly read-only —
and reachable from production as `GET /api/import/precheck/group-members`
(admin only, same function, live Neon connection). Step 3 consumes that report:
a clean run is the precondition for the constraint swap, and an unclean run means
the data is fixed by a human before any DDL is attempted.

---

## 14. Rollback Plan

| Migration | Rollback | Data risk |
|---|---|---|
| 0008 | `DROP TABLE` the four new tables | none — nothing references them |
| 0009 | `DROP TABLE` + `DROP COLUMN` | **loses imported data**, so a snapshot is taken first |
| 0010 | Recreate `group_members_group_member_uniq` from a recorded definition | re-entry becomes impossible again |
| 0011 | `DROP TABLE` ×3 | none |
| 0012 | Idempotent and reversible; old rows are retained and flagged, never deleted | low |
| 0013 | Widen back to `text` | lossy for non-numeric values, so those are reported first |

**Every migration ships with** a pre-migration row-count snapshot, a
post-migration verification query, and a tested `down`. A migration whose
rollback cannot restore the original data is not allowed on production.

---

## 15. Data Integrity Constraints

| Constraint | Table | Why |
|---|---|---|
| `UNIQUE (group_id, member_id) WHERE left_at IS NULL` | `group_members` | One current membership, unlimited history |
| `UNIQUE (group_id, week_start)` | `weekly_reports` | One report per group per week — **[ADR-conflict]** replaced by ADR 004's two partial unique indexes (current non-draft version; open draft); not built, unproven |
| `UNIQUE (weekly_report_id, member_id)` | `weekly_report_attendance` | No double-ticking |
| `UNIQUE (member_id)` | `mission_member_details` | It is 1:1 |
| `UNIQUE (normalizedName)` | `areas` | No duplicate localities |
| `UNIQUE (fileChecksum)` | `import_batches` | The same workbook is never imported twice silently |
| `CHECK (ageAtRegistration BETWEEN 0 AND 120)` | `mission_member_details` | Catches `"60.0"` coercion mistakes |
| `CHECK (beliefYear BETWEEN 1800 AND 2100)` | `mission_member_details` | Same |
| `CHECK (week_end = week_start + 6)` | `weekly_reports` | Derived fields cannot drift |
| `CHECK (latitude BETWEEN -90 AND 90)`, `CHECK (longitude BETWEEN -180 AND 180)` | `groups` | Only meaningful once numeric |
| `ON DELETE SET NULL` | every `→ users` FK | Deleting a Clerk account must not delete history |
| `ON DELETE CASCADE` | `group_members.groupId` | Removing a group removes its memberships |
| **No cascade to `members`** | — | A member is never destroyed by a downstream delete |

---

## 16. Permission / Ownership Model

Reuses the canonical sets in `shared/roles.ts`. No second permission system.

| Action | Gate |
|---|---|
| Import a workbook | `requireAdmin` |
| Confirm a normalization rule | `requireAdmin` |
| Merge / split a duplicate | `requireAdmin`, audit-logged |
| Create / edit a mission group | `GROUP_MANAGE_ANY_ROLES`, or a `group_leader` of that group via `verifyGroupManagementAccess` |
| Place a map pin | same as group edit |
| Submit a weekly report | any current member of that group — **[ADR-conflict]** ADR 004 (owner decision Q26): only the leaders defined by `getLedGroupIds` |
| Acknowledge a weekly report | `GROUP_MANAGE_ANY_ROLES` — **[ADR-conflict]** ADR 003/004: the middle-level leader above that group (scope-based); body leader and `team_lead` read-only; self-approval rule undecided (ADR 003 S7) |
| View group location | existing `maskGroupLocation` privacy rule, unchanged |

> **[ADR-conflict] 2026-10-09:** "No second permission system" still holds —
> ADR 003 derives scope from group leadership and `parentGroupId` rather than
> adding roles per level. It does need two things that do not exist today: a
> hierarchical scope (`resolveGroupScope` only covers groups the user leads) and
> a `team_lead` role (requirements recorded in ADR 003, not created; `admin` can
> delete and `staff` sees every member's contacts, so neither fits). A
> read/export-only statistician role is **deferred**. No role or security test
> was added.

**The gap this exposes:** `groups.leaderId` → `users`, i.e. a Clerk account.
Workbook leaders have no account, so `coordinatorName` is plain text and cannot
satisfy the ownership gate. A village coordinator is therefore **not yet a
user** and cannot be given scoped access to their own group. Enabling that means
inviting them to Clerk — a product decision, not a schema one, and it is listed
below as out of scope for now.

> **[ADR-conflict] 2026-10-09:** the proposed model has the leaders of the
> lowest-level (`care`) groups submit reports and see only their own group's members, which needs an account
> per leader. That reopens the "invite coordinators to Clerk" decision (ADR 003
> S3); the out-of-scope row below is no longer a safe default for that model.

---

## 17. UI Impact

| Screen | Change | Phase |
|---|---|---|
| Admin → นำเข้าข้อมูล | **New.** Upload → parse → preview → duplicate review → confirm → report | 1–2 |
| Admin → ตรวจสอบข้อมูลซ้ำ | **New.** Side-by-side comparison, merge or keep | 2 |
| Members list | Shows `displayName`; badge `"ยังไม่ระบุชื่อ-สกุล"` when `realName` is null | 3 |
| Member detail | Mission fields from `mission_member_details`, visibly optional | 3 |
| Group detail | Team, village, coordinator, and a pin-drop control | 3 |
| Group → สมาชิก | Reads `group_members` with an unchanged response shape; adds "ย้ายกลุ่ม" and "ออกจากกลุ่ม" | 5 |
| รายงานประจำสัปดาห์ | **New.** The 4-step mobile flow from §9 | 4 |
| Dashboard | Adds "กลุ่มที่ยังไม่ส่งรายงานสัปดาห์นี้" | 4 |
| Map | Pins only where coordinates exist; unplaced groups listed as "ยังไม่มีพิกัด" | 3 |
| Profile (member) | Weekly report history | 4 |

Screens **not** touched: Events, Announcements, Ministries, Church, Feed,
FollowUps, Inbox, and the existing care-group behaviour on Map.

Reused components only: `PageHeader`, `EmptyState`, `ErrorState`, `StatusChip`,
`Field`, `Modal`, `Button`, `Skeleton`, the existing `ConfirmDialog`. No new
design system and no new dependency.



---

## 18. API Impact

```
POST /api/import/upload                 raw .xlsx body, up to 4 MB → parse → batch (admin)
POST /api/import/upload/token           Vercel Blob client-upload handshake (admin)
POST /api/import/upload/from-blob       read the private blob, import it, delete the blob (admin)
GET  /api/import/batches                list with counts
GET  /api/import/batches/:id/preview    raw + normalized + blocked fields
POST /api/import/batches/:id/confirm    promote L2 → L3 (admin)
GET  /api/import/batches/:id/report     completeness + duplicate report
POST /api/import/rules/:id/confirm      confirm a normalization rule
GET  /api/import/duplicates             review queue
GET  /api/import/precheck/group-members read-only Q2 gate + CLEAR/BLOCKED (admin)

GET   /api/weekly-reports?groupId&weekStart
POST  /api/weekly-reports
PATCH /api/weekly-reports/:id
POST  /api/weekly-reports/:id/submit
POST  /api/weekly-reports/:id/acknowledge

GET  /api/groups/:id/memberships
POST /api/groups/:id/members            join
POST /api/members/:id/leave-group
POST /api/members/:id/move-group
PUT  /api/groups/:id/location           latitude/longitude
```

| Endpoint | Change | Compatibility |
|---|---|---|
| `GET /api/members` | adds `displayName`, `realName` | **Additive** |
| `GET /api/groups` | adds `groupKind`, `teamCode`, `areaId`, `hasCoordinates` | **Additive** |
| `GET /api/groups/:id` | `members[].group` stays, gains `membership.joinedAt/leftAt` | **Additive** |
| member exports | emit `displayName` plus both name columns | Column **added**, not replaced |

**No endpoint breaks.** Every legacy field keeps working through phase 7.

---

## 19. Test Plan

| Layer | Test |
|---|---|
| Contract (static) | Standing rules hold: no `birthDate` from age, no nickname into `realName`, no relation keyed on a name string |
| Parser | All 3 layouts detected from header text; a sheet with shifted columns still resolves |
| Parser | Both checkbox conventions detected and recorded distinctly |
| Parser | `หนองบัว` (layout C) and `หนองบัว new` (key-value form) classified correctly, the latter rejected as non-member data |
| Parser | 17 goal variants cluster without losing the original string |
| Import | A rejected row stays in L1 and appears in the report; `Skipped` is never non-zero without a human decision |
| Import | Duplicate detection flags but never merges |
| Migration | The pre-check reports duplicate counts; the migration refuses to run when they are non-zero |
| Migration | Every `up` has a tested `down`; row counts before and after are asserted |
| Constraint | Partial unique index permits rejoin while rejecting a second active membership |
| Constraint | `UNIQUE (group_id, week_start)` rejects a second report for the same week — **[ADR-conflict]** to be replaced by tests for ADR 004's two indexes (a second current non-draft version is rejected; a second open draft is rejected; a draft beside the current version is allowed; supersede-then-promote succeeds and the reverse order fails). **None of these tests exists yet** |
| Weekly flow | Attendance count is derived, never trusted from the client |
| Route | Import endpoints are admin-gated; weekly submit is limited to current members — **[ADR-conflict]** ADR 004 (owner decision Q26): limited to the leaders defined by `getLedGroupIds`, not general members or a `host` |
| Regression | The full suite stays green — no response shape is removed. Baseline at this revision: 26 files / 303 tests |
| Pre-check | `runGroupMembersPreCheck()` writes nothing and reports each condition separately: duplicate pairs, historical `left_at` rows, duplicate active rows, `status` vs `left_at` conflicts, orphan references |
| Pre-check | `migrationBlocked` stays true while any blocking count is non-zero, so migration 0010 can never be justified by a partial report |
| Pre-check | The current full unique index provably rejects a rejoin (`23505`) — the test asserts today's failure so the constraint swap is visibly the thing that fixes it |
| UI | Empty, error and skeleton states for every new screen |
| Mobile | 360 / 375 / 390 / 414 px for the 4-step weekly flow |

---

## Out of scope — deliberately

| Not doing | Why |
|---|---|
| Interpreting checkbox semantics | Unconfirmed by the people who filled the forms (Q5) |
| Automatic duplicate merging | A wrong merge destroys a person's record |
| Any birth date derived from age | Fabricates data |
| Hierarchy beyond flat areas | One province, ~23 groups — applies to the geographic `areas` table only; the organisation hierarchy is ADR 002 |
| Auto-normalising goal spellings | Needs a human decision on which variants are real |
| Inviting village coordinators to Clerk | A product decision about accounts and privacy — **reopened by the proposed model, see ADR 003 S3** |
| Merging `attendance_records` with `weekly_reports` | They are genuinely different facts |
| Changing recharts / sonner / brand colours | Q4 |
| Sarabun font | Permitted, but scheduled last and gated on visual regression |

---

## Open blocker

**The credentials blocker is gone; only the report is missing.** The check runs
inside the deployed app, where the production Neon connection already exists.
An admin opens:

```text
GET https://puntakit-kalasin.vercel.app/api/import/precheck/group-members
```

and pastes `data.gate` back here. It is read-only (every statement is a SELECT)
and admin-only, because the verdict authorises DDL.

The CLI remains for anyone who does hold a connection string:

```bash
pnpm exec dotenv -e .env.production.local -- tsx server/scripts/pre-migration-check.ts
```

(add `--json` for the machine-readable form.) **No DDL touching `group_members`
runs before that report is clean**, and the clean report is what authorises
writing migration `0010`, not writing it.
