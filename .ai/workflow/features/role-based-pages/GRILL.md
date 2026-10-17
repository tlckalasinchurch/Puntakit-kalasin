# GRILL — role-based-pages

Slug: `role-based-pages`  
Branch / worktree: `redesign/full-app-claude-20261015` · `C:\Users\Administrator\Desktop\Work\02-Worktrees\puntakit-claude-redesign`  
Base commit when written: `666e9a3`  
Date: 2026-10-16  

> **เอกสารนี้บันทึกผลการสัมภาษณ์ (grill) เท่านั้น ไม่ใช่การอนุมัติให้ implement**  
> ตามกฎใน `CLAUDE.md` การอนุมัติทำโดยผู้ใช้เปลี่ยน `Status: draft` เป็น `Status: approved`  
> ใน `TICKETS.md` ด้วยตนเองเท่านั้น

---

## 1. ปัญหาและเป้าหมายที่ตกลงกัน (Settled Problem)

ผู้ใช้ต้องการให้ระบบ Puntakit นำเสนอประสบการณ์หน้าจอที่เหมาะสมกับความรับผิดชอบของแต่ละกลุ่มผู้ใช้ โดย:
1. ใช้ระบบ Role ที่มีอยู่จริงในระบบ (`USER_ROLES`) ไม่เพิ่ม Role หรือสร้าง Permission ซ้ำซ้อน
2. จัดกลุ่มทางลัดหน้าแรก (`HomeMyWork` / Quick Action Tiles) ให้แต่ละบทบาทเห็นงานสำคัญของตนเองเป็นหลัก (Mobile-first, Quick actions first)
3. แก้ปัญหา Data Scope ความไม่สอดคล้องกันระหว่าง `/care` (ซึ่งเดิมมองไม่เห็นแคร์ลูก) กับ `/memberships` (ที่เห็นแคร์ลูก) เพื่อให้หัวหน้าบอดี้ติดตามงานกลุ่มในความรับผิดชอบได้จริง
4. รักษา Design System V2 เดิม: ใช้ฟอนต์ Prompt, โทเค็นสีเดิม `--color-primary: #0c7c82`, Touch target ≥ 44px, Contrast ≥ 4.5:1

---

## 2. ข้อเท็จจริงเริ่มต้นที่ตรวจแล้ว (VERIFIED เมื่อ 2026-10-16)

| ข้อเท็จจริง | หลักฐาน (ไฟล์:บรรทัด) |
|---|---|
| ระบบมี Role เดียวผ่าน enum `USER_ROLES` 7 ค่า (`super_admin`, `admin`, `ministry_leader`, `group_leader`, `staff`, `member`, `viewer`) | `shared/schema.ts:30-39` |
| Canonical role sets ประกาศไว้ที่เดียวและใช้ร่วมกันทั้ง client/server | `shared/roles.ts:18-128` |
| "หัวหน้าบอดี้" และ "หัวหน้าแคร์" ไม่ใช่ Role แต่เป็น Data Scope ของ `group_leader` | `server/lib/membershipScope.ts:11-24`, `server/lib/careScope.ts:10-18` |
| ไม่มี Role `coordinator`, `pastor`, หรือ `team_leader` ในระบบ | `shared/schema.ts:30-39` |
| ไม่มีหน้าจอ/API สำหรับ Audit Logs (ตาราง write-only), System Settings (stub `ComingSoon`), Security, Handover, Schedule, Team Performance | `client/src/App.tsx:257-266`, `server/routes/*` |
| แบบอักษรของระบบคือ `Prompt` (ไม่มี Sarabun ใน CSS หรือ font loader) | `client/src/index.css:5` |
| โทเค็นสีหลักคือ `--color-primary: #0c7c82` (ไม่มีโทเค็น `#35B4B0` ใน `index.css`) | `client/src/index.css:12` |
| `membershipScope.ts` มี `withDescendantGroups()` แต่ `careScope.ts` ยังไม่มี ทำให้หัวหน้าบอดี้มองไม่เห็นแคร์ลูกใน `/care` | `server/lib/membershipScope.ts:34-55`, `server/lib/careScope.ts:20-38` |
| Baseline tests ผ่านทั้งหมด 65 ไฟล์ / 822 tests | รันจริง `pnpm test` เมื่อ 2026-10-16 |

---

## 3. การตัดสินใจที่ผู้ใช้ยืนยัน (Decision 1–6 เมื่อ 2026-10-16)

| # | ประเด็น | ผลการตัดสินใจของผู้ใช้ |
|---|---|---|
| **D1** | **ผู้ประสานงาน (Coordinator)** | **เลือก ก: ใช้ Role เดิมที่มีอยู่**<br>- ใช้ `staff` สำหรับงานประสานงานทั่วไปตามขอบเขตที่ได้รับมอบหมาย<br>- ใช้ `group_leader` เฉพาะกรณีทำงานภายในกลุ่มที่รับผิดชอบ<br>- ห้ามเพิ่ม Role `coordinator` หรือ Migration ในรอบนี้ |
| **D2** | **หัวหน้าทีม (ศบ. / อาจารย์)** | **เลือก ก: ใช้ Role เดิมที่มีอยู่**<br>- ตรวจสอบ `ministry_leader` ก่อน หากไม่รองรับให้พิจารณา `staff` พร้อม Scope ที่เหมาะสม<br>- ห้ามให้ `admin` อัตโนมัติเพียงเพื่อให้เข้าถึง Dashboard หรือรายงาน<br>- ห้ามสร้าง Role `pastor` หรือ `team_leader` |
| **D3** | **แบบอักษร (Typography)** | **เลือก ก: ใช้ Prompt ต่อไป**<br>- คง Font Token และรูปแบบเดิม ไม่เปลี่ยนเป็น Sarabun เพื่อรักษา Layout และเสถียรภาพ |
| **D4** | **โทเค็นสี (Color Token)** | **เลือก ก: คง Design System เดิม**<br>- ใช้ `--color-primary: #0c7c82` ตามเดิม ไม่เพิ่มโทเค็น `#35B4B0` |
| **D5** | **Care Data Scope (ปัญหาข้อ 3)** | **เลือก ก: จัดทำแนวทางแก้ `careScope.ts` ให้รองรับ descendant groups**<br>- เป้าหมายให้หัวหน้าบอดี้เข้าถึงสมาชิกในกลุ่มลูกได้ถูกต้อง<br>- ต้องระบุ Scope ชัดเจน, มี Tests ครอบคลุมกลุ่มลูกและปฏิเสธกลุ่มอื่น, ห้ามขยายเป็นเห็นทุกกลุ่ม<br>- แยกเป็น Ticket ชัดเจน และห้ามแก้ Backend จนกว่า Ticket จะได้รับอนุมัติ |
| **D6** | **ลำดับการพัฒนา (Implementation Order)** | **เลือก ก: ทำ HomeMyWork / Quick Action Tiles แบบ Vertical Slice ก่อน**<br>- เริ่มจากหน้าแรกและไทล์ทางลัดตามบทบาทจริง โดย Reuse API เดิม<br>- ห้ามรื้อ Sidebar และ Routing ของทุกบทบาทพร้อมกันในรอบนี้ |

---

## 4. ข้อจำกัดและกฎเหล็ก (Guardrails)

1. ทำงานใน Feature Worktree เดิม (`redesign/full-app-claude-20261015`) ห้ามแตะ branch อื่น
2. ห้าม Merge, Push หรือ Deploy โดยไม่ได้รับอนุมัติ
3. ห้ามเปลี่ยน Role Schema, API Authorization หรือ Business Logic นอกขอบเขตที่อนุมัติ
4. ห้ามทับหรือ Revert งานเดิม (รวมทั้ง `stash@{0}` และงาน login ค้างเดิม)
5. ใช้ข้อมูลจริง ห้ามสร้าง Mock Data
6. จัดทำเอกสาร `GRILL.md` → `SPEC.md` → `TICKETS.md` (ทุก Ticket เป็น `Status: draft`) แล้วหยุดรอผู้ใช้อนุมัติ
7. ห้ามเริ่ม Implementation ใน Phase B จนกว่าผู้ใช้จะเปลี่ยน Status เป็น `approved` ในไฟล์ `TICKETS.md` ด้วยตนเอง
