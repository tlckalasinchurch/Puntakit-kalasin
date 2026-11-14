# FaithMap — Phased Implementation Plan

Date: 2026-11-14 · Status: **proposed. No phase has started. Implementation starts only after the owner approves the transformation architecture and this plan.**

Relation to `FAITHMAP_IMPLEMENTATION_ROADMAP.md`: the roadmap is the only source for the scope, acceptance criteria and regression tests of the mission phases (roadmap Phases 1–5). This plan adds the product transformation around them: the identity phases, the readiness work and the order. It does not repeat the roadmap's criteria. If the two documents differ on a mission phase, the roadmap is correct.

## 1. Rules

The rules of `FAITHMAP_IMPLEMENTATION_ROADMAP.md` §1 apply to every stage of this plan. In addition:

1. No stage removes a feature, a page path or an API path.
2. No stage renames an internal technical identifier unless `FAITHMAP_PRODUCT_TRANSFORMATION.md` §5 allows it and a ticket is approved.
3. Each stage states its rollback step (`FAITHMAP_MIGRATION_AND_REGRESSION_RISKS.md` §6) in its `SPEC.md`.
4. A proposed item in a document is not a developed feature.

## 2. Stages

| Stage | Name | Content | Roadmap phase |
|---|---|---|---|
| S0 | Audit and design | Document set (done, documents only) | Phase 0 |
| S1 | Readiness | Decisions and read-only production checks | — |
| S2 | Product identity | FaithMap name in every user-facing place | — |
| S3 | Organizational foundation | Assignments | Phase 1 |
| S4 | Weekly reporting | Draft, submit, review, approval, blocked | Phase 2 |
| S5 | Mission overview | Scoped overview, meeting brief | Phase 3 |
| S6 | Member care | Follow-up tracking, newcomers, attention items | Phase 4 |
| S7 | LINE and LIFF | Linking, LIFF report, LINE notices | Phase 5 |
| S8 | Identity completion | Remaining names in project documents; optional domain | — |

### S0 — Audit and design · done (documents only; code verified)

Output: twelve documents in `docs/` with the prefix `FAITHMAP_` (the list is in `FAITHMAP_EXECUTIVE_REVIEW.md` §2).
Not done in S0: any test run, any production read, any code change.

### S1 — Readiness

No code. Work of the owner, the church and an administrator.

- Decisions for S2: P1 (display texts), P2 (logo and icons), P5 (legal wording), P9 (order).
- Decisions for S3: O1, O2, O5, O10.
- Read-only production checks 1–4 (`FAITHMAP_DATA_MAPPING.md` §7).
- Check of the live URL and the Vercel project settings (domains, environment variables, backup function of the database).
- Read-only count of real and simulated rows in `push_subscriptions` (`FAITHMAP_EXISTING_SYSTEM_AUDIT.md` §6.4).
- Decision O14 (notification channel before LINE).

Exit criteria: each decision above has a recorded answer in `FAITHMAP_PHASE0_SYSTEM_AUDIT.md` §8 or `FAITHMAP_PRODUCT_TRANSFORMATION.md` §6; each check has a recorded result with its date and the person who ran it.

### S2 — Product identity

Feature slug: `faithmap-identity`.
Scope: inventory items I1–I6 and I9–I14 of `FAITHMAP_EXISTING_SYSTEM_AUDIT.md` §3.1. Items I7 and I8 (logo and icons) when the owner supplies the files; until then a text wordmark. A note in `CLAUDE.md`, `PRODUCT.md` and `brand-spec.md` that the product is FaithMap.
Not in scope: identifiers T1–T11, table names, API paths, the design tokens, navigation order, any feature change.

Acceptance criteria:
- No user-facing screen, title, manifest field or notification shows "Puntakit".
- The browser title, the installed-app name and the sign-in page show "FaithMap".
- Every existing page path and API path answers as before.
- A signed-in user stays signed in after the release.
- An installed app opens after the release.
- A test fails if the old product name returns to a user-facing client file.

Regression tests: the full existing suite; the sign-in contract test with the new text; design-token tests unchanged.
Rollback: revert the pull request or promote the previous deployment.
Database: none. Permission: none.

### S3 to S7 — Mission phases

Scope, acceptance criteria and regression tests: `FAITHMAP_IMPLEMENTATION_ROADMAP.md` §2, Phases 1 to 5. Gates: roadmap §4.

Additions from the transformation analysis:

| Stage | Addition |
|---|---|
| S3 | New screens use the FaithMap name and the org wording of gap B1 from the first release |
| S4 | Before reminders are built: remove the simulated push subscription path (finding X1) by an approved ticket. Web Push delivery is new work and is built only if decision O14 selects it (finding X2). The first reporting period is the cutover week; no period for a past week |
| S5 | Navigation changes only after decision P3 |
| S6 | The default member list hides visitors; a filter shows them; a release note explains it |
| S7 | Needs the LINE channel of the church (BLOCKED until it exists) |

### S8 — Identity completion

- A historical note at the top of each `PUNTAKIT_*.md` document (decision P8).
- The remaining project documents (`AGENTS.md`, `MASTER_PROMPT.md`, `DEPLOYMENT.md`, `design.md`) state FaithMap as the product.
- A FaithMap domain, if decision P7 selects one, by the plan in `FAITHMAP_MIGRATION_AND_REGRESSION_RISKS.md` §5. The old URL stays in service.

## 3. Order

```
S0 ─► S1 ─┬─► S2 (identity) ────────────────────────────────► S8
          │
          └─► S3 ─► S4 ─┬─► S5
                        └─► S6 ─► S7
```

S2 and S3 do not depend on each other in code. Whether S2 goes before, with or after S3 is decision P9. One technical point for that decision: S2 needs no migration and no permission change, so it has the lowest risk of all stages.

## 4. Approval gates

Gates G0–G7 of `FAITHMAP_IMPLEMENTATION_ROADMAP.md` §4 stay as they are. Added gates:

| Gate | Needed before | Approver |
|---|---|---|
| GT0 Approval of the transformation architecture and this plan | Any `/grill` | Owner |
| GT1 Decisions P1, P2, P5, P9 | S2 spec | Owner + church |
| GT2 Decision P3 | Any navigation change | Owner + church |
| GT3 Decision O14; finding X1 resolved | Reminder work in S4 | Owner |
| GT4 Decision P7 and a domain plan | Any domain or repository change | Owner |
| Every ticket | `Status: approved` in `TICKETS.md` | Owner |
| Every merge and deploy | — | Owner |

## 5. What blocks the start

| Blocker | Blocks |
|---|---|
| GT0 not given | Everything after S0 |
| P1 open | S2 |
| O1, O2, O5, O10 open; production checks 1 and 4 not run | S3 |
| O8 (deadline time) and O3, O4, O9, O11, O12, O13, O14 open | S4 |
| No LINE channel | S7 |

## 6. Not planned

A second application or a second database; removal of an existing feature; a rename of tables, columns, API paths, cookies, environment variables or the import hash salt; a redirect of the existing URL; automatic approval of reports; automatic linking of names to people.
