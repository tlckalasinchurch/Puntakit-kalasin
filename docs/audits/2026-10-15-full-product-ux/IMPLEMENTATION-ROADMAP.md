# IMPLEMENTATION-ROADMAP.md

**Status: PLAN ONLY. No implementation has been performed. Awaiting explicit approval.**

**Audit location:** `docs/audits/2026-10-15-full-product-ux/` — a **new** sibling directory. The three prior audit folders (`2026-10-15-badminton-ux/`, `2026-10-15-minimal-premium/`, `2026-10-15-product-audit/`) were **not** touched or overwritten.

---

## 0. Ground rules this plan obeys

| Rule | Source |
|---|---|
| Never commit / push / merge / deploy without an explicit in-session command | `AGENTS.md`, handoff |
| Never reset / revert / discard the 10 modified + 4 untracked working-tree entries | task constraint |
| No business logic, schema, migration, API-authorization or permission change without explicit approval + evidence | `AGENTS.md`, task constraint |
| No new dependency without approval | `AGENTS.md`, handoff |
| Never hand-edit `client/src/components/ui/**` (shadcn-generated) | `AGENTS.md` |
| `README.md` and `puntakit-readme.patch` must not be modified | task constraint |
| Never invent production data or fabricate statistics | task constraint |
| Gate order: `pnpm check` → `pnpm test` → `pnpm build` | `.github/workflows/ci.yml` |

> **Note on the handoff conflict.** `docs/superpowers/HANDOFF-2026-10-15-ui-cleanup.md` states *"do not change `server/**` or `shared/roles.ts`"*. The **uncommitted** working tree has already modified `server/routes/submissions.ts` and `shared/roles.ts` (BLOCKER 2), plus 9 `:root` design tokens in `index.css` despite *"do not change existing design tokens"*. Those changes are **already applied**. This plan neither reverts nor extends them — it flags them for your decision.

---

## 1. Current verified baseline `[RUN]`

| Gate | Command | Result |
|---|---|---|
| Type check | `pnpm check` | ✅ exit 0 |
| Server tests | `pnpm vitest run server/` | ✅ **41 files / 535 tests** |
| Client + shared | `pnpm vitest run client/ shared/` | ❌ **1 failed / 245 passed** |
| Build | `pnpm build` | **NOT RUN** in this audit |
| Browser | — | **NOT RUN** in this audit |

**The tree is red on exactly one test** (`brand-spec.md uses the same Sunken colour as index.css`).

---

## 2. Batch plan

Each batch is small, independently reviewable, and independently revertable. **Batches 1–3 are the recommended starting point** — they are the minimum needed to get to a trustworthy green baseline.

---

### Batch 0 — Decide before touching code 🔒 **[OWNER DECISION REQUIRED]**

Nothing below should start until these are answered, because each one changes *what* the later batches do.

| # | Question | Why it blocks |
|---|---|---|
| **D1** | Approve, amend or revert the **uncommitted** BLOCKER 1/2/3 work (3 route gates, `SUBMISSION_CREATE_ROLES`, the member report form, the 9-token palette swap)? It contradicts the handoff's own rules. | Determines whether Batches 1–4 are building on it or reverting it |
| **D2** | The palette swap reverses the recorded `ACCENT_ONLY` decision. Is the teal palette **approved**? | Batch 1's content depends on the answer |
| **D3** | `brand-spec.md` or `index.css` — which wins? (`brand-spec.md` says `index.css` wins; the test enforces the reverse direction.) | A one-line answer that unblocks the red gate |
| **D4** | Member bottom nav: code's **5** items, mockup's **5** (with a map tab), or wireframe's **4**? | Blocks G-20 and any `/app/menu` work. **Does not block G-10** (admin shell): Pilot G-10 was completed on 2026-10-16 without a D4 answer — see Batch 7 |
| **D5** | `.lamb-theme`: converge onto `--color-*`, or keep it permanently separate? | Blocks any member-side restyle |
| **D6** | Prompt (keep) or Sarabun (introduce)? Sarabun is **not present** today. | Blocks typography work |
| **D7** | `/app/menu`: build it, or drop it from scope? | Blocks G-14 |
| **D8** | May I touch `server/**` to address findings A1–A7? | Blocks the whole authorization track |

---

### Batch 1 — Restore a trustworthy green baseline 🔴 **P0**

**Goal:** CI green, docs consistent. **No visual change.**

| File | Change |
|---|---|
| `brand-spec.md` | Update the 10 stale hexes to the values now in `index.css` **if D2 approved**. If D2 says revert, do the inverse. Either way `brand-spec.md` and `index.css` must agree. |
| `design.md` | Same 6 conflicts (`:14-22`). |
| `CLAUDE.md:56` | Remove the stale *"olive `--color-primary: #315c2b`"* claim and the dead `.metric-card` / `.journey-step` / `.goal-ring` class references. |
| `client/src/index.css:2059` | Update the `#0C7C82 (4.47:1 on mint)` comment if the teal is now the global primary, so the next reader knows the mint constraint still applies. |

**Acceptance criteria**
1. `pnpm vitest run client/src/ux-audit-regressions.test.ts` → **57/57 pass** `[RUN before: 56/57]`
2. `pnpm check` → exit 0
3. `pnpm test` → **all suites green**
4. `pnpm build` → exit 0
5. `grep -rniE "#315c2b|#3f7337|#1d1d1f|#fafafc|#f2f2f4|#f0f0f0|#e0e0e0"` over `*.md` → no hits in `brand-spec.md`/`design.md`/`CLAUDE.md`
6. **No token value changed** in this batch

**Regression risk:** none — documentation only.
**Rollback:** `git checkout -- brand-spec.md design.md CLAUDE.md client/src/index.css`

---

### Batch 2 — Fix the member 404 🔴 **P0**

**Goal:** stop the member report list from leading to a dead page.

| File | Change |
|---|---|
| `client/src/pages/member/MemberReports.tsx` | Replace the `<Link href={`/app/reports/${sub.id}`}>` (line 195) with a non-navigable element |
| `client/src/role-aware-ui.test.ts` | Add: **every** href literal in `MemberReports.tsx` resolves to a `path="…"` declared in `App.tsx` |

**Why not add the detail route now:** `GET /api/submissions/:id` already exists and allows reviewer-or-own, so a detail page is genuinely feasible — but **a detail page is a new feature** and needs a specification. The non-navigable fix is a defect repair, not a feature.

**Acceptance criteria**
1. No href in `MemberReports.tsx` is absent from `App.tsx`'s route table.
2. Tapping any row does not render `NotFound`.
3. The list still renders all rows and status chips unchanged.
4. `role-aware-ui.test.ts` + `member-events-rsvp.test.ts` pass.
5. Verified in a browser at 390 px and 1280 px, light and dark.

**Dependencies:** none. **Risk:** low.
**Rollback:** `git checkout -- client/src/pages/member/MemberReports.tsx`

---

### Batch 3 — Verify the token swap before building on it 🔴 **P0**

**Goal:** establish whether the uncommitted palette actually renders acceptably.

This is a **test** batch, not an edit batch — but no later visual work is safe without it.

**Method:** all 38 route slots × {390, 768, 1280} × {light, dark}, with a console-error, HTTP-status, overflow and contrast capture — mirroring the method already recorded in `docs/UI_ROUTE_TRACKER.md`.

**Acceptance criteria**
1. Zero uncaught console errors; zero unexpected 4xx/5xx.
2. Zero horizontal overflow at 390 px.
3. Every text pairing ≥4.5:1 (≥3:1 for ≥24 px), including dark mode. **Specifically re-measure `#0C7C82` as foreground on every surface it lands on** — measured values: `#f8fafc` 4.76 ✅, `#ffffff` 4.98 ✅, `#e8f5f4` **4.45 ❌**, `#e4f7f2` **4.47 ❌**.
4. `--muted` renders as a light tint (see Batch 4) — until fixed, record the current grey as a known defect.
5. Findings recorded in `docs/UI_ROUTE_TRACKER.md`, not asserted verbally.

**Risk:** if it fails, the palette must be adjusted **before** any other UI work — which is exactly why this precedes Batch 4.

---

### Batch 4 — Shared component correctness 🟡 **P1**

**Goal:** fix real defects in the shared layer first, per the brief's "start with shared UI components".

| File | Change | Defect |
|---|---|---|
| `client/src/index.css:95` | Delete the second `--muted` declaration | `#5b6474` shadows `#f5f5f7`, so `bg-muted` renders mid-grey |
| `client/src/lib/statusTone.ts` **(new)** | One `statusTone(status)` map for all domains | 4 duplicated maps + 2 inline ternaries |
| `client/src/pages/members/*`, `Map.tsx`, `FollowUps.tsx`, `ImportDuplicates.tsx`, `Feed.tsx`, `Inbox.tsx`, `Events.tsx`, `MemberAttendance.tsx`, `Attendance.tsx` | Consume it; delete the copies | `absent` differs admin vs member; `ImportDuplicates:353` inverted |
| `client/src/components/DesignSystem.tsx` | *(reference only)* — **do not** edit | contract test bans redeclaration |
| `client/src/pages/Members.tsx:880-907` | Reuse `ListPager` | hand-rolled pager |

**Acceptance criteria**
1. `--muted` appears exactly once in `:root`; `bg-muted` renders light.
2. No page file contains a status→tone map; a test asserts this.
3. `absent` renders identically in `/attendance` and `/app/attendance`.
4. `ImportDuplicates` shows `neutral` for zero differences.
5. `design-system-consistency.test.ts`, `design-tokens.test.ts`, `ux-audit-regressions.test.ts`, `membership-ui.test.ts` all pass **without being edited to accommodate the change**.

> ⚠️ **Do not weaken a contract test to make a change pass.** If a test genuinely blocks a correct fix, stop and report it.

**Risk:** low–medium. **Rollback:** per-file `git checkout --`.

---

### Batch 5 — Navigation consistency 🟡 **P1**

| File | Change |
|---|---|
| `client/src/lib/navActive.ts` **(new)** | One exported `isNavActive(path, location)` |
| `components/layout/Sidebar.tsx:305-308` | Use it, keeping the `/worship` and `/import/*` special cases |
| `components/layout/MobileBottomNav.tsx:49` | Use it — fixes `/import/duplicates` highlighting nothing |
| `components/layout/MemberAppLayout.tsx:130-132` | Use it, keeping prefix matching |

**Acceptance criteria**
1. `/import/duplicates` lights the Import entry in **both** the sidebar and the bottom nav.
2. `/worship` still lights `/events`.
3. `group_leader` bottom nav still shows exactly 3 items; default still 4.
4. `nav-structure-contract.test.ts` and `role-gate-contract.test.ts` pass **unchanged**.
5. Zero label changes — this is behaviour only.

---

### Batch 6 — Feedback and truncation 🟡 **P1**

| File | Change |
|---|---|
| `Members.tsx:515`, `Reports.tsx:83`, `Attendance.tsx:511` | Toast on CSV export |
| `server/routes/portal.ts` + `client/src/pages/member/MemberAttendance.tsx` | Paginate `/api/me/attendance` (currently hard `.limit(50)`) |

**Acceptance criteria**
1. Every CSV export emits success/error feedback.
2. A member can reach their **full** attendance history.
3. If any limit remains, the UI states it — **truncation is never silent**.
4. `/api/me/attendance` still returns **only the caller's own rows** (server test added).
5. `prayer-request-copy-contract.test.ts` unaffected.

**Risk:** medium — this touches a server endpoint contract.

---

### Batch 7 — Admin mobile discoverability 🟡 **P1**

Render an action grid on small screens **from the existing `navGroups`** in `Sidebar.tsx:74-185`.

**Status (2026-10-16): Pilot G-10 DONE** — `client/src/components/layout/Sidebar.tsx` only, commit `2265a89`. Below `lg` the drawer is now a 2-column tile grid, built from the same `navGroups` / `groupLeaderNavGroups`; desktop Sidebar unchanged. No change to API, database, authentication or role permissions. Still open: keyboard/focus test of the mobile drawer, browser test of the roles other than admin and group_leader, and a component render test (none exist, X-01). No new test was added by the Pilot, so criterion 1's "a test asserts this" is **not** met.

**Acceptance criteria**
1. The grid is generated from `navGroups` — no second list. A test asserts this.
2. Every role sees exactly the entries its sidebar shows today. No role set changes.
3. Thai labels unchanged — `nav-structure-contract.test.ts` passes unchanged.
4. Touch targets ≥44 px; `premium-shell-contract.test.ts` still passes (no `pk-*` leakage).
5. ~~Blocked on **D4** if it would change the member nav.~~ Not applicable: the Pilot did not touch the member nav (`MobileBottomNav.tsx`, `MemberAppLayout.tsx` unchanged).

---

### Batch 8 — Visualization of existing data 🟡 **P1**

Render **already-fetched** numbers from `/api/reports/summary`, `/api/dashboard/operations`, `/api/attendance/summary`.

**Hard constraints**
- **No new endpoint. No new metric. No new dependency** without approval.
- `recharts` is already in `package.json` but **never imported**; using it is still a decision for you.
- If no charting is approved, a CSS bar (`.DataBar` already exists in `DesignSystem.tsx`) is the zero-dependency fallback.
- All of it stays behind the existing `PRIVILEGED_ROLES` gate.

**Acceptance criteria**
1. Zero new network calls; every number rendered was already fetched.
2. Gate unchanged; `viewer`/`member`/`group_leader` still denied.
3. Text equivalents of every chart are present (accessibility).
4. `premium-shell-contract.test.ts` + `design-system-consistency.test.ts` pass.

---

### Batch 9 — Owner decisions 🔒 **NOT SCHEDULED**

| Item | Blocked on |
|---|---|
| `/app/menu` hub (G-14) | **D7** + a real specification |
| Member care-status visibility (G-13) | Specification + **safeguarding review** — reveals a pastoral judgement about the member |
| Member notification inbox (G-15) | Specification + **schema change** |
| Submission detail page | Specification (feasible: `GET /api/submissions/:id` exists) |
| Group recency ordering (G-12) | **A1** must be resolved first (it broadens group visibility) |
| Home hero metric (G-11) | **A2** must be resolved first (it promotes a church-wide count) |
| Authorization findings **A1–A7** | **D8** — explicit authorization; each needs its own test |
| Font (G-21) | **D6** |
| `.lamb-theme` (G-19) | **D5** |
| Bottom nav (G-20) | **D4** |
| Sarabun introduction | **D6** — conflicts with `brand-spec.md` "one family" |
| Charting dependency | Explicit approval — `AGENTS.md` forbids unapproved installs |
| `/media`, `/settings` (`ComingSoon` stubs) | Specification |

---

## 3. Dependency map

```
Batch 0 (decisions)
   │
   ├─► Batch 1 (green baseline) ──┐
   │                              │
   └─► Batch 3 (token verification)│
                                  ▼
                            Batch 4 (shared components)
                                  │
                            Batch 5 (nav) ──► Batch 7 (mobile grid)
                                  │
                            Batch 6 (feedback) ──► Batch 8 (visualization)

Batch 9 (spec-gated) — needs Batch 0 decisions + A1/A2 resolution first
```

**Batches 4, 5 and 6 are independent of each other** and can run in parallel by different agents, provided each does not weaken a shared contract test.

---

## 4. Regression tests that must stay green

| Test | Guards |
|---|---|
| `client/src/design-tokens.test.ts` | exact hexes, contrast, retired navy palette |
| `client/src/ux-audit-regressions.test.ts` | broadest UI net **incl. the `brand-spec.md` sync (currently red)** |
| `client/src/design-system-consistency.test.ts` | no raw Tailwind palette, no redeclared components, 12 px floor |
| `client/src/premium-shell-contract.test.ts` | `pk-*` stays admin-only |
| `client/src/nav-structure-contract.test.ts` | Thai nav labels + role gates |
| `client/src/role-gate-contract.test.ts` | every admin route carries `allow=` |
| `client/src/role-aware-ui.test.ts` | member report form + list-unwrap fix |
| `client/src/member-events-rsvp.test.ts` | dual-CTA RSVP, no `/interest` endpoint |
| `client/src/membership-ui.test.ts` | `MemberCard` privacy bar, fee from `shared/membership` |
| `client/src/auth-session-contract.test.ts` | auth-loop guard |
| `shared/roles.test.ts` | `CREATE_ROLES` must never contain `member` |
| `server/routes/submissions.test.ts` | member 201 / viewer rejection |

**⚠️ Systemic risk — X-01.** All 18 client tests are **static source scans**; there is **no jsdom and no React Testing Library**, and `tsconfig.json` excludes `**/*.test.ts` so `pnpm check` never parses them. The suite proves *strings exist*, not *components render* — which is exactly why the `/app/reports/:id` dead link (G-02) passed every gate. A green suite is therefore **necessary but not sufficient**. Any batch that touches rendering must include manual browser verification.

---

## 5. Verification procedure per batch

```powershell
$env:TZ="UTC"          # machine is SE Asia; CI is UTC
pnpm check
pnpm test
pnpm build
```
Then a browser pass at **390 / 768 / 1280**, **light and dark**, plus any role sweep the change touches.

Judge `pnpm test` by the **`Test Files` / `Tests` summary line**, not the exit code — the script passes `--passWithNoTests`, so a mis-scoped run reports green with zero tests.

---

## 6. What this roadmap does **not** cover

- Any change to business logic, schema, migrations, API authorization or permissions (Batches 9 only, with `D8`)
- Any authentication change — the PIN-login blueprint remains **NOT APPROVED**
- Any new dependency
- Any production or Neon access
- Any commit, push, merge or deploy
- Any modification of `README.md` or `puntakit-readme.patch`

---

## 7. Final status

| Item | Status |
|---|---|
| Batch 0 — 8 owner decisions | **PARTLY RESOLVED** — D2/D3 answered ("fix docs first"); D1/D4–D8 still open |
| Batch 1 — green baseline | **IMPLEMENTED + TESTED** 2026-10-15 (see `LOGIN-REWRITE-RECORD.md`) |
| Login rewrite (owner-instructed, outside this plan) | **IMPLEMENTED + TESTED + browser-rendered** — see `LOGIN-REWRITE-RECORD.md` |
| Batches 2, 4–8 | **PLANNED, NOT IMPLEMENTED** |
| Batch 9 — spec-gated items | **BLOCKED** — no approved specification exists |
| Findings A1–A7 (authorization) | **REPORTED ONLY** — reported, not fixed |
| Files modified by this audit | **6 audit markdown files** in `docs/audits/2026-10-15-full-product-ux/` |
| Existing files modified by the owner-authorised work | `brand-spec.md`, `design.md`, `CLAUDE.md`, `client/src/index.css`, `client/src/pages/PinSignInPage.tsx` |
| Pre-existing uncommitted work | **PRESERVED** — the 10 files present before this session are untouched by the audit |
| Commits / pushes / merges / deploys | **NONE** |
| New dependencies installed | **NONE** |
| Production access | **NONE** |

**Batches 1 and the login rewrite are done and green. Batches 2 and 4–8 remain WAITING FOR APPROVAL.**