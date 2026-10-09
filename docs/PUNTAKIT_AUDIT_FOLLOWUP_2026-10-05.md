# Audit follow-up — 2026-10-05

Branch: `fix/audit-2026-10-04`. Continues the 5-agent audit of 2026-10-04.
Nothing here is verified in Production. All browser checks ran against a local
demo-mode server (one `admin` account, throwaway PGlite database).

## 1. Closed in this round

| ID | Change | Evidence |
|---|---|---|
| UJ-08 (server) | `maskPhone` and `maskEmail` replace the digit-run regex. `081-234-5678` and `+66 81 234 5678` were returned unmasked to non-privileged roles. | `server/routes/membersPrivacy.test.ts` |
| UJ-08 (server) | `GET /api/members?search=` matches phone and email only for `MEMBER_CONTACT_ROLES` (`super_admin`, `admin`, `staff`). Other roles search names only. Before, any signed-in role could ask "whose number is 081-234-5678?" | same test file |
| UJ-08 (server) | `GET /api/members/check-duplicate` requires `MEMBER_UPDATE_ROLES`. It returned the existing member's name to any signed-in role. | same test file |
| UI-02 | `RouteErrorBoundary` (in `ProtectedRoute`, `AppLayout`, `MemberAppLayout`). A page that throws shows an in-page error inside the normal shell. The error clears on navigation. | browser check, `ux-audit-regressions.test.ts` |
| UI-06, UJ-06 | Announcements, Events, Ministries and Church use `noValidate`, a trimmed required check and `<Field error>` from `ApiError.details`. | browser check |
| UI-06 root cause | These four routers sent `error` as a bare string. The browser then showed "ดำเนินการไม่สำเร็จ" and dropped the field detail. They now use `sendValidationError` (standard envelope). | `server/routes/validationEnvelope.test.ts` |
| UJ-04 (partial) | Quick follow-up buttons in Members and Feed are disabled while a request runs. | `ux-audit-regressions.test.ts` |

## 2. Decisions needed from the administrator

### D1. What a `member` account may see in the member directory

Current behaviour, from code and tests (`members.test.ts` "Data Privacy & Field Masking"):
every signed-in role, including `member` and `viewer`, can list and open every
non-deleted member. Roles other than `super_admin`, `admin`, `staff` (and the
assigned leader of a record) receive a masked record.

The member PWA never calls `/api/members`. It uses only `/api/me/*`.

Still returned to a `member` or `viewer` account today:

| Field | Note |
|---|---|
| `name`, `nickname`, `gender`, `avatarUrl` | Directory data. |
| `birthDate` | Not masked. Exact date of birth. |
| `status` (`ต้องติดตาม`) | Pastoral follow-up state. |
| `membershipStatus`, `role`, `area`, `group`, `joinedAt` | |
| `assignedLeaderId`, `userId`, `createdById`, `updatedById` | Internal account IDs. |
| `consentGiven`, `consentDate` | |
| `careGroup` | Name of the care group. |

Questions:
1. Should the `member` role see the directory at all? Option A: no (403, the PWA does not need it). Option B: names only. Option C: keep as is.
2. Should `viewer`, `group_leader` and `ministry_leader` see the whole church or only their own group?
3. Should `birthDate`, `status` and the internal IDs be masked for non-privileged roles?

Not changed. This is a business rule.

### D2. Prayer requests (UJ-14, P1)

Current path, confirmed by code:
- Member PWA `PrayerRequestModal` → `POST /api/me/prayer-requests` (`server/routes/portal.ts:584`).
- Row goes to `prayer_requests` with `status = "pending"`, `memberId` and `isConfidential`. An audit log entry is written.
- The only read is `GET /api/me/prayer-requests/my`, which returns the sender's own requests.
- No staff endpoint, no page, no notification, and nothing sets `status` or `answeredNotes`.
- The success message says "ทีมศิษยาภิบาลจะร่วมอธิษฐานเผื่อท่าน". Nobody receives the request.

The table already has `status` (`pending`, `praying`, `answered`) and `answeredNotes`.
**No migration and no schema change is needed** for the plan below.

Plan (not started):

| Layer | Work |
|---|---|
| Roles | Add `PRAYER_TEAM_ROLES` to `shared/roles.ts`. Proposal: `super_admin`, `admin`, `staff`, `ministry_leader`. Needs D2-a. |
| API | New `server/routes/prayerRequests.ts`, mounted at `/api/prayer-requests`: `GET /` (filters `status`, `category`, paging), `PUT /:id/status` (`pending`/`praying`/`answered`, optional `answeredNotes`). Every read and write calls `logAudit`. |
| Confidential | When `isConfidential` is true, return the row only to `CONFIDENTIAL_PRAYER_ROLES` (needs D2-b). Other team members see title, category and date, with the content hidden. |
| Member side | `GET /api/me/prayer-requests/my` already returns `status` and `answeredNotes`. `MemberHome` shows them. |
| UI | New page `/prayer` (admin shell, role-gated with `ProtectedRoute allow`). List with status chips, empty state, error state, filter by status. Detail modal with status buttons and a notes field. Add a count to the Operations dashboard. |
| Tests | Route test per role (403 for `member`, `viewer`, `group_leader`), confidential masking, status transitions, audit rows. Client contract test. |
| Alternative | If no team will read the requests yet, change the confirmation text to say the request is saved and not yet read. This is a one-line change in `portal.ts` and `PrayerRequestModal.tsx`. |

Questions:
- D2-a. Which roles are the prayer team?
- D2-b. Who may read confidential requests?
- D2-c. Should the team get a notification (Notifications are not built yet)?
- D2-d. How long should requests be kept?

### D3. Feed activities cannot be edited or deleted (UJ-05)

The server has `PUT /api/activities/:id` and `DELETE /api/activities/:id`
(`DELETE_ROLES`). The Feed UI has neither. A wrong draft cannot be removed.
Proposal: edit and soft-delete for `DELETE_ROLES` on drafts only, with
`ConfirmDialog`. Question: may a `published` activity be edited, or only archived?

### D4. Quick follow-up (UJ-04)

Now one click, no form. The button is disabled during the request only.
Proposal: a small `Modal` (title, due date, owner, note) using the existing
`followUpInputSchema`, and a warning when the subject already has an open
follow-up. Question: is one open follow-up per person the rule?

## 3. Remaining items, by type

### Security
- D1 items above (decision needed).
- UI-03 (403 wording): a 403 on a data load still shows the generic "connection failed" text on most pages. Not a leak. Fix is per page.
- `PUNTAKIT_DEMO_MODE` and the test-auth cookie path are non-production only and guarded in `createApp()`. Not re-tested.

### Business decision
D1, D2, D3, D4. Also UJ-07 (church name and phone hard-coded in the sidebar, login page and member PWA) and UJ-09 (search covers members only).

### Usability
- UJ-13: date inputs show US format; worship check-in gives no toast; attendance event types do not include events created in `/events`.
- UJ-10: a deep link to a missing member fails silently.
- UI-09: `/church` is read-only for non-admin roles without an explanation.
- MX-04 (other checkboxes inside dialogs), MX-07 and UJ-15 (drawer keyboard focus), MX-08.
- UI-02 field-level guards: the boundary contains the failure. The pages still throw on a wrong response shape.

### Refactor
DS-03, DS-05, DS-07 (Terms and Privacy inline styles), DS-09 (four button implementations), DS-10 (dead CSS), DS-11 to DS-20.

## 4. Follow-up — 2026-10-09 (D2, D3 decided and shipped)

Decisions taken from §2 above, with the "Alternative" option chosen for both.

| ID | Decision | What shipped | Still open |
|---|---|---|---|
| D2 | Take the **Alternative**: no staff endpoint, no notification, no `/prayer` page. The copy now states the request is stored and waiting, instead of claiming the team already has it. | `server/routes/portal.ts` success message, `client/src/components/PrayerRequestModal.tsx` (toast, modal header, confidential explanation), `client/src/pages/member/MemberHome.tsx` quick-action subtitle | **D2-a** (which roles are the prayer team), **D2-b** (who reads confidential), **D2-c** (notification), **D2-d** (retention) — all still unanswered, so the receiving side is deliberately not built. `GET /api/me/prayer-requests/my` still has no UI consumer. |
| D3 | Take the **Alternative**: the Feed UI now offers edit and delete on the endpoints that already exist. No permission was widened: edit follows the server's `canManage`, delete follows `DELETE_ROLES` exactly (the question "may a `published` activity be edited?" is answered **yes**, by the existing route — status itself is untouched by an edit). | `client/src/pages/Feed.tsx` (edit dialog reusing the create form + `ConfirmDialog` for delete), `client/src/components/ConfirmDialog.tsx` (new optional `error` slot) | — |

Found while implementing D3: `PUT /api/activities/:id` used to treat an omitted
`participantMemberIds`/`media` as `[]` and delete the recorded people and photos
(known as **D53** on the `master` branch's tech-debt tracker; fixed here by
`missionActivityUpdateSchema` in `shared/validation.ts`). The Feed edit dialog is
safe on top (loads `GET /:id` first, refuses to save until the detail arrives).

## 5. Needs a real environment

- Real iOS and Android: keyboard over the submit button, safe-area insets, pinch zoom.
- Clerk sign-in and sign-out. Demo mode bypasses Clerk.
- Role behaviour with real accounts. Browser role checks used a simulated `/api/auth/me`. Server gates are covered by the route tests only.
- Tables and lists with real data volumes.
- Contrast of status colours in dark mode.
- The Prompt web font and Thai line-height on real devices.
- Production database content: any stored phone that does not match the new phone rule will be rejected on the next edit of that member.
