# Puntakit — Full Application Audit & UX/UI Review

**Date:** 2026-10-18
**Repo:** `02-Worktrees/puntakit-claude-redesign`
**Branch / HEAD:** `fix/import-get-privacy` @ `a2a41e8` (behind `origin/main` by 4, ahead 0)
**Mode:** READ-ONLY AUDIT. **No application code, configuration, dependency, schema or database record was modified. Nothing was committed, pushed or deployed.**

This directory is the hand-off for any engineer or AI agent continuing the audit or implementing the fixes.

---

## 1. Read these first

| Order | File | What it is for |
|---|---|---|
| 1 | [`04-DESIGN-SYSTEM-RULES.md`](04-DESIGN-SYSTEM-RULES.md) | **The binding rules.** Read before judging any UI code. The project's own docs contradict each other and contradict the CSS. This file resolves them. |
| 2 | [`03-FINDINGS-REGISTER.md`](03-FINDINGS-REGISTER.md) | The master P0–P3 register. Every finding with evidence, confidence and suggested fix. |
| 3 | [`02-ROUTE-AND-NAV-INVENTORY.md`](02-ROUTE-AND-NAV-INVENTORY.md) | 35 routes, 11 navigation surfaces, 15 role sets, 119 API endpoints. |
| 4 | [`05-BROWSER-EVIDENCE.md`](05-BROWSER-EVIDENCE.md) | Measured runtime results, coverage matrix, and the two detector bugs I hit. |
| 5 | [`01-BASELINE-AND-METHOD.md`](01-BASELINE-AND-METHOD.md) | Environment, DB isolation proof, method, limitations. |
| 6 | [`06-REMAINING-WORK.md`](06-REMAINING-WORK.md) | What was not verified, and the recommended remediation order. |

---

## 2. Status at a glance

| Phase | State |
|---|---|
| 0 — Safety, baseline, environment | ✅ Complete. DB isolation proven with 5 independent checks. |
| 1 — Route & feature inventory | ✅ Complete (source). |
| 2 — Sidebar & navigation audit | ✅ Complete (source + browser). |
| 3 — Every page & interactive control | ⚠️ **Partial.** Pages enumerated and statics analysed; per-control interaction testing not finished. |
| 4 — UX review | ✅ Complete (source). |
| 5 — UI / design system | ✅ Complete (source + 1 browser confirmation). |
| 6 — Responsive & cross-device | ✅ Complete: 37 routes × 3 viewports × 2 themes. |
| 7 — Accessibility | ⚠️ **Partial.** Automated structural + contrast checks done. No full keyboard/focus-order pass, no screen-reader testing, no zoom/reflow test. |
| 8 — Functional & performance | ⚠️ **Partial.** Zero console/network errors measured. Performance not benchmarked. Test suite not executed. |
| 9 — Findings & prioritisation | ✅ This register. |
| 10 — Deliverables | ✅ These files. |
| 11 — Stop for review | ✅ **Awaiting approval. No edit authorised.** |

**Read `06-REMAINING-WORK.md` before claiming coverage.** Several phases are explicitly partial.

---

## 3. The five things that matter most

1. **A `member` can list every care group.** `GET /api/groups` has no role middleware (`server/routes/groups.ts:197`). Ten routes gate their *read* client-side only — the UI hides the page, the API serves it. Whether this is acceptable is a **product decision**, not a code fix. See F-01.
2. **`/app/attendance` and the prayer-request flow are unreachable.** A fully-built member attendance page that nothing links to, and a modal whose open function is never called anywhere in the codebase. See F-02, F-03.
3. **The test suite cannot catch a broken page.** `vitest.config.ts` runs `environment: "node"`; zero React rendering tests exist. All 45 client tests read `.tsx` files as text. A test passes on a page that throws on render. See F-04.
4. **Three label maps have drifted from the database schema**, so raw enum values are shown to members and assistant leaders display as ordinary members. See F-05.
5. **The design system has two vocabularies for "card"** — radius and elevation both disagree between the docs, the CSS, and the components. See F-06, F-07.

---

## 4. Rules of engagement for whoever picks this up

**Do:**
- Audit against `04-DESIGN-SYSTEM-RULES.md`, not against generic best practices. This app is deliberately unusual (flat editorial, teal, no decorative shadows, `design.md` written in Thai).
- Keep the existing Design System V2, the teal palette including `#0C7C82`, and the Prompt typeface. Extending is allowed; forking is not (`PRODUCT.md:39`).
- Label every finding **Observed / Likely / Hypothesis**. Do not inflate.
- State the denominator for every count.

**Do not:**
- Do not use `DESIGN-apple.md` as a reference. It is a different product and its own line 276 forbids copying it.
- Do not "fix" the 10 client-only-gated read routes by adding client gates — that is already there. The question is a server-side authorisation decision.
- Do not commit, push or deploy without an explicit instruction in that same message.
- Do not touch `.db_data`, the stash, or the other two worktrees.

---

## 5. Honest limitations

- **Role ceiling is `admin`.** The repo's own `.env.local` enables demo mode, which fixes the session to `admin`. `super_admin` routes (`/admin/users`, `/admin/pins`, `/import/org`) rendered the access-denied state and are reported **NOT VERIFIED**.
- **Automated checks are not WCAG conformance.** No axe-core, no screen reader, no expert manual testing. Contrast and structure are measured; behaviour is not.
- **REA contributed nothing.** This is a live local web application, not a shipped binary. Forcing a reverse-engineering tool onto source code would have produced theatre, not evidence.
- **The dev-stack environment is not production.** Findings about the running app describe this build in this environment.
