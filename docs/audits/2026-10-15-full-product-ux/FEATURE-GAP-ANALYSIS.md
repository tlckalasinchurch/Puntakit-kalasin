# FEATURE-GAP-ANALYSIS.md

**Status: AUDITED (read-only). Nothing in this document has been implemented.**

---

## 0. Priority definitions applied

| | Definition |
|---|---|
| **P0** | Broken critical workflow, security regression, or severe usability issue **supported by evidence** |
| **P1** | High-impact improvement to an existing workflow |
| **P2** | Lower-impact polish or optional enhancement |

**New features without an approved specification remain proposals, not implementation tasks.** No `GRILL.md`/`SPEC.md`/`TICKETS.md` exists anywhere in this repository — **zero tickets are at `Status: approved`**.

---

## 1. Prioritized matrix

| ID | Feature | Route | Current behavior (evidence) | UX issue | Proposed adaptation | Data/API | Risk | Pri |
|---|---|---|---|---|---|---|---|---|
| **G-01** | Brand spec ↔ token sync | — | `index.css:58` = `#f1f5f9`; `brand-spec.md:38` = `#f2f2f4` `[RUN]` | CI is **red**; the palette change is undocumented | Update `brand-spec.md` to the teal palette in the same change | None needed | Low — doc-only | **P0** |
| **G-02** | Member report list | `/app/reports` | `MemberReports.tsx:195` links `/app/reports/${sub.id}`; **no such route** `[RUN]` | Every report row → **404 page** | Either add the detail route **or** make the row non-navigable | `GET /api/submissions/:id` exists | Low if non-navigable | **P0** |
| **G-03** | Whole-app token swap | all | 9 `:root` tokens changed, **never viewed in a browser** `[DOC]` | Invisible regressions ship; contradicts recorded decision `ACCENT_ONLY` | Browser sweep all 38 routes in light+dark, 390/768/1280 | None needed | **Regression** | **P0** |
| **G-04** | Nav active states | all | 3 algorithms: exact / exact+2 special / prefix `[CODE]` | `/import/duplicates` highlights **nothing** in the bottom bar | One shared helper; keep `Sidebar`'s 2 special cases | None | Low | **P1** |
| **G-05** | Status semantics | many | `MembershipStatus` map duplicated ×2; `GroupStatus` ×2; `absent` neutral (member) vs error (admin); `ImportDuplicates:353` **inverted** `[CODE]` | Same datum shows opposite meaning | One shared `statusTone()` module; fix the inversion | None | Low | **P1** |
| **G-06** | `--muted` token | many | Declared twice in `:root`; `#5b6474` wins `[CODE]` | `bg-muted` renders mid-grey, not a surface | Delete the `:95` declaration | None | Low | **P1** |
| **G-07** | Member attendance history | `/app/attendance` | `GET /api/me/attendance` hard `.limit(50)` `[CODE]` | History **silently truncates** | Paginate or "load more" | **Endpoint change** | Low | **P1** |
| **G-08** | Analytics rendering | `/reports`, `/` | `--chart-1..6` declared, **never referenced**; `ui/chart.tsx` never imported `[CODE]` | Analytics are text-only; reference shows one clear number | Render **already-fetched** numbers; no new metric | Data exists; **charting = new dep** | Medium | **P1** |
| **G-09** | CSV export feedback | `/members`, `/reports`, `/attendance` | `window.open(...)`, **no toast** `[CODE]`/`[DOC]` | User cannot tell if it worked | Toast on trigger | None | Low | **P1** |
| **G-10** | Admin mobile nav | mobile admin | `navGroups` has **21 entries** in 6 groups; visible per role: super_admin 21, admin 19, staff 18, ministry_leader 17, viewer 12, `group_leader` 6 (own `groupLeaderNavGroups`) `[RUN]` 2026-10-16. The drawer already renders the same `navGroups` as the desktop Sidebar — there was **no duplicate list**. The real problem was opening the drawer and scrolling a one-column list to find a destination. | Poor discoverability for `staff` | Render tiles **from the same `navGroups`** — never a 2nd list | None | Med (role gates) | **P1 — DONE (Pilot)**: `Sidebar.tsx` only, commit `2265a89`. Not checked: keyboard/focus order in the mobile drawer, roles other than admin and group_leader in a browser, any component render test (none exist, X-01). |
| **G-11** | Home hierarchy | `/` | Many equal-weight sections; `dashboard/operations` already returns counts `[CODE]` | No single primary action | Promote one existing metric to a hero slot | **Yes — already fetched** | **High** — A2 scope leak | **P1** |
| **G-12** | Group ordering | `/groups` | `GET /api/groups` has **no pagination**; `startDate`/`createdAt` present `[CODE]` | No "recently opened" ordering | Sort client-side by existing fields | **Yes — no schema change** | **High** — A1 | **P1** |
| **G-13** | Member care status | `/app/profile` | `PUT /api/me/profile` **excludes** `role`/`membershipStatus` `[CODE]` | Member can't see their own status | — | Data exists, **not exposed** | **Very high — pastoral** | 🔒 **SPEC** |
| **G-14** | `/app/menu` hub | — | **No route exists** `[CODE]` | Wireframe's centrepiece absent | — | — | Med | 🔒 **SPEC** |
| **G-15** | Member notifications | `/app/*` | Admin has a polling bell; members have **none** `[CODE]` | Members cannot see submission outcomes | — | **No read-state / no delivery log** | High | 🔒 **SPEC + SCHEMA** |
| **G-16** | Pager consolidation | `/members` | Hand-rolled pager vs shared `ListPager` `[CODE]` | Inconsistent pagination | Reuse `ListPager` | None | Low | **P2** |
| **G-17** | Post-login reload | `/login` | `window.location.assign("/")` `[CODE]` | Full reload; loses SPA shell | `navigate("/")` | None | Low | **P2** |
| **G-18** | Dead design code | — | `.chip-*` (0 consumers), `--sidebar*` (undefined), 2 radius scales, `motion-reduce` gap, dual dialog systems `[CODE]` | Maintenance hazard | Delete or wire — owner choice | None | Low | **P2** |
| **G-19** | Brand drift | member app | `.lamb-*` never follows `--color-*`; `--lamb-primary` `#0A767C` ≠ `#0c7c82` `[CODE]` | Two brands drift apart | Converge **or** declare permanent | None | Med | 🔒 **OWNER** |
| **G-20** | Bottom nav composition | `/app/*` | 3 conflicting designs: code 5 / mockup 5 / wireframe 4 `[CODE]` | Cannot be resolved by design | — | — | **High** — mockup's map tab is admin-only | 🔒 **OWNER** |
| **G-21** | Font | all | **Sarabun absent**; Prompt in use `[RUN]` | Brief's premise is wrong | Keep Prompt | None | Low | 🔒 **OWNER** |
| **G-22** | Authorization gaps A1–A7 | server | 7 inconsistencies found (see §4) | `member` served the group list; drafts visible to all; silent Zod failure | — | Server change | **High** | 🔒 **APPROVAL** |

🔒 = blocked; requires specification, owner decision, or explicit authorization.

---

## 2. P0 detail

### G-01 · Fix the red gate 🔴 `[RUN]`
**Evidence**
```
FAIL client/src/ux-audit-regressions.test.ts
  > brand-spec.md uses the same Sunken colour as index.css   (line 540)
index.css:58   --color-canvas-sunken: #f1f5f9
brand-spec.md:38  | Sunken | `#f2f2f4` |
```
**Risk if unfixed:** CI fails on every push/PR.
**Fix:** update `brand-spec.md` (and `design.md` + `CLAUDE.md`, which the test does *not* check but which are equally stale — G-01b).
**Acceptance criteria**
1. `pnpm vitest run client/src/ux-audit-regressions.test.ts` → 57/57 pass.
2. `brand-spec.md`, `design.md` and `CLAUDE.md` name no retired hex (`#315c2b`, `#3f7337`, `#1d1d1f`, `#fafafc`, `#f2f2f4`, `#f0f0f0`, `#e0e0e0`).
3. `pnpm check` exit 0 (already true).
4. No token value changed as part of this fix.

### G-02 · The member report list leads to 404 🔴 `[RUN]`
**Evidence** — `MemberReports.tsx:195` `href={`/app/reports/${sub.id}`}`; `App.tsx` has no `/app/reports/:id`; wouter matches exactly; the `*` catch-all renders `NotFound`.
**Risk:** the member's primary "what happened to my report" journey is broken on **every row**.
**Fix (lowest risk):** render the row as a non-navigable `<div>`/button-free element. **Higher-value alternative:** add the detail route backed by the existing `GET /api/submissions/:id` (server already allows reviewer-or-own) — but that is a **new feature and needs a spec**.
**Acceptance criteria**
1. No `<Link>`/`<a>` in `MemberReports.tsx` points at a path absent from `App.tsx`.
2. Tapping any report row does not reach `NotFound`.
3. A test asserts every href literal used in `MemberReports.tsx` resolves to a declared route.
4. `role-aware-ui.test.ts` still passes.

### G-03 · The token swap is unverified 🔴
**Evidence:** 9 `:root` tokens changed in `index.css`; `docs/audits/2026-10-15-product-audit/FEATURE-INVENTORY.md` states *"no page has been looked at since"*; `docs/superpowers/plans/…` records the owner decision **`ACCENT_ONLY`** (tokens unchanged), which this reverses.
**Risk:** the whole app's colour may ship with contrast, hierarchy or dark-mode regressions that no test detects — **client tests render nothing**.
**Acceptance criteria**
1. All 38 route slots opened in a browser at 390 / 768 / 1280 in **light and dark**.
2. Zero console errors, zero HTTP 4xx/5xx, zero horizontal overflow.
3. Every text pairing measured ≥4.5:1 (or ≥3:1 for ≥24px).
4. Both worktrees' tests green (`pnpm check`, `pnpm test`, `pnpm build`).
5. The `ACCENT_ONLY` decision is either superseded **in writing** by the owner, or the swap is reverted.

---

## 3. P1 detail (summarised acceptance criteria)

| ID | Acceptance criteria |
|---|---|
| **G-04** | One exported helper drives nav active state. `/import/duplicates` lights the Import entry in **both** sidebar and bottom nav. `/worship` still lights `/events`. `group_leader` bottom nav still shows exactly 3 items. `nav-structure-contract.test.ts` + `role-gate-contract.test.ts` pass unchanged. |
| **G-05** | One `statusTone(status)` module used by all pages; the duplicated maps are deleted. `absent` renders identically in `/attendance` and `/app/attendance`. `ImportDuplicates` shows `neutral` for zero differences and `warning` for many. `design-system-consistency.test.ts` passes (no page redeclares `StatusChip`). |
| **G-06** | `--muted` declared exactly once in `:root`. `bg-muted` renders a light surface tint, not `#5b6474`. Light and dark agree. `design-tokens.test.ts` passes. |
| **G-07** | `/app/attendance` can reach a member's full history. Truncation is never silent — if capped, the UI says so. Still returns only the caller's own rows. Test added. |
| **G-08** | Existing fetched numbers gain a visual form. **No new API, no new dependency** without approval. Gate stays `PRIVILEGED_ROLES`. Zero new endpoints called. |
| **G-09** | Every `window.open("/api/...csv")` path emits a success/error toast. |
| **G-10** | Any mobile admin tile grid renders from the **same** `navGroups` array. No second hand-maintained list. No role set changes. `nav-structure-contract.test.ts` passes unchanged. |
| **G-11** | One metric is visually dominant on `/`; it comes from `dashboard/operations` (already fetched). **The A2 scope question must be resolved first** — otherwise a church-wide count is promoted to the most prominent element for roles that should not see it. |
| **G-12** | `/groups` can sort by recency using fields already returned. **No schema change.** A1 must be resolved before this broadens group visibility. |

---

## 4. Authorization observations — findings, **not** fixes 🔒

Each is a **fact about current code**. None is fixed here. Each needs explicit authorization, and each needs its own test.

| # | Finding | Location | Severity |
|---|---|---|---|
| A1 | `GET /api/groups` = `requireAuth` only; `GET /api/groups/:id` = `ADMIN_SHELL_ROLES`. A `member` is refused detail but **is served the list**. | `server/routes/groups.ts:30,195` vs `:301` | **High** |
| A2 | `GET /api/dashboard/summary` returns church-wide counts to any authenticated role; only `recentMembers` is gated. | `server/routes/dashboard.ts:29-74` | **High** |
| A3 | `GET /api/announcements` applies **no status filter** → drafts readable by any authenticated role. The member portal **does** filter. | `server/routes/announcements.ts:13-27` vs `portal.ts:86` | **Medium** |
| A4 | `/api/admin/users` uses inline `role !== "super_admin"` instead of `SUPER_ADMIN_ROLES`. | `server/routes/adminUsers.ts:21-24` | Low |
| A5 | `POST /api/me/events/:id/register` **silently ignores** a Zod parse failure instead of 400. | `server/routes/portal.ts:420,457,477` | Low |
| A6 | Two hardcoded role lists duplicate `shared/roles.ts`. | `groups.ts:149-151`; `membershipScope.ts:31` | Low |
| A7 | CSV-injection guard applied on `reports.ts` only; `members.ts`/`attendance.ts` build CSV inline. | `lib/csv.ts` vs `routes/members.ts:315-352` | Medium |

**Recommendation:** do **not** batch these with UI work. They are security-relevant, they touch `server/**`, and `AGENTS.md` plus the handoff both prohibit changing authorization without explicit approval and supporting evidence.

---

## 5. Proposals requiring a specification (no implementation)

| Proposal | Why it needs a spec |
|---|---|
| `/app/menu` "everything" hub | New route + new IA. Its nav design conflicts with 2 other designs. |
| Member care-status visibility | Reveals a pastoral judgement **about** the member. Product + safeguarding decision. |
| Member notification inbox | Requires read-state → **schema change** → prohibited without approval. |
| Submission detail page | New route; server endpoint exists, so this is a genuine candidate — but it is still a new feature. |
| "Featured"/"Recommended" groups | Needs a curation rule. Must **not** use decorative badges with no backing metric. |
| Paginated `GET /api/me/attendance` | Endpoint contract change. |
| Any new dashboard metric | Backend + spec. |

---

## 6. Honest status

| Item | Status |
|---|---|
| Gap matrix, priorities, risks | **AUDITED** — from source + one executed test run |
| G-01, G-02, G-03 | **CONFIRMED** — G-01 and G-02 verified by reading code; G-01 additionally by running the test |
| G-04 … G-12 | **PROPOSED** — not implemented, not tested |
| G-13 … G-22 | **BLOCKED** — specification / owner decision / authorization required |
| Authorization findings A1–A7 | **REPORTED ONLY** — no change made |
| Implementation | **NONE** |