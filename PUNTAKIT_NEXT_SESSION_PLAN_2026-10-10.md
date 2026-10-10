# Puntakit — แผนงาน Session ถัดไป (เขียนปิดงาน 2026-10-09)

> **ถึง AI ที่เปิด repo นี้ใน session ใหม่:** อ่านไฟล์นี้ให้ครบก่อนทำอะไร แล้วทำงานต่อตามหัวข้อ 6 โดยไม่ต้องให้ผู้ใช้อธิบายซ้ำ ไม่ถามในสิ่งที่ไฟล์นี้หรือ repo ตอบได้ ถ้าไฟล์นี้ขัดกับ `PUNTAKIT_NEXT_SESSION_HANDOFF_2026-10-09.md` (เขียนโดยบุคคล/AI อื่น) ให้ยึดไฟล์นี้ — โดยเฉพาะข้อ W4 ซึ่งใน handoff เดิมยังเป็นตัวบล็อก แต่ **ตัดสินแล้ว** ณ ตอนปิดงาน ห้ามแก้ handoff เดิม
>
> สถานะที่เขียนไว้ **ไม่ใช่การตรวจสด** ให้ตรวจ `git status --short` กับไฟล์จริงก่อนเชื่อ

---

## 1. กฎห้ามละเมิด (ผู้ใช้กำกับไว้ตลอดวัน)

1. ตรวจ `git status --short` ก่อนแก้ไฟล์ใด และเทียบกับหัวข้อ 3
2. **ห้าม** discard / revert / reset / overwrite การเปลี่ยนแปลงที่มี ห้ามลบไฟล์ที่ไม่ได้สร้างเอง
3. **ห้ามแตะ** `README.md` และ `puntakit-readme.patch` (เป็นงานของผู้อื่น)
4. **ห้าม** commit / push / merge / deploy จนกว่าผู้ใช้อนุมัติแยกต่างหากในข้อความนั้น ๆ
5. **ห้ามแก้** application code, shared security code, schema, migration หรือข้อมูลจริง และห้ามรัน migration — งานปัจจุบันเป็นงานเอกสารและการตรวจรับ
6. **ห้ามเข้า/เขียน production** ห้ามเดา credentials ห้ามนำข้อมูลส่วนบุคคลมาในแชต
7. **ห้ามเปลี่ยน ADR 002–004 เป็น `accepted`** เอง
8. **ห้ามเริ่ม Q13** (ปรับหน้า Member PWA อีก 4 หน้า: `MemberEvents` → `MemberGroup` → `MemberAttendance` → `MemberProfile`) จนกว่าผู้ใช้รับรองภาพ `MemberHome` **และ** สั่งแยกต่างหาก
9. **ห้ามถือว่าตัวเลข 6 บอดี้ / 20 แคร์ / 52 กลุ่ม / 49 กลุ่มที่ทำได้จริงถูกตรวจสอบแล้ว** — `NOT VERIFIED` จนกว่ามีหลักฐานต้นทาง
10. ห้ามแก้ `ARCHITECTURE.md` §10 จนกว่า ADR เป็น `accepted` และส่วนนั้นถูก implement (แผนแก้อยู่ที่ `Work\_review-docs-round\ARCHITECTURE-s10-followup.md`)
11. ห้ามอ้างว่าได้รัน test/build/ตรวจภาพ ถ้ายังไม่ได้รันใน session นั้น ห้ามกล่าวว่า "ผ่าน" โดยไม่มีหลักฐาน และห้ามเขียนข้อความที่อ้างว่าระบบสอดคล้อง PDPA
12. ผู้ใช้ **ไม่ต้องการ** ให้เลือกแทนในเรื่องที่ต้องตัดสินใจ — เสนอทางเลือกพร้อมผลกระทบที่ตรวจพบจริง ผู้ใช้เป็นผู้ตัดสิน
13. ผู้ใช้ตอบเป็นภาษาไทย ตอบกลับเป็นภาษาไทย

## 2. ภาพรวมสองงานที่ค้างอยู่

**งาน A — Member PWA (หน้า `MemberHome` + shell):** ทำเสร็จทางเทคนิค **ยังรอผู้ใช้ตรวจรับภาพ** (ผู้ใช้ยังไม่ได้ตอบ Q21 "ผ่าน/ไม่ผ่าน") — ดูหัวข้อ 4

**งาน B — ข้อกำหนดผลิตภัณฑ์งานบริหารพันธกิจ (เอกสารล้วน):** โครงสร้างองค์กร 3 ระดับ, สิทธิ์ตามสายบังคับบัญชา, รายงานรายสัปดาห์, สถิติ ข้อกำหนดอยู่ใน **ADR 002–004** (ทั้งหมด `proposed`) — ดูหัวข้อ 5 ผู้ใช้ตัดสินแล้วว่าไม่ปรับหน้าเว็บต่อจนกว่าข้อกำหนดนี้ชัด

## 3. สถานะ repo ณ เวลาปิดงาน (ตรวจจริง `git status --short`, HEAD `3afed5b`, ไม่มี commit ใหม่)

```
 M AGENTS.md                                  ← งาน B (เพิ่มแถวตัวชี้ §1 + §6.10)
 M PRD.md                                     ← งาน B
 M docs/PUNTAKIT_MISSION_DOMAIN_PLAN.md       ← งาน B (ข้อความกำกับ + ป้าย [ADR-conflict])
 M docs/README.md                             ← งาน B
 M docs/adr/README.md                         ← งาน B
?? docs/adr/adr-002.md  adr-003.md  adr-004.md ← งาน B (ใหม่ — proposed)
 M client/src/components/layout/MemberAppLayout.tsx ← งาน A
 M client/src/pages/member/MemberHome.tsx           ← งาน A
?? client/src/components/MemberList.tsx             ← งาน A (ใหม่)
?? CLAUDE.md                                        ← สร้างโดย /init
?? PUNTAKIT_NEXT_SESSION_HANDOFF_2026-10-09.md      ← handoff เดิม (ไม่ใช่ของไฟล์นี้)
?? PUNTAKIT_NEXT_SESSION_PLAN_2026-10-10.md         ← ไฟล์นี้
 M README.md                                  ← ไม่ใช่ของเรา ห้ามแตะ
?? puntakit-readme.patch                      ← ไม่ใช่ของเรา ห้ามแตะ
?? .github/copilot-instructions.md, _tmp_1984_…   ← มีอยู่ก่อน ห้ามลบ
```

ไฟล์ gitignored ที่มีอยู่: `.env.local` (ค่า demo local ล้วน ไม่มี secret), `.db_data/` (ฐานข้อมูล PGlite local พร้อมแถวทดสอบ ชื่อขึ้นต้น "ข้อมูลทดสอบ:" และสมาชิก `ทดสอบ ระบบสาธิต`) — **เก็บไว้จนกว่าตรวจรับ Member PWA เสร็จ** (ผู้ใช้ตกลงไว้) ห้ามลบ ห้ามนำไปใช้กับ production

## 4. งาน A — Member PWA

**สิ่งที่ทำแล้ว:** shell (`MemberAppLayout`: ความสูงแถบเมนูจากค่าเดียว `NAV_HEIGHT=72`, safe-area, scroll-padding กัน focus ถูกบัง, ป้ายแท็บ 14px, เอาเงา literal ออก), หน้า `MemberHome` (QR เป็นจุดเด่นเดียว กรอบ 140px รูป 116px, รายการแบบ grouped จาก `MemberList.tsx`, ชื่อกิจกรรม/ประกาศ `type-body`, ปุ่มลงทะเบียนสีเขียวเฉพาะกิจกรรมถัดไปที่ยังลงทะเบียนได้ ที่เหลือเป็นปุ่มเส้นขอบ)

**ผลตรวจล่าสุดที่รันจริง (วันที่ 2026-10-09 — session ใหม่ต้องรันซ้ำก่อนอ้าง):** `tsc` ผ่าน · `vitest` 42 ไฟล์ / 528 tests ผ่าน (`TZ=UTC`) · `vite build` + `esbuild` server ผ่าน · วัดใน Chromium ที่ 360×740 และ 390×844: ไม่มี horizontal scroll, เนื้อหาท้ายหน้าไม่ถูกเมนูบัง (จำลอง safe-area 34px), ไม่มีปุ่มเล็กกว่า 44px, contrast ข้อความต่ำสุด 5:1, focus ไม่ถูกเมนูบัง · QR ถอดรหัสจากภาพ render ได้ตรงกับ token (jsQR) quiet zone ≈ 4.2 module

**`NOT VERIFIED`:** สแกน QR ด้วยกล้องมือถือจริง · safe-area บน iPhone จริง · dark mode · screen reader · Safari/Firefox · กรณีปุ่มลงทะเบียนเมื่อลงทะเบียนครบ/ยังไม่ลงทะเบียนเลย (ภาพเห็นเฉพาะกรณีลงทะเบียนแล้ว 1 จาก 3) · ผลของปุ่มถึง DB จริง (ตรวจแค่ว่าเรียก endpoint ถูกตัว) · `pnpm install --frozen-lockfile` (ไม่ได้รัน; เครื่องนี้ไม่มี `pnpm` บน PATH)

**ภาพสำหรับตรวจรับ** (ไฟล์อยู่ใต้ `Work\_shots-member-home\`): `contact-sheets\contact-sheet-1-this-round.png` (รอบล่าสุด 6 มุมมอง), `contact-sheets\contact-sheet-2-vs-original.png` (โค้ดเดิมเทียบล่าสุด), ภาพต้นฉบับใต้ `compare\` — เมื่อต้องแสดงให้ผู้ใช้ ให้เปิดไฟล์ด้วยเครื่องมืออ่านรูปแล้วอธิบายตามที่เห็นจริง ห้ามอ้างว่าเห็นถ้าเปิดไม่ได้

**ข้อสังเกตจากภาพที่ผู้ใช้อาจยกขึ้นมา (บอกตรง ๆ ถ้าถูกถาม):** ที่ 360×740 จอแรกไม่เห็นกิจกรรมเลย (QR + "ของฉัน" เต็มจอ) · หน้ายาวขึ้นราว 4% เทียบของเดิม · แถว "ลงทะเบียนแล้ว • ยกเลิก" ยังใช้เส้นขอบเทาที่ contrast 1.32:1 (ปัญหาเดิม ไม่ได้แก้) · ป้าย "ผู้สนใจ/เยี่ยมเยียน" บนบัตรเป็นข้อมูลทดสอบ (สถานะเปลี่ยนหลัง seed ครั้งก่อนเรียก `PUT /members` ไม่ครบ ดู `TECH-DEBT-NOTE-members-put.md`)

**ขั้นถัดไปของงาน A:** รอผู้ใช้ตอบ ผ่าน/ไม่ผ่าน ถ้าผ่าน → ผู้ใช้ต้องสั่ง Q13 แยก แล้วทำ **ทีละหน้า หยุดรอตรวจรับหลังแต่ละหน้า** ตามลำดับ `MemberEvents` → `MemberGroup` → `MemberAttendance` → `MemberProfile` (หน้าสุดท้ายเสี่ยงสุด: ฟอร์มข้อมูลส่วนบุคคล ห้ามเปลี่ยนความหมายข้อมูล/validation/การบันทึก) ข้อกำหนด UI: token เท่านั้น, `.type-*`, `DesignSystem.tsx`/`MemberList.tsx`, ปุ่ม ≥ 44px, ข้อความเนื้อหา ≥ 14px, ไม่ใช้ emoji เป็นไอคอน, ห้ามแก้ `components/ui/*`, ห้ามลด test

## 5. งาน B — ข้อกำหนดผลิตภัณฑ์ (แหล่งอ้างอิงเดียว = ADR; ที่นี่เป็นดัชนี ไม่ทำสำเนา)

**ADR 002 — โครงสร้างองค์กร + ตารางศัพท์ + ขั้นตอน Q24** (`docs/adr/adr-002.md`)
- ตัดสินแล้ว: 3 ระดับ; ห้ามเปลี่ยนความหมาย `careGroupId`; ห้ามย้าย/สร้างกลุ่มให้ตัวเลขตรง; ห้ามเปลี่ยนป้าย UI ที่มีมติเดิม
- **Proposed (รอ Q24):** `care` (UI "พันธกิจ") = หน่วยล่างสุดที่มีอยู่แล้ว; "แคร์" = ระดับกลางใหม่ (ชื่อเทคนิคยังไม่กำหนด)
- **Q24 `NOT VERIFIED`:** ผู้ใช้ตัดสินว่ารอหลักฐาน read-only จากผู้ดูแล production — ผู้ดูแลส่งกลับ 2 อย่าง: (1) Console บนแท็บที่ล็อกอิน `fetch('/api/org/overview',{credentials:'include'}).then(r=>r.json()).then(j=>console.log(j.data.totals, j.data.unassignedCareGroups))` → `bodies`, `careGroups`, `members` (**หมายถึงสมาชิก active ใน `care` ไม่ใช่สมาชิกทั้งระบบ**), `unassignedCareGroups` (2) SQL `SELECT action, count(*), min(created_at), max(created_at) FROM audit_logs WHERE action IN ('ORG_DATASET_LOADED','ORG_DATASET_ROLLED_BACK') GROUP BY action;` — **ห้ามรันเอง** ตัวเลข "20 แคร์" ตรวจจากฐานข้อมูลไม่ได้เลย การตีความผล: `careGroups` ใกล้ 52 → สนับสนุน Q23 · ใกล้ 20 → ไม่สนับสนุน (กลับไปตัดสินใหม่) · 0/ไม่เคยรัน org-data → ไม่มีข้อมูลต้องย้าย แต่ยังไม่มีหลักฐานโครงสร้าง · ค่าอื่น → สรุปไม่ได้
- Open: O1 ชื่อเทคนิคระดับกลาง/ยืนยันป้าย "แคร์" · O2 · O3 `groupKind` กับ `orgLevel` (เสี่ยงกลุ่มซ้ำกับ org-data) · O4 ตัวเลข · O5 ความหมาย "หนค."/"หนบ." · O6 แหล่งข้อมูลว่า `care` ใดอยู่ใต้แคร์ใด

**ADR 003 — สิทธิ์ ตำแหน่ง ข้อมูลส่วนบุคคล** (`docs/adr/adr-003.md`)
- ตัดสินแล้ว: scope = ผู้นำจริง (`leaderId`/`coLeaderId`) + `parentGroupId`; แยก read/create/update/approve/export/delete; หัวหน้าทีมไม่ใช้ `admin`; delete เฉพาะ `admin`/`super_admin`; ข้อกำหนดบทบาท **`team_lead`** (ดูทั้งหมด มอบเป้าหมาย ติดตามรายงาน ไม่ลบ/นำเข้า/org-data ข้อมูลติดต่อตามสิทธิ์+ความยินยอม ส่งออกเฉพาะสรุป — **ยังไม่สร้างบทบาท ไม่มี security tests**); บทบาทผู้จัดทำสถิติ **เลื่อน**
- ตารางสิทธิ์ส่วนใหญ่เป็นข้อเสนอของ AI ไม่ใช่ข้อสรุปของผู้ใช้ (ยกเว้นข้อกำหนด `team_lead`)
- Open: S2 ใครสร้างกลุ่ม · S3 เชิญผู้นำเข้า Clerk/ถอนสิทธิ์ · S4 ส่งออกรายคน · S5 ทบทวนข้อมูลส่วนบุคคลกับผู้รับผิดชอบของคริสตจักร · S6 รูปถ่าย · S7 กันอนุมัติตัวเอง · S8 ช่องทางมอบ `team_lead` ก่อนมี UI

**ADR 004 — รายงานรายสัปดาห์ + ตัวชี้วัด** (`docs/adr/adr-004.md`)
- ตัดสินแล้ว: สถานะ `draft → submitted → (needs_revision | acknowledged)` + `superseded`; ผู้ส่ง = ผู้นำตาม `getLedGroupIds`; X รับรองแล้ว (ทางการ) / Y รอรับรอง / "รวมตามที่รายงาน" ไม่แทนทางการ; ตัวหาร `active`; ห้ามนับ "ไม่ส่ง" เป็น "ไม่จัด"; สัปดาห์จันทร์–อาทิตย์เวลาไทย `weekStart` เป็นวันที่ล้วน
- **W4 ตัดสินแล้ว (2026-10-09 ท้ายวัน): ทางเลือก ก** — สองดัชนี: A `UNIQUE (group_id, week_start) WHERE superseded_at IS NULL AND status <> 'draft'` (ฉบับปัจจุบันที่ไม่ใช่ draft 1 ฉบับ) และ B `UNIQUE (group_id, week_start) WHERE status = 'draft'` (ร่างเปิดอยู่ 1 ฉบับ) · ส่งฉบับใหม่แบบ atomic: ทำฉบับเดิมเป็น `superseded` **ก่อน** แล้วจึงเลื่อนร่างเป็น `submitted` ในชุดเดียว · **Q31:** `needs_revision` → สร้างฉบับใหม่ (ไม่แก้แถวเดิม) · ประวัติฉบับเก่าเก็บเสมอ · ระหว่างร่างแก้ไข ฉบับเดิมที่รับรองแล้วยังนับเป็น X; เมื่อส่งฉบับใหม่ กลุ่มย้าย X → Y จนกว่าจะรับรองใหม่
- **การออกแบบดัชนียังไม่ได้พิสูจน์:** ไม่มี DDL/ตาราง/เทสต์ · repo มี test partial unique index **ตัวเดียว** บน PGlite (`server/db/pendingMigration0010.test.ts`) เท่านั้น · `shared/schema.ts` ยังไม่มี partial index · ยังไม่ได้ตรวจว่า drizzle-kit 0.31 สร้าง predicate แบบนี้ได้
- Open: W5 เป้าหมาย · W6 "ผู้ประสานงาน" · W7 ผู้มาใหม่ · **W8 (แคบลง)** `needs_revision` อยู่หมวดไหนใน Q27, `held=false` ที่ยังไม่รับรองอยู่หมวด 2 หรือ 3, สูตร "รวมตามที่รายงาน" · W9 "ปิดรอบ"/ส่งช้า · **W10** ทิ้งร่างที่เปิดอยู่ ใครทำได้ · **W11** ร่างแก้ไขเริ่มจากสำเนาฉบับปัจจุบันหรือเริ่มว่าง

**เอกสารอื่นที่แก้แล้ว:** `PRD.md` (§2, §3, §7 T8–T12, §7A, §9–§12), `docs/PUNTAKIT_MISSION_DOMAIN_PLAN.md` (ข้อความกำกับด้านบน, decision log Q14–Q19 — เป็นเลขของ log นั้นเอง ไม่ตรงกับเลข Q ของ session, ป้าย **[ADR-conflict]** ที่ §2, §9, §11, §15, §16, §19, out-of-scope), `AGENTS.md` (§1 แถว 10, §6.10), `docs/README.md`, `docs/adr/README.md`

**บันทึกนอก repo ที่ต้องรู้:**
- `Work\_review-docs-round\TECH-DEBT-NOTE-attendance-week-start.md` — dashboard เช็คชื่อเริ่มสัปดาห์วันอาทิตย์ ด้วยเวลาท้องถิ่นของเซิร์ฟเวอร์ (`attendance.ts:689-691`) ยังไม่แก้ ยังไม่เข้า tracker
- `Work\_shots-member-home\TECH-DEBT-NOTE-members-put.md` — `PUT /api/members/:id` กับ default ที่รอดจาก `.partial()` (`membershipStatus`, `role`, `status`, `consentGiven` ถูกเติมเมื่อ payload ไม่ครบ) ยังเป็น "ข้อสงสัยที่มีหลักฐานบางส่วน" ไม่ใช่ข้อสรุปว่าเป็นบั๊ก ห้าม seed ด้วย `PUT /members` ที่ payload ไม่ครบ
- `Work\_review-docs-round\ARCHITECTURE-s10-followup.md` — แผนแก้ `ARCHITECTURE.md` §10 (ทำหลัง ADR `accepted` และ implement แล้ว)
- `Work\_review-docs-round\tracked-docs-final.diff` — diff เอกสารรอบก่อน (ก่อนการแก้ W4 รอบล่าสุด; ใช้ `git diff` ดูฉบับล่าสุด)

## 6. ลำดับงานสำหรับ session ถัดไป (ทำตามลำดับ ห้ามข้ามไป implementation)

1. **เริ่มต้น:** `git status --short` เทียบกับหัวข้อ 3 → อ่านไฟล์นี้ + `docs/adr/adr-002.md`, `adr-003.md`, `adr-004.md` (ฉบับปัจจุบัน) → ตรวจว่ามีไฟล์/ข้อความหลักฐาน Q24 มาหรือยัง (ผู้ใช้อาจวางผลในแชต) แล้วสรุปสถานะให้ผู้ใช้ **สั้น ๆ** (ผู้ใช้บอกว่าไม่ต้องอธิบายซ้ำ)
2. **Q24:** ถ้ามีผล → ตีความตามตารางตัดสินล่วงหน้าใน ADR 002 (ไม่เดา) แล้วเสนอการปรับ ADR 002 และเอกสารที่พึ่ง (ADR 003/004, PRD, แผนเดิม) ให้ผู้ใช้ตัดสิน ถ้ายังไม่มี → คง `NOT VERIFIED` **ห้ามเข้า production ห้ามเดา และถามซ้ำได้อย่างมากหนึ่งครั้ง**
3. **ตรวจรับภาพ `MemberHome`:** เปิด contact sheets จริง สรุปให้ผู้ใช้ตามที่เห็น แล้วถามเพียงว่า **ผ่านหรือไม่ผ่าน** (ถ้าไม่ผ่าน ขอจุดที่ต้องแก้) ไม่เริ่ม Q13 เอง
4. **ตัดสิน Open decisions ที่บล็อกการออกแบบข้อมูล** โดยค้นหลักฐานใน repo ก่อน แล้วถามผู้ใช้ตามรูปแบบ grill (หลายข้อต่อรอบ แต่ละข้อมีทางเลือกและผลกระทบ ไม่เลือกแทน) ลำดับความสำคัญ:
   - ADR 004: **W8, W10, W11** (ปิดความหมายรายงาน/ร่างก่อนออกแบบตาราง) แล้ว W9, W5–W7
   - ADR 003: **S3** (บัญชีผู้นำ — ถ้าไม่มีบัญชี กลุ่มจะอยู่หมวด "ยังไม่ส่ง"), **S7** (อนุมัติตัวเอง), S2, S8, S4–S6 (S5/S6 เกี่ยวกับข้อมูลส่วนบุคคล ต้องมีผู้รับผิดชอบด้านข้อมูลของคริสตจักรทบทวน)
   - ADR 002: O1, O5, O6 (ผูกกับผล Q24), O3
5. **หลังได้คำตอบ:** ปรับ ADR 002–004, `PRD.md`, `docs/PUNTAKIT_MISSION_DOMAIN_PLAN.md` ให้สอดคล้อง (แหล่งอ้างอิงเดียวใน ADR ไม่ทำสำเนา) แยก "ตัดสินแล้ว / Proposed / Open" ให้ชัด แสดง diff และรายการที่เหลือ แล้วหยุดรอตรวจรับ
6. **ข้อเสนอสำหรับขั้นตอนหลังตรวจรับเอกสาร (ยังไม่ได้รับอนุมัติ ห้ามเริ่มเอง):** (ก) เขียน **เทสต์บน PGlite สำหรับดัชนี A+B และลำดับ supersede→submit** ก่อนมีตารางจริง เพื่อพิสูจน์ดีไซน์ W4 (ลำดับถูกต้องผ่าน กลับลำดับล้ม ร่างที่สองถูกปฏิเสธ ร่างข้างฉบับปัจจุบันได้) (ข) ผ่านเกณฑ์ Q24 และ `0010_group_members_history` pre-check ก่อนแตะ schema (ค) ขยาย `resolveGroupScope` + security tests ก่อนสร้าง `team_lead` (ง) ค่อยเริ่ม schema/migration/UI ตามที่ผู้ใช้อนุมัติเป็นขั้น ๆ
7. **ห้ามโดยอัตโนมัติ:** implementation, Q13, commit, push, merge, deploy, การเปลี่ยน ADR เป็น `accepted`

## 7. ความรู้เชิงปฏิบัติจากวันนี้ (เครื่อง Windows + Git Bash)

- **ไม่มี `pnpm` บน PATH** เรียกไบนารีตรง: `TZ=UTC node_modules/.bin/tsc --noEmit` · `TZ=UTC node_modules/.bin/vitest run` (ทั้งชุด ~3–7 นาที ใช้ background; `vitest run client` ~12 วินาทีแต่ก็จับไฟล์ `server/db/client.test.ts` ด้วย) · build: `node node_modules/vite/bin/vite.js build --outDir <โฟลเดอร์ชั่วคราว> --emptyOutDir` และ `node_modules/.bin/esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=<โฟลเดอร์ชั่วคราว>` (ไม่เขียนทับ `dist/` ของ repo)
- **dev server (โหมด demo)** — `concurrently` ใช้ไม่ได้บนเครื่องนี้ (cmd.exe ไม่เข้าใจ path แบบ `/`) รันแยกสองโปรเซสจากรากของ repo: API `node node_modules/dotenv-cli/cli.js -e .env.local -- node node_modules/tsx/dist/cli.mjs server/index.ts` (พอร์ต 3001) และ client `node node_modules/dotenv-cli/cli.js -e .env.local -- node node_modules/vite/bin/vite.js --host` (พอร์ต 3000) ตรวจด้วย `curl http://localhost:3001/api/health` ณ เวลาปิดงานทั้งสองยังตอบ 200 แต่หลังเปิดโปรแกรมใหม่ **ต้องตรวจก่อน อาจดับไปแล้ว**
- **ถ่ายภาพ/ตรวจใน Chromium:** ติดตั้ง Playwright + Chromium แล้วที่ `C:\Users\Administrator\.claude\skills\playwright-skill\node_modules` (ลงโดยผู้ช่วยตามคำสั่ง setup ของ skill นอก repo) `run.js` ของ skill ใช้ไม่ได้ (ขาด `sanitize-filename`) ให้รันสคริปต์ด้วย node ตรง โดยตั้ง `NODE_PATH` เป็นพาธ **แบบ Windows** (`C:/Users/Administrator/.claude/skills/playwright-skill/node_modules`) และตั้ง `MSYS_NO_PATHCONV=1` เมื่อส่งค่า route แบบ `/app` ผ่าน environment (ไม่งั้น Git Bash แปลงเป็น `C:/Program Files/Git/app`)
- **สคริปต์เครื่องมือที่เก็บไว้ถาวร:** `Work\_tools-member-pwa\` — `capture.js` (วัด layout/ภาพ), `cmp.js` + `compose2.js` + `contact.js` (ภาพเทียบ/contact sheet), `qr-decode.js` (ต้องมี `jsqr`, `pngjs` ที่ติดตั้งในโฟลเดอร์ชั่วคราวเดิม — ติดตั้งใหม่นอก repo ได้ด้วย `npm i jsqr pngjs`), `a11y.js`, `btn-check.js`, `seed*.mjs` (สร้างแถวทดสอบผ่าน API ของแอป: ส่ง UTF-8 ผ่านไฟล์ ไม่ใช่ argument ของ curl — เคยเพี้ยนเป็น `?`; **อย่าใช้ `seed2/3` ซ้ำ** เพราะเรียก `PUT /members` ไม่ครบ), `parse-check.ts` สคริปต์เหล่านี้อ้างตัวแปร `OUT_DIR`/`PHASE`/`ROUTE` ตามหัวไฟล์ และบางตัวอ้างพาธโฟลเดอร์ชั่วคราวของ session เก่า ให้ปรับก่อนใช้
- **ข้อควรรู้เรื่องข้อมูลทดสอบ:** การลงทะเบียนกิจกรรม demo ต้องใช้ผู้ใช้ `demo@puntakit.local` (role admin) ที่ผูกกับสมาชิกด้วยอีเมล
- กฎภาษา/รูปแบบ ADR ใน repo: ไฟล์ละหนึ่งการตัดสินใจ, ต้องมี Consequences ที่มีข้อเสีย, ฉบับ `accepted` แก้เนื้อหาไม่ได้ (ฉบับ `proposed` แก้ได้), เอกสารต้องมี `<!-- last_verified: YYYY-MM-DD -->` ที่อัปเดตเมื่อแก้, ห้ามคัดลอกเนื้อหา `AGENTS.md` ไปที่อื่น

## 8. Definition of Done ของ session ถัดไป

- [ ] สถานะ repo ตรวจแล้วและตรงกับไฟล์นี้ (หรือรายงานส่วนที่ต่าง)
- [ ] Q24 มีหลักฐานแบบไม่เปิดเผยข้อมูลส่วนบุคคล หรือยังเป็น `NOT VERIFIED` ชัดเจน
- [ ] ผู้ใช้ตอบผ่าน/ไม่ผ่านของภาพ `MemberHome`
- [ ] Open decisions ที่บล็อกการออกแบบ (W8, W10, W11, S3, S7 เป็นอย่างน้อย) ได้รับการตัดสินหรือบันทึกว่ายังค้าง
- [ ] ADR/PRD/Domain Plan สอดคล้องกันในข้อที่ตัดสินแล้ว; ADR ยัง `proposed`
- [ ] ไม่มีการแก้โค้ด/schema/migration/ข้อมูล ไม่มี commit/push/merge/deploy; `README.md` กับ `puntakit-readme.patch` ไม่ถูกแตะ
- [ ] รายงานปิด session มี Files Changed / Decisions / Open Decisions / Evidence / Git Status และหยุดรอตรวจรับ

---

*เขียนโดยผู้ช่วย AI ตอนปิดงาน 2026-10-09 ตามคำสั่งผู้ใช้ — สถานะ ADR ทุกฉบับยังเป็น `proposed` ไม่มีผลจาก production ใด ๆ*
