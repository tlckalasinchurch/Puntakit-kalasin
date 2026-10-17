# TICKETS — home-card-membership-ux

Source: `SPEC.md` (draft) · `GRILL.md` (D1–D8) · Date: 2026-10-16 · Base `666e9a3`

> **ประตูอนุมัติภายนอก:** ทุก ticket เริ่มที่ `Status: draft` ผู้ใช้ต้องเปลี่ยนบรรทัด `Status:` เป็น `approved`
> ในไฟล์นี้ด้วยตนเองเท่านั้น การยืนยันในแชทไม่ถือเป็นการอนุมัติ ยังไม่มี ticket ใดได้รับอนุมัติ
> ห้าม `/implement` ticket ที่ไม่ใช่ `approved`

## กติการ่วมทุก ticket (ผูกกับ GRILL §4)

- ห้ามแตะ `server/**`, `shared/**`, migrations, `CLAUDE.md`, `client/src/pages/PinSignInPage.tsx`, `stash@{0}`
- ห้าม stage / commit / push / deploy; ห้ามเขียนข้อมูล production; ข้อมูลทดสอบอยู่ใน PGlite ชั่วคราว `%TEMP%`
- `client/src/index.css`: **เพิ่มบล็อกใหม่ท้ายไฟล์เท่านั้น** ไม่แก้บล็อกเดิม (บล็อกที่ feature นี้สร้างเอง
  ticket ถัดไปแก้ได้) รายงาน `git diff --stat -- client/src/index.css` ก่อน/หลัง และยืนยันว่าบรรทัดเดิมไม่ถูกลบ
- ห้ามแตะหรือรวมงาน `.pin-login` ที่ค้างอยู่ใน working tree
- งาน `.pin-login` และ `client/src/pages/PinSignInPage.tsx` อยู่นอกขอบเขตของ feature นี้
- หากต้องแก้ `client/src/index.css` ให้เพิ่มเฉพาะ CSS block ใหม่ท้ายไฟล์ และต้องไม่ stage งาน `.pin-login` เดิม
- ชุด role ในโค้ดใหม่มาจาก `shared/roles.ts` เท่านั้น ไม่เขียนรายชื่อ role ซ้ำ
- ไม่ใช้สีอย่างเดียวบอกสถานะ; ทุกพื้นที่กด ≥ 44×44px; ไม่มี horizontal overflow ที่ 320/360/390/768/1280
- รองรับ light/dark และ `prefers-reduced-motion`; ไม่เพิ่ม raw palette
- หลังแต่ละ ticket รัน `pnpm check`, `git diff --check` และ test ที่เกี่ยวข้อง; ปิดงานต้อง `pnpm test` + `pnpm build`
- รายงานผลจริงเท่านั้น (VERIFIED / NOT VERIFIED); แยก baseline failure ออกจาก regression
  (baseline: 64 files / 796 tests ผ่านที่ `666e9a3`)

ลำดับแนะนำ: `HCM-01` → `HCM-02`; `HCM-03`, `HCM-04`, `HCM-05` ทำคู่ขนานได้ → `HCM-06` ปิดงาน

---

## HCM-01 — ทางลัดหลัก 3 อันสำหรับหัวหน้าแคร์/หัวหน้าบอดี้ (tracer bullet)

Status: approved
Blocked by: —
Priority: P1 · ขนาดโดยประมาณ: กลาง

**Vertical slice:** role → ฟังก์ชันเลือกไทล์ → ไทล์ใหม่บนหน้าแรก → CSS บล็อกใหม่ → ตรวจ browser ที่ `group_leader`

**ไฟล์:** `client/src/lib/homeTiles.ts` (ใหม่), `client/src/lib/homeTiles.test.ts` (ใหม่),
`client/src/components/home/HomeMyWork.tsx`, `client/src/index.css` (บล็อกใหม่ `.pk-home-tile*`),
`client/src/membership-ui.test.ts` (ปรับ assertion `min-h-28`)

**Acceptance criteria**
1. `homeTilesFor("group_leader")` คืนไทล์หลักตามลำดับ `care`, `photo`, `membership` และ `moreExtra` ที่มี `/follow-up`
2. ไทล์ใหม่: วงกลมไอคอน ≥ 64px (ไอคอน ≥ 32px) กึ่งกลาง; ชื่อไทล์ใต้ไอคอน; ไม่มี border ตอนปกติ; ความสูงไทล์ ≥ 120px;
   พื้นที่กดเท่าทั้งไทล์
3. 3 ไทล์เรียง 3 คอลัมน์ที่ 320–1280px; ชื่อไทล์ไม่ถูกตัดหรือซ้อนที่ 320px
4. badge "ต้องดำเนินการ" เป็นข้อความใน `StatusChip` มุมบนขวา (ไม่พึ่งสี) และยังคำนวณจาก `/api/home/overview` เดิม
5. "การติดตาม" ของ `group_leader` ไม่เป็นไทล์ แต่เข้าถึงได้จาก "ดูทั้งหมด" (ลิงก์ `/follow-up` อยู่ในรายการ)
6. การกดไทล์ "อัปเดตภาพพันธกิจ" เปิดชีตเดิม; ไทล์อื่นนำทางไป `/care`, `/memberships`
7. `membership-ui.test.ts` ไม่ยึด `min-h-28` อีก แต่ยืนยันพื้นที่กด ≥ 44px (เช่น class/ค่าที่ใช้จริงในไทล์ใหม่) และ
   `hasRole(...CREATE_ROLES)` / `hasRole(...MEMBERSHIP_VIEW_ROLES)` ยังอยู่
8. light/dark อ่านได้ (contrast ไอคอนบนวงกลม ≥ 3:1, ชื่อไทล์ ≥ 4.5:1); `reduced-motion` ไม่มี transition

**Public test seam:** `homeTilesFor(role)` (vitest) + Playwright ที่ 320/390/768/1280 × light/dark ด้วย `group_leader`

**สิทธิ์ที่ต้องรักษา:** ไทล์ "เช็คชื่อ/ภาพ" เฉพาะ `CREATE_ROLES`, "สถานะสมาชิก" เฉพาะ `MEMBERSHIP_VIEW_ROLES`; หน้าไม่เรียก
`/api/dashboard/summary`

**ความเสี่ยง:** R3, R4, R8 (SPEC §9) · **นอกขอบเขต:** "ดูทั้งหมด" แบบข้อความ (HCM-02), ชุดไทล์ role อื่น (HCM-02)

---

## HCM-02 — ชุดไทล์ role อื่น, "ดูทั้งหมด" แบบข้อความ, หัวข้อและ spacing

Status: draft
Blocked by: HCM-01
Priority: P1 · ขนาดโดยประมาณ: กลาง

**Vertical slice:** `homeTilesFor` ครบทุก role → รายการ "ดูทั้งหมด" ใหม่ → หัวข้อ/ระยะห่างทั้งหน้า → ตรวจ browser หลาย role

**ไฟล์:** `client/src/lib/homeTiles.ts`, `client/src/lib/homeTiles.test.ts`, `client/src/components/home/HomeMyWork.tsx`,
`client/src/index.css` (บล็อกใหม่ `.pk-home-more*` และ spacing), `client/src/membership-ui.test.ts`

**Acceptance criteria**
1. ตารางใน SPEC §4.1 ผ่านทุกแถวใน `homeTiles.test.ts`: `staff`/`admin`/`super_admin` = เช็คชื่อ·ภาพ·สถานะสมาชิก·การติดตาม;
   `ministry_leader` = เช็คชื่อ·ภาพ·การติดตาม; `viewer` = การติดตาม; `member`/ไม่มี role = ไม่มีไทล์
2. ชุดไทล์ของ role อื่นที่ไม่ใช่ `group_leader` **เหมือนก่อนแก้ทุกประการ** (ตรวจเทียบ `666e9a3`) ไม่เพิ่ม/ลดสิทธิ์
3. 4 ไทล์ → 2 คอลัมน์ (<1024px) และ 4 คอลัมน์ (≥1024px)
4. "ดูทั้งหมด": คง `aria-expanded`/`aria-controls`; ปุ่ม ≥ 44px; เนื้อหาเป็นรายการข้อความ **ไม่มีไอคอน** แถว ≥ 44px
   คั่นเส้นบาง; รวม `SECONDARY_LINKS` + `getRoleShortcuts` ผ่าน `mergeHomeLinks` และไม่มีลิงก์ที่ role เคยเข้าถึงได้หายไป
   (`homeLinks.test.ts` ผ่านโดยไม่แก้)
5. ไม่มี icon ใน `HomeMyWork.tsx` นอกไอคอนของไทล์หลัก
6. หัวข้อหมวด ≥ 28px น้ำหนัก ≥ 600; ระยะห่างหมวด ≥ 48px (mobile) / ≥ 64px (≥1024px); หัวข้อ→เนื้อหา ≥ 16px
7. states: skeleton สถิติ, ข้อความภาพว่าง, `ErrorState` + ลองใหม่ ทำงานเหมือนเดิม

**Public test seam:** `homeTilesFor` ทุก role, `homeLinks.test.ts`, Playwright เทียบ DOM ก่อน/หลังของ `staff`, `ministry_leader`, `viewer`

**สิทธิ์ที่ต้องรักษา:** ตาม HCM-01 + `ministry_leader` ไม่เห็นไทล์สถานะสมาชิก, `viewer` ไม่เห็นไทล์เช็คชื่อ/ภาพ
**ความเสี่ยง:** R1, R8 · **นอกขอบเขต:** `Home.tsx` ส่วนอื่น, `OrgSnapshot`, รายงานสัปดาห์

---

## HCM-03 — ชีตอัปโหลดภาพพันธกิจ: ปุ่มใหญ่ ความคืบหน้าชัด

Status: approved
Blocked by: —
Priority: P1 · ขนาดโดยประมาณ: เล็ก–กลาง

**Vertical slice:** เปิดชีตจากหน้าแรก → เลือก/ถ่ายรูป → อัปโหลด → บันทึก → ภาพขึ้นแถบล่าสุดโดยไม่ reload

**ไฟล์:** `client/src/components/home/MissionPhotoSheet.tsx`, `client/src/index.css` (บล็อกใหม่ถ้าจำเป็น),
`client/src/membership-ui.test.ts` (เพิ่ม contract)

**Acceptance criteria**
1. ปุ่ม "ถ่ายรูป" และ "เลือกรูป" สูง ≥ 56px; เต็มความกว้างและซ้อนแนวตั้งที่ <640px; เคียงข้างที่ ≥640px
2. แสดง "เลือกแล้ว n/6"; ข้อความสถานะอยู่ใน `role=status`/`aria-live=polite`
3. ระหว่างอัปโหลดมี `role="progressbar"` พร้อม `aria-valuemin`, `aria-valuemax`, `aria-valuenow` จาก state เดิม (`progress`, `picked.length`)
   และข้อความ "กำลังอัปโหลดรูป n จาก m…"
4. ปุ่มลบรูปและปุ่มทุกอัน ≥ 44×44px; ที่ 320px ไม่ล้นจอ
5. คง logic ทั้งหมด: `prepareImage` → `uploadMissionPhoto` → `POST /api/activities` (`type: "ministry_update"`); เลือกกลุ่มได้เฉพาะ
   `photoGroups`; error แล้วรูปที่เลือกยังอยู่และกดบันทึกซ้ำได้; `discardGuard`
6. States: idle, preparing, uploading, saving, error (คงรูป), success (toast + ปิดชีต + แถบภาพล่าสุดอัปเดต), ไม่มีกลุ่ม (ข้อความเตือนเดิม)
7. keyboard: Tab ครบ, Escape ปิดชีต (ถ้าไม่ busy), focus ring มองเห็นทั้ง light/dark

**Public test seam:** contract test (`prepareImage` ยังถูกใช้, progressbar มีแอตทริบิวต์ครบ) + Playwright อัปโหลดจริงกับ API (PGlite ชั่วคราว)
ด้วยภาพสังเคราะห์ ทั้ง `group_leader` และ `staff`; ตรวจกรณี error (เช่นบังคับ 4xx) ว่ารูปไม่หาย

**สิทธิ์ที่ต้องรักษา:** `group_leader` อัปโหลดให้กลุ่มที่นำเท่านั้น; `staff`/`admin` ทุกกลุ่ม; สิทธิ์ตัดสินที่ `server/routes/media.ts`/`activities.ts` (ไม่แตะ)
**ความเสี่ยง:** R1, R6 · **นอกขอบเขต:** การเปลี่ยน storage/endpoint, การเผยแพร่โพสต์ (ยังเป็นฉบับร่างตามเดิม)

---

## HCM-04 — บัตรสมาชิก: เหมือนบัตรจริงขึ้นและอ่านชัด

Status: approved
Blocked by: —
Priority: P1 · ขนาดโดยประมาณ: กลาง

**Vertical slice:** ข้อมูลทะเบียน → `/api/member-cards/:id` → บัตรสไตล์ใหม่ → เปลี่ยนรูป → บัตรแสดงรูปใหม่ → พิมพ์

**ไฟล์:** `client/src/components/membership/MemberCard.tsx`, `client/src/components/membership/MemberCardPanel.tsx`,
`client/src/index.css` (บล็อกใหม่ override `.pk-card`), `client/src/membership-ui.test.ts`

**ข้อห้ามเฉพาะ ticket (งาน `.pin-login`)**
- ห้ามแตะหรือรวมงาน `.pin-login` ที่ค้างอยู่ใน working tree
- งาน `.pin-login` และ `client/src/pages/PinSignInPage.tsx` อยู่นอกขอบเขตของ feature นี้
- หากต้องแก้ `client/src/index.css` ให้เพิ่มเฉพาะ CSS block ใหม่ท้ายไฟล์ และต้องไม่ stage งาน `.pin-login` เดิม

**Acceptance criteria**
1. ข้อมูลบนบัตรยังมาจาก props ของ `/api/member-cards/:id` เท่านั้น; test เดิม "ไม่มี contact" และ "ไม่มีตัวเลข/ชื่อ baked-in" ผ่านโดยไม่แก้
2. ความเหมือนจริง: เงาชั้นละเอียด + ขอบสว่างบาง, ประกายแสงทแยงแบบ static (ไม่มี animation), กรอบรูปทองสองชั้น,
   มุมโค้งตามบัตร ID-1; ทั้งหมดอยู่ในบล็อก CSS ใหม่ท้ายไฟล์ (ไม่แก้บล็อก `.pk-card` เดิม)
3. สีเขียวมรกต+ทองคงที่ทั้ง light/dark; ใน dark ขอบบัตรมองเห็นบนพื้นมืด
4. ข้อความบนบัตรทุกตัว contrast ≥ 4.5:1 (วัดจริง) และ ≥ 12px (บล็อกใหม่ต้องผ่านกฎเดียวกับ test เดิม)
5. อัตราส่วน 1.586 คงที่; เต็มความกว้างสูงสุด 640px; พอดีที่ 320px ไม่ล้น
6. พิมพ์: ขนาด 85.6×54mm เดิม; ประกายแสงและเงาใหม่ไม่ปรากฏตอนพิมพ์ (ตรวจด้วย `emulateMedia({ media: "print" })`)
7. `MemberCardPanel`: ปุ่มทุกอัน ≥ 44px และไม่ล้นที่ 320px; ปุ่มแก้รูปเฉพาะ `MEMBER_UPDATE_ROLES`; ปุ่มกำหนดเลขเมื่อ `canAssignNumber` เท่านั้น
8. หลังอัปโหลดรูปใหม่ บัตรแสดงรูปใหม่จริง (ค่า `src` เปลี่ยน หรือภาพต่างจากเดิม) — ถ้าไม่เปลี่ยนเพราะแคช URL ให้รายงานเป็น
   ช่องว่าง (R5) และหยุดถามก่อนแก้ ห้ามแก้ API
9. States: loading skeleton, error + ลองใหม่, ไม่มีรูป (อักษรย่อ + "ยังไม่มีรูป"), รูปโหลดไม่ได้ (fallback), "No. —" เมื่อยังไม่มีเลข

**Public test seam:** contract test (ไม่มี contact, ฟอนต์ ≥12px ของบล็อกใหม่, บล็อกใหม่ถูกเพิ่มท้ายไฟล์โดยบรรทัดเดิมไม่หาย) +
Playwright 320/390/1280 × light/dark + print emulation + เปลี่ยนรูปด้วยภาพสังเคราะห์

**สิทธิ์ที่ต้องรักษา:** หัวหน้าแคร์แก้รูปได้เฉพาะสมาชิกในกลุ่ม; หัวหน้าบอดี้แก้รูปไม่ได้; เลขบัตรกำหนดได้เฉพาะ office roles
**ความเสี่ยง:** R1, R2, R5 · **นอกขอบเขต:** ข้อมูลบนบัตรใหม่, การส่งออก PDF แบบใหม่, ภาพต้นแบบแบบ pixel (ไม่พบไฟล์)

---

## HCM-05 — หน้า `/memberships`: อ่านสถานะได้ทันที กรอบเบาลง

Status: approved
Blocked by: —
Priority: P1 · ขนาดโดยประมาณ: กลาง

**Vertical slice:** เปิด `/memberships` → เห็นสถานะ/กำหนดครบ → เปิด `MembershipPanel` → ดำเนินการตามสิทธิ์ → รายการรีเฟรช

**ไฟล์:** `client/src/pages/Memberships.tsx`, `client/src/components/membership/MembershipPanel.tsx`,
`client/src/index.css` (บล็อกใหม่), `client/src/membership-ui.test.ts`

**Acceptance criteria**
1. แท็บเบาลง (ไม่มีกรอบหนา) แสดงจำนวนและ `aria-selected`; แท็บทุกอัน ≥ 44px; ใช้งานด้วย keyboard ได้
2. แถวรายการ: เส้นคั่นบาง/พื้นอ่อนแทนกรอบหนา; คงข้อมูล ชื่อ·เลขสมาชิก·พันธกิจ·วันครบกำหนด·จำนวนวัน; chip สถานะและ chip ชำระเงินเป็น**ข้อความ**
   (ไม่พึ่งสี); แถว ≥ 64px
3. หัวข้อหน้าและ spacing ตาม SPEC §4.1; ช่องว่างตัวกรอง→รายการ ≥ 24px; ไม่ overflow ที่ 320px
4. `MembershipPanel` ปรับเฉพาะภาพ (หัวข้อ ระยะ ปุ่ม ≥ 44px) **ไม่แตะ logic**; `permissions.canDecide` และ
   `permissions.canRecordPayment` ยังควบคุมปุ่ม (test เดิมใน `membership-ui.test.ts` ผ่านโดยไม่แก้)
5. States: loading (`ListSkeleton`), empty (2 ข้อความเดิม), error (403 → "คุณไม่มีสิทธิ์ดูหน้านี้", อื่น → ลองใหม่), success (หลังดำเนินการรายการรีเฟรช)
6. หัวหน้าแคร์เห็นเฉพาะสมาชิกในกลุ่มที่นำ และดำเนินการได้เฉพาะคนเหล่านั้น; หัวหน้าบอดี้เห็นแคร์ใต้บอดี้และ**ไม่มีปุ่มดำเนินการ**;
   `staff` บันทึกชำระเงินได้; `ministry_leader`/`viewer` ได้ข้อความไม่มีสิทธิ์ (API 403)

**Public test seam:** `server/routes/memberships.test.ts` (ไม่แก้ ต้องผ่าน) + contract test + Playwright 4 role × 320/390/1280 × light/dark;
ตรวจ flow วิสามัญ → ถึงกำหนดตรวจสอบ → แปลงเป็นสามัญ และสามัญ → ต่ออายุ ด้วยข้อมูลสังเคราะห์ใน PGlite ชั่วคราว

**สิทธิ์ที่ต้องรักษา:** ตารางใน SPEC §5 ทั้งหมด; ไม่มี role ใหม่; ไม่แสดง contact
**ความเสี่ยง:** R1, R6, R7 · **นอกขอบเขต:** กฎค่าธรรมเนียม/ใครบันทึกชำระเงิน, ระบบการเงินภายนอก, การย้อนเลขบัตร

---

## HCM-06 — ตรวจรวมและหลักฐาน (ปิดงาน)

Status: draft
Blocked by: HCM-01, HCM-02, HCM-03, HCM-04, HCM-05
Priority: P1 · ขนาดโดยประมาณ: กลาง

**Vertical slice:** รวมทุกจุด → ชุดทดสอบเต็ม → เมทริกซ์ browser → รายงานหลักฐาน

**ไฟล์:** ไม่มีการแก้ source ใหม่ ยกเว้นแก้ regression ที่พบจาก ticket ก่อนหน้า (รายงานแยกชัดเจน)

**Acceptance criteria**
1. `pnpm check`, `pnpm test`, `pnpm build`, `git diff --check` ผ่าน; ถ้ามี test ล้ม ต้องแยก baseline (เทียบ 64 files / 796 tests ที่
   `666e9a3`) ออกจาก regression และไม่รายงานว่า "ผ่านทั้งหมด" หากยังล้ม; รัน test ที่ล้มซ้ำแบบแยกไฟล์ก่อนสรุปว่า flaky
2. test ที่ต้องผ่านโดยไม่แก้: `homeOverview`, `mediaAndCards`, `memberships`, `shared/membership`, `shared/roles`,
   `nav-structure-contract`, `role-gate-contract`, `design-system-consistency`, `design-tokens`, `ux-audit-regressions`
3. เมทริกซ์ Playwright: 5 role × {320, 360, 390, 768, 1280} × {light, dark} + reduced-motion; ผล: horizontal overflow = 0,
   พื้นที่กด ≥ 44px ทุกปุ่ม/ลิงก์/ไทล์ (วัดจริง), console error = 0, ไม่มี HTTP 4xx/5xx ที่ไม่คาด, keyboard focus ครบ, contrast ตามเกณฑ์
4. ตรวจสิทธิ์รายบทบาท: ผู้นำเห็นเฉพาะข้อมูลในขอบเขต, ไม่เห็น contact, หัวหน้าบอดี้ดูอย่างเดียว
5. `git diff --stat -- client/src/index.css` แสดงการเพิ่มล้วน (ไม่มีบรรทัดเดิมถูกลบ/แก้); ไฟล์ค้างเดิมอื่น (`CLAUDE.md`,
   `PinSignInPage.tsx`) ไม่เปลี่ยน; `server/**`, `shared/**`, `stash@{0}` ไม่เปลี่ยน
6. รายงานส่งมอบ: หน้า/ฟังก์ชันที่เสร็จ, ไฟล์ที่เปลี่ยน, ผลทดสอบจริง, รายการ screenshots พร้อม path จริง, สิ่งที่ NOT VERIFIED/BLOCKED,
   `git status` ก่อน–หลัง, และสิ่งที่ยังต้องขออนุมัติ (commit/push ไม่ทำเอง)

**Public test seam:** ชุดทดสอบเต็ม + สคริปต์ Playwright (เก็บนอก repo) + screenshots
**ความเสี่ยง:** R1, R7, R9 · **นอกขอบเขต:** การ commit/push/deploy, หน้าอื่นนอก 4 จุด (รอบถัดไป)
