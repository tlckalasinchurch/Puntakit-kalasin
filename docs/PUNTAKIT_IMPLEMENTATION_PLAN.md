# Puntakit Implementation Plan — Ministry Operating System

Date: 2026-09-24

Each phase is a coherent, shippable slice. No phase deletes existing
working functionality. Schema changes are additive (new tables, nullable
FKs) until a later, explicitly-approved deprecation step.

## Phase 0 — Foundation docs (this change)

- `docs/PUNTAKIT_PRODUCT_RESEARCH.md`
- `docs/PUNTAKIT_UX_AUDIT.md`
- `docs/PUNTAKIT_PRODUCT_ARCHITECTURE.md`
- `docs/PUNTAKIT_IMPLEMENTATION_PLAN.md` (this file)
- Fix `CLAUDE.md`'s stale "no backend, mock data" description.

Non-destructive, no schema change, no UI change. Safe to ship alone.

## Phase 1 — Ministry Activity data layer — DONE

Shipped on branch `claude/eloquent-archimedes-04s1kg`, not yet in a PR.

- Added `mission_activities`, `mission_activity_participants`,
  `mission_activity_media` tables — additive migration
  `server/db/migrations/0004_clumsy_legion.sql` (3 `CREATE TABLE`s, no
  `ALTER`/`DROP` on any existing table).
- Added `server/routes/activities.ts`: list/detail/create/update/status
  transition/soft-delete, filtered by group/person/type/status/date/
  search, server-side RBAC reusing the existing `USER_ROLES` middleware
  (no `visibility` column — see architecture doc for why).
- Added `missionActivityInputSchema`/`missionActivityQuerySchema`/
  `missionActivityStatusUpdateSchema` to `shared/validation.ts`.
- Added `server/routes/activities.test.ts` (17 tests): full loop against
  a real embedded PostgreSQL instance (PGlite) — create, persist, fetch,
  401/403/404 authorization, group relation, participant relation, two
  lifecycle-publish paths, invalid-transition rejection, audit log rows,
  soft delete.
- Fixed a pre-existing hardcoded migration count in
  `server/db/bootstrap.test.ts` (4 → 5).
- `pnpm check`, `pnpm test` (125/125), `pnpm build` all pass. See the
  architecture doc's "Verification actually performed" section for what
  was and wasn't exercised (no live Neon/Postgres — no credential
  available in this environment).

No new navigation yet. No Feed UI yet — the `GET /api/activities` list
endpoint is the query Feed will read from in Phase 2, so Feed can be built
directly against real data with no interim mock layer.

**Deferred to later phases, on purpose (kept the schema minimal):**
`missionSubmissions` (Mission Inbox, Phase 5), `followUps` (Phase 4), a
`visibility` enum (not needed while status already gates draft/
pending_review visibility), LINE/AI integration (not started).

## Phase 2 — Feed — DONE (palette rollout deferred, see below)

Shipped on branch `claude/eloquent-archimedes-04s1kg`, not yet in a PR.

- New page `client/src/pages/Feed.tsx`: chronological, filterable
  (type/status) grid over `GET /api/activities`, photo-first cards
  (thumbnail, type/status badges, group or place, author, story snippet),
  reusing existing `AppLayout`/`CardGridSkeleton`/`ApiError` patterns —
  no new client architecture introduced.
- Capture flow: a full-width `Sheet` (mobile-first — covers the full
  viewport width on phone, a right-hand panel on desktop) with type,
  title, story, occurred-at, optional group, place label, a participant
  checklist (from `/api/members`), and media as URL entries (no file
  upload infra exists yet, so photo capture is a URL field for now, not a
  camera integration — flagged as a real gap, not silently skipped).
- Status actions on each card (submit for review / publish / archive /
  restore) call `PUT /api/activities/:id/status` directly — the server
  is the actual authority; the client just hides actions that are
  obviously never valid (e.g. no "publish" on an archived card) and lets
  the server 403 the rest.
- Added a single new sidebar entry ("ฟีดกิจกรรม" → `/feed`) — this is
  additive, not the Phase 8 restructuring; the rest of the nav is
  untouched.
- List query extended with a correlated-subquery `thumbnailUrl` (first
  media row by `sortOrder`) so Feed cards are photo-first without a
  second round trip per card.

**Deliberately deviated from the original plan on one point: did not
apply the warm palette.** The plan's original text called for swapping
`:root` tokens as part of this phase. On inspection, that's not a
Feed-scoped change — this app's CSS custom properties (`--navy`, `--blue`,
etc.) are global and already used by every existing page, so redefining
them would instantly restyle the entire app, not just Feed. Doing that
without a human able to look at it live (the person who owns this repo
was asleep for this phase) is the kind of visually risky, hard-to-verify-
blind change this plan's own quality bar ("run the actual application...
fix problems introduced by your work") argues against. Feed instead uses
the existing navy/blue design system as-is. The palette swap stays
scheduled for Phase 8, when it can be reviewed live in one pass together
with the navigation restructuring.

**Real bug found and fixed while visually verifying this phase:** the
installed shadcn/ui `Sheet` (and by the same mechanism, `Dialog`)
component renders with a fully transparent background in this app,
because `client/src/index.css` never defines the standard shadcn tokens
(`--background`, `--foreground`, `--popover`, `--border`, etc.) that
`bg-background` and friends resolve to — this codebase uses its own
`--navy`/`--blue`/`--surface` token set instead. That's very likely why
every existing page (see `Announcements.tsx`) rolls its own
`.modal-backdrop`/`.modal-card` CSS instead of using the installed
`Dialog`/`Sheet` primitives — they'd have looked broken. Fixed locally in
`Feed.tsx` with an explicit `bg-white` on `SheetContent`. The systemic gap
(shadcn tokens undefined app-wide) is real and worth fixing centrally, but
is a design-token change outside this phase's scope — flagged as a
follow-up, not fixed globally here.

**Verification actually performed:** `pnpm check`, `pnpm test` (125/125,
unchanged — no new automated tests added for this UI phase, see note
below), `pnpm build` all pass. Additionally, actually ran the app: seeded
a local PGlite database and an admin user, started `pnpm dev`, and drove
it with a headless Chromium (Playwright, the pre-installed browser) at
both a 1440×900 desktop viewport and a 390×844 mobile viewport — logged
in, opened Feed, opened the capture sheet, submitted a real activity,
confirmed it appeared in the list as a draft, changed its status to
published through the UI, and confirmed the status filter and badge
updated. This is what caught the transparent-Sheet bug above; screenshots
are not committed to the repo (they're verification artifacts, not
product assets). No automated browser test (e.g. Playwright in CI) was
added — this phase was UI-focused and manually verified end to end, but a
repeatable UI regression test is not yet part of the test suite, which is
a real gap.

## Phase 3 — Timeline + Person/Group detail integration — DONE

Shipped on branch `claude/eloquent-archimedes-04s1kg`, not yet in a PR.

- Added `client/src/components/ActivityTimeline.tsx`: `subjectType`
  (`"member" | "group"`) + `subjectId` → queries `GET /api/activities`
  with `memberId=`/`groupId=` — the same Phase 1 endpoint Feed uses, no
  new backend route and no new data. This is a pure read lens, exactly as
  the architecture doc specified ("Timeline is a lens, not a page").
- Rendered inline in the existing Member detail modal
  (`client/src/pages/Members.tsx`, under "กิจกรรมพันธกิจล่าสุด") and the
  existing Group members modal (`client/src/pages/Groups.tsx`, under
  "กิจกรรมพันธกิจล่าสุดของกลุ่ม") — both pre-existing modals, not new
  pages. No `place`/Place-entity subject type: Phase 1 kept location as
  columns on the activity, not a Place entity, so there is no Place
  detail view yet for a Place timeline to attach to. Adding it later is
  additive, not a redesign of this component.
- No new top-level nav item — matches the architecture doc.

**Verification:** `pnpm check`, `pnpm test` (125/125, unchanged), `pnpm
build` all pass. Manually verified live: seeded a group, a member, and one
mission activity linking both via the real API in the same authenticated
browser session, then opened the Member detail modal and the Group
members modal and confirmed the same activity renders correctly in both
— proving the "one activity, reused by every lens" rule from the
architecture doc, not just asserted but actually observed across two
different surfaces.

## Phase 4 — Follow-up — DONE (schema/API/UI shipped; data migration still blocked, as planned)

Shipped on branch `claude/eloquent-archimedes-04s1kg`, not yet in a PR.

- Added `follow_ups` table (additive migration
  `server/db/migrations/0005_secret_warstar.sql`, one new table, no
  changes to existing ones) — `status`, `title`, `note`,
  `subjectMemberId`/`subjectGroupId` (at least one required, enforced by
  Zod `.refine`), optional `activityId` tracing back to the activity that
  raised it, `ownerId`, `dueAt`, `completedAt`, `createdById`.
  Deliberately kept separate from `members.status` — see
  `docs/PUNTAKIT_PRODUCT_ARCHITECTURE.md` and the note below.
- Added `server/routes/followUps.ts`: list (filterable by status/owner/
  subject/`overdue=true`)/detail/create/update/status-transition.
  Follow-ups are internal tasks, not public content — unlike Mission
  Activity, visibility has no "published" escape hatch: privileged roles,
  the owner, the creator, or a `group_leader` who actually leads the
  subject group. Explicit lifecycle map (`open → in_progress/completed/
  cancelled`, `in_progress → open/completed/cancelled`, `completed/
  cancelled → open` to reopen); `completedAt` is stamped on entering
  `completed` and cleared on reopen.
- Added `client/src/pages/FollowUps.tsx` at `/follow-up` (new sidebar
  entry, additive — not the Phase 8 restructuring): status/overdue
  filters, one list, inline lifecycle action buttons, overdue rows
  highlighted.
- Linked follow-up creation from two places, per plan: a "สร้างรายการ
  ติดตามจากกิจกรรมนี้" button on each Feed activity card (only shown when
  the activity has a group — a required subject) and a "+ สร้างรายการ
  ติดตาม" button in the Member detail modal, next to its
  `ActivityTimeline`.
- **`members.status` untouched**, exactly as planned — no migration, no
  reinterpretation of that field. It is a separate concept (a two-state
  pastoral flag on the person) from a follow-up (a task with an owner, a
  due date, and a lifecycle). The data-migration step remains explicitly
  blocked pending approval; nothing in this phase touches it.

**Verification:** `pnpm check`, `pnpm test` (139/139 — 14 new tests in
`server/routes/followUps.test.ts`, same real-PGlite full-loop pattern as
`activities.test.ts`: create → persist → fetch → 401/403/404 → relate
person/group/activity → three chained lifecycle transitions including the
reject-invalid-transition and completedAt-stamped/cleared cases → audit
rows → an `overdue=true` filter query against a directly-inserted overdue
row), `pnpm build` all pass. One more mechanical fix in
`server/db/bootstrap.test.ts` (migration count 5 → 6). Also manually
verified live: seeded a group and an activity, clicked "create follow-up"
from a real Feed card, confirmed the new item and a separately-seeded
overdue item both render correctly on `/follow-up` (desktop and mobile),
with working status-transition buttons.

## Phase 5 — Mission Inbox — DONE

Shipped on branch `claude/eloquent-archimedes-04s1kg`, not yet in a PR.

- Added `mission_submissions` table (additive migration
  `server/db/migrations/0006_sweet_zzzax.sql`, one new table): `status`
  (`new/reviewing/needs_info/approved/rejected`), `source` (`manual` now,
  `line`/`import`/`system` reserved), `rawText`, `rawMediaUrls` (JSON
  text — deliberately not a media table, since a submission is transient
  pre-publish input, not the long-term Activity media model),
  `submittedByLabel`, `reviewNote`, `publishedActivityId`, `reviewedById`/
  `reviewedAt`, `createdById`.
- Added `server/lib/missionActivity.ts` (`insertMissionActivity`,
  `insertMissionActivityMedia`) — the one piece of genuinely shared logic
  between the direct-create path (`activities.ts`) and the Inbox publish
  path (`submissions.ts`), so both ultimately write the *same* activity
  table the same way rather than diverging.
- Added `server/routes/submissions.ts`: anyone in the same `CREATE_ROLES`
  set as activities can submit raw input (this is the "type up what came
  over LINE today" manual path — no LINE adapter exists). Only
  `REVIEW_ROLES` (`super_admin/admin/staff/ministry_leader`) can move a
  submission through the review lifecycle (explicit transition map:
  `new → reviewing/rejected`, `reviewing → needs_info/approved/rejected/
  new`, `needs_info → reviewing/rejected`, `rejected → new` to resubmit)
  or publish it. `POST /:id/publish` only works from `approved`, only
  once (checked via `publishedActivityId`), and always creates the
  Mission Activity as `draft` — publishing from Inbox is never a second
  way to skip the Activity's own publish gate.
- Added `client/src/pages/Inbox.tsx` at `/inbox` (new sidebar entry,
  additive): a capture sheet for raw text + media-by-URL + a submitter
  label, and a queue view with inline review actions gated client-side by
  role (server re-checks regardless) plus a publish sheet that maps raw
  input into the same structured fields Feed's capture form uses.
- **No LINE adapter, exactly as planned.** `source` stays `"manual"` for
  everything created in this phase; the enum already reserves `"line"`
  for when a real channel/credential exists.

**Verification:** `pnpm check`, `pnpm test` (153/153 — 15 new tests in
`server/routes/submissions.test.ts`, same real-PGlite full-loop pattern:
submit → persist → fetch → 401/403/404 → full review lifecycle including
a rejected-role-gate case and an invalid-transition case → publish →
confirms the created activity is real, is `status: "draft"`, and carries
the raw media as real `mission_activity_media` rows → refuses a second
publish of the same submission → audit rows), `pnpm build` all pass.
Another mechanical fix in `server/db/bootstrap.test.ts` (6 → 7). Manually
verified live end to end: captured a raw submission through the UI,
walked it through reviewing → approved, published it, confirmed the
resulting activity — media included — appears correctly on `/feed` as a
draft.

## Phase 6 — Operations — DONE

Shipped on branch `claude/eloquent-archimedes-04s1kg`, not yet in a PR.
No new migration this phase — read-only aggregates over Phase 1–5 tables.

- Added `GET /api/dashboard/operations` to `server/routes/dashboard.ts`,
  gated to the same privileged roles that review Inbox submissions
  (`super_admin/admin/staff/ministry_leader`) since it exists to surface
  exactly the otherwise-hidden queue those roles need: pending Inbox
  submissions (count + latest 5), open/overdue follow-ups (counts + the 5
  most overdue, joined to their subject name and owner), groups with no
  Mission Activity in the last 14 days (a real `NOT IN` subquery against
  `mission_activities`, not a fabricated "health score"), the 5 most
  recent activities, and upcoming scheduled events. Every number is a
  `count()`/row from a real table — nothing invented.
- Evolved `client/src/pages/Home.tsx` (still at `/` — the sidebar label
  and route stay as-is; renaming it is Phase 8's job, not this one) with
  an Operations section: three stat chips linking to `/inbox`,
  `/follow-up`, and `/groups`, plus a two-column recent-activity /
  overdue-follow-up panel. Fetched only for privileged roles, matching
  the server-side gate — a `member`/`group_leader` sees the existing
  dashboard unchanged.

**Verification:** `pnpm check`, `pnpm test` (156/156 — 3 new tests in
`server/routes/dashboard.test.ts`: 401/403 checks, plus one seeding a
pending submission, an overdue follow-up, an active group with a recent
activity, and an inactive group without one, then asserting each shows
up — or correctly doesn't — in the response), `pnpm build` all pass.
Manually verified live: seeded the same four kinds of rows through the
real API, loaded `/`, and confirmed all three stat chips and both list
panels show the real seeded data, not placeholders.

## Phase 7 — Map — BLOCKED on a production credential

Confirmed on inspection: `client/src/components/Map.tsx` is a Google
Maps JavaScript API wrapper (`MapView`, marker/places/geocoding/routes
helpers) and is currently unused anywhere in `client/src` (`grep` for its
import returns nothing). Wiring it to `missionActivities`/`groups`
location data requires a Google Maps API key
(`VITE_GOOGLE_MAPS_API_KEY` or similar) — grepped `.env.example`,
`client/src/const.ts`, and `vite.config.ts`: none is configured
anywhere in this repo.

Per the plan's own escalation rule ("stop only for ... production
credential requirement"), this phase stops here rather than faking a map
integration that can't actually be verified without a real key. Nothing
was built for this phase. To unblock: provide a Google Maps API key
(scoped to the Maps JavaScript API, with the domain(s) this app runs on
allow-listed) as `VITE_GOOGLE_MAPS_API_KEY`, and this phase can proceed
the same way Phases 1–6 did — real schema/API work already in place
(`mission_activities.latitude`/`longitude`/`placeLabel`,
`groups.latitude`/`longitude`) needs no changes; only the client map
surface and its query need building.

## Phase 8 — Navigation restructuring

- Only after Feed/Inbox/Follow-up/Operations exist and have real content
  to point to: restructure the sidebar per the proposed IA in the
  architecture doc. This is the one step classified as a genuinely
  user-visible "major architecture replacement" — confirm the final IA
  with the product owner before shipping, per the brief's own escalation
  rule.
- Roll the warm palette out from Feed (Phase 2) to the rest of the app in
  the same pass, so the visual language changes once, coherently, not
  page-by-page.

## Phase 9+ — Reports, Notifications, Search, Administration

- Reports: **done.** `GET /api/reports/summary` (member/group/attendance/event
  aggregates, optionally scoped by `startDate`/`endDate`) plus CSV exports at
  `/api/reports/export/{members,attendance,groups,events}.csv`, gated to the
  same roles as Operations (`super_admin`/`admin`/`staff`/`ministry_leader`).
  Replaces the `/reports` `ComingSoon` stub with `client/src/pages/Reports.tsx`.
  Shared CSV building (RFC 4180 quoting, UTF-8 BOM, formula-injection guard)
  lives in `server/lib/csv.ts`.
- Notifications: event-driven (follow-up due, submission needs review),
  built on the existing `pushSubscriptions` table.
- Search: cross-domain, start with server-side `ILIKE`/trigram search
  over existing Postgres before introducing a separate search
  infrastructure — the brief explicitly asks to justify that before
  adding it.
- Administration: real RBAC management UI over the existing `USER_ROLES`
  enum, filling the `/settings` `ComingSoon` stub.

## What requires explicit confirmation before proceeding

Approved 2026-09-24: proceed autonomously through Phases 2–7 and 9+
without stopping for approval at each phase boundary. Per the brief's own
escalation rule ("ask only for destructive migration, irreversible data
loss, ... major architecture replacement, fundamental product
contradiction"), only two points still require a stop-and-confirm:

1. **Phase 4's data migration** of `members.status` into `followUps` —
   touches existing member data, not additive.
2. **Phase 8's navigation restructuring** — the one user-facing, highly
   visible IA change; confirm final structure first.

Everything else in Phases 2–7, 9+ is additive and proceeds without asking
again, continuing straight through phase boundaries.
