# SPEC — home-card-membership-ux

Slug: `home-card-membership-ux` · Source: `GRILL.md` (D1–D8) · Date: 2026-10-16
Branch: `redesign/full-app-claude-20261015` (base `666e9a3`)

> **Status ของเอกสารนี้: draft.** ยังไม่ได้รับอนุมัติให้ implement การอนุมัติทำที่ `TICKETS.md`

## 1. เจตนาและเหตุผล

ฟีเจอร์ "หน้าแรกตามบทบาท / อัปโหลดภาพพันธกิจ / บัตรสมาชิก / สถานะสมาชิกรายปี" **สร้างและ merge แล้ว**
(commit `84988a1`) แต่หน้าตายังแน่น กรอบหนา ไอคอนเล็ก และลำดับความสำคัญไม่ชัด งานนี้คือการ
**ยกระดับ UX/UI ของ 4 จุดเดิม** ให้ผู้นำพันธกิจบนมือถือทำงานประจำได้เร็วและอ่านสถานะได้ทันที
โดยไม่แตะข้อมูลหรือสิทธิ์

## 2. เป้าหมาย / ไม่ใช่เป้าหมาย / anti-goals

**เป้าหมาย**
- G1 ทางลัดที่ใช้บ่อยเด่นที่สุดบนหน้าแรกของผู้ใช้ที่ล็อกอิน (ไอคอนใหญ่ พื้นที่กดใหญ่ กรอบเบา)
- G2 ลดความรก: ไอคอนอยู่เฉพาะที่ไทล์หลัก รายการรองเป็น "ดูทั้งหมด" แบบข้อความ
- G3 หัวข้อใหญ่และ spacing แบ่งหมวดชัด
- G4 บัตรสมาชิกดูเหมือนบัตรจริง อ่านง่าย ใช้ข้อมูลจากทะเบียน
- G5 ผู้ดูแลเห็นสถานะสมาชิกรายปีและสิ่งที่ต้องทำได้ทันทีโดยไม่พึ่งสีอย่างเดียว

**ไม่ใช่เป้าหมาย (non-goals)**
- ไม่เพิ่ม/แก้ schema, migration, API, role, permission, business logic
- ไม่ปรับหน้าอื่นนอก 4 จุด (member PWA `/app/*`, sidebar, รายงาน ฯลฯ)
- ไม่เปลี่ยน `Home.tsx` ส่วนรายงานสัปดาห์ (placeholder), `OrgSnapshot`, hero
- ไม่เพิ่ม dependency; ไม่เชื่อมระบบชำระเงินหรือแก้ใครบันทึกชำระเงินได้

**Anti-goals (ถือว่าล้มเหลวแม้ทำงานได้)**
- มีสิทธิ์รั่ว (ผู้นำเห็นสมาชิกนอกขอบเขต, เห็นเบอร์โทรบนบัตร/สถานะ)
- UI สวยแต่ทางลัดเดิมหายไปจนผู้ใช้เข้า `/follow-up` ไม่ถึง
- ใช้สีอย่างเดียวบอกสถานะ; พื้นที่กด < 44px; มี horizontal overflow
- แสดงตัวเลขหรือรายงานที่ระบบไม่มีจริง (ไม่มีตารางรายงานรายสัปดาห์)

## 3. สภาพปัจจุบัน (อ้างอิงโค้ด HEAD `666e9a3`)

| จุด | ปัจจุบัน |
|---|---|
| หน้าแรก `HomeMyWork.tsx` | หัวข้อ `type-lead` (28px, น้ำหนัก 400); ไทล์ `border` 1px + `min-h-28` + ไอคอน 26px ในกล่อง 48px ชิดซ้ายบน; สูงสุด 4 ไทล์ (เช็คชื่อ `CREATE_ROLES`, ภาพ `CREATE_ROLES`, สถานะสมาชิก `MEMBERSHIP_VIEW_ROLES`, การติดตาม ทุก role); "ดูทั้งหมด" เปิด pill มีกรอบ; wrapper `space-y-8` |
| `MissionPhotoSheet.tsx` | `Modal` + ปุ่ม "ถ่ายรูป/เลือกรูป" `min-h-11` + ข้อความสถานะ `role=status`; error คงรูปที่เลือกไว้ |
| `MemberCard.tsx` + `.pk-card` | เขียวมรกต+ทอง, ID-1 `aspect-ratio:1.586`, `cqw` scale, พิมพ์ 85.6mm; ไม่มี contact |
| `/memberships` | แท็บ pill มีกรอบ + ค้นหา + รายการ `border` + modal `MembershipPanel`; มี skeleton, empty, error (403 แยกข้อความ) |
| สิทธิ์ | บังคับที่ API; UI สะท้อนด้วย `hasRole(user?.role, SET)` จาก `shared/roles.ts` |

## 4. ดีไซน์ต่อพื้นผิว

### 4.1 หน้าแรก — `client/src/components/home/HomeMyWork.tsx` (+ ฟังก์ชันใหม่ `client/src/lib/homeTiles.ts`)

**ชุดไทล์ต่อ role (ผ่าน `homeTilesFor(role)` ฟังก์ชันบริสุทธิ์ ใช้ role sets จาก `shared/roles.ts` ห้ามเขียนรายชื่อ role ซ้ำ)**

| Role | ไทล์หลัก (ตามลำดับ) | ย้ายไป "ดูทั้งหมด" เพิ่ม |
|---|---|---|
| `group_leader` | เช็คชื่อกลุ่มดูแล `/care` · อัปเดตภาพพันธกิจ (เปิดชีต) · สถานะสมาชิก `/memberships` | การติดตาม `/follow-up` |
| `super_admin`, `admin`, `staff` | เช็คชื่อ · ภาพ · สถานะสมาชิก · การติดตาม (เหมือนปัจจุบัน) | — |
| `ministry_leader` | เช็คชื่อ · ภาพ · การติดตาม (ไม่มีสถานะสมาชิก เหมือนปัจจุบัน) | — |
| `viewer` | การติดตาม | — |
| `member` | ไม่แสดง (Home ส่งไป `/app`) | — |

- การติดตาม `/follow-up` **ไม่ถูก gate ด้วย role** (ผู้ได้รับมอบหมายต้องเข้าถึงได้) ดังนั้นเมื่อย้ายลง
  "ดูทั้งหมด" ของ `group_leader` ต้องยังเข้าถึงได้เสมอ ห้ามหายจากหน้า
- `tileHrefs` ที่ส่งเข้า `mergeHomeLinks` ต้องสะท้อนไทล์ที่แสดงจริงต่อ role

**รูปแบบไทล์ (CSS บล็อกใหม่ `.pk-home-tile*` ท้าย `index.css`)**
- layout แนวตั้งกึ่งกลาง: วงกลมไอคอน **≥64px** (ไอคอน ≥32px, `--color-primary` + `--color-on-primary`),
  ชื่อไทล์ใต้ไอคอน, คำอธิบายสั้น (ซ่อนที่ <640px เพื่อลดความรก)
- กรอบเบา: ไม่มี border ตอนปกติ ใช้พื้น `--color-canvas-soft`; hover เปลี่ยนพื้น; focus ring `--color-primary-focus`
- badge จำนวน ("3 ต้องดำเนินการ") อยู่มุมบนขวาและเป็น **ข้อความ** ใน `StatusChip` (ไม่พึ่งสี)
- พื้นที่กดเท่าทั้งไทล์ สูง **≥ 120px**; ไทล์เป็น `<a>` (ลิงก์) หรือ `<button>` (เปิดชีต) ตามเดิม
- จำนวนคอลัมน์ตามจำนวนไทล์: 3 ไทล์ → 3 คอลัมน์ที่ทุกความกว้าง; 4 ไทล์ → 2 คอลัมน์ (<1024px) / 4 คอลัมน์ (≥1024px);
  ที่ 320px ชื่อไทล์ขึ้นบรรทัดใหม่ได้ ไม่ถูกตัดหรือซ้อนกัน
- การเปลี่ยนสี/เงามี `transition` สั้นและ `motion-reduce:transition-none`

**"ดูทั้งหมด"**
- คงเป็น disclosure จริง (`aria-expanded`, `aria-controls`) ปุ่ม `min-h-11 min-w-11`
- เนื้อหาเปลี่ยนจาก pill มีกรอบเป็นรายการข้อความ **ไม่มีไอคอน** แถวละ `min-h-11` คั่นด้วยเส้นบาง
  (รวม `SECONDARY_LINKS` + ทางลัดตาม role `getRoleShortcuts` ผ่าน `mergeHomeLinks` ไม่ตัดลิงก์ที่ role เคยเข้าถึงได้)
- ห้ามมี icon อื่นใน `HomeMyWork.tsx` นอกจากไอคอนของไทล์หลัก

**หัวข้อและ spacing**
- หัวข้อหมวด ("ทำต่อได้เลย", สถิติ, "ภาพพันธกิจล่าสุด") ขนาด **≥ 28px น้ำหนัก ≥ 600**
- ระยะห่างระหว่างหมวด **≥ 48px** บนมือถือ และ **≥ 64px** ที่ ≥1024px; ช่องว่างหัวข้อ→เนื้อหา ≥ 16px
- ตัวเลขสถิติใหญ่ขึ้นได้ แต่ข้อมูลและคำอธิบาย "ระบบยังไม่มีรายงานรายสัปดาห์" ต้องคงอยู่

**States**
| State | พฤติกรรม |
|---|---|
| Loading | ไทล์ render ทันที (badge ว่าง); สถิติเป็น skeleton `role=status` (เดิม) |
| Empty | ภาพล่าสุดว่าง → ข้อความ "ยังไม่มีภาพ — กด “อัปเดตภาพพันธกิจ”…" (เดิม) ถ้าไม่มีสิทธิ์โพสต์ภาพ ไม่แสดงข้อความนี้ |
| Error | `ErrorState` พร้อมปุ่มลองใหม่ (เดิม) ไทล์ที่ไม่ขึ้นกับข้อมูลยังไม่ถูกบล็อกถ้าทำได้โดยไม่เปลี่ยน logic* |
| Success | หลังบันทึกภาพ: toast + แถบ "ภาพพันธกิจล่าสุด" ต้องอัปเดตโดยไม่ reload (`onSaved` → `load()`) |
| Permission denied | API 403 → ข้อความ error เดิม; ไทล์ที่ role ไม่มีสิทธิ์ไม่แสดง |

\* ถ้าการแสดงไทล์ระหว่าง error ต้องเปลี่ยน logic เดิม ให้คง behavior เดิม (แสดง `ErrorState` อย่างเดียว)

### 4.2 ชีตอัปโหลดภาพ — `client/src/components/home/MissionPhotoSheet.tsx`
- ปุ่ม "ถ่ายรูป" และ "เลือกรูป": สูง **≥ 56px**, เต็มความกว้างและซ้อนแนวตั้งที่ <640px, เคียงข้างที่ ≥640px
- แสดง "เลือกแล้ว n/6"; ตัวนับ/ข้อความ `role=status` / `aria-live=polite`
- เพิ่มแถบความคืบหน้า (`role="progressbar"`, `aria-valuemin/max/now`) ระหว่างอัปโหลด (คำนวณจาก `progress`/`picked.length`
  ที่มีอยู่ ไม่ต้องใช้ API ใหม่) ปุ่มบันทึกแสดงข้อความสถานะเป็นข้อความ
- ปุ่มลบรูปและปุ่มทั้งหมดในชีต ≥ 44×44px
- คง logic: `prepareImage` → `uploadMissionPhoto` → `POST /api/activities` (`type: "ministry_update"`), เลือกกลุ่มได้เฉพาะ
  `photoGroups` ที่ API ส่งมา, error คงรูปที่เลือกไว้, `discardGuard`
- States: idle / preparing / uploading n จาก m / saving / error (คงรูป) / success (toast + ปิด) / empty groups (ข้อความเตือนเดิม)

### 4.3 บัตรสมาชิก — `client/src/components/membership/MemberCard.tsx`, `MemberCardPanel.tsx`, CSS บล็อกใหม่
- **ไม่เปลี่ยนข้อมูลบนบัตร** (ยังอ่านจาก props ที่มาจาก `/api/member-cards/:id`)
- เสริมความเหมือนบัตรจริงด้วย CSS ที่ override `.pk-card` จากบล็อกใหม่: เงาชั้นละเอียด + ขอบสว่างบาง,
  ประกายแสงทแยง (pseudo-element แบบ static ไม่มี animation), กรอบรูปทองสองชั้น, ความมนของมุมตามบัตร ID-1
- บัตรคงสีเขียวมรกต+ทองทั้ง light และ dark (เป็นอัตลักษณ์ของบัตร) ใน dark ต้องมีขอบมองเห็นบนพื้นมืด
- ข้อความบนบัตรทุกตัว contrast **≥ 4.5:1** กับพื้นหลังจริง และไม่เล็กกว่า 12px (test เดิมตรวจบล็อก `.pk-card` เดิม;
  บล็อกใหม่ต้องเคารพกฎเดียวกัน)
- ขนาด: เต็มความกว้างสูงสุด 640px, อัตราส่วน 1.586 คงที่; พอดีที่ 320px ไม่ล้น
- พิมพ์ (`body.pk-printing-card`): ขนาด 85.6mm เดิม; ประกายแสง/เงาใหม่ต้องถูกปิดตอนพิมพ์
- `MemberCardPanel`: ปุ่มเปลี่ยนรูป/ถ่ายรูป/พิมพ์/กำหนดหมายเลข ≥ 44px จัดเรียงไม่ล้นที่ 320px; ปุ่มแก้รูปแสดงเฉพาะ
  `MEMBER_UPDATE_ROLES` (เดิม); เลขสมาชิกกำหนดได้เฉพาะเมื่อ `canAssignNumber` (เดิม)
- รูปใหม่: หลังอัปโหลด บัตรต้อง **แสดงรูปใหม่จริง** (ตรวจว่า `src` เปลี่ยนหรือไม่ติดแคช)
- States: loading skeleton, error + retry, ไม่มีรูป (อักษรย่อ + "ยังไม่มีรูป"), รูปโหลดไม่ได้ (`onError` fallback), ยังไม่มีเลขสมาชิก ("No. —")

### 4.4 หน้า `/memberships` — `client/src/pages/Memberships.tsx`, `client/src/components/membership/MembershipPanel.tsx`
- แท็บเป็นรูปแบบเบาลง (ไม่มีกรอบหนา) ยังแสดงจำนวนและ `aria-selected`; ทุกแท็บ ≥ 44px
- แถวรายการ: ลดกรอบเป็นเส้นคั่นบาง/พื้นอ่อน; คงข้อมูล (ชื่อ, เลขสมาชิก, พันธกิจ, วันครบกำหนด, จำนวนวัน) และ chip สถานะ +
  chip การชำระเงินที่เป็นข้อความ; แถว ≥ 64px
- หัวข้อและ spacing ตามข้อ 4.1; ช่องว่างตัวกรอง→รายการ ≥ 24px
- `MembershipPanel`: ปรับเฉพาะภาพ (ลำดับหัวข้อ ระยะห่าง ปุ่ม ≥44px) **ห้ามแตะ logic** ของเริ่ม/แปลงเป็นสามัญ/ต่ออายุ/ไม่ต่อ/บันทึกชำระเงิน
- States: loading `ListSkeleton`, empty (2 ข้อความเดิม), error (403 → "คุณไม่มีสิทธิ์ดูหน้านี้"), success (หลังดำเนินการ รายการรีเฟรชผ่าน `onChanged`)

## 5. สิทธิ์ที่ต้องรักษา (ห้ามเปลี่ยน)

อ้างอิง `docs/features/membership-lifecycle.md` และ `shared/roles.ts`

| Role | เห็นสถานะ | เริ่ม/แปลง/ต่อ/ไม่ต่อ | บันทึกชำระเงิน | แก้รูปสมาชิก | กำหนดเลขบัตร |
|---|---|---|---|---|---|
| `super_admin`, `admin`, `staff` | ทุกคน | ทุกคน | ได้ | ได้ | ได้ |
| `group_leader` หัวหน้าแคร์ | สมาชิกในกลุ่มที่นำ | เฉพาะสมาชิกเหล่านั้น | ไม่ได้ | เฉพาะสมาชิกเหล่านั้น | ไม่ได้ |
| `group_leader` หัวหน้าบอดี้ | สมาชิกแคร์ใต้บอดี้ | **ดูอย่างเดียว** | ไม่ได้ | ไม่ได้ | ไม่ได้ |
| `ministry_leader`, `viewer`, `member` | ไม่ได้ | ไม่ได้ | ไม่ได้ | ไม่ได้ | ไม่ได้ |

- การซ่อน UI ไม่ใช่ความปลอดภัย: ทุกข้อบังคับที่ API เดิม งานนี้ **ห้ามแก้ `server/**`**
- ชุด role ในโค้ดใหม่ต้องมาจาก `shared/roles.ts` เท่านั้น (`role-gate-contract.test.ts` ต้องผ่าน)
- บัตรและหน้าสถานะ **ไม่แสดง** phone/email/lineId/address/emergency
- หน้าแรกของผู้นำ **ไม่เรียก** `GET /api/dashboard/summary`

## 6. Mobile / Desktop

| Viewport | พฤติกรรมที่ต้องเป็น |
|---|---|
| 320 / 360 / 390 | ไม่มี horizontal overflow; ไทล์ 3 อันเรียง 3 คอลัมน์ ชื่อขึ้นบรรทัดใหม่ได้; ปุ่มทุกอัน ≥ 44px; ชีตภาพและบัตรไม่ล้นจอ |
| 768 | ไทล์ 3 หรือ 2 คอลัมน์ตามจำนวน; ชีตและ modal จัดกึ่งกลาง |
| 1280 | ไทล์ 3-4 คอลัมน์; บัตรใน modal กว้างสูงสุด 640px; Sidebar เดิมไม่เปลี่ยน |

## 7. Light / Dark / Motion / Accessibility

- ใช้ token เดิม (`--color-*`, `--radius-*`) ไม่เพิ่ม raw palette (`design-system-consistency.test.ts`)
- Light และ Dark ต้องอ่านได้: text ปกติ ≥ 4.5:1, text ใหญ่/ไอคอนสำคัญ ≥ 3:1 (วัดจริงด้วยสคริปต์)
- `prefers-reduced-motion: reduce` → ไม่มี transition/animation ในบล็อกใหม่
- keyboard: Tab เข้าไทล์/ปุ่ม/ลิงก์ทุกตัวได้, focus ring มองเห็นทั้งสองธีม, Escape ปิดชีต/modal (เดิม)
- สถานะทุกอย่างมีข้อความ ไม่ใช้สีอย่างเดียว; องค์ประกอบตกแต่ง `aria-hidden`

## 8. ไฟล์ที่จะเปลี่ยน

| ไฟล์ | การเปลี่ยน |
|---|---|
| `client/src/lib/homeTiles.ts` (**ใหม่**) | ฟังก์ชันบริสุทธิ์ role → ไทล์ |
| `client/src/lib/homeTiles.test.ts` (**ใหม่**) | test ตารางใน 4.1 |
| `client/src/components/home/HomeMyWork.tsx` | ใช้ `homeTilesFor`, ไทล์ใหม่, "ดูทั้งหมด" ใหม่, spacing/หัวข้อ |
| `client/src/components/home/MissionPhotoSheet.tsx` | ปุ่มใหญ่, progress bar, ตัวนับ |
| `client/src/components/membership/MemberCard.tsx` | เพิ่ม hook/class สำหรับสไตล์ใหม่ (ไม่เปลี่ยนข้อมูล) |
| `client/src/components/membership/MemberCardPanel.tsx` | จัดปุ่ม/ระยะ |
| `client/src/pages/Memberships.tsx` | แท็บ/แถว/spacing |
| `client/src/components/membership/MembershipPanel.tsx` | visual เท่านั้น |
| `client/src/index.css` | **เพิ่มบล็อกใหม่ท้ายไฟล์** (`.pk-home-tile*`, `.pk-home-more*`, `.pk-card` refinement, memberships list) |
| `client/src/membership-ui.test.ts` | ปรับ assertion `min-h-28`; เพิ่ม contract ของไทล์ใหม่/บล็อก CSS ใหม่ |

**ไม่แตะ:** `server/**`, `shared/**`, migrations, `Home.tsx`, `CLAUDE.md`, `PinSignInPage.tsx`, บล็อกเดิมของ `index.css`, `stash@{0}`

## 9. ความเสี่ยง

| # | ความเสี่ยง | การรับมือ |
|---|---|---|
| R1 | `index.css` มีงานค้าง 377 บรรทัดของ login (ยังไม่ commit) การเพิ่มบล็อกจะปนกับงานนั้นเมื่อ commit | เพิ่มเฉพาะท้ายไฟล์; รายงาน `git diff --stat` ก่อน/หลัง; ห้าม commit ในงานนี้ |
| R2 | override `.pk-card` ด้วย cascade อาจชนกฎเดิม/ลำดับความสำคัญ | บล็อกใหม่หลังบล็อกเดิม, selector ระดับเดียวกัน; ตรวจ computed style ใน browser |
| R3 | test เดิมผูกกับ `min-h-28` (`membership-ui.test.ts:125`) | ปรับ assertion ตาม behavior ใหม่ (≥ 44px จริง) พร้อมเหตุผลในรายงาน ไม่ลดเกณฑ์ |
| R4 | ไทล์ 3 คอลัมน์ที่ 320px แคบ ข้อความอาจชน | กำหนดให้ขึ้นบรรทัดใหม่ได้, ซ่อน hint <640px, วัดใน browser |
| R5 | รูปสมาชิกใหม่อาจไม่ปรากฏบนบัตรถ้า URL เดิมและเบราว์เซอร์แคช | ตรวจ `src` หลังอัปโหลด; ถ้าไม่เปลี่ยนต้องรายงานเป็นช่องว่างและหยุดถาม (ห้ามแก้ API เอง) |
| R6 | ไม่มี component render test | ใช้ Playwright เป็นหลักฐานหลัก + helper บริสุทธิ์ + contract test |
| R7 | ชุดทดสอบช้า/ล้มเมื่อเครื่องมีโหลด (เคยพบ `import.test.ts` timeout) | แยก baseline failure จาก regression; ปิด dev server ก่อนรัน `pnpm test` |
| R8 | ย้าย "การติดตาม" ไป "ดูทั้งหมด" ทำให้ผู้ใช้หาไม่เจอ | ตรวจใน browser ว่า `group_leader` เข้า `/follow-up` ได้จากหน้าแรก |
| R9 | demo mode ให้ admin เสมอ ตรวจสิทธิ์ผู้นำไม่ได้ | ใช้ test-auth cookie (`PUNTAKIT_TEST_AUTH=1`) กับ PGlite ชั่วคราว ปิด `PUNTAKIT_DEMO_MODE` |

## 10. แผนทดสอบ

**อัตโนมัติ** (รันทุกครั้งหลังแก้; บันทึกผลจริง; แยก baseline failure)
1. `pnpm check`, `pnpm test`, `pnpm build`, `git diff --check`
2. test ใหม่/ปรับ: `homeTiles.test.ts`, `membership-ui.test.ts`
3. ต้องผ่านโดยไม่แก้: `server/routes/{homeOverview,mediaAndCards,memberships}.test.ts`, `shared/{membership,roles}.test.ts`,
   `nav-structure-contract`, `role-gate-contract`, `design-system-consistency`, `design-tokens`, `ux-audit-regressions`
4. Baseline ก่อนเริ่ม: 64 files / 796 tests ผ่านที่ `666e9a3`

**Browser (Playwright จาก `C:\Users\Administrator\.claude\skills\playwright-skill\node_modules`)**
- เซิร์ฟเวอร์: API + Vite บน PGlite ชั่วคราวใน `%TEMP%` ข้อมูลสังเคราะห์ (กลุ่ม, สมาชิก, รอบสมาชิกวิสามัญ/สามัญ) ใช้ test-auth cookie ต่อ role
- Roles: หัวหน้าแคร์, หัวหน้าบอดี้, `staff`/`admin`, `ministry_leader`, `viewer`
- Viewports: 320, 360, 390, 768, 1280 × light/dark × reduced-motion
- ตรวจ: จำนวนและลำดับไทล์ต่อ role, พื้นที่กด ≥ 44px (วัดจริง), horizontal overflow = 0, console error = 0 และไม่มี
  HTTP 4xx/5xx ที่ไม่คาดหมาย, keyboard focus, contrast, อัปโหลดภาพพันธกิจ end-to-end (ภาพใหม่ขึ้นแถบล่าสุด),
  เปลี่ยนรูปสมาชิกแล้วบัตรแสดงรูปใหม่, หัวหน้าแคร์ดำเนินการได้เฉพาะสมาชิกของตน, หัวหน้าบอดี้ดูอย่างเดียว,
  บัตรไม่แสดง contact, พิมพ์บัตรไม่มีประกายแสง
- ภาพก่อน/หลัง (screenshots) บันทึกที่ scratchpad และอ้างชื่อไฟล์จริงในรายงาน

**หลักฐานที่ต้องรายงานเมื่อเสร็จ:** `git status` ก่อน–หลัง, `git diff --stat` โดยเฉพาะ `index.css` (ต้องเป็นการเพิ่มล้วน),
ผล check/test/build, รายการ screenshots, สิ่งที่ NOT VERIFIED
