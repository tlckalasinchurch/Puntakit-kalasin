# GRILL — home-card-membership-ux

Slug: `home-card-membership-ux`
Branch / worktree: `redesign/full-app-claude-20261015` · `C:\Users\Administrator\Desktop\Work\02-Worktrees\puntakit-claude-redesign`
Base commit when written: `666e9a3`
Date: 2026-10-16

> เอกสารนี้บันทึกผลการสัมภาษณ์ (grill) เท่านั้น **ไม่ใช่การอนุมัติให้ implement**
> ตามกฎใน `CLAUDE.md` การอนุมัติทำโดยผู้ใช้เปลี่ยน `Status: draft` เป็น `Status: approved`
> ใน `TICKETS.md` ด้วยตนเอง

## 1. ปัญหาที่ตกลงกัน (settled problem)

ผู้ใช้ต้องการยกระดับ UI/UX ของระบบตามแนวทาง "Quick Actions First":

1. เมื่อหัวหน้าแคร์/หัวหน้าบอดี้ล็อกอิน หน้าแรกต้องมีไอคอนทางลัดที่ใช้บ่อยขึ้นก่อน
   (เช็คชื่อ, อัปเดตภาพพันธกิจ, สถานะสมาชิก) ไม่ใช่เมนูรอง
2. ลดน้ำหนักของกรอบ UI ให้ไอคอนตรงกลางเด่นขึ้น ตัดไอคอนตกแต่ง ใช้ "ดูทั้งหมด" สำหรับรายการรอง
   เพิ่มพื้นที่กด หัวข้อใหญ่ขึ้น และแบ่งหมวดด้วย spacing ที่ชัด
3. บัตรสมาชิกต้องดูเหมือนบัตรจริง (เขียวมรกต + ทอง) อ่านจากทะเบียนสมาชิก และเมื่อแก้รูปในทะเบียน
   บัตรต้องแสดงรูปใหม่
4. สถานะสมาชิกรายปี (วิสามัญทดลองฟรี 1 ปี / สามัญ 100 บาทต่อปี) ต้องให้หัวหน้าแคร์
   และหัวหน้าบอดี้เห็นอย่างชัดเจนว่าสมาชิกแต่ละคนอยู่สถานะใด

## 2. ข้อเท็จจริงเริ่มต้นที่ตรวจแล้ว (VERIFIED เมื่อ 2026-10-16)

| ข้อเท็จจริง | หลักฐาน |
|---|---|
| ฟังก์ชันตาม brief **มีครบแล้ว** ใน HEAD และ `origin/main` (commit `84988a1`, 2026-10-10) | `git cat-file -e` ของ `server/routes/{memberships,memberCards,home}.ts`, `HomeMyWork.tsx`, migration `0012` ทุกไฟล์ yes |
| route ถูก mount | `server/app.ts:82-85` (`/api/member-cards`, `/api/memberships`, `/api/media`, `/api/home`) |
| `docs/features/membership-lifecycle.md` อธิบายโมเดลข้อมูล กฎ และตารางสิทธิ์ | อ่านทั้งไฟล์ |
| หน้าแรกมีไทล์ 4 อัน, ลิงก์ "ดูทั้งหมด" (disclosure), สถิติ, แถบภาพล่าสุด | `client/src/components/home/HomeMyWork.tsx:115-224` |
| ชีตอัปโหลดภาพพันธกิจใช้ `prepareImage`, `POST /api/media`, `POST /api/activities` | `MissionPhotoSheet.tsx:77-144` |
| บัตรสมาชิกใช้สีเขียวมรกต+ทองอยู่แล้ว (`--card-emerald-*`, `--card-gold-*`) | `client/src/index.css:1974-1981` (`.pk-card`) |
| บัตรอ่านข้อมูลจากทะเบียนเท่านั้น ไม่มี contact ใด ๆ | `MemberCard.tsx`, test `membership-ui.test.ts:79-90` |
| หน้า `/memberships` มีแท็บ, ค้นหา, รายการ, modal `MembershipPanel` | `client/src/pages/Memberships.tsx` |
| `MemberCardPanel` ถูกใช้ใน `MemberDetailModal.tsx:158` | `grep` |
| ไม่พบ branch `port/ui-p1-p2`, `master`, `D59` ทั้ง local/remote และเอกสาร | `git branch -a`, `git ls-remote --heads origin`, `grep -rn D59` |
| ไม่พบไฟล์ `C:\Users\Administrator\Desktop\Work\member Card.png` | `ls` |
| ไม่มี test ที่ render React component (ไม่มี jsdom/RTL) | `CLAUDE.md`, `USER-FLOW-AUDIT.md` X-01 |
| Baseline test ก่อนเริ่ม | `pnpm test` = 64 files / 796 tests ผ่าน (รันเมื่อ 2026-10-16 ที่ `666e9a3`); `pnpm check` และ `pnpm build` ผ่าน |
| 21st.dev MCP ไม่มีใน session นี้ | ไม่อยู่ในรายการเครื่องมือ |

## 3. การตัดสินใจที่ผู้ใช้ยืนยัน (2026-10-16)

| # | การตัดสินใจ |
|---|---|
| D1 | ปรับปรุงของที่มีอยู่ **ไม่สร้าง schema, migration หรือ API ใหม่** (ถ้าพบช่องว่างจริงต้องหยุดถามผู้ใช้) |
| D2 | ทำตามกฎใน `CLAUDE.md`: grill → spec → tickets → ผู้ใช้เปลี่ยน Status เอง → implement |
| D3 | ทำใน branch `redesign/full-app-claude-20261015` ไม่ commit ไม่ push ไม่ deploy ในงาน implement รอบนี้ รักษาไฟล์ค้างเดิมและ `stash@{0}` |
| D4 | ทางลัดหน้าแรก: หัวหน้าแคร์/บอดี้ได้ไทล์หลัก 3 อัน (เช็คชื่อวันนี้, อัปเดตภาพพันธกิจ, สถานะสมาชิก) ไอคอนใหญ่ตรงกลาง กรอบบาง พื้นที่กด ≥44px "การติดตามและเมนูอื่น" อยู่ใต้ "ดูทั้งหมด" เป็นข้อความไม่มีไอคอน ทางลัดอยู่เหนือเมนูหลัก/เนื้อหารอง |
| D5 | บัตรสมาชิก: ใช้บัตรเดิมเป็นฐาน ปรับให้เหมือนบัตรจริงขึ้น (เขียวมรกต+ทอง) เฉพาะบัตร ส่วนอื่นของแอปยังเป็น teal ข้อมูลบนบัตรมาจากทะเบียน ไม่แสดงเบอร์โทร/อีเมล |
| D6 | รอบแรกครอบคลุม 4 จุด: หน้าแรก, ชีตอัปโหลดภาพพันธกิจ, `MemberCard`, หน้า `/memberships` (หน้าอื่นปรับในรอบถัดไป) |
| D7 | แก้ `client/src/index.css` โดย **เพิ่มบล็อก CSS ใหม่เท่านั้น** ไม่แก้บล็อกเดิม |
| D8 | คงสิทธิ์และ business logic เดิมทั้งหมด (ตามตารางใน `docs/features/membership-lifecycle.md`) |

## 4. ข้อจำกัดและข้อห้าม

- ห้ามเพิ่ม/แก้ schema, migration, API route; ห้ามเปลี่ยน role, permission หรือ business logic
- ห้ามเรียกคืน/แตะ `stash@{0}` (HOLD member submission group)
- ห้าม stage, commit, push, deploy; ห้ามเขียนข้อมูล production; ห้าม apply migration
- ห้ามแก้ไฟล์ค้างเดิมโดยไม่รายงาน: `CLAUDE.md`, `client/src/pages/PinSignInPage.tsx` ห้ามแตะ;
  `client/src/index.css` แก้ได้เฉพาะ **เพิ่มบล็อกใหม่ท้ายไฟล์** และต้องรายงาน diff
- ห้ามสร้างข้อมูลตัวอย่างในระบบจริง; ข้อมูลทดสอบใช้ PGlite ชั่วคราวใน `%TEMP%` เท่านั้น ไม่แตะ `.db_data`
- ห้ามเพิ่ม dependency (รวมถึง jsdom/React Testing Library) โดยไม่ขออนุมัติ
- ต้องคงนโยบายเบอร์โทร/อีเมลเดิม (บัตรและหน้าสถานะไม่แสดง contact)
- ต้องรองรับ mobile-first, light/dark, `prefers-reduced-motion`, keyboard focus

## 5. Test seams ที่ตกลง

1. **ฟังก์ชันบริสุทธิ์ `client/src/lib/homeTiles.ts`** (ใหม่ ไม่ใช่ API/schema) แปลง role → ชุดไทล์หลัก
   และรายการที่ย้ายไป "ดูทั้งหมด" ทดสอบด้วย vitest (node) เหมือน `homeLinks.test.ts`
2. **Contract test แบบ source-level** ใน `client/src/membership-ui.test.ts` (ปรับ assertion ที่ผูกกับ
   `min-h-28` และเพิ่มข้อกำหนดใหม่)
3. **Test เดิมที่ต้องผ่านโดยไม่แก้**: `server/routes/{homeOverview,mediaAndCards,memberships}.test.ts`,
   `shared/{membership,roles}.test.ts`, `client/src/{nav-structure,role-gate}-contract.test.ts`,
   `design-system-consistency.test.ts`, `design-tokens.test.ts`
4. **Browser (Playwright)** เป็น seam หลักสำหรับพฤติกรรมที่ render จริง เพราะไม่มี component render test

## 6. สิ่งที่ agent ตัดสินเอง (ต้องให้ผู้ใช้ตรวจตอนอนุมัติ)

- **ชุดไทล์ของ role อื่น:** ตอนถาม Q4 ผมระบุว่า admin/staff ใช้ "ภาพพันธกิจ, สถานะสมาชิก, การติดตาม" แต่โค้ดจริง
  แสดงไทล์ "เช็คชื่อกลุ่มดูแล" ให้ทุก role ใน `CREATE_ROLES` ด้วย (`HomeMyWork.tsx:133`)
  ผมตัดสินให้ role ที่ไม่ใช่ `group_leader` **คงชุดไทล์ที่แสดงอยู่ตอนนี้ทุกประการ** (ไม่เพิ่ม/ไม่ลดสิทธิ์)
  และปรับเฉพาะหน้าตา
- **บัตรเป็นสีเขียวมรกต+ทองอยู่แล้ว:** ตีความ D5 ว่าเป็นการยกระดับความเหมือนบัตรจริง (ความลึก, ประกายแสง,
  กรอบรูป, ความคมชัด) ไม่ใช่เปลี่ยนสี
- **CSS ใหม่ทับของเดิมด้วย cascade:** เพราะ D7 ห้ามแก้บล็อกเดิม การปรับ `.pk-card` ทำเป็นบล็อกใหม่ท้ายไฟล์
  ที่ override
- **ไฟล์ใหม่ 1 ไฟล์ + test 1 ไฟล์** สำหรับ seam ที่ 1 (`homeTiles.ts`, `homeTiles.test.ts`)

## 7. ประเด็นที่ยังเปิดอยู่ (ไม่ขวางการเขียน SPEC)

| ประเด็น | สถานะ |
|---|---|
| ภาพต้นแบบบัตร `member Card.png` ไม่พบ | ใช้บัตรเดิมเป็นฐาน ถ้าต้องการให้ตรงภาพแบบ pixel ผู้ใช้ต้องแนบไฟล์ภายหลัง |
| `port/ui-p1-p2`, `master`, `D59` ไม่พบ | ทำต่อจาก HEAD ปัจจุบัน ถ้าอยู่ที่อื่นผู้ใช้ต้องระบุที่อยู่ |
| blocker เดิมใน `docs/features/membership-lifecycle.md` ข้อ 1-9 (เช่น `ministry_leader` ไม่เห็นสถานะ, ใครบันทึกชำระเงิน, การเลขบัตรย้อนหลัง, asset ตราคริสตจักร, การ deploy migration) | **ไม่เปลี่ยน** อยู่นอกขอบเขตงานนี้ |
| `GET /api/dashboard/summary` ส่งยอดทั้งคริสตจักรให้ทุก role (A2) | อยู่นอกขอบเขต; ห้ามให้หน้าแรกของผู้นำเรียก endpoint นี้ |
