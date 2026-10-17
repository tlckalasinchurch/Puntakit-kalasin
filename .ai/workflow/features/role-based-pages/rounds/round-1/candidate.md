# Candidate — role-based-pages / RBP-01 — round-1

Frozen after `/test`. Do not edit source or this file before `/review`.

## Identity
- Feature: `role-based-pages` · Ticket: `RBP-01` (Home quick-action tiles by real role)
- Ticket marker at validation time: `Status: approved` (TICKETS.md line 25). Who changed it from `draft` is NOT VERIFIED in this session (not changed by the validating session).
- Date: 2026-10-16 · Branch: `redesign/full-app-claude-20261015`

## Commits
- Baseline: `666e9a3f328356b8de6458a4f600edd34a64211d`
- Candidate: uncommitted working tree on top of baseline (nothing committed, per rules)

## Acceptance criteria (summary; source of truth is TICKETS.md RBP-01)
1. Role table: Primary Tiles and Secondary Links per role (super_admin/admin/staff 8 links incl. `/reports`; ministry_leader 8 incl. `/ministries`; group_leader exactly `/follow-up`,`/groups`,`/members`; viewer 7; member none); no duplicate hrefs; none equal to a shown tile href.
2. `role === undefined`: no tiles, no secondary links.
3. Badge behaviour unchanged (`membership` attention, `followUp` openFollowUps).
4. Sizing/a11y unchanged; tiles above ErrorState; no `/api/dashboard/summary`.

## Validation (run this session, repo root)
| Command | Exit | Result |
|---|---|---|
| `pnpm check` | 0 | PASS — `tsc --noEmit`, no errors |
| `pnpm test` | 0 | PASS — 65 files, 841 tests passed (414.5s) |
| `pnpm build` | 0 | PASS — vite built in 17.64s, `dist/index.js` 416.3kb (chunk-size warning only) |
| `git diff --check` | 0 | PASS — no whitespace errors |

Earlier targeted run (same session): `homeTiles.test.ts` 39, `role-aware-ui.test.ts` 8, `membership-ui.test.ts` 18 — all pass.

## git diff --stat (RBP-01 tracked files only)
```
 client/src/components/home/HomeMyWork.tsx | 106 ++++++++++++++----------------
 client/src/role-aware-ui.test.ts          |  12 ++++
 2 files changed, 62 insertions(+), 56 deletions(-)
```
New untracked: `client/src/lib/homeTiles.ts` (100 lines), `client/src/lib/homeTiles.test.ts` (123 lines).

## Touched files (RBP-01)
- `client/src/lib/homeTiles.ts` (new, untracked)
- `client/src/lib/homeTiles.test.ts` (new, untracked)
- `client/src/components/home/HomeMyWork.tsx`
- `client/src/role-aware-ui.test.ts`
- Listed in ticket but not changed by this round: `client/src/membership-ui.test.ts` (modified earlier by HCM work; passes)

## Known limitations
- `HomeMyWork.tsx` and `membership-ui.test.ts` already carried uncommitted changes from earlier HCM tickets before RBP-01, so the `HomeMyWork.tsx` diff stat mixes HCM and RBP-01 changes; the RBP-01 part is the `homeMoreLinksFor` swap for static `SECONDARY_LINKS`.
- `homeMoreLinksFor(role, _extraLinks)` accepts `extraLinks` but ignores it; output is fixed per role and matches the AC table. `Home.tsx` still passes extra links that are therefore unused.
- Browser/visual checks (320/390/768/1280px, light/dark, contrast, touch targets) were NOT run in this round; covered by RBP-03.
- Pre-existing dirty files not part of RBP-01 and untouched: `CLAUDE.md`, `PinSignInPage.tsx`, `.pin-login` block in `index.css`, `MissionPhotoSheet.tsx`, `MembershipPanel.tsx`, `Memberships.tsx`, `stash@{0}`.
