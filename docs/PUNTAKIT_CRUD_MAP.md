# Puntakit — CRUD map

Each row shows the page where a user performs the operation.
Role column: who sees the action. `admin` = super_admin and admin.

| Entity | Create | Read | Update | Delete | Role |
|---|---|---|---|---|---|
| บอดี้ (body) | `/groups` → "เพิ่มกลุ่ม", level = บอดี้. Shortcut: `/org` → "เพิ่มบอดี้" | `/org`, `/groups` | `/groups` → edit. Shortcut: `/org` → "แก้ไข/ลบบอดี้" | `/groups` → edit → delete. The API refuses (409) while a พันธกิจ remains in the body. | admin |
| พันธกิจ (care) | `/groups` → level = พันธกิจ + choose a body. Shortcut: `/org` → "เพิ่มพันธกิจ" | `/org` (body → พันธกิจ → members), `/groups`, `/care` | `/groups` → edit. Shortcut: pencil icon on the row in `/org` | `/groups` → edit → delete | admin |
| หัวหน้าบอดี้ / หัวหน้าพันธกิจ | `/groups` form field "หัวหน้า…" (member picker) | `/org`, `/care` | Same field | Clear the chip in the field | admin |
| Member | `/members` → "เพิ่มสมาชิก". Shortcut: `/org` → open a พันธกิจ → "เพิ่มสมาชิกใหม่ในพันธกิจนี้" | `/members`, `/org` side sheet, `/care` | `/members` → edit (includes the พันธกิจ picker) | `/members` → delete | staff, admin |
| Member ↔ พันธกิจ | The "พันธกิจ" field in the member form | `/org`, `/care` | Change the field | Clear the field | staff, admin |
| ฝ่ายงาน (ministry team) | `/ministries` | `/ministries` | `/ministries` | `/ministries` | per `shared/roles.ts` |
| Event, Announcement, Attendance | `/events`, `/announcements`, `/attendance`, `/care` | same pages | same pages | same pages | per page |

URL shortcuts used by the links above:
- `/groups?new=body`, `/groups?new=care&parent=<bodyId>`, `/groups?edit=<groupId>`
- `/members?new=1&care=<careId>`, `/members?care=<careId>`
