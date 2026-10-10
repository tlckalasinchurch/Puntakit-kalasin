<!-- last_verified: 2026-10-10 -->
# PRD — Puntakit (Ministry Operating System)

> **เอกสารนี้คือ PRODUCT SOURCE OF TRUTH** — ทุกข้อความในส่วน CURRENT ตรวจสอบจากโค้ดแล้ว (อ้าง path/บรรทัด)
> ส่วน TARGET มาจากแผนงานที่บันทึกไว้ ยังไม่ได้ลงมือทำ — **ห้ามตีความว่า implemented**
> ตรวจไม่ได้ = `NOT VERIFIED` · ยังไม่กำหนด = `NOT DEFINED`

---

## 1. What & Why

**What** — เว็บแอปใช้งานภายในสำหรับบริหารคริสตจักรไทย: จัดการ **คน** (สมาชิก พันธกิจ การเยี่ยมติดตาม การเช็คชื่อ) ไม่ใช่จัดการธุรกรรม
**Why** — งานพันธกิจปัจจุบันกระจัดกระจาย (Excel + ความจำ + ไลน์) ข้อมูลสมาชิกไม่มีที่กลาง ผู้นำแคร์/ฝ่ายงานไม่มีมุมมองร่วมกัน
**ภาษา** — Thai-first (UI ภาษาไทยเป็นค่าเริ่มต้น ตัวเลข/วันที่ `th-TH`)

## 2. Who (Stakeholders)

| กลุ่ม | ใช้อะไร | หลักฐาน |
|---|---|---|
| เจ้าหน้าที่คริสตจักร (ผู้ใช้หลัก) | admin app ทุกหน้า | `ADMIN_SHELL_ROLES` — `shared/roles.ts:30` |
| ผู้นำแคร์/พันธกิจ (ศัพท์เดิม = ผู้นำ `care` — ดู [ADR 002](./docs/adr/adr-002.md)) | `/care` บนมือถือ | `ARCHITECTURE.md` §1 stakeholders |
| สมาชิก (ทั่วไป) | member PWA `/app/*` | `client/src/pages/member/` (5 หน้า) |
| ผู้ดูแลระบบ 1–2 คน | settings/bootstrap | จำนวนจริง = **NOT VERIFIED** |

**ผู้ใช้ตามสายบังคับบัญชา (TARGET — `proposed`, ยังไม่ implemented)** — ดู [`ADR 002`](./docs/adr/adr-002.md) · [`003`](./docs/adr/adr-003.md) · [`004`](./docs/adr/adr-004.md) และ §7A ด้านล่าง:

| กลุ่ม | หน้าที่ | สถานะในโค้ดวันนี้ |
|---|---|---|
| หัวหน้าทีม/ศิษยาภิบาล (`team_lead` — ข้อเสนอ) | ดูภาพรวมทุกบอดี้ มอบเป้าหมาย ติดตามรายงาน (ไม่มีสิทธิ์ลบ/นำเข้า/org-data) | **ไม่มีบทบาทนี้ในโค้ด** — `admin` มีสิทธิ์ลบจึงไม่ใช้แทนอัตโนมัติ |
| หัวหน้าบอดี้ | ดูแลบอดี้ ติดตามเป้าหมาย อ่านรายงาน | ไม่มี scope ตามลำดับชั้น (`group_leader` เห็นเฉพาะกลุ่มที่นำ) |
| หัวหน้าแคร์ (ระดับกลางใหม่ — Proposed) | รับเป้าหมายจากบอดี้ ตรวจ/รับรองรายงาน | **ระดับกลางไม่มีในโค้ดและข้อมูล** (ADR 002) |
| ผู้นำ `care` ("พันธกิจ" หน่วยล่างสุด) | ดูแลทะเบียนกลุ่ม รายชื่อ ส่งรายงานรายสัปดาห์ (ผู้นำ/ผู้นำร่วม/ผู้ช่วยผู้นำ) | ต้องมีบัญชีผู้ใช้ — ยังไม่ตัดสิน (ADR 003 S3) |
| ผู้จัดทำสถิติ | — | **เลื่อน** — ยังไม่มีผู้ใช้และข้อกำหนดที่ยืนยัน |

## 3. Problem

- ข้อมูลสมาชิก 674 แถว / ~23 กลุ่ม จาก 8 ไฟล์ Excel ไม่มีที่เก็บกลาง — นำเข้าผ่าน `/import` แล้ว (L1/L2) แต่ยังไม่ promotion เข้าระบบหลัก (L3/L4)
- ไม่มีประวัติการเป็นสมาชิกกลุ่ม (join → leave → rejoin) — schema ปัจจุบัน unique ทั้งคู่ กันไม่ได้ (dry-run SQL มีแล้วที่ `server/db/pending/0010_group_members_history.sql` **ยังไม่ apply**)
- งานพันธกิจบันทึกเป็นข้อความ/รูป ไม่มี object กลาง ⇒ ดู Feed/Timeline/Operations ไม่ได้จากมุมเดียว
- **รายงานวันจันทร์ยังรวมด้วยมือจากหลายไฟล์ Excel** — ไม่มีรายงานรายสัปดาห์ในระบบ ไม่มีเป้าหมาย/สถิติรวม และไม่มีสิทธิ์ตามสายบังคับบัญชา (§7A)
- **ตัวเลขขนาดองค์กรยังไม่ตรงกันและตรวจไม่ได้:** เอกสารนี้และ audit เดิมอ้าง ~23 กลุ่ม (audit นับ 72 sheet สมาชิก) แต่เจ้าของโปรเจกต์ให้ราว 6 บอดี้ / 20 แคร์ / 52 พันธกิจบ้าน (ทำได้จริง ราว 49) — **NOT VERIFIED** เพราะไฟล์ต้นฉบับและรายงานตัวอย่างไม่อยู่ในสภาพแวดล้อมที่ตรวจ ห้ามใช้ตัวเลขใดเป็นข้อเท็จจริงจนกว่าจะ audit ไฟล์จริง

## 4. Goals (วัดได้)

| # | เป้า | ตรวจอย่างไร |
|---|---|---|
| G1 | ข้อมูลสมาชิกไม่รั่วข้ามบทบาท (mask เบอร์/อีเมลตาม role) | `MEMBER_CONTACT_ROLES` gating + `membersPrivacy.test.ts` · **D54 แก้แล้วในโค้ดของ `master` 2026-10-10 (Production ใช้ `main` ซึ่งมีการจำกัดของตัวเอง — tracker D58)** (`/groups/:id/members` และ `/groups/:id` ใช้กฎเดียวกับ `/members` — `groupMemberPrivacy.test.ts` 40 tests; **ยังไม่ deploy ไม่ได้ตรวจ production**) · ยังมีหนี้ที่เกี่ยวข้อง D55–D57 (tracker) |
| G2 | ใช้ได้มือถือ 360px ไม่มี horizontal scroll | `ux-audit-regressions.test.ts` |
| G3 | โหมดมืดไม่พังเมื่อเพิ่มหน้าใหม่ | `design-system-consistency.test.ts` |
| G4 | route ที่เปลี่ยนมี test คู่ | quality gate (§11) |
| G5 | ตัวเลข/วันที่เป็นไทย | `ux-audit-regressions.test.ts` (Reports ≥5 `toLocaleString("th-TH")`) |

**Success metrics เชิงธุรกิจ (ผู้ใช้/ประสิทธิผล) — NOT DEFINED** — ไม่มีตัวเลข baseline ใด ๆ ในเรพ (ผู้ใช้จริง, retention, เวลาทำงานที่ลดลง = **NOT VERIFIED**)


## 5. CURRENT STATE — ทำได้จริงแล้ว (verify จากโค้ด 2026-10-07)

### 5.1 Admin app (`client/src/App.tsx`)

| Route | หน้า | สถานะ |
|---|---|---|
| `/` | Home (Operations dashboard) | ✅ implemented |
| `/feed` | Feed (Timeline เป็น lens ใน member/group detail modal — **ไม่ใช่ route**) | ✅ |
| `/inbox` · `/follow-up` | Mission Inbox · Follow-ups | ✅ |
| `/care` | CareToday | ✅ |
| `/members` · `/groups` · `/org` | People/Groups/Org | ✅ |
| `/attendance` · `/events` · `/announcements` · `/ministries` | เช็คชื่อ/งาน/ประกาศ/ฝ่ายงาน | ✅ |
| `/church` · `/map` · `/reports` | ข้อมูลคริสตจักร/แผนที่(Leaflet)/รายงาน+CSV | ✅ |
| `/import` (+ duplicates/org-data) | นำเข้า Excel (upload·preview·report·duplicates) | ✅ |
| `/profile` · `/login` · `/signup` · `/privacy` · `/terms` · 404 | ระบบ/กฎหมาย | ✅ |
| **`/media` · `/settings`** | **`ComingSoon` stub** | ⛔ **ยังไม่มี** — route ค้างไว้ไม่ให้ลิงก์เก่า 404 (`App.tsx:222-231`) |

### 5.2 Member PWA (`/app/*` — 5 หน้า)

`/app` (Home) · `/app/events` · `/app/group` · `/app/attendance` · `/app/profile` — `client/src/pages/member/`

### 5.3 API (19 route modules — `server/app.ts:107-124`)

`auth` · `dashboard` · `reports` (+ CSV export 4 รายการ) · `members` · `groups` · `activities` · `follow-ups` · `submissions` · `attendance` · `import` · `org-data` · `org` · `care` · `me` (portal) · `announcements` · `events` · `ministries` · `church-profile` · `clerkWebhook` (+ `/api/health`, `/api/ready`)

**Test คู่:** มีไฟล์ test รวม 21 ไฟล์ — แต่ **5 modules ไม่มี test คู่ของตัวเอง** (`announcements`, `auth`, `churchProfile`, `events`, `ministries`) มีเพียง test ข้ามกลุ่ม (`validationEnvelope.test.ts`, `probe-api.ts`) แตะผิว — บันทึกเป็นหนี้ **tracker D52**

### 5.4 Data & นำเข้า

- Schema SOT: `shared/schema.ts` · migration 11 ไฟล์ใน `server/db/migrations`
- นำเข้า Excel ระดับ L1/L2 ทำแล้ว (normalization 7 กติกา, quarantine ค่าผิด ไม่เดา) — **L3/L4 (promotion เข้าตารางหลัก) ยังไม่เริ่ม**
- `group_members` ยัง unique ทั้งคู่ — ประวัติการเข้า/ออกกลุ่ม **ยังไม่มี**

### 5.5 Auth/RBAC

Clerk (prod) · **7 roles** (`USER_ROLES` — `shared/schema.ts:21-29`) · ชุดสิทธิ์รวมที่ `shared/roles.ts` (SOT) · masking `MEMBER_CONTACT_ROLES` · ไม่มี admin UI จัดการ role (ดู §7)

## 6. Out of Scope (ขอบเขตที่ปิดตาย)

- ไม่ใช่ SaaS สาธารณะ — ใช้ภายในคริสตจักรเดียว
- ไม่มี message queue / cache layer / microservice / cron (ดู `ARCHITECTURE.md` §2)
- ไม่ทำ LINE/AI integration (แผนเดิม defer — `IMPLEMENTATION_PLAN` Phase 1)
- ไม่เปลี่ยน Business Logic หรือ UI เพื่อให้เหมือน reference project ใด ๆ

## 7. TARGET STATE — ยังไม่ทำ (แผนงานบันทึกไว้ ห้ามถือว่า implemented)

| # | สิ่งที่จะทำ | ที่มา | สถานะ |
|---|---|---|---|
| T1 | **Notifications** — event-driven (follow-up due, submission รอตรวจ) บน `pushSubscriptions` ที่มีอยู่ | `IMPLEMENTATION_PLAN` Phase 9+ | NOT STARTED |
| T2 | **Cross-domain Search** — เริ่มด้วย `ILIKE`/trigram บน Postgres ก่อนเพิ่ม infra ใหม่ | เดียวกัน | NOT STARTED |
| T3 | **Administration UI** — จัดการ RBAC บน `USER_ROLES` เติม `/settings` stub | เดียวกัน | NOT STARTED |
| T4 | **Navigation restructure (Phase 8)** — ต้องยืนยัน IA สุดท้ายกับเจ้าของก่อน (จุดที่แผนกำหนดให้ stop-and-confirm) | เดียวกัน | NOT STARTED |
| T5 | **Mission domain L3/L4** — migration ขั้น 2, 4–7 + promotion path จาก L2 | `MISSION_DOMAIN_PLAN` §13 | NOT STARTED (step 0 pre-check + dry-run 0010 มีแล้ว) |
| T6 | แผนที่แสดง activity (coords ใน `mission_activities` ยังไม่ถูก plot) | `IMPLEMENTATION_PLAN` Phase 7 "Still open" | NOT STARTED |
| T7 | `/media` — **ไม่มีแผนในเอกสารแผนงานใด ๆ** | — | NOT DEFINED |
| T8 | **โครงสร้างองค์กร 3 ระดับ** (body → ระดับกลาง "แคร์" ใหม่ → `care` "พันธกิจ" เดิม) — โค้ดวันนี้รองรับ 2 ระดับ | [ADR 002](./docs/adr/adr-002.md) `proposed` · **ทิศทางรอ Production Verification (Q24) ยังไม่ผ่าน** | NOT STARTED · ศัพท์/ชื่อเชิงเทคนิคระดับกลางยังไม่ยืนยัน |
| T9 | **สิทธิ์ตามสายบังคับบัญชา** (scope ตามผู้นำจริง + ลำดับชั้น แยก read/create/update/approve/export/delete) + บทบาท `team_lead` (ผู้จัดทำสถิติเลื่อน) | [ADR 003](./docs/adr/adr-003.md) `proposed` | NOT STARTED · ไม่มีบทบาท/security tests ในโค้ด |
| T10 | **รายงานพันธกิจประจำสัปดาห์** (draft → submitted → needs_revision \| acknowledged + superseded + ฟิลด์ "จัดกิจกรรมจริงหรือไม่") | [ADR 004](./docs/adr/adr-004.md) `proposed` · `MISSION_DOMAIN_PLAN` §9 | NOT STARTED · พึ่ง T5 (migration 0010) · กลไกเวอร์ชันตัดสินแล้ว (สองดัชนี: ฉบับปัจจุบันที่ไม่ใช่ draft + ร่างเปิดอยู่ 1 ฉบับ; ส่งฉบับใหม่แบบ atomic) แต่ **ยังไม่พิสูจน์ด้วยเทสต์/ไม่มี DDL** |
| T11 | **สถิติรวมสำหรับรายงานวันจันทร์** — คำนวณจากทะเบียน+รายงาน ไม่ให้กรอกซ้ำ แยกตามบอดี้/แคร์ เทียบสัปดาห์ก่อน | ADR 004 | NOT STARTED · NOT DEFINED (รูปแบบการแสดงผล) |
| T12 | **เป้าหมายรายสัปดาห์/ไตรมาส** — หัวหน้าทีมมอบ → บอดี้ → แคร์ (ระดับกลาง) → `care` | ADR 004 (W5) | NOT DEFINED — ยังไม่ออกแบบโมเดล |

### 7A. หลักการผลิตภัณฑ์ของงานบริหารพันธกิจ (TARGET — `proposed`)

> สถานะ: ข้อกำหนดเป้าหมายจาก session 2026-10-09 **ยังไม่ผ่านการตรวจรับ ADR ทั้งสามยังเป็น `proposed` ห้ามถือว่า implemented** รายละเอียด การตัดสินใจ และตาราง Open decisions อยู่ใน ADR 002–004 (**ศัพท์ระดับองค์กรอยู่ที่ ADR 002 ที่เดียว**) — ที่นี่เก็บเฉพาะหลักการ ไม่ทำสำเนา

**ข้อมูลไหลทางเดียว:** ทะเบียน (แหล่งข้อมูลหลัก) → รายงานประจำสัปดาห์ (บันทึกสิ่งที่เกิดขึ้น) → สถิติ (รวบรวมผลจริง คำนวณอัตโนมัติ) → เป้าหมาย (กำหนดสิ่งที่ต้องทำต่อ)

| ระบบย่อย | ใช้ทำอะไร | สถานะ |
|---|---|---|
| 1. ทะเบียนพันธกิจบ้าน | ข้อมูลประจำของกลุ่ม: บอดี้/แคร์ที่สังกัด (ระดับกลางยังไม่มีในโค้ด) ผู้นำ วัน-เวลา-สถานที่ พื้นที่/พิกัด รายชื่อสมาชิก (จำนวนสมาชิกคำนวณจากทะเบียนสมาชิก ไม่กรอกซ้ำ) | บางส่วนมีแล้ว (`groups`, `group_members`, `/map`) |
| 2. รายงานประจำสัปดาห์ | สิ่งที่เกิดขึ้นในสัปดาห์: จัดจริงหรือไม่ ผู้เข้าร่วม บทเรียน ผลลัพธ์/ปัญหา ภาพ ผูกกับกลุ่ม+สัปดาห์ | **ยังไม่มี** |
| 3. เป้าหมายและสถิติ | รายงานวันจันทร์: กลุ่มที่จัดจริง/ส่งรายงาน/ผู้ประสานงาน เป้าหมายเทียบผลจริง แยกตามบอดี้และแคร์ | **ยังไม่มี** |

**ข้อห้ามเชิงผลิตภัณฑ์:**
- ทะเบียนกลุ่มกับทะเบียนสมาชิกเป็นคนละระดับข้อมูลและเชื่อมกัน — ห้ามกรอกจำนวนคนซ้ำสองที่
- ผู้ใช้แต่ละระดับ **ไม่ควรเห็นหรือแก้ได้เท่ากัน** — ข้อมูลส่วนบุคคลจำกัดตามขอบเขตกลุ่มและความยินยอม และต้องผ่านการทบทวนโดยผู้รับผิดชอบด้านข้อมูลของคริสตจักรก่อนใช้งานจริง (ไม่ใช่การรับรอง PDPA)
- "ไม่ส่งรายงาน" ≠ "ไม่ได้จัดกิจกรรม" — ห้ามนับค่าที่ไม่มีหลักฐานเป็นข้อเท็จจริง
- **Member PWA (`/app/*`, เช่น `MemberHome`) ไม่ใช่หน้าผู้บริหาร** — dashboard ศิษยาภิบาล งานจัดการของหัวหน้าแคร์ และรายงานวันจันทร์ต้องออกแบบตามบทบาทของตนเอง ห้ามนำรูปแบบหน้า Member PWA ไปบังคับใช้ทั่วทั้งระบบ

**ฐานตรวจ (2026-10-10):** การเทียบโมเดลนี้กับโค้ดจริง ผลตรวจสิทธิ์ ช่องว่าง ทะเบียนข้อตัดสินใจรวม และลำดับงาน อยู่ที่ [`docs/PUNTAKIT_MISSION_OPERATING_MODEL_BASELINE.md`](./docs/PUNTAKIT_MISSION_OPERATING_MODEL_BASELINE.md) — ไม่ทำสำเนาที่นี่ · **ข้อค้นพบสำคัญ:** endpoint ของกลุ่มส่งเบอร์โทรสมาชิกโดยไม่ปิดบังให้ทุกบัญชี (tracker D54 — **แก้แล้วในโค้ด 2026-10-10 ยังไม่ deploy**)

## 8. User Flows (ปัจจุบัน — สำคัญสุด)

1. **เช็คชื่อ:** เจ้าหน้าที่ `/attendance` → เลือกกลุ่ม/วันที่ → บันทึก present|absent|leave|online → ดูซ้ำใน `/reports`
2. **ดูแลแคร์ (มือถือ):** ผู้นำแคร์ `/care` → เห็นงานเยี่ยม/ติดตามวันนี้ → บันทึกผล
3. **สมาชิก (PWA):** login → `/app` → ดูประกาศ/งาน → สมัครงาน (`/app/events`) → เช็คชื่อตัวเอง (`/app/attendance`)
4. **นำเข้า Excel:** admin `/import` → upload (≤4.5 MB ตรง, ใหญ่กว่าผ่าน Vercel Blob) → preview → ตรวจ duplicates → confirm → report
5. **Feed/Operations:** ดู `MissionActivity` แกนเดียวผ่าน lens `/feed` · Timeline (ใน modal) · `/map` · `/`

## 9. Business Rules (กติกาที่ห้ามละเมิด)

- **Standing rules** (`MISSION_DOMAIN_PLAN`): NEVER DERIVE BIRTH DATE FROM AGE · NEVER USE NICKNAME AS REAL IDENTITY · NEVER FILL REAL NAME FROM NICKNAME · NEVER USE GROUP NAME TEXT AS RELATIONSHIP IDENTITY · NEVER TURN UNKNOWN DATA INTO FACT
- สิทธิ์: นิยามเดียวที่ `shared/roles.ts` — ห้ามเขียนรายการ role inline ซ้ำ
- ลบสมาชิก/กลุ่ม = admin เท่านั้น (`ADMIN_ROLES`); กลุ่มมีพันธกิจค้าง → 409 (ADR 003 `proposed` คงข้อนี้: delete ไม่ผูกกับบทบาทตามสายบังคับบัญชา)
- **ห้ามเปลี่ยนป้าย UI ที่มีมติเดิม** (เช่น "พันธกิจ" บนระดับ `care`) โดยพลการ — ความขัดแย้งด้านคำศัพท์กับโครงสร้าง 3 ระดับบันทึกที่ [ADR 002](./docs/adr/adr-002.md)
- Webhook Clerk ต้องผ่าน Svix signature ก่อนแตะ DB
- ไม่มี native enum ใน DB — ค่า validate ที่ Zod เท่านั้น (`shared/validation.ts`) — ดู `ARCHITECTURE.md` R9

## 10. Data Requirements

| ต้องการ | ความจริง ณ วันนี้ |
|---|---|
| ตารางแกน `mission_activities` (+participants/media) | ✅ มี (migration 0004) |
| ประวัติเข้า/ออกกลุ่ม | ⛔ ยังไม่มี — dry-run SQL รอ step 0 (§7 T5) |
| รายงานประจำสัปดาห์ | ⛔ ยังไม่มี (แผน `weekly_reports` 3 ตาราง — ต้องเพิ่มฟิลด์ "จัดกิจกรรมจริงหรือไม่", ผู้ตรวจ และกลไกเวอร์ชันตาม [ADR 004](./docs/adr/adr-004.md) ก่อนสร้าง) |
| ระดับกลาง "แคร์" (ใหม่ — Proposed) | ⛔ ยังไม่มี — `GROUP_ORG_LEVELS` มี `body`/`care` เท่านั้น และไม่มีแหล่งข้อมูลที่ระบุว่า `care` ใดอยู่ใต้แคร์ใด ([ADR 002](./docs/adr/adr-002.md)) |
| เป้าหมายรายสัปดาห์/ไตรมาส | ⛔ ยังไม่มีทั้งตารางและแผน — **NOT DEFINED** (ADR 004 W5) |
| พื้นที่ (`areas`) · รายละเอียดสมาชิก Excel (`mission_member_details`) | ⛔ ยังไม่มี (แผนไว้) |
| พิกัด | `groups` มีคอลัมน์ · `mission_activities` มีคอลัมน์ แต่ **0 coordinates ในข้อมูลนำเข้าจริง** — human places pins, ห้าม derive |

## 11. Roadmap (จัดลำดับจากแผนเดิม + หนี้)

0. **ปิด Q24 (ตรวจ production แบบ read-only), ตรวจรับข้อกำหนด T8–T12 (ADR 002–004) และ audit ตัวเลขขนาดองค์กรจากไฟล์จริงก่อนขยาย UI ฝั่งผู้บริหาร/หัวหน้า** — เอกสารเท่านั้น ยังไม่ลงมือแก้โค้ด; ลำดับลงมือภายหลังพึ่ง T5 ก่อน (รายงานรายสัปดาห์ต้องมีประวัติสมาชิกกลุ่ม)
1. **ปิดหนี้ P0 จาก tracker** (D1–D7: contrast/safe-area โหมดมืด) — กระทบผู้ใช้ตรง ๆ
2. T5 (L3/L4 + history migration) — ข้อมูล import ยังค้างบนชั้น raw
3. T3 (Administration UI) — ตอนนี้ role แก้ผ่าน DB/bootstrap เท่านั้น
4. T1/T2 (Notifications, Search) — ตามแผนเดิม
5. T4 (Navigation) — ต้องได้การยืนยันจากเจ้าของก่อนเสมอ

## 12. Open Questions (blocking — ต้องมนุษย์ตอบ)

- จำนวนผู้ใช้จริง/SLA/เมตริกธุรกิจ = **NOT VERIFIED** (ไม่มีบันทึกที่ใด)
- `/media` จะทำจริงหรือถอด route = **NOT DEFINED**
- ขอบเขต Phase 4 data migration เดิม (ย้าย `members.status` → `followUps`) ยังถูกยกไว้เป็นจุด stop-and-confirm — สถานะปัจจุบัน = **NOT VERIFIED**
- **จำนวนบอดี้/แคร์/พันธกิจบ้าน/กลุ่มที่ทำได้จริง (ราว 6/20/52/49) = NOT VERIFIED** — ไม่มีไฟล์ต้นฉบับและรายงานตัวอย่างให้ตรวจ และขัดกับ ~23 กลุ่ม/72 sheet ที่ audit เดิมนับ และ "20 แคร์" **ตรวจจากฐานข้อมูลไม่ได้เลย** เพราะระดับกลางไม่มีในระบบ
- **Q24 Production Verification ยังไม่ได้ทำ (`NOT VERIFIED`)** — ทิศทางโครงสร้างองค์กรใน ADR 002 (Q23) จึงเป็น Proposed ขั้นตอนอ่านข้อมูลแบบ read-only อยู่ใน ADR 002
- ข้อตัดสินใจที่ค้าง (รายละเอียดอยู่ใน ADR เท่านั้น): [ADR 002](./docs/adr/adr-002.md) O1–O6 · [ADR 003](./docs/adr/adr-003.md) S2–S8 · [ADR 004](./docs/adr/adr-004.md) W5–W11 (W4 ตัดสินแล้ว; W8 แคบลงเหลือการจัดหมวดของ `needs_revision`/`held=false` ที่ยังไม่รับรอง; W10–W11 เกี่ยวกับร่างฉบับแก้ไข)

---

**ความสัมพันธ์กับเอกสารอื่น:** สถาปัตยกรรม → [`ARCHITECTURE.md`](./ARCHITECTURE.md) · UI → [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) · หนี้ → [`docs/exec-plans/tech-debt-tracker.md`](./docs/exec-plans/tech-debt-tracker.md) · แผนละเอียด → [`docs/PUNTAKIT_IMPLEMENTATION_PLAN.md`](./docs/PUNTAKIT_IMPLEMENTATION_PLAN.md), [`docs/PUNTAKIT_MISSION_DOMAIN_PLAN.md`](./docs/PUNTAKIT_MISSION_DOMAIN_PLAN.md) · ข้อกำหนดตามสายบังคับบัญชา (`proposed`) → [`ADR 002`](./docs/adr/adr-002.md) · [`003`](./docs/adr/adr-003.md) · [`004`](./docs/adr/adr-004.md)
