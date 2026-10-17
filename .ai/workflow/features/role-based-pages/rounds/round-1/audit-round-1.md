# Audit round 1 — role-based-pages / RBP-01

Auditor: `Explore` subagent, `model: opus` (substitute for `security-reviewer`, which is not available in this session; disclosed). Verdict below is copied verbatim from the auditor's hand-back.
External snapshot check: `.pre-audit.txt` vs `.post-audit.txt` — `diff` exit 0 (no change to touch set or `.ai/`).

---

VERDICT: ACCEPT-WITH-NITS

All 7 rows of the AC role table match `homeTilesFor`/`homeMoreLinksFor` exactly. Every secondary href is reachable through its App.tsx guard. There is no BLOCKER or MAJOR. What's left is dead plumbing and one wording conflict with the "canonical sets only" clause.

**Fleet sections not applied.** Appendix A, n8n, Telegram, SSH worker nodes, session 0, .ps1 encoding and the queue/state lenses do not apply to this repo. RBP-01 is a pure client-side TS function plus a React component, with no shared state and no I/O beyond the existing `/api/home/overview` GET. Lens 2 (concurrency) and Lens 3 (portability) are clean for that reason. Tier T1, blast R0, git-reversible.

**AC check results (a to h)**
- **(a) Role table.** Matches on every cell. Primary tiles come from `CREATE_ROLES`/`MEMBERSHIP_VIEW_ROLES` at homeTiles.ts:41-42. Secondary links are at homeTiles.ts:70-99. homeTiles.test.ts:60-73 asserts the exact order for all 7 roles.
- **(b) Role names written out.** HomeMyWork.tsx has 0 role literals (grep). homeTiles.ts:70-87 branches on `"member"`, `"group_leader"`, `"ministry_leader"` and `"viewer"`. Ruling: this is not a violation of "ห้ามเขียนรายชื่อ role ซ้ำใน component". The file is a lib, not a component, and the checks are single-role equality, not a role list. It does conflict with "กรองไทล์และทางลัดด้วย canonical role sets ... เท่านั้น" (TICKETS.md:87) and with its own doc comment. Rated MINOR, finding 1.
- **(c) Unused param.** `_extraLinks` is ignored. Home.tsx:645 still builds `getRoleShortcuts(...)` (Home.tsx:556), and that data is now thrown away. MINOR, finding 2.
- **(d) Reachability.** `/members`, `/groups`, `/attendance`, `/events`, `/feed`, `/announcements`, `/map`, `/ministries` and `/follow-up` all use `ADMIN_SHELL_ROLES` (App.tsx:123-250). `/reports` uses `PRIVILEGED_ROLES` (App.tsx:252) and is only shown to super_admin/admin/staff, which that set covers. No ComingSoon target (`/media` and `/settings` are not linked). The viewer list is 403-free.
- **(e) Undefined role and member.** Both return `[]` (homeTiles.ts:38,70). The "ดูทั้งหมด" button and list are hidden when `moreLinks.length === 0` (HomeMyWork.tsx:116). Tiles come from `user.role` synchronously and not from `data`, so they cannot flash while overview loads. HomeMyWork only mounts when `user` exists (Home.tsx:643), so the undefined branch is covered by the unit test only.
- **(f) Badges.** Same logic as HEAD. Membership is `attention > 0`; followUp is `openFollowUps > 0`, and `data?.counts.openFollowUps ?? 0` behaves the same as HEAD's `data && ... > 0` (HomeMyWork.tsx:100-106). The two-span badge markup is HCM work, not RBP-01.
- **(g) Tests.** They assert real behaviour: exact href arrays, a `new Set(hrefs).size` check per role, and no overlap with tile hrefs (homeTiles.test.ts:79-92). The two `extraLinks` tests (homeTiles.test.ts:94-110) pass trivially because the param is ignored. They still guard against someone merging extras back in later. The contract test does not check that HomeMyWork has no role literals. MINOR, finding 4.
- **(h) Scope.** `git diff HEAD --stat -- server shared` is empty, so server, schema, auth and API are untouched.
  - RBP-01's part of the HomeMyWork.tsx diff: removed `SECONDARY_LINKS` and `mergeHomeLinks`, the `homeMoreLinksFor` call at line 98, and the two `moreLinks.length > 0` guards.
  - HCM's part: the `pk-home-tile` classes, the badge split, the `tileView`/`homeTilesFor` map, and moving tiles above `ErrorState`, which is HCM E2E-AUDIT item A7.
  - homeTiles.ts was created by HCM, so the split inside it is inferred. RBP-01 added `BASE_SECONDARY_LINKS` and `homeMoreLinksFor`.

**FINDINGS**

[MINOR] client/src/lib/homeTiles.ts:70 — `homeMoreLinksFor` branches on role string literals instead of the shared sets, against TICKETS.md:87 "sets ... เท่านั้น". It also contradicts its own comment at homeTiles.ts:33-35 ("never from a role list written here").
TRIGGER: someone edits a set in shared/roles.ts, for example adds viewer access to `/reports`.
EFFECT: home links silently stop matching the route guards, and the comment misleads the next reader.
FIX:
```diff
- if (role === "group_leader") {
+ if (hasRole(role, CREATE_ROLES) && !hasRole(role, PRIVILEGED_ROLES)) {
...
- if (role === "ministry_leader") {
+ if (hasRole(role, PRIVILEGED_ROLES) && !hasRole(role, MEMBERSHIP_VIEW_ROLES)) {
...
- if (role === "viewer") { return [...BASE_SECONDARY_LINKS]; }
```
Alternative: keep the literals and correct the comment to say role equality is used where the AC table singles out a role.
VERIFY: `npx vitest run client/src/lib/homeTiles.test.ts` stays at 39/39.

[MINOR] client/src/lib/homeTiles.ts:68 — `_extraLinks` is accepted and ignored. So `HomeMyWork`'s `extraLinks` prop (HomeMyWork.tsx:75) and `getRoleShortcuts` at Home.tsx:645 are dead.
TRIGGER: a maintainer adds a shortcut to `STAFF_ADMIN_SHORTCUTS` in Home.tsx.
EFFECT: the link never appears and nothing fails.
FIX: in homeTiles.ts:66-69, drop the param, or add a one-line comment saying it is intentionally ignored and Home.tsx shortcuts are superseded. Cleaning up Home.tsx belongs in a follow-up ticket, because the AC says not to edit Home.tsx.
VERIFY: `pnpm check`.

[MINOR] client/src/lib/homeTiles.ts:45 — `HomeTiles.moreExtra` is no longer read by the component, which destructures only `primary` at HomeMyWork.tsx:97. It now duplicates `/follow-up` and `/ministries` data that `homeMoreLinksFor` hard-codes separately. `mergeHomeLinks` (client/src/lib/homeLinks.ts:11) has no production caller left.
TRIGGER: someone edits a label or href in one of the two places.
EFFECT: the two sources drift. The tests at homeTiles.test.ts:7-23 keep asserting values nobody renders.
FIX: drop `moreExtra` from `HomeTiles` and from the tests, or derive the extra links from `homeMoreLinksFor`.
VERIFY: `npx vitest run client/src/lib/homeTiles.test.ts`.

[MINOR] client/src/role-aware-ui.test.ts:62 — the contract test that the AC test seam lists for "no duplicated role list" never checks that role literals are absent.
TRIGGER: someone reintroduces `user?.role === "group_leader"` in HomeMyWork.tsx.
EFFECT: the test stays green.
FIX:
```ts
expect(src).not.toMatch(/"(super_admin|admin|staff|ministry_leader|group_leader|viewer|member)"/);
```
VERIFY: add a literal temporarily; the test goes red.

[NIT] client/src/lib/homeTiles.ts:99 — the final `return [...BASE_SECONDARY_LINKS]` cannot be reached, because every `UserRole` returns earlier.
TRIGGER: none at runtime.
EFFECT: a reader may think some role falls through to the base 7 links.
FIX: delete the line and return from the `PRIVILEGED_ROLES` branch unconditionally.
VERIFY: `pnpm check`.

**OUT OF SCOPE, NOTICED**
- client/src/pages/Home.tsx:601 still fetches `/api/dashboard/summary` on the page. HomeMyWork itself does not, so AC4 is met as worded.
- client/src/lib/homeLinks.ts and homeLinks.test.ts now only serve their own test.

**VERIFIED / ASSUMED / UNVERIFIABLE**
- **Verified:** `npx vitest run` on homeTiles, role-aware-ui and membership-ui gives 3 files and 65/65 passed. That is 39 + 8 + 18, the same counts the packet claims. Also verified: the AC table against the code and tests, the App.tsx guards for each href, no server/shared diff, and no role literals in HomeMyWork.
- **Assumed:** the RBP-01 vs HCM split inside homeTiles.ts and HomeMyWork.tsx, inferred from HCM docs (E2E-AUDIT A7, the HCM TICKETS homeTilesFor seam). Neither file has a commit that separates them.
- **Unverifiable from here:** the packet's `pnpm check`, full `pnpm test` (841) and `pnpm build` claims, which I did not re-run as instructed. Also who set `Status: approved`, and the visual and contrast checks, which RBP-03 covers.

```json
{"verdict":"ACCEPT-WITH-NITS","pipeline_result":"PASS","blockers":0,"majors":0,"minors":4,"scope_violations":0,"tests_weakened":false,"executor_assumed":"bash-MSYS","findings":[{"sev":"MINOR","file":"client/src/lib/homeTiles.ts","line":70,"id":"role-literals-vs-canonical-sets-only"},{"sev":"MINOR","file":"client/src/lib/homeTiles.ts","line":68,"id":"extraLinks-param-ignored-dead-plumbing"},{"sev":"MINOR","file":"client/src/lib/homeTiles.ts","line":45,"id":"moreExtra-unconsumed-duplicate-source"},{"sev":"MINOR","file":"client/src/role-aware-ui.test.ts","line":62,"id":"contract-test-missing-no-role-literal-assert"},{"sev":"NIT","file":"client/src/lib/homeTiles.ts","line":99,"id":"unreachable-fallback"}]}
```

I did not check visuals or browser behaviour. The one risk to know: if a role set in shared/roles.ts changes, the per-role links in homeTiles.ts will not follow it automatically (finding 1).
