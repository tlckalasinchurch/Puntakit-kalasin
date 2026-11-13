# 03 — Findings register (P0–P3)

**Severity**
`P0` security exposure / severe data loss / critical failure · `P1` major workflow blocked, serious functional defect, significant a11y barrier · `P2` substantial problem with a workable workaround · `P3` minor inconsistency or polish

**Confidence**
`Observed` — proven from code or measured in the browser · `Likely` — follows with high confidence, wants a runtime check · `Hypothesis` — inferred, unverified

Counts always state the denominator. Recurring patterns are listed in §6 because fixing one shared component resolves many instances — that is usually cheaper than fixing the instances.

---

## 1. P0 — Critical

### F-01 · Ten routes gate their **read** client-side only
**Role:** any authenticated user · **Confidence: Observed** · **Needs a product decision before any fix**

`ProtectedRoute` is client-side by construction (`ProtectedRoute.tsx:28`). For these routes the **server does not enforce the same restriction on the read path** — writes are gated, reads are `requireAuth` only. The UI hides the page; the API serves it.

| Route | Server gate on its read |
|---|---|
| `/groups`, `/map` | `GET /api/groups` — **no role middleware at all** (`groups.ts:197`) |
| `/inbox` | `GET /api/submissions` — `requireAuth` (`submissions.ts:24`) |
| `/announcements` | `requireAuth` (`announcements.ts:11`) |
| `/events`, `/worship` | `requireAuth` (`events.ts:11`) |
| `/ministries` | `requireAuth` (`ministries.ts:11`) |
| `/church` | `requireAuth` (`churchProfile.ts:13`) |
| `/feed` | `requireAuth` (`activities.ts:28`) |
| `/follow-up` | row scope yes, role gate no (`followUps.ts:28`) |

**Most concrete instance:** any authenticated `member` can `GET /api/groups` and enumerate every care group. Locations are masked for non-privileged roles (`groups.ts:117-146`), so this is a *listing* exposure rather than a location leak.

**Not a judgement call I can make.** The project's own tests assert the principle ("hiding an entry never protects a route", `nav-structure-contract.test.ts:9-10`), which suggests intent — but whether a church's group roster should be visible to every signed-in member is a **product decision**. Resolve it before writing code. See [`06-REMAINING-WORK.md`](06-REMAINING-WORK.md).

---

## 2. P1 — High

### F-02 · `/app/attendance` is fully built and unreachable
**Role: member · Observed** — a member has no path to their own attendance history.
Route at `App.tsx:107-111`; the only occurrence of the path in `client/src`. Absent from `MemberAppLayout` `NAV_ITEMS` (`:37-43`), `navGroups`, `groupLeaderNavGroups`, `PAGE_VIEW_GROUPS`, `LambQuickActions`, `LambSecondaryCards`. All five sibling `/app/*` pages are in the bottom nav.
**Compounding:** `MemberHome.tsx:319` displays "เข้าโบสถ์แล้ว N ครั้ง" — a counter derived from exactly this data — and it is not clickable.
**Fix:** add to the member bottom nav or as a card on `MemberHome`. **Regression risk: low** — confirm 5 items still fit at 360px first.

### F-03 · The prayer-request flow cannot be opened
**Role: member · Observed**
`const [prayerModalOpen, setPrayerModalOpen] = useState(false)` (`MemberHome.tsx:91`) and `<PrayerRequestModal open={prayerModalOpen}>` (`:518-522`). **`setPrayerModalOpen(true)` does not exist anywhere in the codebase** — only the declaration and `onClose`. `POST /api/me/prayer-requests` (`portal.ts:584`) therefore has no client entry point, and `GET /api/me/prayer-requests/my` is one of the 11 unused endpoints.
**Fix:** add a trigger. **Regression risk: low** — `PrayerRequestModal` has two source-contract tests; do not change its copy or close semantics.

### F-04 · No test can catch a broken page
**Confidence: Observed** — `vitest.config.ts:6` is `environment: "node"`; zero `render(`/`createRoot`/testing-library/jsdom in `client/**`; `@/` is not aliased. All 45 client tests read `.tsx` as text. **A test passes on a page that throws on first render.**
Compounded by 5 server modules with zero tests including `auth.ts` (login/CSRF/logout handlers), and 2 pages no client test names at all (`AdminUsers`, `PinManagement`).
**Fix:** add jsdom + testing-library; assert at least one render per page. **Regression risk: low**, but this is the single highest-leverage test investment in the repo.

### F-05 · Three label maps have drifted from the schema — raw enums reach users
**Confidence: Observed**

| Site | Maps | Actual enum (`shared/schema.ts`) | Effect |
|---|---|---|---|
| `MemberAttendance.tsx:100-113` | `cell_group` | `care_group` | real rows fall to `default: return type` → **member sees the literal string `care_group`** |
| `MemberAttendance.tsx:83,86` | `cell_group` | `care_group` | the "พันธกิจ" filter never matches on `serviceType`, only on `groupName !== null` |
| `MemberAttendance.tsx:143-162` | `qr_self`, `officer_scan` | `self_qr`, `qr_scan` | the check-in-method line **never renders** |
| `MemberGroup.tsx:81-86` | `assistant` | `assistant_leader` | an assistant leader is shown to their own group as "สมาชิก" |
| `MemberDetailModal.tsx:122` | *no map at all* | free-text column | `<StatusChip>{selectedMember.role}</StatusChip>` prints raw |
| `GroupCard.tsx:129` vs `Map.tsx:98-101` | two different fallbacks | | one silently claims "เปิดดำเนินการ", the other shows the raw value |

**Systemic:** `LABEL[x] ?? x` appears at 8 sites, and the same 12-entry `TYPE_LABELS` map is **copy-pasted three times** (`Feed.tsx:86-99`, `Inbox.tsx:62-75`, `ActivityTimeline.tsx:21-34`). Nothing pins any label map to the schema.
**Fix:** move the maps into `shared/labels.ts` (which already owns `ROLE_LABELS`, `MEMBERSHIP_STATUS_LABELS`) and add a test that every enum member has a label. **Regression risk: low.**

### F-06 · Two competing "card" radii
**Confidence: Observed** — `--radius-card` 24px (`.card-surface`, `index.css:382`) vs `--radius-lg` 18px (shadcn `Card` at `components/ui/card.tsx:10`, and ~50 hand-rolled sites across 22 files). Home renders at 18px; Attendance/Reports/Profile render at 24px. The whole `/app` member shell uses raw Tailwind radii (`rounded-2xl`, `rounded-3xl`, `rounded-[28px]`) and never touches `--radius-*`.
Also a **doc contradiction**: `brand-spec.md:173` and `design.md:142` say 18px; `index.css:134` says 24px. No test guards it.
**Fix:** pick one, document it, add a test. **Regression risk: medium** — visual change across many pages.

### F-07 · `--shadow-card` (2-layer) applied outside `clay-*`
**Confidence: Observed** — `design.md:143` bans stacked shadows; `:199` grants the exception only to `clay-*`. Yet:

| Selector | Uses |
|---|---|
| `.card-surface` (`index.css:383`) | **30 / 12 files** — this is the default card elevation |
| `.pk-premium .card-surface/.pk-surface` (`:1917-1928`) | explicit 2-layer stack + dark twin |
| `.pk-nav` (`:1746`) | **fixed bottom chrome**, which `design.md:119` says must be flat — the block's own comment says "FLAT, not glass" |
| `.pin-login__plate` / `__card` (`:2311`, `:2438`) | login surfaces |
| `ProtectedRoute.tsx:109`, `BasemapToggle.tsx:27` | TSX |

The token itself is documented **nowhere**. **Note:** every shadow in the repo is correctly neutral black — the "no hue" rule is fully honoured.

### F-08 · The primary button on `/media` and `/settings` renders unstyled
**Confidence: Observed — MEASURED IN THE BROWSER**

`ComingSoon.tsx:34` uses `className="primary-action min-h-11"`, but **`.primary-action` has no rule of its own in `index.css`** — only `.welcome-row .primary-action`, `.page-heading .primary-action`, and `.coming-soon-card .primary-action { margin: 0 auto }`.

Measured at 390×844, dark:

| Property | "กลับหน้าหลัก" (`/media`, `/settings`) | correct button (`/care`, "เริ่มเช็คชื่อ") |
|---|---|---|
| `background-color` | `rgba(0,0,0,0)` — **transparent** | `rgb(53,180,176)` |
| `border-radius` | **`0px`** | `9999px` |
| `padding` | **`0px`** | `0px 26px` |
| `height` | 44px (from `min-h-11` alone) | 56px |

It renders as bare text with **no horizontal padding**, so the tap target is exactly the glyph width. It clears 44px height only by accident.
**Root cause:** nothing verifies that a CSS class used in TSX actually has a rule. **Fix:** use `ActionButton` or the `PRIMARY_BUTTON_CLASS` literal used everywhere else. **Regression risk: none.**

### F-09 · Retired literals smuggled past a CSS-only test
**Confidence: Observed** — `lib/geo.ts:77-78` holds 8 raw hexes in `BODY_COLORS` plus `NO_BODY_COLOR = "#6b7280"`.
- `#e8560a` is on the **retired** list, but `palette-contrast.test.ts:132-136` scans `index.css` only.
- `#6b7280` is the exact colour `design.md:36` retired for contrast (4.69:1).
- **4 of the 8 body hues fail WCAG 1.4.11 on canvas**: `#ca8a04` 2.85:1, `#16a34a` 3.20:1, `#e8560a` 3.54:1, `#0891b2` 3.58:1.
**Fix:** convert to tokens and extend the retired-literal test to walk `client/src` as the blue test already does.

### F-10 · Attendance defaults to **yesterday** before 07:00 ICT
**Confidence: Observed** — `Attendance.tsx:200` uses `new Date().toISOString().slice(0,10)` (UTC). For a Thailand deployment (UTC+7) any session opened between 00:00–07:00 opens the roster on the previous service. Same class of bug at `:909`, `:999`, `:1176` where `new Date("YYYY-MM-DD")` parses as UTC midnight.
**Fix:** `dateToIso` from `@/lib/date` already exists for this. **Regression risk: low.**

### F-11 · Inbox publish dialog saves `occurredAt` **7 hours in the past**
**Confidence: Observed** — `Inbox.tsx:129` and `:237` seed a `datetime-local` (whose value format is *local*) with a UTC string. `:250` then re-parses that shifted string as local and posts it. `Events.tsx:68-73` has the correct `toLocalInput()` — port it.

### F-12 · Feed grants actions the server will always reject
**Confidence: Observed** — `Feed.tsx:555` computes `canAdvance = isMine || CREATE_ROLES.includes(role)`, but the server gates `PUT /:id/status` with `canManage` (`activities.ts:459`) and publish with `canPublish` (`:464`). `CREATE_ROLES` includes `group_leader`, so a group leader sees publish/archive/restore on **every** card including groups they do not lead → guaranteed 403 toast. It also disagrees with `canEditActivity` (`:215`) on the same card.
**Fix:** one shared predicate. **Regression risk: low.**

### F-13 · The area filter only offers areas on the current page
**Confidence: Observed** — `Members.tsx:546-548`: `areaOptions` is derived from the current **15-row page**, so the dropdown only contains districts that happen to be visible, and it mutates as you page. The server supports the filter independently (`members.ts:128-130`); the client never fetches the list.
**Fix:** a distinct-area endpoint. **Do not** fix by raising the page limit — that trades a wrong filter for a slow page.

### F-14 · Counts report the page length, not the total
**Confidence: Observed** — `Feed.tsx:481` (`limit=30`) and `Inbox.tsx:268` (`limit=50`) label with `items.length` while `meta` is already captured. `FollowUps.tsx:189-192` and `Members.tsx:720-727` do it correctly on the same app. A reviewer sees "30 กิจกรรม" when 500 are queued.
**Fix:** `meta.total`. **Regression risk: none.**

### F-15 · Plain status colour used as body text — fails AA
**Confidence: Observed (source + token math)**

| Site | Measured |
|---|---|
| `Attendance.tsx:1115` | `--color-warning` on `warning/10` over canvas-soft → **2.98:1** light |
| `Members.tsx:966` | `--color-warning` on `--color-warning-soft` → **3.08:1** |
| `ImportDuplicates.tsx:155,220,392` | `--color-warning` on canvas → **3.33:1** |
| `PinManagement.tsx:131` | `--color-success` at 12px → **4.02:1** |
| `index.css:720,721,723` | `.chip-success/.chip-warning/.chip-info` set `color:` to the plain status colour on their own tint (3.66 / ~3.0 / ~3.2:1). `.chip-error` is correct. Dead classes today, wrong the moment they ship |

The `-ink` tokens exist precisely for this. `palette-contrast.test.ts` measures every `-ink` variant but never measures the **plain** colour on its own tint — which is how all of these shipped.

### F-16 · Cluster count renders at 11px — below the 12px floor
**Confidence: Observed** — `components/map/pins.ts:57`: `fontSize: visibleSize >= 40 ? "13px" : "11px"`. The floor test (`design-system-consistency.test.ts:122`) matches only Tailwind utilities, so a JS `fontSize` is invisible to CI.

### F-17 · Failed PIN login drops keyboard focus to `<body>`
**Confidence: Observed** — `PinSignInPage.tsx:63` clears the PIN on failure, which disables the still-focused submit button (`:205`); focus falls to `<body>` and the keyboard user loses their place. Compounding: there is **no `<input>` anywhere on the page**, so paste is impossible by construction — a password manager, an OTP autofill, and a user with the PIN on the clipboard are all locked out.

### F-18 · Primary push action fails silently
**Confidence: Observed** — `MemberProfile.tsx:138` `handleSubscribePush` has `try { … } finally { … }` with **no `catch`**. If the permission API or SW registration rejects, the user gets an unhandled rejection and zero feedback. The neighbouring `handleSendTestPush` (`:168`) does catch.

### F-19 · Import duplicate results have inverted semantics
**Confidence: Observed** — `ImportDuplicates.tsx:353` gives "ข้อมูลเหมือนกันทุกช่อง" (all fields identical — the *good* outcome) an orange **warning** chip, and marks "ต่างกัน N ช่อง" (*differing* — the interesting case) **neutral grey**. It also contradicts the `text-warning` marker at `:392`, which uses the same colour to say the opposite.

### F-20 · Every guarded page appears to render its shell twice
**Confidence: Likely** — `ProtectedRoute` wraps in a layout (`ProtectedRoute.tsx:126-128`) **and** 30 pages render their own layout inside it (24 `AppLayout`, 6 `MemberAppLayout`), duplicating `#app-main` / `#member-app-main` ids. Equally likely the page-level shell is dead code. **Needs one browser check to resolve** — see [`06-REMAINING-WORK.md`](06-REMAINING-WORK.md).

---

## 3. P2 — Medium (selected, grouped)

### Navigation
| Finding | Evidence |
|---|---|
| **Navigation by `onClick` instead of `<Link>`** — no middle-click, no open-in-new-tab, no URL in the status bar, AT announces a button | `Home.tsx:725,799,849` (while the same section uses a real Link at `:706`); `Profile.tsx:36`; `ComingSoon.tsx:35`; `NotFound.tsx:23` |
| `/announcements` has **no sidebar entry** — reachable only via a tab on `/feed` or a Home card | Phase 2 §3 |
| `/import` is a **dead end for `admin`** — no upload control, and the empty state reads "nobody has imported yet" rather than "you cannot" | `ImportData.tsx:77,177-206,221` |
| Admin `/profile` "edit my details" jumps to the member PWA, losing the admin shell | `Profile.tsx:105` |
| **"เช็คชื่อ" points at a different page per viewport** — `/care` on mobile, `/attendance` on desktop | `MobileBottomNav.tsx:39` vs `Sidebar.tsx:89` |

### Forms & data
| Finding | Evidence |
|---|---|
| A new announcement **defaults to draft** with a success toast and no indication the congregation sees nothing | `Announcements.tsx:34,71,100-101` |
| Follow-up create **stays enabled after success** → duplicate rows with nothing linking them | `Feed.tsx:672-681`; `createFollowUp` resets state in `finally` (`:456-467`) |
| The attendance roster's four status buttons are enabled but **guaranteed to fail** until a group is chosen | `Attendance.tsx:423-426`, `:779-792` |
| `Map.tsx` `?limit=100` is **silently ignored** server-side — the map renders every group, unbounded | `Map.tsx:287` vs `groups.ts:197-259` (verified: `limit` is never destructured) |
| `Reports.tsx:84` export is fire-and-forget — a 403/500 gives the user **zero** feedback | `Reports.tsx:84,200` |
| Radix `Sheet`/`Dialog` used **without `discardGuard`** — typed work is discarded silently | `AdminUsers.tsx:278,391`; `map/LocationPicker.tsx:153`; compare `DesignSystem.Modal` which defaults it on |
| Member attendance "consistency" grades a person's spiritual life from a hard-coded `>= 8` with no basis | `MemberAttendance.tsx:164-169` — conflicts with `PRODUCT.md:24` ("real data only") |
| `ImportOrgData.tsx:72` `JSON.parse` of an arbitrary file with no size cap and no shape check | |
| `ImportData.tsx:180` the visually-hidden `<input type=file>` stays tabbable — keyboard focus lands on a 1px-clipped control | contradicted by the 2026-10-17 audit's note; **verify before fixing** |
| Hardcoded church name and phone in the member app while `/church` makes both editable | `LambSecondaryCards.tsx:36`; `MemberProfile.tsx:290`; `MemberGroup.tsx:155`; `PinSignInPage.tsx:97` |

### Content & overflow
| Finding | Evidence |
|---|---|
| `Home.tsx:598` — an unbreakable Thai name in a `shrink-0` span with no `truncate`/`break-words` overflows the card horizontally | **contradicts my own browser measurement of "zero horizontal overflow"** — see F-25, needs a long-name reproduction |
| Unclamped user content in grid layouts | `Announcements.tsx:180` (3-col grid); `ImportMergeApprovals.tsx:152`; `Inbox.tsx:352`; `Map.tsx:665,657` |
| `Terms.tsx` / `Privacy.tsx` — long-form legal prose at ~704px ≈ **100ch**, past the 60–75ch measure; both ride the auth-only `.login-card` classes with inline styles | `Terms.tsx:57-58`, `Privacy.tsx:56` |
| Terms §4 splits one sentence into three `<p>` blocks purely so the middle can be linked; the link is applied by **positional string matching** (`i === 1`) | `Terms.tsx:27,74` |

### Design-system detail
| Finding | Evidence |
|---|---|
| **`PageHeader` bypassed on the two most important admin pages** — hand-rolled eyebrow + `<h1>`, so both lose `data-pk="page-title"` | `Map.tsx:475-483`, `Home.tsx:502-520` |
| `Profile` rebuilds `SectionHeader` via legacy `.section-heading` whose `h2` is **17px** vs the shared **28px** | `Profile.tsx:84,111` vs `DesignSystem.tsx:164` |
| `.type-*` bypassed at **24 sites**, concentrated in the member PWA | `LambHero.tsx:48,51`; `MemberProfile.tsx:203`; `MemberReports.tsx:91`; `MemberHome.tsx` ×10 |
| The entire `/app` member shell bypasses `--radius-*` | see F-06 |
| `.dark` class overrides instead of a token remap | `index.css:1950` (`.dark .pk-hero` raw hexes); `index.css:1426-1433` |
| Four decorative hues on one page — `design.md:90` caps at 3 | `Profile.tsx:86,95,113,121,130,144,152` |
| **66 of 197 class selectors in `index.css` are dead** — no guard detects new dead CSS | where `.chip-success` at 3.66:1 and 10 sub-12px font sizes survive |

---

## 4. P3 — Low (selected)

| Finding | Evidence |
|---|---|
| Literal `"..."` instead of `…` (U+2026) — **banned as a loading indicator** by `design.md:150` | `AdminUsers.tsx:223,329,453,463`; `PinManagement.tsx:223`; `Attendance.tsx:699`; `Feed.tsx:795,907`; `Groups.tsx`; `Members.tsx:1069` |
| Search placeholders missing the repo's trailing `…` | `AdminUsers.tsx:118,404`; `OrgChart.tsx:278` |
| `404` renders as a `<p>` at 40px **above** an `<h1>` at 28px | `NotFound.tsx:13` |
| `NotFound` and `/privacy`,`/terms` have **no `<main>` landmark and no skip link** | confirmed in browser |
| `ComingSoon.tsx:17` — an unmapped route silently renders the **Settings** placeholder, so `/typo` shows a wrong title | |
| Dead code: `Events.tsx:84` `formatDateTime` defined and never called; unused imports in `Groups.tsx:6`, `Members.tsx:2,8`, `Attendance` | `pnpm check` does not catch it — `noUnusedLocals` is off |
| `key={index}` on arrays that are spliced by index | `FollowUps.tsx:103`; `Inbox.tsx:524`; `Feed.tsx:897` — React reuses DOM nodes, so the next keystroke overwrites a neighbour |
| `ImportDuplicates.tsx:563` — `ListPager` gets the **unclamped** page, so it can read "หน้า 4 จาก 3" while rendering page 3 | |
| `No confirm on cancelling an RSVP` in the member event list, despite destructive styling | `MemberEvents.tsx:295-310` |
| `ImportMergeApprovals.tsx:273` — the only generic `ErrorState` in the app (no Thai title) | |
| No search, filter or count on the Ministries list, unlike every sibling directory page | `Ministries.tsx:151-183` |
| `careCode` (รหัสแคร์) is fetched on every care group and **never displayed** | `OrgChart.tsx:31` |

---

## 5. Verified positives — do not "fix" these

Recording these so a future pass does not churn working code:

- **Zero horizontal overflow** across 37 routes × 3 viewports × 2 themes. `design.md:185` holds.
- **Exactly one `<h1>`** and a `<main>` on every route. Skip links on both shells.
- **Zero uncaught exceptions, zero console errors, zero failed requests, zero HTTP ≥ 400** across 222 page loads.
- Loading / empty / error states are correctly separated everywhere; `ErrorState` copy is human-readable Thai with raw errors behind a technical disclosure, with one exception.
- Every mutation traced ends in a toast. Double-submit guards exist on the higher-value mutations. Optimistic updates roll back correctly.
- **Shadows are 100% neutral black.** The "no hue" rule is fully honoured.
- **No meaningless gradient on any live surface.**
- `StatusChip` always carries a text label; its tone is type-enforced to five values; all 30 call sites conform.
- No second font family. Heading letter-spacing is correct.
- Zero raw Tailwind palette classes, zero `!important` dark overrides, zero `.modal-card`, zero `PageHeader` with >1 primary action.
- The Map page's location masking (`maskGroupLocation`) and the member portal's per-user scoping (`getLinkedMember`) are correctly implemented.

---

## 6. 🔧 Recurring patterns — fix once, not per instance

These are the highest-leverage items. Each resolves many findings at lower risk than patching instances.

| # | Pattern | Sites | One-line fix |
|---|---|---|---|
| **S-1** | `Field`'s error is a bare `<p>` with **no `role="alert"`** | `DesignSystem.tsx:476` → Groups `:835`, Members `:977`, Feed `:395` | give the error node `role="alert"` in the shared component |
| **S-2** | `ListSkeleton` is `aria-hidden="true"` and most call sites never wrap it in `role="status"` | 9 sites: `FollowUps:237`, `MemberAttendance:271`, `MemberGroup:133`, `Announcements:143`, `ImportMergeApprovals:271`, `Memberships:109`, `MemberReports:65`, `Ministries:135`, `Church:105` | put `role="status"` **inside** `LoadingStates.tsx` |
| **S-3** | Three hand-rolled Thai date formatters, none anchored to `Asia/Bangkok` | `Groups:566`, `Members:116`, `Attendance:909,999`, `Feed:140`, `Home:250,258`, `CareToday:186` | one `todayLocal()` + `formatThaiDateTime()` in `lib/date.ts` |
| **S-4** | Control class constants copy-pasted and drifting | `INPUT_CLASS`/`CONTROL_CLASS`/`PRIMARY_BUTTON_CLASS`/`CANCEL_BUTTON_CLASS` in 7 files | export from `DesignSystem.tsx` |
| **S-5** | Navigation by `onClick` instead of `<Link>` | 6 sites, §3 | pass `href` to the existing `ActionButton` |
| **S-6** | Flex text children missing `min-w-0`/`truncate`/`break-words` | ~12 sites | audit every `flex` row containing user text |
| **S-7** | `LABEL[x] ?? x` fallback pattern | 8 sites | one shared label map + a test pinning every enum |
| **S-8** | Three different initials-avatar treatments | `Home:664` (duplicates `InitialsAvatar`), `Attendance:756`, `Attendance:980` | use `InitialsAvatar` + `initialOf` everywhere |
| **S-9** | Green used for an OK / no-action-needed state | `Attendance:1012`, `Home:679` | neutral tone; reserve colour for rows needing attention |
| **S-10** | `formatDateTime` copy-pasted three times | `Inbox:92`, `Events:84`, `ImportDuplicates:93` | one `lib/datetime.ts` export |
| **S-11** | Unbounded list rendering, no virtualisation, no `loading="lazy"` | `Events:217`, `Announcements:58`, `Ministries:52`, `Memberships:60`, `MemberEvents:225`, `Groups:781`, `Attendance:518`, `Feed:877`, `AdminUsers:137`, `PinManagement:114` | one shared paged-list hook |
| **S-12** | `transition-all` and non-compositor animation | `ui/button.tsx:8,16` and every consumer | list properties; animate `transform`/`opacity` only |
| **S-13** | `role="tablist"` without roving tabindex / arrow keys | `Memberships:113` (also no tabpanel), `Attendance:576`, `MemberEvents:163` | use the shared Tabs primitive |
| **S-14** | `focus:` instead of `focus-visible:` | `MemberProfile:53`, `PinManagement:24` | `focus-visible:` |
| **S-15** | Raw counts without `toLocaleString("th-TH")`, or with the wrong number | `Attendance:719`, `ImportOrgData:194`, `OrgChart:232,306` | one hoisted `Intl.NumberFormat` wrapper |

---

## 7. F-25 · A finding I could not confirm, and why

`Home.tsx:598` places an unbreakable Thai member/group name plus a badge in a `shrink-0` span with **no `truncate`, `break-words` or max-width**, while the sibling span has `truncate`. Source reading says this overflows the card on a 360px viewport.

**My browser measurement found zero horizontal overflow on every route at every viewport.** Either the existing data never produces a long enough name, or the overflow is contained by an ancestor.

**Do not "fix" this on the strength of the source reading alone.** It needs a reproduction with a deliberately long Thai name — which the brief forbids me from fabricating. Logged as Likely with the conflict stated.
