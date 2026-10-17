# TICKETS — role-based-pages

Source: `SPEC.md` (draft) · `GRILL.md` (D1–D6) · Date: 2026-10-16 · Base commit `666e9a3`

> **ประตูอนุมัติภายนอก:** ทุก ticket เริ่มที่ `Status: draft` ผู้ใช้ต้องเปลี่ยนบรรทัด `Status:` เป็น `approved`  
> ในไฟล์นี้ด้วยตนเองเท่านั้น การยืนยันในแชทไม่ถือเป็นการอนุมัติ ยังไม่มี ticket ใดได้รับอนุมัติ  
> **ห้าม `/implement` ticket ที่ไม่ใช่ `approved`**

---

## กติการ่วมทุก ticket (ผูกกับ GRILL §4)

- ห้าม stage, commit, push, หรือ deploy; ห้ามเขียนข้อมูลลงฐานข้อมูล production; การทดสอบรันบน PGlite ชั่วคราวใน `%TEMP%`
- ห้ามแตะไฟล์ค้างเดิม: `CLAUDE.md`, `client/src/pages/PinSignInPage.tsx`, บล็อก `.pin-login` ใน `index.css`, และ `stash@{0}`
- ไม่สร้าง Role ใหม่ ไม่แตะ `USER_ROLES` ใน `shared/schema.ts` และไม่สร้าง Migration
- `client/src/index.css`: หากต้องเพิ่ม ให้เพิ่มเฉพาะบล็อกใหม่ท้ายไฟล์ ห้ามแก้บล็อกเดิม
- ทุกพื้นที่กด (Touch Targets) ≥ 44×44px; รองรับ viewport 320/390/768/1280px โดยไม่มี horizontal overflow
- รองรับ light/dark และ `prefers-reduced-motion`; ไม่เพิ่ม raw color palette นอกเหนือโทเค็นเดิม
- รัน static check (`pnpm check`), `git diff --check`, และ tests ที่เกี่ยวข้องทุกครั้งก่อนรายงาน

---

## RBP-01 — ปรับแต่งชุดไทล์ทางลัดหน้าแรกตามบทบาทจริง (Home Quick Action Tiles)

Status: done  
Blocked by: —  
Priority: P1 · ขนาดโดยประมาณ: กลาง (M)

**Vertical slice:** Role mapping → `homeTilesFor(role)` และ Role-scoped Secondary Links → ไทล์หน้าแรกและทางลัดรอง "ดูทั้งหมด" → Tests ตรวจสอบทุกบทบาทและสถานะ Session Loading

**ไฟล์ที่จะเปลี่ยนแปลง:**
- `client/src/lib/homeTiles.ts`
- `client/src/lib/homeTiles.test.ts`
- `client/src/components/home/HomeMyWork.tsx`
- `client/src/role-aware-ui.test.ts`
- `client/src/membership-ui.test.ts`

**Acceptance Criteria (ปรับปรุงตาม Review):**

1. **การกรองชุดไทล์หลัก (Primary Tiles) และทางลัดรอง (Secondary Links) ตาม Role และ Permission จริง:**
   - ใช้ canonical role sets จาก `shared/roles.ts` (`CREATE_ROLES`, `MEMBERSHIP_VIEW_ROLES`, `PRIVILEGED_ROLES`, `ADMIN_SHELL_ROLES`) ห้ามเขียนรายชื่อ role ซ้ำใน component
   - ห้ามนำ static `SECONDARY_LINKS` ทั้ง 7 รายการมาแสดงให้ทุกบทบาทโดยไม่กรอง (พฤติกรรมปัจจุบันของ `HomeMyWork.tsx` ที่ `group_leader` เห็นครบ 7 ลิงก์ ต้องแก้) รายการ "ดูทั้งหมด" ต้องคำนวณใน `homeTiles.ts` (ย้าย `SECONDARY_LINKS` เข้าไป และเพิ่ม helper เช่น `homeMoreLinksFor(role, extraLinks)`) แล้ว `HomeMyWork` เรียกใช้ helper นั้นแทน `mergeHomeLinks(SECONDARY_LINKS, ...)`
   - **ตารางตรวจรับ (ต้องตรงทุกช่อง; ลำดับในช่อง Secondary คือลำดับที่แสดง):**

     | Role | Primary Tiles (ตามลำดับ) | Secondary Links ใต้ "ดูทั้งหมด" (ตามลำดับ) |
     |---|---|---|
     | `super_admin` | `care`, `photo`, `membership`, `followUp` | `/members`, `/groups`, `/attendance`, `/events`, `/feed`, `/announcements`, `/map`, `/reports` (8) |
     | `admin` | `care`, `photo`, `membership`, `followUp` | เหมือน `super_admin` ทุกรายการ (8) |
     | `staff` | `care`, `photo`, `membership`, `followUp` | เหมือน `super_admin` ทุกรายการ (8) |
     | `ministry_leader` | `care`, `photo`, `followUp` (ไม่มี `membership`) | `/members`, `/groups`, `/attendance`, `/events`, `/feed`, `/announcements`, `/map`, `/ministries` (8) |
     | `group_leader` | `care`, `photo`, `membership` (ไม่มี `followUp`) | `/follow-up`, `/groups`, `/members` (3 เท่านั้น) |
     | `viewer` | `followUp` | `/members`, `/groups`, `/attendance`, `/events`, `/feed`, `/announcements`, `/map` (7) |
     | `member` | ไม่มี | ไม่มี (`Home` ส่งต่อไป `/app` ผ่าน `ProtectedRoute`) |

   - **ข้อแตกต่างของ `super_admin` / `admin` / `staff` — อยู่ที่ Route Access ไม่ใช่ที่หน้าแรก:** ทั้งสามบทบาทเห็นไทล์และลิงก์หน้าแรกชุดเดียวกัน (`/reports` อยู่ใน `PRIVILEGED_ROLES` ซึ่งครอบคลุมทั้งสาม) ห้ามเพิ่มลิงก์ที่มีเฉพาะบางบทบาทในหมู่ทั้งสามบนหน้าแรก ส่วนที่ต่างกันเป็นสิทธิ์เข้า Route ตาม `App.tsx` และต้องไม่ถูกแตะใน ticket นี้:
     - `/admin/users`, `/admin/pins`: เฉพาะ `super_admin` (`SUPER_ADMIN_ROLES`); `admin` และ `staff` ถูกปฏิเสธโดย `ProtectedRoute` (denied)
     - `/import/org`: `super_admin` และ `admin` (`ADMIN_ROLES`); `staff` เข้าไม่ได้
     - ไทล์ `membership` และปุ่มบันทึกการชำระเงิน: `staff` ใช้ได้ตาม `MEMBERSHIP_VIEW_ROLES` / `MEMBERSHIP_PAYMENT_ROLES` เช่นเดียวกับ `admin` (ไม่ต่างกัน)
     - ลิงก์ `/admin/users` และ `/admin/pins` ไม่อยู่ในทางลัดหน้าแรกของบทบาทใดเลย (เข้าได้ผ่าน Sidebar เท่านั้น)
   - **`group_leader`:** Secondary Links ต้องเป็น `/follow-up`, `/groups`, `/members` เท่านั้น สอดคล้องกับ `groupLeaderNavGroups` ใน `Sidebar.tsx` (ไม่แสดง `/attendance`, `/events`, `/feed`, `/announcements`, `/map`, `/reports`, `/ministries`) ลิงก์ใดที่ `Home.tsx` ส่งผ่าน `extraLinks` แล้วไม่อยู่ใน 3 รายการนี้ต้องถูกตัดทิ้งสำหรับบทบาทนี้ (ไม่ต้องแก้ `Home.tsx`) `/care` และ `/memberships` เป็นไทล์อยู่แล้วจึงไม่ซ้ำในรายการลิงก์
   - **`ministry_leader`:** `/ministries` (ฝ่ายงาน) เป็นลิงก์ของบทบาทนี้ ต้องปรากฏ **ครั้งเดียว** ในรายการ (ท้ายรายการ) ไม่ว่า `extraLinks` จาก `Home.tsx` จะส่ง `/ministries` มาด้วยหรือไม่ และ **ไม่แสดง** `/ministries` ให้ `super_admin`, `admin`, `staff`, `group_leader`, `viewer` บนหน้าแรก ไม่เพิ่ม `/reports` ให้บทบาทนี้ (คงพฤติกรรมเดิม)
   - **`viewer`:** ทุกลิงก์ในแถวต้องเป็น Route ที่ `ADMIN_SHELL_ROLES` เข้าถึงได้ ไม่มีลิงก์ที่ติด 403 หรือ redirect
   - **ไม่มีรายการซ้ำ:** ในผลลัพธ์ของทุกบทบาท ห้ามมี `href` ซ้ำกันเอง และห้ามซ้ำกับ `href` ของไทล์หลักที่แสดงอยู่ (`/care`, `/memberships`, `/follow-up` เมื่อเป็นไทล์) Unit test ต้องยืนยันด้วย `new Set(hrefs).size === hrefs.length` ต่อบทบาท

2. **การจัดการสถานะระหว่างโหลด Session (`role === undefined`):**
   - เมื่อ `role === undefined` (Session กำลังโหลดจาก `AuthProvider` หรือยังไม่ได้เข้าสู่ระบบ):
     - `homeTilesFor(undefined)` คืนค่า `{ primary: [], moreExtra: [] }` และ `homeMoreLinksFor(undefined, ...)` คืน `[]` (ไม่แสดง Secondary Links ใดเลย แม้ลิงก์พื้นฐาน)
     - ส่วน "ทำต่อได้เลย" และ "ดูทั้งหมด" ใน `HomeMyWork` จะไม่แสดงไทล์หรือลิงก์ที่มีสิทธิ์พิเศษ ป้องกันปัญหา Content Flashing (FOUC)
     - มี Unit Test และ Contract Test ยืนยันพฤติกรรมสถานะ `role === undefined` ชัดเจน

3. **การรักษาพฤติกรรม Badge บนไทล์เดิม:**
   - ไทล์ `membership`: หากมี `data.membership.attention > 0` ให้แสดง Badge ข้อความ `${attention} ต้องดำเนินการ` ใน `StatusChip tone="warning"` มุมบนขวา (ไม่พึ่งสีอย่างเดียว)
   - ไทล์ `followUp`: หากมี `data.counts.openFollowUps > 0` ให้แสดง Badge ข้อความ `${openFollowUps} รายการ` ใน `StatusChip tone="warning"`
   - ทั้งสองค่าต้องคำนวณจากข้อมูลจริงของ `/api/home/overview` ตามเดิม ห้ามใช้ค่าสมมติ

4. **ขนาดและการเข้าถึง (Accessibility & UI Specifications):**
   - ไทล์หลักคงขนาดวงกลมไอคอน ≥ 64px, ความสูงไทล์ ≥ 120px, พื้นที่กดเท่าทั้งไทล์ (≥ 44×44px)
   - ส่วนไทล์ "ทำต่อได้เลย" แสดงผลอยู่เหนือ `ErrorState` เสมอ เพื่อให้ผู้ใช้กดทางลัดได้แม้สถิติ overview โหลดไม่สำเร็จ
   - รายการทางลัดรองใต้ "ดูทั้งหมด" เป็นปุ่ม pill เรียบง่าย (ไม่มีไอคอนตกแต่งฟุ่มเฟือย) และเคารพสถานะ `aria-expanded`
   - ผ่านเกณฑ์ Contrast (ข้อความ ≥ 4.5:1, ไอคอน ≥ 3:1) ทั้ง Light และ Dark mode
   - ไม่มีการเรียกใช้ `/api/dashboard/summary` (ซึ่งส่งยอดทั้งคริสตจักรแบบไม่มี scope) บนหน้าจอ

**Public test seam:**
- `homeTilesFor(role)` unit tests ใน `client/src/lib/homeTiles.test.ts` (ครอบคลุมทุกบทบาท และกรณี `role === undefined`)
- Contract tests ใน `client/src/role-aware-ui.test.ts` และ `client/src/membership-ui.test.ts` ยืนยันว่าไม่มีการเขียน role list ซ้ำ และ badge/tiles ทำงานตามเกณฑ์

**สิทธิ์ที่ต้องรักษา:** กรองไทล์และทางลัดด้วย canonical role sets จาก `shared/roles.ts` เท่านั้น

**ความเสี่ยงและการทดสอบ:**
- ตรวจสอบว่า `viewer` ไม่เห็นปุ่มที่ยิง API แล้วติด 403
- ตรวจสอบ responsive ที่ 320px และ 390px ไม่ล้นขอบจอ
- ตรวจสอบว่าไม่มีลิงก์ปลายทางที่กดแล้วนำไปสู่หน้าว่างหรือหน้า `ComingSoon`

---

## RBP-02 — ปรับปรุง Care Data Scope ให้รองรับกลุ่มลูกของบอดี้ (Backend Hierarchy Resolution)

Status: approved  
Blocked by: —  
Priority: P1 · ขนาดโดยประมาณ: กลาง (M)

**Vertical slice:** ฟังก์ชัน Scope ใน backend → การดึงกลุ่มลูก (Cycle-safe traversal) → ทดสอบสิทธิ์ `/care` และ `/members` สำหรับหัวหน้าบอดี้และหัวหน้าแคร์

**ไฟล์ที่จะเปลี่ยนแปลง:**
- `server/lib/careScope.ts`
- `server/lib/careScope.test.ts` (ใหม่ หรือเพิ่มใน test suite ของ care)
- `server/routes/care.test.ts`
- `server/routes/members.test.ts`

**Acceptance Criteria:**
1. ปรับปรุงฟังก์ชัน `getLedGroupIds(userId)` หรือสร้าง `getScopedCareGroupIds(userId)` ใน `server/lib/careScope.ts` ให้เรียกใช้ `withDescendantGroups()` เพื่อรวมกลุ่มลูกภายใต้กลุ่มที่ผู้นำนำโดยตรง
2. หัวหน้าบอดี้ (ผู้นำกลุ่มที่มี `org_level = 'body'`) สามารถ:
   - เข้าถึงและดูสมาชิกของแคร์ลูกในหน้า `/care` ได้
   - ค้นหาและดูสมาชิกในขอบเขตบอดี้ของตนผ่าน `/api/members` ได้ โดยไม่เจอหน้าว่าง
3. **การป้องกันสิทธิ์รั่วไหล (Strict Boundary):**
   - หัวหน้าบอดี้ A **ไม่สามารถ** เข้าถึงกลุ่มหรือสมาชิกของบอดี้ B หรือแคร์ลูกของบอดี้ B (ต้องตอบ 403 Forbidden เสมอ)
   - หัวหน้าแคร์ A **ไม่สามารถ** เข้าถึงแคร์ B ที่อยู่ระดับเดียวกัน แม้จะอยู่ใต้บอดี้เดียวกัน
4. **การรักษาสิทธิ์ของ Membership Lifecycle:**
   - การตัดสินใจสถานะสมาชิก (`canDecide`) ใน `membershipScope.ts` **ต้องคงเดิม**: เฉพาะผู้นำแคร์โดยตรงเท่านั้นที่ประเมินหรือเปลี่ยนสถานะได้ (หัวหน้าบอดี้ยังคงเป็น View-only สำหรับแคร์ลูก)
5. เขียน Automated Tests พิสูจน์ขอบเขตข้อมูล:
   - Test เคสหัวหน้าบอดี้เข้าถึงแคร์ลูก = 200 OK
   - Test เคสหัวหน้าบอดี้เข้าถึงบอดี้อื่นหรือแคร์อื่น = 403 Forbidden
   - Test เคสหัวหน้าแคร์เข้าถึงแคร์อื่น = 403 Forbidden
6. **ขอบเขตที่เจ้าของอนุมัติ (2026-10-17):** scope ที่ขยายเป็น**ฝั่งอ่านเท่านั้น** การเขียน (บันทึกเช็คชื่อ, `PUT /api/members/:id`) คงเป็นผู้นำโดยตรง; `GET /api/members/:id` นอก scope ตอบ **404** (กัน ID enumeration) ไม่ใช่ 403 — ตรงกับโค้ดและ `server/lib/careScope.test.ts`

**Public test seam:** `server/lib/careScope.test.ts` รันด้วย Vitest + PGlite DB

**สิทธิ์ที่ต้องรักษา:** คงกฎ `isScopedRole(user.role) => role === "group_leader"`; ผู้ใช้ระดับ `super_admin`, `admin`, `staff` ยังคงเข้าถึงได้ทุกกลุ่มตามเดิม

**ความเสี่ยงและการทดสอบ:** ระวังปัญหา Circular Reference ใน `parentGroupId` (ฟังก์ชันต้องเป็น Cycle-safe); ตรวจสอบผลกระทบต่อ `assertGroupInScope` และ `assertMembersInScope`

---

## RBP-03 — ตรวจสอบการทำงานแบบ Persona Walkthrough และความสมบูรณ์ของ UI/UX (Verification & Polish)

Status: draft  
Blocked by: RBP-01, RBP-02  
Priority: P2 · ขนาดโดยประมาณ: เล็ก (S)

**Vertical slice:** ทดสอบเสมือนผู้ใช้จริง 6 Persona บนเบราว์เซอร์ → ตรวจสอบ Loading, Empty, Error, Responsive, Dark theme → สรุปผล Audit รอบปิดงาน

**ไฟล์ที่จะตรวจสอบ:**
- ทุกหน้าจอที่เกี่ยวข้องกับทางลัดและขอบเขตงาน (`HomeMyWork.tsx`, `CareToday.tsx`, `Members.tsx`, `Memberships.tsx`)
- `.ai/workflow/features/role-based-pages/E2E-AUDIT.md` (จัดทำรายงานผลการตรวจจริง)

**Acceptance Criteria:**
1. ทดสอบ Login เสมือนจริงด้วย session สังเคราะห์ 6 Persona:
   - `super_admin`: เห็นไทล์ครบ 4 อัน, เข้าถึง `/admin/users` ได้
   - `admin`: เห็นไทล์ครบ 4 อัน, เข้าถึงงานบริหารได้, เข้า `/admin/users` ไม่ได้ (ได้ 403 ตามสิทธิ์)
   - `ministry`: เห็นไทล์ 3 อัน (เช็คชื่อ, ภาพ, การติดตาม), ไม่เห็นไทล์สถานะสมาชิก
   - `bodyLead`: เห็นไทล์ 3 อัน, กด `/care` และ `/members` แล้วเห็นสมาชิกของแคร์ลูก ไม่เจอหน้าว่าง
   - `careA`: เห็นไทล์ 3 อัน, กด `/care` เห็นเฉพาะสมาชิกแคร์ตนเอง
   - `viewer`: เห็นเฉพาะไทล์การติดตาม, เบอร์โทรในทะเบียนถูก Mask ทั้งหมด
2. ทุกหน้าจอแสดงผลถูกต้องบน Viewport: 320px, 390px, 768px, 1280px ไม่มีข้อความล้นหรือตกขอบ
3. รองรับ Light mode และ Dark mode อย่างสมบูรณ์ ไม่มีสีเพี้ยนหรือคอนทราสต์ต่ำกว่า 4.5:1
4. ไม่มี Console Error หรือ Warning แดงในทุก Flow การใช้งานหลัก
5. รัน `pnpm check`, `pnpm test` (ครบทุก suite 65+ ไฟล์), `pnpm build`, และ `git diff --check` ผ่าน 100%

**Public test seam:** Playwright Persona Walkthrough scripts ใน scratchpad (ไม่เขียนลง repo)

**สิทธิ์ที่ต้องรักษา:** ข้อมูลไม่รั่วไหลข้าม Role, ไม่มีการแก้ไข API นอกเหนือจากที่ระบุใน Ticket

---
