<!-- last_verified: 2026-10-10 -->
# Membership card, annual membership lifecycle, mission photos

Branch `feat/redesign-home-card-lifecycle` (on top of `main` @ `be1c2e2` + the four red-test fixes). **Not merged, not deployed, migration not applied.**

## What this adds

| Area | Where |
|---|---|
| Role-based home: quick actions, own-scope numbers, latest photos | `client/src/components/home/*`, `server/routes/home.ts` (`GET /api/home/overview`) |
| Mission photo update (take/choose → resize → private upload → mission activity) | `MissionPhotoSheet.tsx`, `server/routes/media.ts`, existing `POST /api/activities` |
| Real membership card from the register | `components/membership/MemberCard.tsx` (+ `.pk-card` in `index.css`), `server/routes/memberCards.ts` |
| Annual membership lifecycle (วิสามัญ / สามัญ) | `shared/membership.ts`, `server/routes/memberships.ts`, `MembershipPanel.tsx`, page `/memberships` |
| Photo + number management | `POST /api/media?kind=member_avatar`, `POST /api/member-cards/:id/number` |
| Sign-in page polish | `lib/clerkAppearance.ts` (`clerkSignInAppearance`), `ClerkSignInPage.tsx` |
| Readable status-chip text | `--color-{success,warning,info}-ink` tokens (light + dark), used by `StatusChip` |

## Data model (migration `0012_membership_lifecycle_and_media.sql`, additive only)

- `members.member_no integer` — unique when set; printed as `No. 00304` (`formatMemberNo`). Nobody is renumbered automatically.
- `membership_terms` — one row **per cycle**, never overwritten. `type` (`extraordinary` | `ordinary`), `status` (`open` | `closed`), `starts_on` / `ends_on` (`date`, read as strings — no timezone drift), `closed_reason`, `decided_by_id`, `decision_note`, `fee_baht`, `payment_status` (`not_required` | `unpaid` | `paid`), `paid_amount_baht`, `paid_at`, `payment_recorded_by_id`. A partial unique index allows **one open term per member**.
- `media_assets` — metadata for uploaded images (kind, storage, pathname, content type, size, member/group, uploader). Bytes are in a **private** Vercel Blob (local files in dev/test). `members.avatar_url` and `mission_activity_media.url` hold `/api/media/<id>`, never a storage URL.

## Rules (from the owner brief)

- **วิสามัญ**: free 1-year trial. When it ends (or is within 30 days) it shows **"ถึงกำหนดให้หัวหน้าแคร์ตรวจสอบ"**. It is **never converted automatically** and never billed. The care leader decides: convert to สามัญ, or not continue.
- **สามัญ**: 100 baht per year. Renewal closes the cycle and opens the next one (starting where the old one ends). Closed cycles stay as history.
- **Payment**: only an office role (`super_admin`/`admin`/`staff`) can record that money was received (amount ≥ the fee, date, who). Nothing is marked paid by inference; no card data, no gateway, no collection.
- Every change writes `audit_logs`: `MEMBERSHIP_TERM_STARTED`, `MEMBERSHIP_TERM_DECIDED`, `MEMBERSHIP_PAYMENT_RECORDED`, `MEMBER_AVATAR_CHANGED`, `MEMBER_NUMBER_ASSIGNED`.

## Who may do what (enforced in the API; the UI only mirrors it)

"หัวหน้าแคร์ / หัวหน้าบอดี้" are **not roles**: they are a `group_leader` who leads a care / body group. No role was added.

| Role | See status | Start / convert / renew / not continue | Record payment | Change member photo | Assign card no. |
|---|---|---|---|---|---|
| super_admin, admin, staff | all members | all | yes | yes | yes |
| group_leader — care leader | members of the groups they lead | **those members only** | no | those members only | no |
| group_leader — body leader | members of care groups under their body | **no (view only)** | no | no | no |
| ministry_leader, viewer, member | no | no | no | no | no |

Mission photos: a `group_leader` uploads for a group they lead; privileged roles for any group. A photo is readable like the activity it belongs to (drafts: creator, privileged, leaders of that group; published: signed-in non-member roles).

Contact policy is untouched: none of the new endpoints return phone, email or address, and the card never shows them.

## Home page numbers

`GET /api/home/overview` counts only existing rows inside the caller's scope (groups, members, activities in the last 30 days, open follow-ups, members needing membership action). There is **no weekly-report table**, so there are no targets, scores or "reports submitted" — the page says so.

## Verified (local, synthetic data, throwaway PGlite — not production)

- `tsc` 0 · `vite build` 0 · server `esbuild` bundle 0 · vitest 59 files / 694 tests.
- New tests: `shared/membership.test.ts` (12), `server/routes/memberships.test.ts` (27, mutation-checked: breaking the scope made 10 fail), `mediaAndCards.test.ts` (19), `homeOverview.test.ts` (6), `client/src/membership-ui.test.ts` (13).
- Playwright against the real API with signed role cookies: 42 checks (home per role, photo upload end-to-end, card photo swap, trial → ordinary, renewal, payment by staff, body leader read-only), 0 console/HTTP errors, no horizontal overflow, contrast scan 0 below AA on the pages above (light + dark).

## Blockers / decisions still needed from the owner (not guessed)

1. **`ministry_leader`** has no access to membership status or payment data (it is the ministry-team role, not a place in body → care). Say if it should.
2. **Who records payments** — currently office roles only. Should the care leader be able to?
3. **Card details from the reference image**: the big number on the card is taken from the care group's name (first number); the letter "G" in the reference is **not** reproduced because its meaning is not in the register. Tell us what it means if it must appear.
4. **Church emblem**: the only logo on disk was inside the reference card image; `client/public/church-emblem.png` is a crop of that emblem (no person, no text). Replace it with the official vector/PNG when available.
5. **Card numbers for existing members**: nobody is numbered until an office role assigns it (next free number, or an explicit one to match the paper cards). A bulk back-fill was not run — it needs an ordering rule.
6. **Deploying this runs a migration**: production has `DB_AUTO_MIGRATE` set, so the first boot with `0012` would apply it to the real database. It is additive (2 tables, 1 nullable column, indexes) but it is a production write — approve it explicitly.
7. **Blob store type**: image storage assumes the existing Blob store is **private** (the import code already reads private blobs). Not verified against production.
8. **Production sign-in** is blocked by Clerk's domain rule, see `.ai`/report: the live publishable key only works on `puntakit.dynv6.net`, which does not resolve; the app is served from `puntakit-kalasin.vercel.app`.
9. **Found, not fixed (out of scope)**: `GET /api/dashboard/summary` returns church-wide totals to a `group_leader` (unscoped). The new home page does not use it for leaders.
