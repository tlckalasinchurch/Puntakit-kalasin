# 06 — Remaining work, gaps, and recommended remediation order

---

## 1. What is NOT verified — read before claiming coverage

| Phase | State | Missing |
|---|---|---|
| 3 — every page & interactive control | **Partial** | Pages enumerated and statics analysed. **No control was actually clicked.** No per-control interaction matrix exists. |
| 6 — responsive | **Complete** for overflow/structure | No orientation change, no 200%/400% zoom/reflow, no landscape phone. |
| 7 — accessibility | **Partial** | **Contrast is void** (detector artifact — see [`05`](05-BROWSER-EVIDENCE.md) §5). **No keyboard/focus-order pass. No screen reader. No reflow test.** Only static structure was checked. |
| 8 — functional & performance | **Partial** | Zero console/network errors measured, but **performance was never benchmarked** and the **test suite was never run**. |

### Gaps inherited from the 2026-10-17 audit, still open
| Gap from the prior audit | Still open? |
|---|---|
| Performance not measured | **Yes** — not attempted |
| Contrast only at 390px, only flat backgrounds | **Yes** — worse here; that audit's method was better |
| No keyboard / focus-order pass | **Yes** — still not done |
| Only `admin` and `viewer` rendered | **Partly** — `viewer`, `staff`, `ministry_leader`, `group_leader`, `member`, `super_admin` all still unrendered |
| Desktop 1280 screenshots not viewed by eye | **Yes** — no screenshots reviewed |
| Light theme rarely screenshotted | **Yes** |

### Known open questions needing a decision or a check
| # | Question | Who resolves it |
|---|---|---|
| Q-1 | **Is client-side-only read gating acceptable?** (F-01) — a `member` can list every care group | **Product decision.** Blocks the fix. |
| Q-2 | Does every guarded page really render its shell twice? (F-20) | One browser check: count `[data-testid=…]`/`<main>` ancestors, or check whether the page-level `AppLayout` import is dead |
| Q-3 | Is the `/follow-up` checkbox hit area extended by its `<label>`? | One DOM inspection |
| Q-4 | Which card radius is canonical — 18px or 24px? (F-06) | **Product/design decision.** `index.css` says 24, both docs say 18 |
| Q-5 | Should `--shadow-card` be the default card elevation, or an exception? (F-07) | **Design decision** — the docs and the shipped CSS disagree |
| Q-6 | Does `Home.tsx:598` actually overflow with a long Thai name? (F-25) | Needs a long-name reproduction, which the brief forbids me from fabricating |
| Q-7 | Should `/media` and `/settings` exist at all? They are unstyled stubs | **Product decision** |

---

## 2. Recommended order

Ordered by *risk-adjusted value*. Each step states its acceptance test.

### Wave 0 — cheap, zero-risk, unblocks everything
| # | Fix | Acceptance |
|---|---|---|
| 0.1 | **F-04** add jsdom + testing-library; render each of the 34 pages once | a page that throws fails `pnpm test` |
| 0.2 | **F-08** replace `.primary-action` with `ActionButton` | F-08's measurement shows a teal fill, `9999px` radius, non-zero padding |
| 0.3 | **F-14** `meta.total` in the Feed/Inbox count labels | count equals the pager total |
| 0.4 | **F-05** move label maps into `shared/labels.ts`; add a test that every `SERVICE_TYPES` / `CHECKIN_METHODS` / group-role value has a label | the test fails if an enum member has no label — this is the guard that stops the drift recurring |
| 0.5 | **F-10 / F-11** use `lib/date.ts` helpers | a session opened at 00:30 ICT shows today |

### Wave 1 — shared-component fixes, one edit each, many findings resolved
| # | Fix | Resolves |
|---|---|---|
| 1.1 | `role="alert"` on the `Field` error node | S-1, 3 sites |
| 1.2 | `role="status"` inside `LoadingStates.tsx` | S-2, 9 sites |
| 1.3 | Export `INPUT_CLASS`/`PRIMARY_BUTTON_CLASS`/etc. from `DesignSystem.tsx` | S-4, ~7 files of drift |
| 1.4 | One `todayLocal()` + `formatThaiDateTime()` in `lib/date.ts` | S-3, 8 sites |
| 1.5 | Hoisted `Intl.NumberFormat` wrapper | S-15, 4 sites |
| 1.6 | Extend the retired-literal test to walk `client/src` (as the blue test already does) | closes the hole that let **F-09** ship |

### Wave 2 — needs a decision first
| # | Item | Blocked by |
|---|---|---|
| 2.1 | Server-side authorisation on the ten client-only read routes | **Q-1** |
| 2.2 | Settle the card radius, then normalise ~50 sites | **Q-4** |
| 2.3 | Settle `--shadow-card` scope | **Q-5** |
| 2.4 | `/app/attendance` + prayer-request entry points (**F-02**, **F-03**) — small, but changes navigation, so confirm the shape with the product owner | — |

### Wave 3 — the systemic `.type-*` / radius work
`S-14` and `F-06`'s member-shell arm: 24 sites bypass the type scale, the whole `/app` shell bypasses `--radius-*`. Large, mechanical, low individual risk but high blast radius — do it with the type-scale guard test in place first.

### Wave 4 — housekeeping
- **66 dead class selectors** in `index.css` (`design-system-consistency` should gain a dead-CSS guard).
- Delete dead code CI cannot see: `Events.tsx:84`, unused imports in `Groups.tsx`/`Members.tsx` (`noUnusedLocals` is off).
- Reconcile the `API_PORT` proxy defect — see [`01`](01-BASELINE-AND-METHOD.md) §4. **Fix the config or the docs; right now `pnpm dev` is broken for anyone who follows `AGENTS.md`.**
- Update `AGENTS.md`'s stale `API_PORT=3001` claim and its Clerk references.
- Update `PRODUCT.md`'s `DESIGN.md` citation to `design.md` (breaks on a case-sensitive filesystem).

---

## 3. Which fixes are safe, which need a decision

| Class | Examples |
|---|---|
| **Safe — mechanical, no behaviour change** | Wave 0 (except 0.5, which touches navigation), all of Wave 1, P3 items in the register |
| **Needs a product decision** | F-01 (Q-1), F-02/F-03 (navigation shape), F-06 (Q-4), F-07 (Q-5), `/media` `/settings` (Q-7), the six-label role vocabulary, the four-word care-group vocabulary, whether a default-draft announcement is acceptable |
| **Touches business behaviour** | Feed's role→action mapping (**F-12**) — changes who sees what; the announcement draft default; member consent pre-check (`MemberProfile.tsx:74` pre-ticks PDPA consent — **this one is a compliance question, not a UI one**) |
| **Do not do without a migration plan** | any server-authorisation change (F-01), because 15 role sets interact |

---

## 4. Test strategy I recommend

`pnpm test` takes ~5 minutes and boots 34 PGlite instances. The prior audit recorded **60 files / 744 tests** passing on `main`; treat any number as stale and re-run.

Recommended order:
1. `pnpm check` — fastest gate
2. scoped `pnpm vitest run client/src/<file>` while iterating
3. full `pnpm test` with `TZ=UTC` in **PowerShell** (`$env:TZ="UTC"`) — the bash form `TZ=UTC pnpm test` fails there, and the suite is timezone-sensitive
4. `pnpm build` — a real CI gate that `check` alone cannot substitute for

CI runs Node 24; this machine has 26.11.1. Green locally is not proof of green in CI.

---

## 5. Final state

| Item | Value |
|---|---|
| Repo files modified | **0** |
| Files created | 7 markdown files in `docs/audits/2026-10-18-full-audit/` |
| Commits / pushes / deploys | **none** |
| Original `.db_data` | byte-identical, SHA `b290b639…` unchanged |
| Stash / other worktrees | untouched |
| Findings recorded | 20 numbered (1×P0, 19×P1) + grouped P2/P3 + 15 recurring patterns |
| Approval to edit | **not given — and none assumed** |
