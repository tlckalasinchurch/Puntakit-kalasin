# Puntakit — Mission Workbook Source Audit (Phase 1, VERIFIED)

Status: **COMPLETE — produced from the workbook bytes by `server/scripts/audit-mission-workbooks.ts`.**
Date: 2026-10-02
Command: `pnpm exec tsx server/scripts/audit-mission-workbooks.ts [--json]`
Source: `..\mission-20260930T143403Z-1-001\mission\` (8 `.xlsx` files, 1 `.pptx` ignored)

The audit is **read-only**: no database was contacted, no file was modified, and
no cell value was interpreted. Checkbox tokens below are raw observations.

---

## 1. What the earlier audit claimed vs. what the bytes show

| Prior claim | Verdict | Evidence |
|---|---|---|
| 6 unique workbooks | **REFINED** | 8 files, 8 distinct sha256, **0 byte-identical pairs**. The accurate statement is *6 churches across 8 files*. "Unique" was right at byte level and wrong at content level: เมือง 1 / เมือง 1 New and เมือง 2 / เมือง 2(1) are content-equivalent without being identical. |
| เมือง 2(1) is a 100% duplicate of เมือง 2 | **NOT CONFIRMED at byte level** | Different sha256 (`49014dab…` vs `99fb0e62…`). Both have 11 sheets and both yield exactly 80 member rows, so they are *content-equivalent*, but the bytes are not identical. "New" therefore must still not be assumed newer or authoritative. |
| เมือง 1 New adds a non-member sheet | **CONFIRMED** | เมือง 1 = 14 sheets / 133 rows; เมือง 1 New = 15 sheets / 133 rows. The extra sheet resolves to no member header. |
| ~662 member rows | **CORRECTED → 674** | 674 rows carry a non-empty nickname, across all 8 files. |
| Layout A ≈47, B ≈24, C ≈1 sheet | **CORRECTED** | All 75 worksheets resolve to **1 structural signature** (same 11 fields, same order). There are exactly **3 column-position variants** (see §3). |
| 2 checkbox conventions (`1` and `/`) | **CONFIRMED** | `"1"` × 1763, `"/"` × 81. No third, unrecognised token exists. |
| 17 goal spellings | **CORRECTED → 15** | 15 distinct raw goal values. |
| Full name ~4% filled | **CONFIRMED** | 29 / 674 = 4.3% |
| Age ~80% | **CONFIRMED** | 543 / 674 = 80.6% |
| Mission goal ~94% | **CONFIRMED** | 633 / 674 = 93.9% |
| Marital ≈12% / Response ≈18% / Participation ≈27% | **NOT CONFIRMED — measured far higher** | marital 88.4%, response 92.7%, participation 92.4% (see §4). These fields are **not** sparse. |

The 1,659 figure from an even earlier note remains rejected: it counted blank rows.
Every sheet reports `data rows 998` while `members` is far lower — the blank tail
is real and is excluded by the nickname-non-empty rule.

---

## 2. Files (sha256, sizes, sheet and member counts)

| File | Size | Sheets | Member rows | sha256 (short) |
|---|---|---|---|---|
| เมือง 1 New .xlsx | 26.67 MB | 15 | 133 | `98bb9d13…` |
| เมือง 1.xlsx | 26.72 MB | 14 | 133 | `861e9f6d…` |
| เมือง 2.xlsx | 6.13 MB | 11 | 80 | `99fb0e62…` |
| เมือง 2(1).xlsx | 6.13 MB | 11 | 80 | `49014dab…` |
| สมเด็จ.xlsx | 7.16 MB | 17 | 143 | `57e798f2…` |
| กุฉินารายณ์.xlsx | 1.34 MB | 3 | 40 | `7bc931fd…` |
| คำใหญ่.xlsx | 1.31 MB | 2 | 47 | `da87153a…` |
| ท่าคันโท.xlsx | 1.33 MB | 2 | 18 | `c028681a…` |
| **Total** | | **75** | **674** | |

**Byte-identical duplicate groups: none.** Every file is unique at the byte level.

---

## 3. Layouts

Structural signature (field order), identical for all 72 member sheets:

```
sequence > fullName > nickname > age > occupation > workplace
         > marital > beliefYear > response > participation > goal
```

Column-position variants — **3**, matching the documented A/B/C count:

| Variant | Anchor columns | Checkbox spans |
|---|---|---|
| 1 | seq 2 … goal 20 | marital 8–11, response 13–15, participation 16–19 |
| 2 | seq 25 … goal 42 | marital 31–33, response 35–37, participation 38–41 |
| 3 | seq 25 … goal 43 | marital 31–34, response 36–38, participation 39–42 |

Detection is by **header text**, so the differing column offsets and the
differing checkbox span widths are handled without any per-variant parser.

Sheets that resolve to **no** member table (`layout: UNRESOLVED`, 0 members):
`ฐานข้อมูลกลุ่มพันธกิจทีม G เมือ` (in both เมือง 1 files) and `หนองบัว new`.
`หนองบัว new` is a key–value form, **not** member data — the earlier audit's
claim is confirmed.

---

## 4. Completeness (674 member rows)

| Field | Filled | Empty | % |
|---|---|---|---|
| nickname | 674 | 0 | 100% |
| sequence | 674 | 0 | 100% |
| workplace | 593 | 81 | 88.0% |
| marital *(any marker)* | 596 | 78 | 88.4% |
| response *(any marker)* | 625 | 49 | 92.7% |
| participation *(any marker)* | 623 | 51 | 92.4% |
| beliefYear | 587 | 87 | 87.1% |
| occupation | 563 | 111 | 83.5% |
| age | 543 | 131 | 80.6% |
| goal | 633 | 41 | 93.9% |
| **fullName** | **29** | **645** | **4.3%** |

**Implication for the model:** only `fullName` is genuinely sparse. The three
checkbox groups are ~90% populated, so the earlier "these are sparse, don't
force them into the UI" guidance is wrong for them — but they stay blocked
regardless, because their **semantics** are still unconfirmed.

---

## 5. Checkbox conventions — recorded, NOT interpreted

| Raw token | Occurrences | Status |
|---|---|---|
| `"1"` | 1763 | documented token; **meaning UNKNOWN** |
| `"/"` | 81 | documented token; **meaning UNKNOWN** |
| any other token | 0 | none observed |

Both conventions coexist and are preserved verbatim with their source file,
sheet, row and column. Nothing maps `1` or `/` onto a domain value.

---

## 6. Standing facts this audit does NOT establish

These remain **UNKNOWN** and must not be inferred:

- What `1` or `/` means for any checkbox field.
- Whether เมือง 2 is newer than เมือง 2(1), or เมือง 1 newer than เมือง 1 New.
  Content-equivalence ≠ recency.
- Which of the 15 goal spellings are typos of each other.
- Whether any two members sharing a nickname are the same person.
- Any birth date. `age` is an age; it is never converted into a date.
- Any coordinate. None exist in the source.

---

## 7. Next gate

Phase 2 (L1/L2 import infrastructure) is **built** — migration
`0008_import_audit`, the normalization engine, and the `/api/import` routes.
It stops at L2 on purpose: nothing is promoted into L3 and no checkbox
semantics are assigned.

The next gate is still the same one, and it is **not the code that is missing —
the credentials are.** Before any DDL touches `group_members`, the read-only
pre-check (`server/scripts/pre-migration-check.ts`, defined in
`docs/PUNTAKIT_MISSION_DOMAIN_PLAN.md` §13 step 0) must be run against
production by someone with database access and reported here. Until its output
exists, migration `0010` must not be written.