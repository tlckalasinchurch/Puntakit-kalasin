# Puntakit UX / UI Audit — 2026-10-02

Baseline: `b6b7310` (clean tree). Verification gate at audit time:
`pnpm check` → pass, `pnpm test` → **219 tests / 20 files pass**.

Scope: every shipped screen in `client/src` — 19 admin routes, 5 member-PWA
routes, 2 public legal pages, plus the shell, the design system in
`client/src/index.css`, and the shared loading/error primitives.

Method: read every screen file, counted raw-palette usage per file, and checked
each screen against `design.md`, `brand-spec.md` and the Web Interface
Guidelines. Findings are ranked by user impact, not by how easy they are to fix.

---

## 1. The one-sentence summary

The app has **two competing design systems living side by side.** `Home.tsx`
is a genuinely good, token-based, mobile-first screen; everything built
*earlier* still ships the retired blue/navy palette as raw Tailwind
(`slate-*`, `blue-*`, `gray-*`) and hardcoded hex, with 10–11px text and
8-column tables that a 390px phone cannot use. The UX debt is not "the design
is ugly" — it is **inconsistency plus a broken mobile path through the two
screens people use most** (Members, Groups).

### Raw retiring-palette usage vs tokens, by file

| File | `var(--color-*)` | raw `slate` | raw `blue/indigo/sky` | raw `gray/zinc` | raw `rose/red` | other raw |
|---|---:|---:|---:|---:|---:|---:|
| `pages/Members.tsx` | 2 | 62 | 24 | 0 | 4 | 12 |
| `pages/member/MemberProfile.tsx` | 21 | 0 | 14 | 136 | 8 | 0 |
| `pages/member/MemberGroup.tsx` | 11 | 0 | 19 | 57 | 0 | 11 |
| `pages/Feed.tsx` | 0 | 59 | 8 | 0 | 2 | 7 |
| `pages/Inbox.tsx` | 0 | 41 | 7 | 0 | 6 | 10 |
| `pages/member/MemberAttendance.tsx` | 6 | 0 | 11 | 43 | 0 | 10 |
| `pages/Church.tsx` | 0 | 30 | 16 | 0 | 2 | 0 |
| `pages/FollowUps.tsx` | 0 | 25 | 6 | 0 | 5 | 7 |
| `pages/Events.tsx` | 1 | 16 | 13 | 0 | 8 | 3 |
| `pages/Announcements.tsx` | 0 | 17 | 6 | 0 | 6 | 2 |
| `pages/Home.tsx` | **hundreds** | 0 | 0 | 0 | 0 | 0 |

`design.md` §1 says *"ทุกหน้าและทุก component ต้องใช้ token ชุดเดียวกันนี้"* and
§2 says *"ห้าม hardcode hex ใน component ใหม่"* — the table above is the gap.

---

## 2. Shell and navigation

### 2.1 Sidebar (`components/layout/Sidebar.tsx`)

| Line | Finding |
|---|---|
| 151–179 | Nav items are `<button onClick={navigate}>` instead of `<a>`/`<Link>`. No ⌘/Ctrl-click, no middle-click, no "open in new tab", and screen readers announce 15 buttons rather than a navigation landmark. |
| 123 | `w-72` = **288px**, but `brand-spec.md` pins the sidebar at **240px**, and `index.css:169` defines a `.sidebar { width: 240px }` class that nothing uses — dead CSS. |
| 144 | Group headers `text-xs uppercase tracking-wider` — 12px uppercase Thai, the hardest possible combination to read. |
| 157 | Row height ≈ 40px (`py-2.5` + 14px text) — under the 44px minimum in `brand-spec.md` §Composition. |
| 63, 64 | Decorative badges `"ใหม่"` on ฟีดกิจกรรม and `"PWA"` on แอพสมาชิก — neither is news nor a status. Pure noise. |
| 188–200 | Footer motto card with a `Sparkles` icon and a bordered panel — decoration, and `Sparkles` is also used as the ฟีด icon. |
| 149 | Active state only when `location === path` — `/worship` also renders `Events`, so the nav shows nothing active there. |
| 58–91 | **15 destinations in 3 groups.** Labels are long and double-barrelled: `เช็คชื่อ/เข้าร่วม`, `กล่องข้อมูลนำเข้า`, `แผนที่กลุ่มแคร์`, `แอพสมาชิก (PWA)`. `/media` and `/settings` are `ComingSoon` stubs — dead ends sitting in the primary nav. |
| 71 | Route `/events` is labelled `การนมัสการ` ("worship") while the page itself is titled events/worship — label and destination disagree. |
| 116 | Backdrop `bg-slate-950/60` — raw palette in the shell. |

### 2.2 Topbar (`components/layout/Topbar.tsx`)

| Line | Finding |
|---|---|
| 41–50 | A **notification bell whose badge is hardcoded `0`**, and clicking it toasts `"ไม่มีการแจ้งเตือนใหม่"`. It is a button that exists to say it does nothing. Real notifications are not implemented — this is UI noise per §8. |
| 19, 23, 35, 42 | Raw `slate-*`, `rose-500`, `bg-white` in the shell; `h-18` = 72px vs the documented 76px topbar. |
| 60 | In demo mode the avatar is a bare `<div>` with initials — not keyboard focusable, not a menu. |

### 2.3 `AppLayout` / `index.css` dark mode

- `AppLayout.tsx:13,24` raw `slate-50/60`, `slate-900`, `max-w-7xl` — fine on
  mobile, but the token surface (`--color-canvas-soft`) is what the brand
  specifies.
- **Dark mode is implemented by `!important` overrides on Tailwind utility
  classes** (`index.css:1679–1699`, e.g. `.dark .text-slate-800 { color: … !important }`).
  That is a symptom of the palette split, not a theme. Any new screen that uses
  a palette class outside the override list is unreadable in dark mode. The
  theme toggle is in the topbar, so this is user-reachable.

---

## 3. The two highest-impact screens

### 3.1 Members (`pages/Members.tsx`) — the primary screen

| Line | Finding |
|---|---|
| 298–330 | Title `จัดการสมาชิก` uses `--color-primary` (olive) **inside a blue hero** (`.member-page-hero`, `border-blue-100`, `bg-white/80 text-blue-700` eyebrow). Two systems in one card. |
| 317 | Button label **`Export CSV`** — an English acronym in a Thai-first app. |
| 333–401 | **Four** summary cards, one of which is `หน้าปัจจุบัน` ("current page") — a pagination fact promoted to a KPI. Not information a church leader needs. |
| 407 | `min-w-[240px]` search box — combined with the toolbar's 4 controls, this forces horizontal overflow inside the card at 390px. |
| 411–417 | Search input has **no `<label>`, no `type="search"`, no `aria-label`** — placeholder only. |
| 419–425 | Clear-search icon button **has no `aria-label`**. |
| 431–467 | Three `<select>`s with visible `text-xs` labels as sibling `<span>`, not associated `<label for>` — the control is unlabelled to assistive tech. |
| 489–594 | **8-column `<table>` inside `overflow-x-auto`.** At 390px this is a horizontally-scrolling spreadsheet: the user must scroll right to reach `จัดการ`, and the row identity (name) scrolls off-screen. Violates §5 ("avoid dense tables on mobile"). |
| 492, 520, 528, 544, 548 | `text-[11px]` headers and `text-[10px]` birthdate/group — below the readable floor, and `#8e8e93`-class grey. |
| 596–602 | Empty state `ไม่พบสมาชิก` says only "not found" — it does not offer the primary action, and does not distinguish "you have no members" from "your filter matched nothing". |
| 471–483 | Error state renders `{error}` verbatim — this is the raw server/Zod message string (see §6). |
| 245–284 | Success toasts are good (`"เพิ่มสมาชิกใหม่เรียบร้อยแล้ว"`), and delete is confirmed — keep these. |
| 558–588 | Row actions are 3 icon-only buttons at `p-1.5` ≈ **28px** hit area (under 44px). `aria-label`s are present — good. |
| 637–645 | Modal close button has no `aria-label`; the modal is a CSS `.modal-card` with no focus trap, no Escape key, and no `role="dialog"`. |

### 3.2 Groups (`pages/Groups.tsx`)

| Line | Finding |
|---|---|
| 419–431 | Page header is good in structure (`.page-heading` + one `primary-action`) — the pattern worth keeping. But label is `สร้างกลุ่มใหม่` where the rest of the app says `เพิ่ม…` (§4/§23 consistency). |
| 553 | Grid uses `repeat(auto-fill, minmax(320px, 1fr))` — at 360px viewport a 320px minimum card leaves almost no gutter and any inner padding overflows; horizontal scroll risk. |
| 563–573, 593–631 | Card is styled with a large inline `style` object including hardcoded `#fff`, `#e5edf5`, `#64748b`, `#4f657d`, `#397bc4`, `#e35b78`, `#259a60`. |
| 642–694 | **Three to four competing buttons per card** — `สมาชิก (n)`, `เช็คชื่อ`, edit icon, delete icon — all in one row. No single primary action; `เช็คชื่อ` is re-coloured inline (`background: "#228b5a"`). |
| 662–694 | Edit/delete are icon-only buttons with `title` but **no `aria-label`**. |
| 537–551 | Error state prints `{error}` verbatim; empty state `ไม่พบกลุ่มที่ตรงกับเงื่อนไข` does not offer "สร้างกลุ่มใหม่" for an admin looking at a truly empty list. |
| 745 | Label `ระดับความเป็นส่วนตัว (PDPA)` — regulatory jargon in a field label. |
| 762–764 | Option text carries English in parentheses: `เปิดดำเนินการ (Active)`, `พักชั่วคราว (Paused)`, `ปิดกลุ่ม (Closed)`. |
| 322/326 in CSS | `.state-panel` uses a RotateCw icon for loading — a **spinner for page content**, which `design.md` §8 forbids (skeleton for content, spinner only for button actions). |

---

## 4. State handling (§12/13/14/15)

**Where loading is correct:** `Home.tsx` (`QueryView` + skeletons),
`Members.tsx`, `Groups.tsx`, `Announcements.tsx`, `Events.tsx`, `Feed.tsx`,
`FollowUps.tsx`, `Inbox.tsx`, `MemberProfile.tsx`, `MemberAttendance.tsx`,
`MemberGroup.tsx`, `MemberEvents.tsx`, `Church.tsx`, `Ministries.tsx` all use
`components/LoadingStates.tsx`.

**Where it is wrong:**

- `pages/Reports.tsx:113–117` — page content loading rendered as a
  `RotateCw` spinner plus the text `กำลังโหลดรายงาน...`. Should be a skeleton.
- `LoadingStates.tsx` itself uses raw `border-slate-100 bg-white` in every
  variant (lines 18, 39, 64, 82, 97) — the skeletons do not match the token
  surfaces they replace, and they flip colour inconsistently in dark mode.
- `Home.tsx` redefines `TileSkeleton`/`RowsSkeleton` locally (lines 352–389)
  instead of using the shared module — the duplication §22 forbids.

**Empty states that are dead ends** (say what is missing but not what to do):

| Screen | Line | Current | Missing |
|---|---|---|---|
| Members | 596 | `ไม่พบสมาชิก` | "เพิ่มสมาชิก" action for admins |
| FollowUps | 130 | `ไม่มีรายการติดตาม` | how a follow-up gets created |
| Announcements | 129 | `ยังไม่มีประกาศ` | an action button, not just text |
| Groups | 547 | `ไม่พบกลุ่มที่ตรงกับเงื่อนไข` | create action when list is truly empty |

**Error states that leak internals:** every one of the screens above renders
`{error}` directly, and `error` comes from `lib/api.ts:47–62`, which is the
**server's own message string** (a Zod issue or a route message). The audit's
own §14 example — a technical string reaching the user — is live in
`Members.tsx:475`, `Groups.tsx:540`, `FollowUps.tsx:124`,
`Announcements.tsx:120`, `Reports.tsx:122`, `Inbox.tsx`, `Feed.tsx`,
`Events.tsx`, `Church.tsx`, `Ministries.tsx`. Fix belongs in one place
(`lib/api.ts` mapping + an `ErrorState` component that shows a friendly
sentence with the technical detail behind a disclosure).

**Success feedback** is generally good (sonner `toast.success` with specific
Thai wording) — `Members.tsx:257/260`, `MemberAppLayout.tsx:46`,
`FollowUps.tsx:82`. Keep.

---

## 5. Mobile (390px / 360px)

Verified problems, all reachable on a phone:

1. **Members 8-column table** — `Members.tsx:489–594`, `overflow-x-auto`.
   The worst instance.
2. **Attendance** — `Attendance.tsx:341–386` renders 4 tab buttons with
   **numbered, English-contaminated Thai labels** (`1. เช็คชื่อประจำวัน (Live)`,
   `2. QR Code Check-in`, `3. ผู้ขาดต่อเนื่อง (Pastoral Follow-up)`,
   `4. รายงานและสถิติ`); they wrap to 2–3 lines at 390px. Inputs are pinned to
   `height: 36px` (lines 411–419, 432–439, 460–467) — under the 44px minimum.
   Column headers inside the roster use `fontSize: "10px"` (lines 404, 426, 454)
   and a hardcoded `#6e8297`.
3. **Groups grid** `minmax(320px, 1fr)` at `Groups.tsx:553`.
4. **Member PWA** — `MemberAppLayout.tsx` pinning `maxWidth: 600px` with a
   blue-tinted `boxShadow` (line 69, `rgba(23,59,112,.08)`) and a bottom nav
   using `#315c2b`/`#71859c`/`#eaf2fb` inline; `transition: "all 0.15s ease"`
   (line 191, an anti-pattern) and `fontSize: "10px"` labels (line 205).
   Header taps have no `aria-label`s. Bottom nav items are `<button>`s again.
   Safe-area inset **is** handled (line 168) — keep that.
5. Touch targets under 44px in: `Members.tsx:558–588` (28px), `Groups.tsx:662–694`
   (≈34px), `FollowUps.tsx:162–199` (~28px buttons), `Announcements.tsx:165–180`
   (~28px), `Inbox.tsx:226–264` (~28px), `Topbar.tsx:41–50` is 44px (good).
6. `text-[10px]`/`text-[11px]` micro-text is used for real content in 9 files
   (56 occurrences) — see the earlier table.

What is already good on mobile: `Home.tsx` stacks every section, uses
`min-h-11` (44px) on all rows, `line-clamp-2`/`truncate` on long content,
`sm:grid-cols-3` so the base breakpoint is single-column, and `motion-reduce:`
on its one transition. `Attendance`'s Leaflet zoom controls are already forced
to 44px (`index.css:145–150`).

---

## 6. Accessibility

| Category | Finding | Where |
|---|---|---|
| Icon-only button, no name | clear-search | `Members.tsx:419` |
| Icon-only button, no name | modal close (Members, Groups, Announcements) | `Members.tsx:642`, `Groups.tsx:712`, `Announcements.tsx:191` |
| Icon-only button, no name | group edit/delete | `Groups.tsx:662–694` |
| Input without label | Members search | `Members.tsx:411` |
| Control label not associated | all `.form-grid label` wrappers are fine, but the `<span>`-labelled `<select>`s in Members/Groups/Attendance toolbars are not | `Members.tsx:430–467` |
| Div-with-onClick | Member PWA header logo (`<div onClick={navigate}>`) | `MemberAppLayout.tsx:88`, `Groups.tsx`/`Attendance.tsx` use `<button>` (better) |
| Non-semantic navigation | sidebar + bottom nav + Attendance tabs are `<button>`, not `<a>`/`<nav>` landmarks with current-page state | `Sidebar.tsx:151`, `MemberAppLayout.tsx:176`, `Attendance.tsx:351–385` |
| No `aria-live` for async status | toasts are sonner (has its own live region — acceptable), but inline loading/error panels are not announced | `Reports.tsx:114`, `Groups.tsx:537` |
| Modal without dialog semantics | CSS `.modal-card` — no `role="dialog"`, `aria-modal`, focus trap, Escape, or `overscroll-behavior: contain` | `index.css:939–977`, used by Members/Groups/Announcements/Members modal |
| Colour-only meaning | overdue follow-ups marked by `border-rose-200` alone plus a chip (chip saves it); `.state-panel.error-panel` relies on colour for the red icon | `FollowUps.tsx:139–141` |
| Heading structure | `Home.tsx` has one `<h1>` and labelled `<h2>`s (good). Members/Groups/Announcements/Feed/Inbox/FollowUps use `<h1>` given by the page but split into divergent markup; `ComingSoon.tsx:24` uses `<h1>` correctly. | mixed |
| Decorative icons not hidden | `ComingSoon.tsx:26` `Sparkles`, `Sidebar.tsx:191` `Sparkles`, Members/Groups card icons are missing `aria-hidden` throughout | multiple |
| `outline-none` without replacement | `Members.tsx:413/434/446/459` `focus:outline-none` **with** `focus:ring-2` (acceptable) but `Attendance.tsx` inline inputs have no focus style at all | `Attendance.tsx:407–419` |

Already good: `Home.tsx` uses `aria-hidden` on every decorative icon,
`role="img"`+`aria-label` on its data bars, `role="alert"` on errors,
`role="status"` on loading, `focus-visible:ring-*` on every interactive row.

---

## 7. Copy (§4/§9)

- Good Thai action labels already in use: `เพิ่มสมาชิก`, `บันทึก`,
  `ดูทั้งหมด`, `แก้ไข`, `ลบ`, `ค้นหา`, `ลองใหม่`.
- Problems: `Export CSV` (`Members.tsx:317`), `SYSTEM PULSE` / `API service` /
  `ระบบพร้อมทำงาน` / `เชื่อมต่อแล้ว` on the **church dashboard**
  (`Home.tsx:647–665`) — infrastructure vocabulary in front of a church user.
- English eyebrows under Thai headings: `CHURCH MEMBERS` (`Members.tsx:301`),
  `ANNOUNCEMENTS • ข่าวสารและการประกาศ` (`Announcements.tsx:93`),
  `FOLLOW-UP • การติดตาม` (`FollowUps.tsx:94`), `ATTENDANCE & CHECK-IN`
  (`Attendance.tsx:328`), `PUNTAKIT CHURCH GROUPS` (`Groups.tsx:421`),
  `REPORTS` (`Reports.tsx:91`, plus a `.blue-eyebrow` class).
  §4 wants the screen's purpose in Thai within 3 seconds; a bilingual eyebrow
  spends the most valuable line on the least useful words.
- Enum English in options: `Groups.tsx:762–764`.
- One leak of a raw DB/enum value to users: `Members.tsx:521` renders `m.role`
  (a system role) where the nickname/email should be, and `Members.tsx:544`
  shows `m.group` (the free-text field the architecture doc calls a
  duplication risk) next to `area` — two subtly different "group" notions on
  one line.
- No emoji are used as UI icons anywhere (verified: zero emoji characters in
  `client/src`). §17 satisfied — keep it that way.

---

## 8. Information design (§9/§10)

The dashboard (`Home.tsx`) is a **hybrid editorial landing page and operations
board**: 8 stacked sections, two full-height hero blocks with inspirational
copy, a `เส้นทางการสร้างสาวก` framework with no data behind it (by its own
comment at line 614), a vision section, an `/api/health` + `/api/ready`
"SYSTEM PULSE" panel, and only then the `ผู้คนและกลุ่มที่ต้องดูแล` section —
the thing a church leader actually opens the app for. In Thai on a 390px
phone that is roughly 4–6 screens of scrolling before the first decision-
relevant item. §10 asks the dashboard to answer "ตอนนี้มีอะไรที่ฉันควรรู้?"
first.

---

## 9. Design-system duplication (§22/§23)

- Two parallel CSS systems: 222 hand-rolled classes in `index.css` plus
  Tailwind utility styling in the newer pages, with the same concepts defined
  twice — `.primary-action`/`.blue-button` (index.css:294) vs
  `ui/button.tsx` variants; `.state-panel` vs `Home.tsx`'s `ErrorState`;
  `.summary-card` vs `tailadmin-card` vs `Card`.
- `Home.tsx`'s `EmptyState` (307), `ErrorState` (272), `StatusChip` (488),
  `IconBadge` (510) are the *right* implementations but live inside one page.
  Five other screens re-implement the same three states with different colours
  and different wording for the same situation — the §23 violation.
- `.sidebar` (index.css:169) and `.topbar` (1667) are dead/duplicated rules
  for components that no longer use them.

---

## 10. Ranked fix list (impact order)

1. **Unify the palette on the V2 tokens.** The blue system is the root cause
   of most visual inconsistency, most dark-mode breakage, and the "AI-generated
   template" feel. One shared layer, applied screen by screen.
2. **Members on a 390px phone:** replace the 8-column table with a card list
   below `md`, keep the table for desktop. This is the app's most-used screen.
3. **One obvious primary action per screen**, consistent label grammar
   (`เพิ่ม…`), and demote export/edit/delete to secondary or overflow.
4. **Shared `PageHeader` / `EmptyState` / `ErrorState` / `StatusChip` /
   `Modal` primitives** extracted from `Home.tsx` — then delete the 5+ local
   copies.
5. **Friendly error messages** in `lib/api.ts` + `ErrorState`, technical
   detail demoted.
6. **Groups:** one primary action per card, token styling, drop inline hex.
7. **Sidebar/Topbar:** real `<a>` navigation with `aria-current`, 240px width,
   remove the fake notification bell and decorative badges.
8. **Dashboard:** decision-first ordering — surface `สิ่งที่ต้องดูแล` and
   upcoming events before the editorial sections; keep the editorial content
   for members instead of privileged dashboards.
9. **Attendance:** de-jargon the tabs, fix 36px inputs and 10px labels.
10. **Member PWA:** remove the ~700 lines of inline blue styling, fix the
    bottom-nav semantics, `transition: all`.
11. **Touch targets and micro-text**: 44px minimum and a 12px floor for real
    content everywhere.
12. **Retire the `!important` dark-mode override block** once (1) lands.
