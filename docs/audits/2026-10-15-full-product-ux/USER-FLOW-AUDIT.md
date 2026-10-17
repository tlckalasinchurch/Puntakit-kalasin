# USER-FLOW-AUDIT.md

**Status: AUDITED (read-only). No browser was used. No flow is claimed as verified unless marked `[RUN]`.**

> **Status update 2026-10-16 (documentation only).** This audit was written against a working tree that carried uncommitted changes. Since then the teal palette and dark theme are committed (`f87c770`) and the `/care` route gate is committed (`821d763`). The member-submission fix described under F-06 is **not** in the working tree: it is held in `stash@{0}` ("HOLD not-approved: member submission group"). Source line references below were re-checked against the repository on 2026-10-16 (HEAD `1e8f58f`). The UX findings are unchanged unless an item says "Status update".

---

## 0. Evidence rules for this document

| Tag | Meaning |
|---|---|
| `[RUN]` | I executed a command and observed the result |
| `[CODE]` | Traced in source; the described path is what the code says |
| `[DOC]` | Asserted by an existing document, not re-verified by me |
| `[INFER]` | Reasoned; needs confirmation |
| `[NV]` | Not verified |

**Deliberate exclusion.** `docs/audits/2026-10-15-badminton-ux/02-APP-FLOW.md` used a strict rule — *a flow is verified only if a screenshot shows both ends* — and consequently verified **zero** of the six candidate reference flows. I have adopted the same rule for **reference** flows.

But I apply a **different, weaker** rule to **Puntakit** flows, and I state it plainly: a Puntakit flow traced from router → page → fetch → server route → schema is **[CODE]**, meaning *the wiring is complete*, **not** that it was exercised. Nothing below is `[RUN]` unless it is a gate command.

---

## 1. Flow map — 14 journeys `[CODE]`

```
AUTH
  F-01  Sign in (PIN) ───────────────────────────────▶ /app or /
  F-02  Session lost mid-task ───────────────────────▶ error, NOT /login

MEMBER (member /app)
  F-03  Home load
  F-04  Browse events ──▶ RSVP จะมา ──▶ cancel
  F-05  RSVP สนใจ (interest)
  F-06  Submit mission report
  F-07  View own report list
  F-08  View own attendance history
  F-09  Edit own profile
  F-10  Submit prayer request

ADMIN
  F-11  Members: search ─▶ create ─▶ edit ─▶ export CSV
  F-12  Attendance: live check-in ─▶ bulk save ─▶ absentees ─▶ flag
  F-13  Mission lifecycle: submit ─▶ inbox review ─▶ publish ─▶ feed
  F-14  Import: upload ─▶ precheck ─▶ duplicate decisions ─▶ 4-eyes merge
```

---

## 2. Auth flows

### F-01 · PIN sign-in `[CODE]`

```
/login → PinSignInPage (10-key keypad, 6 dots)
  POST /api/auth/login { pin }  → firstPartyAuth.authenticateWithPin
    scrypt verify against all active PIN rows (limit 1000)
    must match EXACTLY ONE account
    >12 attempts/60s per IP → RATE_LIMIT_EXCEEDED
    5 failures/account → pinLockedUntil = now + 15 min
  ← sets puntakit_session (httpOnly) + puntakit_csrf
  → window.location.assign("/")   ← FULL PAGE RELOAD, not SPA nav
```

**Observations**
- Login UX is **solid**: `busy` double-submit guard, `pin.length !== 6` gate, `role="alert"` error paragraph, `aria-live` counter, digit/Backspace/Escape/Enter keyboard support, legal links.
- **`window.location.assign("/")` forces a full reload** where every other navigation is client-side. After sign-in the member loses the SPA shell, re-runs `initPwa()`, and re-fetches `/api/auth/csrf` + `/api/auth/me`. It works, but it is inconsistent and slower than `navigate()`.
- **Open product question** (already logged, unapproved): `.ai/workflow/features/pin-login/BLUEPRINT.md` proposes identifier + PIN to replace the O(n) scrypt scan. **NOT APPROVED.** Do not touch.

**Status:** **A** — working `[CODE]`. Runtime **NOT VERIFIED** `[NV]`.

### F-02 · Session expiry mid-task `[CODE]`

`api.ts` dispatches `puntakit:unauthorized` on any 401 (rate-limited to 1/5 s, and never for `/api/auth/me`). `AuthContext` re-runs `retry()`. `ProtectedRoute` redirects to `/login` **only** when `!isLoading && !user && !error`.

The `!error` guard is deliberate and well-commented (`ProtectedRoute.tsx:33-39`, condition at `:40`): a 403/5xx from `/api/auth/me` previously bounced to `/login`, which bounced straight back — an infinite loop. Now it renders `data-testid="auth-error"` with retry + logout.

**Status:** **A** — the known auth-loop bug is fixed and guarded by `auth-session-contract.test.ts`. **NV** at runtime.

---

## 3. Member flows

### F-03 · Home load `[CODE]`
`GET /api/me/portal` → hero, quick actions (with `notificationCount`), member QR pass, 3 announcements, 5 upcoming events with dual CTA, prayer modal. Background refresh every `PORTAL_REFRESH_INTERVAL_MS`, gated on `document.visibilityState === "visible"` (`MemberHome.tsx:141-147`) — correct behaviour.

**Risk `[INFER]`:** the background refresh can re-render the RSVP buttons mid-interaction. Not verified.

### F-04 · Event RSVP — the primary member workflow `[CODE]`
```
/app/events
  Promise.all([GET /api/events, GET /api/announcements, GET /api/me/events/my])
  announcements filtered to published (MemberEvents.tsx:92-95)   ← correct
  → primary CTA "จะมา"  → POST   /api/me/events/:id/register  (201/200/409)
  → cancel              → DELETE /api/me/events/:id/register
```
- Dual-submit guard present; `min-h-11` on all three buttons; shared `<Modal>`.
- **`member-events-rsvp.test.ts` pins the exact API path list** and asserts it contains **nothing matching `/interest/i`**. The "สนใจ" CTA is deliberately **client-only** — it opens a modal and persists nothing.
- **Backend caveat (observation A5):** `POST /api/me/events/:id/register` parses `eventRegistrationSchema` but **silently ignores** a parse failure (`portal.ts:420,457,477`) instead of returning 400.

**Status:** **A**. The silent-parse issue is a **C**.

### F-05 · "สนใจ" interest `[CODE]`
Client-only by design and contractually pinned. **This is a deliberate, documented product decision** — do not "fix" it by adding an endpoint.

### F-06 · Submit mission report `[CODE]` — **fix held in stash, not in HEAD**
```
/app/reports
  POST /api/submissions { rawText (max 5000), submittedByLabel (max 200) }
  server: requireRole(...CREATE_ROLES)   ← HEAD, server/routes/submissions.ts:149;
                                                     member excluded; SUBMISSION_CREATE_ROLES exists only in stash@{0}
  GET /api/submissions?limit=20 → renders status chips
```
A second defect is fixed by the same held stash: a **double-unwrap bug**. At HEAD, `client/src/pages/member/MemberReports.tsx:45` still types `api.get<{ data: Submission[] }>` and reads `res.data`, but `api.get` already returns the unwrapped `data` (`client/src/lib/api.ts:167`), so the list renders empty `[CODE]`. The stash changes it to `api.get<Submission[]>` and adds `role-aware-ui.test.ts` assertions.

**Status:** **C** — at HEAD a `member` cannot create a report (the create route is `CREATE_ROLES`) and the list reads as empty `[CODE]`. The fix is held in the stash, is **not approved** and is **not browser-verified**. Status update 2026-10-16: replaces the earlier "uncommitted" wording.

### F-07 · View own report list — 🔴 **BROKEN** `[CODE]`

```tsx
// client/src/pages/member/MemberReports.tsx:112
<Link href={`/app/reports/${sub.id}`}>
```

Verified facts `[CODE]`:
- `App.tsx:102` declares `/app/reports` — **there is no `/app/reports/:id` route**, and no dynamic-segment route anywhere.
- wouter matches exactly (`^<pattern>/?$`), so `/app/reports/<uuid>` does **not** match.
- The final `<Route component={NotFound}/>` (no `path` ⇒ `*` ⇒ `^/(.*)/?$`) matches instead.

**Therefore every row of a member's report list navigates to the 404 page.** This is a genuine broken link. Status update 2026-10-16: it is **not** introduced by uncommitted work — it has been in HEAD since `c321177`. At HEAD the rows may never render because of the F-06 double-unwrap, so the 404 is latent `[CODE]`. The held stash fixes the unwrap but does not change the `href`, so landing it without also fixing the link would expose a 404 on every row.

It survived because **no client test renders React** — the contract tests only scan strings.

### F-08 · Own attendance history `[CODE]`
`GET /api/me/attendance` → hard `.limit(50)`, `desc(date)` `[CODE]`. The UI shows `attendedCount` + filtered records, but there is **no pagination or "load more"**. A long-attending member silently sees only the most recent 50.

**Status:** **C** — silent truncation.

### F-09 · Edit own profile `[CODE]`
`GET /api/me/profile` → `PUT /api/me/profile`. Update schema **excludes `role` and `membershipStatus`** — a member cannot see or change their pastoral-care status. Logout uses a two-step `confirmLogout` state.

Per the wireframe, loading should be **skeletons at avatar/name/list positions, not a centred spinner**, and failure must **never clear what the user typed**. The existing `ErrorState` + `FormError` pattern satisfies the second; the first **NOT VERIFIED**.

### F-10 · Prayer request `[CODE]`
`POST /api/me/prayer-requests`. `prayer-request-copy-contract.test.ts` pins the copy to what actually happens — it forbids promising a team received the request. Good discipline.

---

## 4. Admin flows

### F-11 · Members `[CODE]`
URL is the state store (`q/area/status/membershipStatus/page/member`); transient `?care=`/`?new=1` are consumed then stripped; 300 ms debounce + `loadSeq` request-sequence guard; dual presentation (`<md` cards / `≥md` table with `<caption class="sr-only">` + `scope="col"`); 12-field form in 5 `<fieldset>`s; `careGroupId` only sent when changed so an unrelated edit cannot end a membership.

**Gaps:** hand-rolled pager (`880-907`) instead of the shared `ListPager`; duplicated `MEMBERSHIP_STATUS_TONES` (`Members.tsx:54` vs `MemberDetailModal.tsx:32`).

### F-12 · Attendance `[CODE]`
4 tabs, each lazily loading only its own data. Per-member request-sequence map prevents double-submits. `?groupId=` deep link auto-switches service type; `group_leader` must pick a group before saving (`assertGroupWriteAccess`).

🔴 **Live gate mismatch — fixed and committed in `821d763`:** `/care` was `ADMIN_SHELL_ROLES`, so a **`viewer`** could open the page while the API requires `CREATE_ROLES` — page opens, data load fails. `App.tsx:163` now uses `CREATE_ROLES` (verified at HEAD) and `role-gate-contract.test.ts` (`ROUTE_GATES`) pins it.

### F-13 · Mission lifecycle `[CODE]`
`submit → review → publish → feed` is fully wired, with a real state machine (`STATUS_TRANSITIONS`) and per-row `canRead`/`canManage`/`canPublish`. Edit reloads participants + media before saving because `PUT /:id` would otherwise clear them (ref D53) — a subtle bug that was caught and fixed.

### F-14 · Import `[CODE]` / **NOT VERIFIED** `[DOC]`
Four-eyes merge is enforced server-side (403 on self-approval). `ImportDuplicates` warns on stale decisions. `ImportOrgData` deliberately never echoes uploaded JSON back.

> `docs/UI_ROUTE_TRACKER.md` states the **import upload happy path was never exercised** and requires a real `.xlsx` that **writes data**. Class **C**.

---

## 5. Cross-cutting flow findings

### X-01 · No client test renders a component 🔴 `[CODE]`
- 19 client test files (18 when first audited), all `.test.ts`, **zero `.test.tsx`**
- No jsdom, no React Testing Library
- `tsconfig.json` excludes `**/*.test.ts`, so `pnpm check` never parses them

**Consequence:** the contract suite proves *strings exist*, not *components render*. F-07 (a 404 dead link on the member's primary list) passed **every** contract test. This is a systemic verification gap, not a one-off.

### X-02 · Silent-truncation pattern `[CODE]`
`GET /api/me/attendance` hard `.limit(50)`; `GET /api/groups` has **no pagination**; `GET /api/admin/users` hard `.limit(500)`; CSV exports cap at 5000. Two of these are silent to the user.

### X-03 · Option-fetch failure can masquerade as "none" `[CODE]`
`Feed.tsx` carries an explicit `groupsError` so a failed dropdown cannot look like "no groups" `[CODE]`. Good. `CareToday` persists the selected group to `localStorage` — a stale ID there could produce a confusing empty roster `[INFER]`.

### X-04 · CSV export gives no user feedback `[DOC]`
`window.open("/api/members/export/csv","_blank")` — a new tab opens with no toast. Recorded as known-and-left-alone in `UI_ROUTE_TRACKER.md`.

### X-05 · Design-token change is visually unverified 🔴 `[RUN]`
`index.css` swapped 9 `:root` colour tokens (since committed in `f87c770` together with the dark theme). Per the prior audit, **no page has been looked at since**. Contrast was **not** re-verified against real surfaces. See `MINIMAL-DESIGN-SYSTEM.md` §4 for measured numbers — one pairing is **below AA**.

---

## 6. Flow status table

| Flow | Class | Evidence | Blocking issue |
|---|---|---|---|
| F-01 Sign in | A | `[CODE]` | full reload instead of SPA nav |
| F-02 Session lost | A | `[CODE]` | — |
| F-03 Home load | A | `[CODE]` | refresh may re-render RSVP mid-interaction `[INFER]` |
| F-04 RSVP จะมา | A | `[CODE]` | silent Zod failure on register (A5) |
| F-05 RSVP สนใจ | A | `[CODE]` | by design — do not change |
| F-06 Report submit | **C** | `[CODE]` | fix held in `stash@{0}` (not approved); not browser-verified |
| **F-07 Report list** | **🔴 BROKEN** | `[CODE]` | `/app/reports/:id` → 404 (latent at HEAD, see F-06) |
| F-08 Attendance history | C | `[CODE]` | silent 50-row truncation |
| F-09 Profile edit | A | `[CODE]` | skeleton-vs-spinner `[NV]` |
| F-10 Prayer request | A | `[CODE]` | — |
| F-11 Members | A | `[CODE]` | hand-rolled pager; duplicated tone map |
| F-12 Attendance | A | `[CODE]` | `/care` gate fixed in `821d763` |
| F-13 Mission lifecycle | A | `[CODE]` | — |
| F-14 Import | C | `[DOC]` | upload happy path never exercised |

---

## 7. Honest status

| Item | Status |
|---|---|
| Flow wiring traced from router to schema | **AUDITED** — `[CODE]` throughout |
| F-07 dead link | **CONFIRMED** by reading `App.tsx` route table + `MemberReports.tsx:112` |
| Gate commands (`pnpm check`, vitest) | **TESTED** — see `FEATURE-INVENTORY.md` §2 |
| Runtime/browser behaviour of any flow | **NOT VERIFIED** — no browser used |
| Production flows | **NOT VERIFIED** — no production access, by policy |
| Reference-app flows | **NOT VERIFIED** — only 2 static screenshots exist |
| Any fix applied | **NONE** — read-only |