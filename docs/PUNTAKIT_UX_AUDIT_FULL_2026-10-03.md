# Puntakit — full UX audit (2026-10-03)

Scope: every route in `client/src/App.tsx` (28), checked in a real browser against a build of
this code with the church's real data loaded (463 members, 54 groups), at 390 px and
1280 px, then the changed pages again at 360 / 375 / 390 / 414 / 768 / 1024 / 1280 px.
Method: automated measurement (overflow, tap-target size, missing labels, console and
HTTP errors) + screenshots + source reading + task journeys.
Limit: production sits behind Clerk, so the audit ran against the same code in demo mode.
This file contains no member data.

## Problems found, by severity

### P0 — blocks a task
| Page | Problem | Evidence | Fix |
|---|---|---|---|
| Attendance | The roster never loaded: error toast every time. | `GET /api/members?limit=300` returned 400 (API cap is 100). | `fetchAllPages` / `fetchAllMembers` (`client/src/lib/fetchAll.ts`) walk the pages at limit 100. |
| Feed (log an activity) | The "people involved" list was empty. | `GET /api/members?limit=200` returned 400; the `catch` hid it. | Same helper; an error toast replaces the silent `[]`. |
| Groups (add member) | The member picker was empty. | `limit=200` returned 400; `catch {}` hid it. | Same helper; error toast. |
| Sidebar | Two entries led to a "coming soon" page. | `ComingSoon.tsx` | Removed from the menu (routes kept for old links). |
| Member app (logout, any modal) | The bottom nav covered the buttons of a dialog: "ยกเลิก" could not be tapped. | Journey test: Playwright reported the nav intercepting the click. | Member bottom nav `z-50` → `z-30` (design.md z-scale: modal = 50). |

### P1 — important
| Page | Problem | Fix |
|---|---|---|
| All (phone) | No bottom navigation; every move went through a 16-item drawer. | `MobileBottomNav`: home, groups, members, reports (check-in for roles without reports), menu. |
| Sidebar | 16 entries in 4 groups; three near-identical import labels. | 6 groups by task; "นำเข้าจาก Excel" and "ข้อมูลที่ส่งเข้ามา" replace the old labels everywhere. |
| Home | Promotional hero; nothing about the church. | Greeting, search, and an organisation snapshot (bodies, care groups, members) from `/api/org/overview`. |
| Home (phone ≤ 390) | The "needs attention" card was wider than the screen and clipped. | `min-w-0` on the grid cards, wrapping labels. |
| Groups, Feed, Members | Filters stacked down the phone screen before the first result. | Shared `FilterDisclosure` (one "ตัวกรอง (n)" button on phones, inline from 640 px). |
| Groups | Cards printed raw import text. | Cards show level, body, area and the care leader only. |
| Members | Seven columns, most cells "-" or identical. | Four columns; contact, gender and birth date fold into the name line when present. |
| Feed | 463 checkboxes with no way to search. | Search box above the list; selected people stay visible. |
| Map | A grey, empty map when no group has coordinates. | Explains why and offers "ดูเป็นรายการ". |
| Org structure | No view of ศบ. → body → care → member. | `/org` (read-only) with member side sheet. |

### P2 — consistency
| Item | Fix |
|---|---|
| `window.confirm` on member logout | In-app `ConfirmDialog` (now with `tone`, `busyLabel`, `details`). |
| Privacy / Terms links 15–20 px tall | 44 px targets. |

## Deferred (not done, with reason)
- Reports date inputs show `mm/dd/yyyy`: browser locale, needs a Thai date input component.
- Reports "joined in this period: 463": all members carry the import date; needs real join dates.
- Care-leader names (หนค.) and member details are stored as text lines (`groups.description`,
  `members.notes`) and read back by `shared/orgView.ts`. A migration with real columns is the
  proper fix.
- Role-management screen: the first admin is bootstrapped through `BOOTSTRAP_ADMIN_EMAILS`.
- Production runs Clerk in development mode (the Clerk widget says so): switch keys before launch.
- Thai font: the Prompt web font could not be fetched in the test sandbox, so type rendering was
  not judged.
