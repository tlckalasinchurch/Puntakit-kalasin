<!-- last_verified: 2026-10-07 -->
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
| ผู้นำแคร์/พันธกิจ | `/care` บนมือถือ | `ARCHITECTURE.md` §1 stakeholders |
| สมาชิก (ทั่วไป) | member PWA `/app/*` | `client/src/pages/member/` (5 หน้า) |
| ผู้ดูแลระบบ 1–2 คน | settings/bootstrap | จำนวนจริง = **NOT VERIFIED** |

## 3. Problem

- ข้อมูลสมาชิก 674 แถว / ~23 กลุ่ม จาก 8 ไฟล์ Excel ไม่มีที่เก็บกลาง — นำเข้าผ่าน `/import` แล้ว (L1/L2) แต่ยังไม่ promotion เข้าระบบหลัก (L3/L4)
- ไม่มีประวัติการเป็นสมาชิกกลุ่ม (join → leave → rejoin) — schema ปัจจุบัน unique ทั้งคู่ กันไม่ได้ (dry-run SQL มีแล้วที่ `server/db/pending/0010_group_members_history.sql` **ยังไม่ apply**)
- งานพันธกิจบันทึกเป็นข้อความ/รูป ไม่มี object กลาง ⇒ ดู Feed/Timeline/Operations ไม่ได้จากมุมเดียว

## 4. Goals (วัดได้)

| # | เป้า | ตรวจอย่างไร |
|---|---|---|
| G1 | ข้อมูลสมาชิกไม่รั่วข้ามบทบาท (mask เบอร์/อีเมลตาม role) | `MEMBER_CONTACT_ROLES` gating + `membersPrivacy.test.ts` |
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

## 8. User Flows (ปัจจุบัน — สำคัญสุด)

1. **เช็คชื่อ:** เจ้าหน้าที่ `/attendance` → เลือกกลุ่ม/วันที่ → บันทึก present|absent|leave|online → ดูซ้ำใน `/reports`
2. **ดูแลแคร์ (มือถือ):** ผู้นำแคร์ `/care` → เห็นงานเยี่ยม/ติดตามวันนี้ → บันทึกผล
3. **สมาชิก (PWA):** login → `/app` → ดูประกาศ/งาน → สมัครงาน (`/app/events`) → เช็คชื่อตัวเอง (`/app/attendance`)
4. **นำเข้า Excel:** admin `/import` → upload (≤4.5 MB ตรง, ใหญ่กว่าผ่าน Vercel Blob) → preview → ตรวจ duplicates → confirm → report
5. **Feed/Operations:** ดู `MissionActivity` แกนเดียวผ่าน lens `/feed` · Timeline (ใน modal) · `/map` · `/`

## 9. Business Rules (กติกาที่ห้ามละเมิด)

- **Standing rules** (`MISSION_DOMAIN_PLAN`): NEVER DERIVE BIRTH DATE FROM AGE · NEVER USE NICKNAME AS REAL IDENTITY · NEVER FILL REAL NAME FROM NICKNAME · NEVER USE GROUP NAME TEXT AS RELATIONSHIP IDENTITY · NEVER TURN UNKNOWN DATA INTO FACT
- สิทธิ์: นิยามเดียวที่ `shared/roles.ts` — ห้ามเขียนรายการ role inline ซ้ำ
- ลบสมาชิก/กลุ่ม = admin เท่านั้น (`ADMIN_ROLES`); กลุ่มมีพันธกิจค้าง → 409
- Webhook Clerk ต้องผ่าน Svix signature ก่อนแตะ DB
- ไม่มี native enum ใน DB — ค่า validate ที่ Zod เท่านั้น (`shared/validation.ts`) — ดู `ARCHITECTURE.md` R9

## 10. Data Requirements

| ต้องการ | ความจริง ณ วันนี้ |
|---|---|
| ตารางแกน `mission_activities` (+participants/media) | ✅ มี (migration 0004) |
| ประวัติเข้า/ออกกลุ่ม | ⛔ ยังไม่มี — dry-run SQL รอ step 0 (§7 T5) |
| รายงานประจำสัปดาห์ | ⛔ ยังไม่มี (แผน `weekly_reports` 3 ตาราง) |
| พื้นที่ (`areas`) · รายละเอียดสมาชิก Excel (`mission_member_details`) | ⛔ ยังไม่มี (แผนไว้) |
| พิกัด | `groups` มีคอลัมน์ · `mission_activities` มีคอลัมน์ แต่ **0 coordinates ในข้อมูลนำเข้าจริง** — human places pins, ห้าม derive |

## 11. Roadmap (จัดลำดับจากแผนเดิม + หนี้)

1. **ปิดหนี้ P0 จาก tracker** (D1–D7: contrast/safe-area โหมดมืด) — กระทบผู้ใช้ตรง ๆ
2. T5 (L3/L4 + history migration) — ข้อมูล import ยังค้างบนชั้น raw
3. T3 (Administration UI) — ตอนนี้ role แก้ผ่าน DB/bootstrap เท่านั้น
4. T1/T2 (Notifications, Search) — ตามแผนเดิม
5. T4 (Navigation) — ต้องได้การยืนยันจากเจ้าของก่อนเสมอ

## 12. Open Questions (blocking — ต้องมนุษย์ตอบ)

- จำนวนผู้ใช้จริง/SLA/เมตริกธุรกิจ = **NOT VERIFIED** (ไม่มีบันทึกที่ใด)
- `/media` จะทำจริงหรือถอด route = **NOT DEFINED**
- ขอบเขต Phase 4 data migration เดิม (ย้าย `members.status` → `followUps`) ยังถูกยกไว้เป็นจุด stop-and-confirm — สถานะปัจจุบัน = **NOT VERIFIED**

---

**ความสัมพันธ์กับเอกสารอื่น:** สถาปัตยกรรม → [`ARCHITECTURE.md`](./ARCHITECTURE.md) · UI → [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) · หนี้ → [`docs/exec-plans/tech-debt-tracker.md`](./docs/exec-plans/tech-debt-tracker.md) · แผนละเอียด → [`docs/PUNTAKIT_IMPLEMENTATION_PLAN.md`](./docs/PUNTAKIT_IMPLEMENTATION_PLAN.md), [`docs/PUNTAKIT_MISSION_DOMAIN_PLAN.md`](./docs/PUNTAKIT_MISSION_DOMAIN_PLAN.md)
