# Puntakit — UI audit แบบรายหน้า (per-route) · 2026-10-04

> จุดประสงค์: รวมผล audit เดิม 2 ฉบับ (`PUNTAKIT_UX_UI_AUDIT_2026-10.md`,
> `PUNTAKIT_UX_AUDIT_FULL_2026-10-03.md`) ให้เป็นตาราง **ราย route** พร้อมสถานะปัจจุบัน
> เพื่อให้เห็นชัดว่า **อะไรแก้แล้ว อะไรยังเปิดอยู่** ก่อนเริ่มงานรอบถัดไป
>
> แนวทางอ้างอิง: "AI-assisted แต่มีเอกลักษณ์ ใช้งานจริงได้ และเป็นระบบ" — warm editorial /
> church operations, ไทยเป็นหลัก, mobile-first, semantic color ชุดเดียว, ไม่มี AI slop
> (ไม่ไล่ gradient พร่ำเพรื่อ, ไม่การ์ดเต็มหน้าซ้ำกันทุกหน้า, ไม่ modal/ฟอร์มยาวเกินจำเป็น)

---

## ⚡ Update — Thai date input (implemented same day)

ข้อ 1 (Thai date input) ด้านล่าง **ทำเสร็จแล้ว** บน branch `feat/ui-system-refresh`:

- เพิ่ม `client/src/components/DateField.tsx` — date picker ไทย (react-day-picker + locale `th`,
  Buddhist year) แทน native `type="date"` ที่แสดง `mm/dd/yyyy` ตาม browser locale
- ใส่ใน 3 จุด: `Reports.tsx` (เริ่ม/สิ้นสุด), `Attendance.tsx` (วันที่รอบนมัสการ), `Members.tsx` (วันเกิด)
- แยก pure logic เป็น `client/src/lib/date.ts` + เทสต์ `client/src/lib/date.test.ts` (7 tests)
- Verification: `pnpm check` ✅ · `pnpm test` ✅ **403/403** · `pnpm build` ✅
  (`DateField` code-split แยก chunk 117 kB โหลดเฉพาะ 3 หน้า ไม่แตะ shared bundle)

เหลือ: ยืนยัน Prompt font + production regression (หลัง Clerk) — §3 ข้อ 2, 3

---

## 0. Baseline (ล็อกสถานะก่อนแก้)

ตรวจบน `main` @ `6e2c790` (clean tree, branch up-to-date กับ `origin/main`):

| Gate | คำสั่ง | ผล |
|---|---|---|
| Type-check | `pnpm check` | ✅ exit 0 |
| Test | `pnpm test` | ✅ **396 tests / 36 files** |
| Build | `pnpm build` | ✅ exit 0 (แจ้งเตือน chunk 594 kB / gzip 165 kB — ดู §6) |

ไม่มี `lint` script ใน repo นี้ (`pnpm check` คือ static gate เดียว ตาม `CLAUDE.md`).

### หลักฐานสถานะปัจจุบัน (วัดจาก source จริง ไม่ใช่แค่เชื่อ audit เดิม)

| ตรวจ | ผล |
|---|---|
| raw palette (`slate-*`, `blue-*`, `gray-*`, `rose-*`, …) ใน `pages/**` | ✅ **0 ครั้ง** (หนี้ palette เดิมหมดจริง) |
| micro-text `text-[9/10/11px]` / `fontSize: 9/10/11` | ✅ **0 ครั้ง** |
| hardcode hex ใน `pages/**` | ✅ เฉพาะสี QR code (`#272729`/`#ffffff` — จำเป็นต่อการสแกน, ตรงกับ graphite token) |
| `window.confirm` | ✅ ไม่เหลือ (ใช้ `ConfirmDialog` แทน) |
| Prompt font | ✅ โหลดผ่าน `<link>` ใน `client/index.html` + มี regression test คุม (`ux-audit-regressions.test.ts:270`) |

---

## 1. สรุปสั้น ๆ

**โค้ดปัจจุบัน "สะอาด" ในระดับ design-system เกือบทั้งระบบแล้ว** — งานส่วนใหญ่ในแผน
(design tokens, app shell, responsive primitives, empty/loading/error states, raw-palette)
**เสร็จแล้วจากรอบ audit ที่ผ่านมา** (batch A + batch F + org/CRUD round)

สิ่งที่**ยังเปิดอยู่จริง** เหลือแค่ 3 เรื่อง (เรียงตามผลกระทบ):

1. **Input วันที่ใช้ native `type="date"`** → แสดง `mm/dd/yyyy` ตาม locale ของเบราว์เซอร์
   (Reports, Attendance, Members) — มี label แล้ว แต่ฟอร์แมตไม่ไทย 100%
2. **การ render ฟอนต์ Prompt** ยังไม่เคยยืนยันบนเบราว์เซอร์จริง (sandbox โหลด Google Fonts
   ไม่ได้) — การ wiring ถูกต้องแล้ว เหลือแค่ยืนยันภาพ
3. **Production ยังไม่ถูก re-check** (หลัง Clerk) — checklist 13 ข้อใน §5

---

## 2. ตาราง audit ราย route

สัญลักษณ์: ✅ สะอาด (ยืนยันจาก source + Round 2 browser check) · ⚠️ มีของเหลือ ·
⏳ ต้องยืนยันบน production เท่านั้น

### 2.1 Shell หลัก

| Route | ปัญหา | ระดับ | แนวทางแก้ | ไฟล์ที่เกี่ยวข้อง |
|---|---|---|---|---|
| (Shell) Sidebar | ✅ แก้แล้ว — เดิม 15 รายการ/3 กลุ่ม, ป้าย "ใหม่"/"PWA", 288px, `<button>` | — | จัดเป็น 6 กลุ่มตามงาน, `<Link>` + `aria-current`, 240px, role-gate | `components/layout/Sidebar.tsx` |
| (Shell) Topbar | ✅ แก้แล้ว — เดิม bell ปลอม badge 0 | — | ลบ bell; เหลือ search + theme + account | `components/layout/Topbar.tsx` |
| (Shell) Mobile nav | ✅ แก้แล้ว — เดิมไม่มี bottom nav | — | `MobileBottomNav` 4-5 target + เมนู | `components/layout/MobileBottomNav.tsx` |
| (Shell) AppLayout | ✅ แก้แล้ว — skip link, `overflow-x-hidden`, `pb-24` กันชน nav | — | — | `components/layout/AppLayout.tsx` |
| (Global) Typography | ✅ token ครบ (`.type-*`), Prompt thai-first | — | — | `client/src/index.css` |

### 2.2 หน้าข้อมูล

| Route | ปัญหา | ระดับ | แนวทางแก้ | ไฟล์ที่เกี่ยวข้อง |
|---|---|---|---|---|
| `/` (Dashboard) | ✅ แก้แล้ว — เดิม hero โปรโมชัน + "SYSTEM PULSE" นำหน้า | — | เป็น operational summary: ทักทาย + search + quick action + สิ่งที่ต้องดูแลก่อน, system status ไปท้ายสุด | `pages/Home.tsx` |
| `/members` | ⚠️ ฟอร์ม `type="date"` (แก้ไขข้อมูล) | ต่ำ | แทน native date ด้วย Thai date picker (`react-day-picker` มีแล้ว) | `pages/Members.tsx:975` |
| `/members` (ตาราง) | ✅ แก้แล้ว — เดิม 8 คอลัมน์ล้นจอ | — | เหลือ 4 คอลัมน์, พับเป็นรายการบนมือถือ | `pages/Members.tsx` |
| `/groups` | ✅ แก้แล้ว — เดิม 3-4 ปุ่มแข่งกัน, inline hex | — | 1 primary action ต่อการ์ด, token ล้วน | `pages/Groups.tsx` |
| `/org` (ผังองค์กร) | ✅ สร้างแล้ว — เดิมไม่มี view ศบ.→body→care→member | — | read-only + member side sheet | `pages/OrgChart.tsx` |
| `/map` | ✅ แก้แล้ว — เดิม map เทาว่าง | — | อธิบายเหตุ + ปุ่ม "ดูเป็นรายการ" | `pages/Map.tsx` |

### 2.3 หน้าปฏิบัติงาน

| Route | ปัญหา | ระดับ | แนวทางแก้ | ไฟล์ที่เกี่ยวข้อง |
|---|---|---|---|---|
| `/attendance` | ⚠️ ฟอร์ม `type="date"` | ต่ำ | Thai date picker | `pages/Attendance.tsx:488` |
| `/attendance` (tabs) | ✅ แก้แล้ว — เดิม label ปนอังกฤษ + 36px input + 10px header | — | label ไทย, 44px, ฟอนต์ ≥12px | `pages/Attendance.tsx` |
| `/feed` | ✅ แก้แล้ว — เดิม 463 checkbox ไม่มีค้นหา, fetch 400 | — | search + selected อยู่ + `fetchAll` limit 100 | `pages/Feed.tsx`, `lib/fetchAll.ts` |
| `/follow-up` | ✅ แก้แล้ว — เดิม empty state dead-end | — | EmptyState มี action | `pages/FollowUps.tsx` |
| `/inbox` | ✅ แก้แล้ว | — | token + EmptyState | `pages/Inbox.tsx` |
| `/events` / `/worship` | ✅ แก้แล้ว | — | token ล้วน | `pages/Events.tsx` |
| `/care` (เช็คชื่อแคร์) | ✅ แก้แล้ว — clay surfaces opt-in, ปุ่ม 44px | — | — | `pages/CareToday.tsx` |
| `/announcements` | ✅ แก้แล้ว | — | token + EmptyState action | `pages/Announcements.tsx` |
| `/import`, `/import/org`, `/import/duplicates` | ✅ แก้แล้ว — label ไม่ซ้ำ | — | "นำเข้าจาก Excel" / "ข้อมูลที่ส่งเข้ามา" | `pages/Import*.tsx` |

### 2.4 หน้าระบบ + สาธารณะ + member PWA

| Route | ปัญหา | ระดับ | แนวทางแก้ | ไฟล์ที่เกี่ยวข้อง |
|---|---|---|---|---|
| `/reports` | ⚠️ ฟอร์ม `type="date"` | ต่ำ | Thai date picker | `pages/Reports.tsx:117,130` |
| `/reports` (joined this period) | ✅ แก้แล้ว — เดิมโชว์ 464 = total เสมอ | — | แสดงเฉพาะเมื่อเลือกช่วงวันที่ | `pages/Reports.tsx:161` |
| `/profile` | ✅ แก้แล้ว — `window.confirm` → `ConfirmDialog` | — | — | `pages/Profile.tsx` |
| `/ministries`, `/church` | ✅ แก้แล้ว | — | token ล้วน | `pages/Ministries.tsx`, `pages/Church.tsx` |
| `/media`, `/settings` | ✅ (stub) — ลบออกจากเมนูแล้ว, route เก็บไว้กัน 404 | — | ต่อเมื่อ feature จริงมา | `pages/ComingSoon.tsx` |
| `/privacy`, `/terms` | ✅ แก้แล้ว — target 15-20px → 44px | — | — | `pages/Privacy.tsx`, `pages/Terms.tsx` |
| `/login`, `/signup` | ✅ Clerk Thai localization | — | — | `pages/ClerkSignInPage.tsx`, `ClerkSignUpPage.tsx` |
| `/app/*` (member PWA 5 หน้า) | ✅ แก้แล้ว — ลบ inline blue ~700 บรรทัด, bottom nav semantics, safe-area | — | — | `pages/member/*`, `components/layout/MemberAppLayout.tsx` |
| `/404` | ✅ แก้แล้ว | — | — | `pages/NotFound.tsx` |

---

## 3. ของเหลือที่ต้องทำจริง (prioritized)

| # | งาน | ระดับ | หมายเหตุ |
|---|---|---|---|
| 1 | **Thai date input** — แทน `type="date"` 3 จุดด้วย component กลางที่ใช้ `react-day-picker` (มี dependency แล้ว, `ui/calendar.tsx` มีแล้ว) แล้ว render ไทย | ต่ำ-กลาง | กระทบ Reports / Attendance / Members; ควรทำเป็น `DateField` ใน `DesignSystem.tsx` เพื่อ reuse |
| 2 | **ยืนยัน Prompt font** บน preview/production จริง (ไทย 400–800) | ต่ำ | wiring ถูกแล้ว เหลือแค่ visual confirm |
| 3 | **Production regression pass** หลัง Clerk — รัน checklist §5 บน `puntakit-kalasin.vercel.app` | กลาง | ต้องมีบัญชีจริง/ทดสอบ; demo mode ใช้แทนได้แต่ไม่เทียบเท่า production |

### ของที่ "defer" (ไม่ใช่ bug UI — อย่าเพิ่งทำในรอบนี้)

- Care-leader / member details เก็บเป็น text lines (`groups.description`, `members.notes`) → ต้อง migration คอลัมน์จริง (งาน data-model ไม่ใช่ UI)
- หน้าจัดการ role → ปัจจุบัน bootstrap ผ่าน `BOOTSTRAP_ADMIN_EMAILS` (งาน RBAC feature)
- Production ยังรัน Clerk ใน dev mode → สลับ key ก่อน launch (งาน config)

---

## 4. Checklist ที่ user ระบุ — สถานะ

| ตรวจ | สถานะ |
|---|---|
| ทุก route เปิดได้จริง | ⏳ source routing ถูก; ต้องยืนยันบน production |
| ไม่มี console error | ⏳ ต้องยืนยันบน production |
| ไม่มี request 404/500 | ⏳ (P0 fetch-limit 400/500 ถูกแก้ใน code แล้ว — `lib/fetchAll.ts`) |
| ไม่มี horizontal overflow บนมือถือ | ✅ Round 2: "no overflow on any route" @ 390/1280 |
| ปุ่มทุกปุ่มกดได้ด้วยนิ้ว (≥44px) | ✅ shell + primitives ใช้ `min-h-11`/`size-11` |
| input มี label | ✅ `Field` component ผูก label/hint/error อัตโนมัติ |
| ตารางใช้งานบนมือถือได้ | ✅ Members → responsive list |
| loading ไม่ทำให้ layout กระโดด | ✅ token skeleton ตรง surface จริง |
| empty state มีคำแนะนำ | ✅ `EmptyState` มี title + description + action |
| error state มี retry / วิธีแก้ | ✅ `ErrorState` friendly Thai + `technical` disclosure + retry |
| refresh หน้า detail ไม่พัง | ⏳ detail เป็น modal (member/group) — ต้องยืนยัน production |
| back/forward browser ทำงาน | ⏳ wouter SPA — ต้องยืนยัน production |
| สิทธิ์ไม่รั่วข้อมูลเกินจำเป็น | ✅ role-gate nav + server 401/403 จาก `shared/roles.ts` ชุดเดียว |

---

## 5. แผนดำเนินงานที่แนะนำ (แคบลงจากแผนเดิม เพราะงานหลักเสร็จแล้ว)

```text
1. (เล็ก) เพิ่ม DateField ไทยใน DesignSystem.tsx → ใช้ใน Reports / Attendance / Members
2. (เล็ก) ยืนยัน Prompt font + production regression (checklist §4) บน Vercel
3. (เล็ก) พิจารณา split main chunk 594 kB ถ้าต้องการ (manualChunks) — เป็น perf ไม่ใช่ UI
4. (data-model, แยกงาน) migration คอลัมน์ care-leader / member details จริง
5. (config) สลับ Clerk เป็น production key + ทำ role-management UI
```

ไม่มีงาน "เปลี่ยนสีทั้งเว็บ" หรือ "ทำ shell ใหม่" เหลือ — ระบบ tokens + shell + responsive
primitives อยู่ในสถานะเสถียรแล้ว ไม่ควรแตะเพื่อ "ทำให้ดูใหม่" โดยไม่มีเหตุผลเชิงผู้ใช้
