# Puntakit Product Research

Date: 2026-09-24

## Scope and method

This is desk research from existing product knowledge, not a live browsing
session — no `WebSearch`/`WebFetch` calls were made to produce it. Treat
each row as a starting hypothesis to validate against real Puntakit users
(field workers, group leaders, admins), not as settled fact. Where a claim
needs verification against a live product, it is marked **[verify]**.

For each reference: the pattern, why it works, what Puntakit can learn,
what Puntakit should not copy.

## Ministry / church systems

### Planning Center
- **Pattern:** separate modules (People, Groups, Check-Ins, Giving,
  Services, Registrations) that share one People database and one
  permissions model.
- **Why it works:** a person is one record everywhere; module boundaries
  match how church staff actually divide labor (the check-in volunteer
  never touches Giving).
- **Lesson for Puntakit:** the OS domains (People, Groups, Activity,
  Attendance, Events) should read/write one `members`/`groups` table, the
  way the current schema already does — do not fork People per module.
- **Do not copy:** Planning Center's module-per-product pricing/account
  model — irrelevant to a single-tenant church app.

### ChurchApps / B1, Acts, Disciple.Tools, ChurchCRM
- **Pattern (Disciple.Tools especially):** a "contact/group timeline"
  showing discipleship touchpoints in chronological order, with
  follow-up tasks attached to a contact. **[verify]** exact UI details —
  this is recalled from general familiarity with the product's public
  description, not a fresh audit.
- **Why it works:** field workers think in "what happened, what's next,"
  not in database tables. A single timeline view collapses several tables
  into one narrative.
- **Lesson for Puntakit:** this is close to the `MINISTRY ACTIVITY +
  TIMELINE + FOLLOW-UP` idea in the OS brief — validates that pattern as
  proven in this product category, not just theoretical.
- **Do not copy:** heavier CRM concepts (pipelines, stages, lead scoring)
  common in ChurchCRM-style tools — the OS brief explicitly rules out
  "generic CRM."

## Modern product systems

### Linear
- **Pattern:** one object (the Issue) flows through every surface —
  inbox, board, cycle, project view, search — without being re-entered.
  Status is a first-class, small enum; activity is an append-only log on
  the object.
- **Why it works:** users never wonder "where is the real data" — every
  view is a lens on the same object.
- **Lesson for Puntakit:** `MissionActivity` (or whatever it is named)
  must play the Issue role: one record, many lenses (Feed = list view,
  Timeline = per-person/group view, Map = geo view, Operations = queue
  view). This directly supports the brief's "never duplicate the same
  ministry event into independent systems" rule.
- **Do not copy:** Linear's keyboard-first power-user density — Puntakit's
  primary user (a field worker on a phone) needs a simpler default.

### Notion
- **Pattern:** progressive disclosure — a page shows a few properties by
  default, more on click; the same content renders as list, board, or
  calendar without re-entering data.
- **Lesson for Puntakit:** People/Group detail pages should default to a
  compact view (per the brief's own "progressive disclosure, not giant
  forms" instruction) and let filters/views reshape Feed and Timeline
  without new tables.
- **Do not copy:** fully freeform, schema-less pages — Puntakit needs a
  fixed, typed domain model for reporting and permissions to work.

### Slack
- **Pattern:** channels + threads keep a stream readable at scale;
  notifications are opt-in per channel, not global broadcast.
- **Lesson for Puntakit:** Feed filters (by group/person/place/date) are
  the "channel" equivalent — scope the stream instead of one global feed.
  Notification rules (assigned follow-up, submission needs review) should
  be targeted, matching the brief's "avoid notification spam."
- **Do not copy:** open reactions/threads/DMs — explicitly ruled out by
  the brief ("no social-media mechanics").

### GitHub
- **Pattern:** every object (PR, issue, commit) has one canonical URL and
  a visible activity timeline (comments, status changes, reviews)
  rendered inline on that object's page.
- **Lesson for Puntakit:** each Activity/Person/Group page should render
  its own timeline inline, not link out to a separate "history" page.

## Design systems

### Apple HIG / Material 3 / Vercel Geist / Radix / shadcn/ui
- **Pattern common to all four:** a small set of semantic color/spacing/
  radius tokens, not per-component hex values; platform-appropriate
  interaction (sheets and full-screen flows on mobile, dialogs/popovers on
  desktop); accessible contrast and touch-target minimums baked into the
  token scale, not left to each screen.
- **Lesson for Puntakit:** the repo already follows this shape —
  shadcn/ui (`components.json`, `style: new-york`) + Radix primitives +
  CSS-custom-property tokens in `index.css`. The warm palette should be
  applied as a token swap in `:root`, keeping the same structure, per the
  brief's own instruction ("centralized semantic tokens," "do not scatter
  hex values").
- **Do not copy:** Material's very high animation/elevation vocabulary or
  Apple's platform-specific chrome — Puntakit is a web app with a
  Thai-first, warm-editorial identity of its own, not a Material or iOS
  clone.

## Cross-cutting patterns to research further before building

- **Activity feeds:** chronological + filterable, media-first cards,
  each card links to its underlying object (confirmed useful across
  Planning Center's timeline, Disciple.Tools, GitHub, Linear).
- **Inbox/review workflows:** a queue with explicit states
  (new/reviewing/needs-info/approved/rejected) that never silently
  auto-publishes — matches the brief's Mission Inbox and AI sections, and
  matches Linear's triage inbox pattern.
- **Progressive disclosure on detail pages:** overview first, drill-down
  tabs (Activity, Groups, Attendance, Follow-up) — matches Notion pages
  and Planning Center's People module.
- **Mobile-first capture:** full-screen photo-first flow for field
  workers, not a shrunk desktop form — no single reference nails this for
  a ministry context; this needs original design work, not a copy.

## Open items for live research (flagged, not done here)

- Confirm current Planning Center / ChurchApps / Disciple.Tools UI with a
  live look (screens change over time; the above is pattern-level, not
  pixel-level).
- Confirm current shadcn/ui and Radix component set matches what
  `components.json` already pins in this repo (avoid drifting from the
  installed version).
