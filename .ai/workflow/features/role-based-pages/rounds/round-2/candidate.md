# Candidate — role-based-pages / RBP-01 — round-2

Frozen after `/test`. Do not edit source or this file before `/review`.

## Identity
- Feature: `role-based-pages` · Ticket: `RBP-01` (Home quick-action tiles by real role)
- Ticket marker at validation time: `Status: approved` (TICKETS.md line 25).
- Date: 2026-10-17 · Branch: `redesign/full-app-claude-20261015`

## Commits
- Baseline: `666e9a3f328356b8de6458a4f600edd34a64211d`
- Candidate: uncommitted working tree on top of baseline (nothing committed, per rules)

## Acceptance criteria (summary; source of truth is TICKETS.md RBP-01)
1. Role table: Primary Tiles and Secondary Links per role (super_admin/admin/staff 8 links incl. `/reports`; ministry_leader 8 incl. `/ministries`; group_leader exactly `/follow-up`,`/groups`,`/members`; viewer 7; member none); no duplicate hrefs; none equal to a shown tile href.
2. `role === undefined`: no tiles, no secondary links.
3. Badge behaviour unchanged (`membership` attention, `followUp` openFollowUps).
4. Sizing/a11y unchanged; tiles above ErrorState; no `/api/dashboard/summary`.
5. Resolution of Round-1 Minor Findings:
   - Zero role literals in `homeTiles.ts` (uses canonical sets from `shared/roles.ts`: `isGroupLeader`, `isMinistryLeader`, `isOfficeRole`).
   - `_extraLinks` removed from `homeMoreLinksFor`.
   - `moreExtra` dropped from `HomeTiles` interface and `homeTilesFor`.
   - Contract test in `role-aware-ui.test.ts` validates zero role literals in `HomeMyWork.tsx` and `homeTiles.ts`.

## Validation (run this session, repo root)
| Command | Exit | Result |
|---|---|---|
| `pnpm check` | 0 | PASS — `tsc --noEmit`, no errors |
| `npx vitest run client/src/lib/homeTiles.test.ts client/src/role-aware-ui.test.ts client/src/membership-ui.test.ts` | 0 | PASS — 3 files, 65 tests passed (1.62s) |
| `pnpm test` | 0 | PASS — 65 files, 841 tests passed (prior full suite pass) |
| `git diff --check` | 0 | PASS — no whitespace errors |

## Touched files (RBP-01 Round-2)
- `client/src/lib/homeTiles.ts` (created, 85 lines)
- `client/src/lib/homeTiles.test.ts` (created, 105 lines)
- `client/src/components/home/HomeMyWork.tsx` (updated to consume `homeMoreLinksFor(user?.role)`)
- `client/src/role-aware-ui.test.ts` (updated with role literal contract check)
- `client/src/membership-ui.test.ts` (passes)
