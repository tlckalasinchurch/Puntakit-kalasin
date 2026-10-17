# Audit Report: Role-Based Pages (Phase A — Read-only Audit)

วันที่ตรวจสอบ: 2026-10-16  
เอกสารอ้างอิง: `Puntakit-Role-Based-Pages.md`  
สถานะ: **Phase A Complete — Read-only Audit** (ยังไม่มีการแก้ไขโค้ดหน้าจอหรือระบบใด ๆ)

---

## (ก) ตารางเทียบ "6 กลุ่มผู้ใช้ในไฟล์ข้อกำหนด" กับ Role/Scope จริงในระบบ

ระบบ Puntakit มีระบบ Role เดียวผ่าน enum `USER_ROLES` ใน `shared/schema.ts` และ canonical role sets ใน `shared/roles.ts` ไม่มี Role แยกตามชื่อกลุ่มองค์กร

| กลุ่มผู้ใช้ในข้อกำหนด | Role / Scope จริงในระบบ | หลักฐาน (ไฟล์:บรรทัด) | สถานะการจับคู่ (Mapping Status) |
|---|---|---|---|
| **1. Super Admin** | `super_admin` | `shared/schema.ts:31`<br>`shared/roles.ts:95` (`SUPER_ADMIN_ROLES`) | **ตรงกันสมบูรณ์ (1:1)** — เป็นบทบาทเดียวที่มีสิทธิ์จัดการผู้ใช้และ PIN (`/admin/users`, `/admin/pins`) |
| **2. Admin** | `admin` | `shared/schema.ts:32`<br>`shared/roles.ts:51` (`ADMIN_ROLES`) | **ตรงกันเกือบทั้งหมด** — ต่างจุดสำคัญคือ `admin` **ไม่มีสิทธิ์** เข้าถึง `/admin/users` (ถูกจำกัดเฉพาะ `super_admin`) |
| **3. หัวหน้าทีม (ศบ. / อาจารย์)** | *ไม่มี Role นี้โดยตรง*<br>ใกล้เคียงสุด: `ministry_leader` หรือ `staff` หรือ `admin` | `shared/schema.ts:33` (`ministry_leader`)<br>`shared/schema.ts:35` (`staff`) | **ไม่สามารถ Map ได้โดยตรง (Unmapped)**<br>- `ministry_leader` ในระบบคือนำ "ฝ่ายงาน" (`ministries` table) ไม่ใช่ผู้นำทีมดูแล และไม่มีสิทธิ์ดูสมาชิกรายปี (`MEMBERSHIP_VIEW_ROLES`)<br>- หากเป็น ศบ./ผู้บริหาร คริสตจักรมักใช้ `admin` หรือ `staff` |
| **4. หัวหน้าบอดี้** | Role: `group_leader`<br>Scope: นำกลุ่มที่มี `org_level = 'body'` | `shared/schema.ts:237-238` (`GROUP_ORG_LEVELS`)<br>`shared/schema.ts:274-275` (`groups.orgLevel`, `parentGroupId`)<br>`server/lib/membershipScope.ts:34-55` (`withDescendantGroups`) | **ไม่ใช่ Role แยก แต่เป็น Data Scope**<br>- ใน `/memberships` เห็นสมาชิกบอดี้ตัวเองและแคร์ลูกทั้งหมด (อ่านอย่างเดียว ไม่สามารถตัดสินใจแทนแคร์ลูก)<br>- **แต่ใน `/care` และ `/members`** Scope ยังจำกัดเฉพาะกลุ่มที่ตนนำตรง ไม่รวมกลุ่มลูก (ดูปัญหาข้อ 3 ใน E2E-AUDIT) |
| **5. หัวหน้าแคร์** | Role: `group_leader`<br>Scope: นำกลุ่มที่มี `org_level = 'care'` | `shared/schema.ts:237-238`<br>`server/lib/careScope.ts:20-38`<br>`server/lib/membershipScope.ts:54` | **ไม่ใช่ Role แยก แต่เป็น Data Scope**<br>- เป็นผู้นำกลุ่มระดับแคร์โดยตรง (`leader_id` หรือ `co_leader_id`) มีสิทธิ์ประเมินสมาชิกวิสามัญและบันทึกกิจกรรมในแคร์ |
| **6. ผู้ประสานงาน** | *ไม่มี Role หรือ Field นี้ในระบบ* | `shared/schema.ts:30-38`<br>`shared/roles.ts` | **ไม่พบในระบบ (Completely Missing)**<br>- ไม่มี Role `coordinator`<br>- ไม่มีตาราง/ฟิลด์การมอบหมายงานประสานงาน |

---

## (ข) ตารางวิเคราะห์โมดูลที่เสนอรายบทบาท เทียบกับระบบปัจจุบัน

### 1. Super Admin
| โมดูลที่เสนอ | สถานะในระบบปัจจุบัน | Route / หน้าจอที่รองรับ | ใช้ Route เดิมได้หรือไม่ / สิ่งที่ต้องทำเพิ่ม |
|---|---|---|---|
| Overview | มีแล้ว | `/` (`client/src/pages/Home.tsx`) | ใช้ Route `/` เดิมได้ (ปรับ Dashboard tile/summary) |
| Users & Roles | มีแล้ว | `/admin/users` (`AdminUsers.tsx`) | ใช้ Route เดิมได้ (`SUPER_ADMIN_ROLES` เท่านั้น) |
| Organization | มีแล้ว | `/org` (`OrgChart.tsx`), `/import/org` | ใช้ Route เดิมได้ |
| Reports | มีแล้ว | `/reports` (`Reports.tsx`) | ใช้ Route เดิมได้ (`PRIVILEGED_ROLES`) |
| Audit Logs | **ไม่มี UI** (มีตาราง DB `audit_logs`) | ไม่มี Route | **ต้องสร้าง API และหน้าจอใหม่** (ปัจจุบัน `audit_logs` เป็น write-only) |
| System Settings | **ไม่มี** (เป็น stub) | `/settings` (`ComingSoon.tsx`) | **ต้องมี Schema/API ใหม่** หากต้องการให้ตั้งค่าระบบจริง |
| Security | **ไม่มี** | ไม่มี Route | **ไม่มีในระบบ** |

### 2. Admin
| โมดูลที่เสนอ | สถานะในระบบปัจจุบัน | Route / หน้าจอที่รองรับ | ใช้ Route เดิมได้หรือไม่ / สิ่งที่ต้องทำเพิ่ม |
|---|---|---|---|
| Admin Dashboard | มีแล้ว | `/` (`Home.tsx`) | ใช้ Route `/` เดิมได้ |
| Member Management | มีแล้ว | `/members` (`Members.tsx`) | ใช้ Route เดิมได้ |
| Team & Group Management | มีแล้ว | `/groups` (`Groups.tsx`) | ใช้ Route เดิมได้ |
| Report Management | มีแล้ว | `/reports` (`Reports.tsx`), `/inbox` | ใช้ Route เดิมได้ |
| Activity Management | มีแล้ว | `/feed` (`Feed.tsx`), `/events` | ใช้ Route เดิมได้ |
| User Support | **ไม่มีโมดูลนี้** | ไม่มี Route | ไม่มีในระบบ |
| Reports & Export | มีแล้ว | `/reports`, `/api/members/export/csv` | ใช้ Route และ API เดิมได้ |

### 3. หัวหน้าทีม (ศบ. / อาจารย์)
| โมดูลที่เสนอ | สถานะในระบบปัจจุบัน | Route / หน้าจอที่รองรับ | ใช้ Route เดิมได้หรือไม่ / สิ่งที่ต้องทำเพิ่ม |
|---|---|---|---|
| Team Overview | มีบางส่วน | `/` (`Home.tsx`) | ใช้ `/` เดิมได้ แต่ต้องกำหนดว่า "ทีม" คืออะไรใน Data Scope |
| Team Members | มีแล้ว (ภาพรวม) | `/members` (`Members.tsx`) | ใช้ `/members` ได้ แต่ต้องมี Data Filter ตามทีม |
| Body Overview | มีบางส่วน | `/org` (`OrgChart.tsx`) | ใช้ `/org` ได้ |
| Mission Reports | มีแล้ว | `/inbox`, `/feed` | ใช้ Route เดิมได้ |
| Team Activities | มีแล้ว | `/feed`, `/events` | ใช้ Route เดิมได้ |
| Follow-up | มีแล้ว | `/follow-up` (`FollowUps.tsx`) | ใช้ `/follow-up` เดิมได้ |
| Team Performance | **ไม่มี** | ไม่มี Route | **ต้องสร้าง API และการคำนวณใหม่** ระบบยังไม่มีสถิติประสิทธิภาพทีม |

### 4. หัวหน้าบอดี้
| โมดูลที่เสนอ | สถานะในระบบปัจจุบัน | Route / หน้าจอที่รองรับ | ใช้ Route เดิมได้หรือไม่ / สิ่งที่ต้องทำเพิ่ม |
|---|---|---|---|
| My Body | มีแล้ว | `/groups` (`Groups.tsx`) | ใช้ `/groups` เดิมได้ |
| Body Members | มีบางส่วน | `/members` (เห็นทุกคนแต่ mask เบอร์), `/memberships` (เห็นเฉพาะบอดี้+แคร์ลูก) | ใช้ `/memberships` และ `/members` ได้ แต่ `/care` ยังไม่รวมกลุ่มลูก |
| Groups | มีแล้ว | `/groups` | ใช้ `/groups` เดิมได้ |
| Attendance | มีแล้ว | `/attendance`, `/care` | ใช้ Route เดิมได้ |
| Weekly Reports | **ไม่มีระบบรายงานรายสัปดาห์** | ไม่มี Route | ระบบยังไม่มี weekly report object มีเพียง `mission_activities` |
| Body Activities | มีแล้ว | `/feed` | ใช้ `/feed` เดิมได้ |
| Follow-up | มีแล้ว | `/follow-up` | ใช้ `/follow-up` เดิมได้ |

### 5. หัวหน้าแคร์
| โมดูลที่เสนอ | สถานะในระบบปัจจุบัน | Route / หน้าจอที่รองรับ | ใช้ Route เดิมได้หรือไม่ / สิ่งที่ต้องทำเพิ่ม |
|---|---|---|---|
| Care Overview | มีแล้ว | `/` (มีไทล์ "เช็คชื่อกลุ่มดูแล", "อัปเดตภาพ", "สถานะสมาชิก") | ใช้ `/` เดิมได้ |
| My Care Members | มีแล้ว | `/care` (`CareToday.tsx`), `/members` | ใช้ Route เดิมได้ |
| Follow-up Queue | มีแล้ว | `/follow-up` | ใช้ `/follow-up` เดิมได้ |
| Care History | มีบางส่วน | `/feed`, Timeline ใน MemberDetail | ใช้ Component เดิมได้ |
| Upcoming Follow-ups | มีบางส่วน | `/follow-up` (กรองตามวันที่นัด) | ใช้ `/follow-up` เดิมได้ |
| Care Status | มีแล้ว | `/memberships` | ใช้ `/memberships` เดิมได้ |
| Handover (ส่งต่องาน) | **ไม่มี** | ไม่มี Route | **ต้องเพิ่มฟิลด์หรือ Flow ใหม่** หากต้องการระบบส่งต่องานเป็นทางการ |

### 6. ผู้ประสานงาน
| โมดูลที่เสนอ | สถานะในระบบปัจจุบัน | Route / หน้าจอที่รองรับ | ใช้ Route เดิมได้หรือไม่ / สิ่งที่ต้องทำเพิ่ม |
|---|---|---|---|
| My Tasks / Coordination Queue | มีบางส่วน | `/follow-up` (assigned to me) | ใช้ `/follow-up` ได้ |
| Pending Reports | มีบางส่วน | `/inbox` (submissions) | ใช้ `/inbox` ได้ |
| Schedule | มีบางส่วน | `/events` | ใช้ `/events` ได้ |
| Status Updates | มีแล้ว | `/follow-up`, `/feed` | ใช้ Route เดิมได้ |
| Notifications | **ยังไม่มี** (CLAUDE.md ระบุว่า "ยังวางแผน") | ไม่มี Route | ยังไม่มีระบบ Notification |
| Activity History | มีแล้ว | `/feed` | ใช้ `/feed` เดิมได้ |

---

## (ค) ตารางเปรียบเทียบสิทธิ์: หัวข้อ 4 ในข้อกำหนด เทียบกับ API บังคับจริง

| ความสามารถ | ข้อกำหนดเสนอ | สิทธิ์จริงที่ API และ Middleware บังคับ | ประเภทการบังคับ (Enforcement) | ความขัดแย้ง / ช่องว่างที่พบ |
|---|---|---|---|---|
| **ตั้งค่าระบบ** | Super Admin (เต็ม), Admin (ตามสิทธิ์), อื่นๆ (ไม่มี) | `server/routes`: **ไม่มี API ตั้งค่าระบบใดๆ** (`/settings` เป็น `ComingSoon.tsx`) | **ไม่มีในระบบ** | ข้อเสนอระบุว่า Admin ตั้งค่าได้ แต่ระบบจริงไม่มีระบบ Settings |
| **จัดการผู้ใช้และบทบาท** | Super Admin (เต็ม), Admin (จำกัด), อื่นๆ (ไม่มี) | `server/routes/adminUsers.ts:16`<br>`requireRole(...SUPER_ADMIN_ROLES)` | **API-enforced** (Server-side) | **ขัดแย้ง:** ข้อเสนอระบุว่า Admin มีสิทธิ์แบบจำกัด แต่ API จริงบล็อก Admin ด้วย 403 (เฉพาะ `super_admin` เท่านั้น) |
| **ดูภาพรวมองค์กร** | Super Admin/Admin (ตามสิทธิ์), หัวหน้าทีม/บอดี้/แคร์ (ตามขอบเขต) | `server/routes/home.ts:175-188`<br>`GET /api/dashboard/summary` | **API Leak / ไม่จำกัด Scope** | **ช่องว่างความปลอดภัยเดิม (A2):** `GET /api/dashboard/summary` ส่งยอดรวมคริสตจักรให้ทุก Role เท่ากันหมด (ไม่มี Scope filter) ส่วน `GET /api/home/overview` กรองตาม Scope สำเร็จแล้ว |
| **ดูข้อมูลสมาชิก** | ตามสิทธิ์ / ตามขอบเขต | `server/routes/members.ts:184-213`<br>`server/lib/careScope.ts` | **API-enforced** (Masking) + **UI-only** (บางส่วน) | ทุก Role ใน `ADMIN_SHELL_ROLES` เปิด `/members` ดูชื่อสมาชิกได้ทุกคน แต่ถูก Mask เบอร์โทร/อีเมล ยกเว้น `MEMBER_CONTACT_ROLES` (`super_admin`, `admin`, `staff`) |
| **จัดการกิจกรรม** | ตามสิทธิ์ / ตามขอบเขต | `server/routes/activities.ts:327`<br>`CREATE_ROLES` + `assertActivityScope` | **API-enforced** | ตรวจสอบว่าผู้นำต้องเป็น Leader ของกลุ่มที่ลงกิจกรรมจริง |
| **ตรวจรายงาน** | Super Admin/Admin (ตามสิทธิ์), หัวหน้าทีม/บอดี้ (ตามขอบเขต) | `server/routes/reports.ts:25`<br>`requireRole(...PRIVILEGED_ROLES)` | **API-enforced** | `group_leader` (หัวหน้าบอดี้/แคร์) ถูก 403 ที่ `/reports` ทั้งหมด |
| **ดูประวัติการดูแล** | ตามสิทธิ์ / ตามขอบเขต | `server/routes/followUps.ts` | **API-enforced** | เข้าถึงได้เฉพาะผู้ได้รับมอบหมาย (`assignedToId`) หรือผู้สร้าง (`createdById`) หรือ `PRIVILEGED_ROLES` |
| **ส่งออกข้อมูล** | ตามขอบเขต | `server/routes/members.ts:89`<br>`requireRole(...MEMBER_UPDATE_ROLES)` | **API-enforced** | `group_leader` สามารถเรียก `GET /api/members/export/csv` ได้ (แต่ได้เฉพาะสมาชิกใน Scope) |

---

## (ง) Data Scope ที่ Schema และ Backend รองรับจริง

### 1. โครงสร้างองค์กร (Hierarchical Scope)
- **ตาราง `groups` (`shared/schema.ts:267-309`):**
  - มีฟิลด์ `orgLevel` (`"body"` | `"care"` | `null`)
  - มีฟิลด์ `parentGroupId` (Self-referencing Foreign Key สำหรับเชื่อมโยง Care เข้ากับ Body)
  - มีฟิลด์ `leaderId`, `coLeaderId` (เชื่อมกับ `users.id`)
  - มีฟิลด์ `leaderMemberId` (เชื่อมกับ `members.id`)
- **การคำนวณ Scope ฝั่ง Server:**
  - `server/lib/membershipScope.ts:34-47` มีฟังก์ชัน `withDescendantGroups()` ที่คำนวณ Hierarchy แบบ Cycle-safe (Body Leader -> Care Groups ลูก) ใช้งานเฉพาะในโมดูล `/api/memberships`
  - `server/lib/careScope.ts:20-38` ใช้งานใน `/care` และ `/members` กรองเฉพาะกลุ่มที่ `leaderId === user.id` เท่านั้น **ยังไม่รองรับ Descendant Groups** ทำให้หัวหน้าบอดี้มองไม่เห็นข้อมูลในหน้าเหล่านี้

### 2. ขอบเขตการมอบหมายบุคคล (Assigned Scope)
- **ตาราง `members`:** มีฟิลด์ `assignedLeaderId` (เชื่อมกับ `users.id`)
- **ตาราง `follow_ups`:** มีฟิลด์ `assignedToId` (เชื่อมกับ `users.id`)

### 3. ส่วนที่ Schema ยังไม่รองรับ (Missing in Schema)
- **ไม่มีแนวคิด "ทีม" (Team):** ไม่มีตารางหรือฟิลด์ `team_id` ใน Schema (มีเพียง `ministries` ซึ่งเป็นฝ่ายงานบริการ เช่น ฝ่ายปฏิคม, ฝ่ายดนตรี)
- **ไม่มีแนวคิด "ผู้ประสานงาน" (Coordinator):** ไม่มีฟิลด์ผู้ประสานงานในตารางใดๆ
- **ไม่มีแนวคิด "ส่งต่องาน" (Handover):** ไม่มี State หรือ Log สำหรับการส่งต่องานดูแล

---

## (จ) ความเสี่ยง ช่องว่าง ไฟล์ที่คาดว่าจะเปลี่ยน และขนาดงานโดยประมาณ

### 1. ความเสี่ยงและช่องว่างสำคัญ
1. **Font Token:** ข้อกำหนดระบุให้ใช้ Sarabun แต่ระบบใช้ Prompt ทั่วทั้งระบบ (`client/src/index.css:5`) การเปลี่ยนฟอนต์จะกระทบ typography scale, line-height, text truncation และ visual test ทั้งหมด
2. **Color Token:** ข้อกำหนดระบุสี `#35B4B0` ซึ่งไม่มีอยู่ใน Design System V2 ใน `index.css` (สีหลักคือ `--color-primary: #0c7c82`)
3. **Data Scope Inconsistency:** หน้า `/care` และ `/memberships` มีนิยาม scope ไม่เท่ากันสำหรับหัวหน้าบอดี้
4. **ความเข้าใจผิดเรื่อง Role:** หากสร้าง Role ใหม่โดยพลการ จะทำให้ Auth, Session, และ Role-gate แตกทั้งหมด

### 2. ไฟล์ที่คาดว่าจะต้องเปลี่ยนในงาน Phase B/C (เมื่อได้รับอนุมัติ)
- `client/src/components/layout/Sidebar.tsx` (ปรับโครงสร้างเมนูตามบทบาท)
- `client/src/components/layout/MobileBottomNav.tsx` (ปรับปุ่มล่างบนมือถือ)
- `client/src/pages/Home.tsx` และ `client/src/components/home/HomeMyWork.tsx` (ไทล์และสถิติตามบทบาท)
- `client/src/lib/homeTiles.ts` (ตรรกะการจัดไทล์ตามบทบาท)
- `client/src/App.tsx` (Route protection ที่สอดคล้องกับเมนู)
- `client/src/role-aware-ui.test.ts`, `nav-structure-contract.test.ts` (อัปเดต Contract Tests)

### 3. ขนาดงานโดยประมาณต่อบทบาท
- **Super Admin:** ขนาด **เล็ก (S)** — หน้าจอและสิทธิ์มีอยู่แล้วเกือบทั้งหมด เพียงจัดเมนูให้กระชับ
- **Admin:** ขนาด **เล็ก (S)** — มีหน้าจอครบถ้วน
- **หัวหน้าแคร์ (Care Leader):** ขนาด **กลาง (M)** — หน้าแรกมีไทล์แล้ว ปรับเมนูและการเข้าถึงงานให้โฟกัส
- **หัวหน้าบอดี้ (Body Leader):** ขนาด **กลาง-ใหญ่ (L)** — ต้องแก้ปัญหา Scope ไม่สอดคล้องกัน (A3) เพื่อไม่ให้เจอหน้าว่าง
- **หัวหน้าทีม (ศบ./อาจารย์):** ขนาด **ใหญ่ (XL)** — ขาดคำนิยาม Role และขาดโมดูล Team Performance
- **ผู้ประสานงาน:** ขนาด **ใหญ่มาก (XXL)** — ยังไม่มี Role, Workflow, หรือ Schema รองรับ

---

## (ฉ) รายการ "ต้องให้เจ้าของตัดสินใจ" (Decisions Required)

### ข้อ 1: บทบาท "ผู้ประสานงาน" (Coordinator)
- **ตัวเลือก ก:** ยังไม่สร้าง Role ใหม่ แต่ใช้ Role `staff` หรือ `group_leader` ที่มีอยู่เดิม พร้อมระบุ Scope งาน
  - *ผล:* ปลอดภัย ไม่ต้องแก้ Schema, Migration หรือ Auth System
- **ตัวเลือก ข:** สร้าง Role `coordinator` ใหม่ใน enum `USER_ROLES`
  - *ผล:* ต้องสร้าง Migration, เพิ่มใน `shared/roles.ts`, อัปเดต Route guards ทุกจุด และเพิ่มระบบกำหนดสิทธิ์
- **คำแนะนำ:** **เลือก ตัวเลือก ก** เพื่อไม่ขยายขอบเขตระบบโดยไม่จำเป็น และไม่กระทบเสถียรภาพของ Auth

### ข้อ 2: บทบาท "หัวหน้าทีม (ศบ. / อาจารย์)"
- **ตัวเลือก ก:** Map เข้ากับ Role `admin` หรือ `staff` ที่มีอยู่เดิม โดยให้เห็นภาพรวมระดับสูง
  - *ผล:* ใช้งานได้ทันที มีสิทธิ์ดูข้อมูลและรายงานครบถ้วน
- **ตัวเลือก ข:** สร้าง Role `pastor` หรือ `team_leader` ใหม่
  - *ผล:* ต้องแก้ Schema และระบบสิทธิ์ใหม่ทั้งหมด
- **คำแนะนำ:** **เลือก ตัวเลือก ก (ใช้ `admin` หรือ `staff`)**

### ข้อ 3: ฟอนต์ Sarabun vs Prompt
- **ตัวเลือก ก:** ใช้ฟอนต์ `Prompt` ตามระบบปัจจุบันของ Repo ต่อไป (คง Token เดิม)
  - *ผล:* สอดคล้องกับ Design System V2, ไม่มีความเสี่ยงเรื่อง Layout shift
- **ตัวเลือก ข:** นำเข้าฟอนต์ `Sarabun` และแก้ Typography ของระบบใหม่ทั้งหมด
  - *ผล:* กระทบ CSS ทั่วทั้งระบบ ขัดแย้งกับการตัดสินใจเดิม (D6)
- **คำแนะนำ:** **เลือก ตัวเลือก ก (ยืนยันใช้ Prompt)**

### ข้อ 4: สี `#35B4B0`
- **ตัวเลือก ก:** ใช้โทนสี Teal ใน Design System V2 (`--color-primary: #0c7c82`)
  - *ผล:* ตรงกับ Contract Token ปัจจุบันที่ผ่านเกณฑ์ Contrast Accessibility
- **ตัวเลือก ข:** เพิ่ม Token สี `#35B4B0` ใหม่ใน `index.css`
  - *ผล:* ต้องตรวจสอบ Contrast และอัปเดต `design-tokens.test.ts`
- **คำแนะนำ:** **เลือก ตัวเลือก ก (ใช้ Primary Token เดิม)**

### ข้อ 5: ปัญหา E2E-AUDIT ข้อ 3 (หัวหน้าบอดี้เห็นหน้าว่างใน /care และ /members)
- **ตัวเลือก ก:** ปรับ Data Scope ใน `server/lib/careScope.ts` ให้รวมกลุ่มลูก (`withDescendantGroups`) เหมือน `membershipScope.ts`
  - *ผล:* หัวหน้าบอดี้จะเห็นสมาชิกในแคร์ลูกทั้งหมดในหน้า `/care` และ `/members` (เป็นการแก้ logic ฝั่ง server)
- **ตัวเลือก ข:** ปรับเฉพาะข้อความ Empty state ในหน้าจอฝั่ง client เพื่ออธิบายให้ถูกต้อง
  - *ผล:* เป็น client-only ไม่แตะ logic server แต่หัวหน้าบอดี้นำเข้าดูแคร์ลูกในหน้านั้นไม่ได้
- **คำแนะนำ:** **เลือก ตัวเลือก ก ในรอบถัดไปที่ได้รับอนุมัติให้ปรับ backend**

### ข้อ 6: ลำดับการพัฒนาหน้าจอตามบทบาท
- **ตัวเลือก ก:** ทำหน้าแรก (`HomeMyWork` / ไทล์) ตามบทบาทให้เสร็จสมบูรณ์ก่อน แล้วจึงจัด Sidebar
  - *ผล:* เห็นผลเร็ว กระทบผู้ใช้น้อย ควบคุมขอบเขตงานได้ดี
- **ตัวเลือก ข:** ปรับรื้อ Sidebar และ Routing ของทุกบทบาทพร้อมกัน
  - *ผล:* ขอบเขตงานใหญ่ มีความเสี่ยงกระทบ Regression สูง
- **คำแนะนำ:** **เลือก ตัวเลือก ก (ทำ Home Dashboard ตามบทบาทก่อน)**
