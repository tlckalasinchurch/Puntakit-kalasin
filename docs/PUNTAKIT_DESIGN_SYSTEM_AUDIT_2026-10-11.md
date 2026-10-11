<!-- last_verified: 2026-10-11 -->
# Design System UI Audit — 2026-10-11

ตรวจด้วย Playwright (Chromium 1248) บนสาขา `design-system/2026-10-11` (ฐาน `origin/main` = `57bd2cb`) ใน local demo mode เท่านั้น ไม่มีการเข้า production ไม่ใช้ credentials จริง รายงานนี้เป็นผลวัด ไม่ใช่การแก้ UI

## สภาพแวดล้อมและขอบเขต

- Local demo: Vite `:5199` + API `:3101`, PGlite ชั่วคราว, ผู้ใช้ `demo@puntakit.local` บทบาท `admin` (แถวผู้ใช้ถูกใส่เองด้วยสคริปต์ เพราะโค้ดสาขานี้ไม่ได้สร้างให้)
- ข้อมูลทดสอบ: สมาชิก 12 คน (สร้างผ่าน `POST /api/members`) ไม่มีกลุ่ม/กิจกรรม/เช็คชื่อ
- 27 route × 3 viewport (360/768/1280) × 2 ธีม (light/dark) = 162 รอบ ได้แก่ admin 22 route และ member PWA 5 route (`/app*`)
- Focus ตรวจเฉพาะ phone และ desktop (108 รอบ) กด Tab สูงสุด 30 จุดต่อหน้า

## สรุปผลต่อมิติ

| มิติ | PASS | FAIL | INCONCLUSIVE / NOT TESTED |
|---|---|---|---|
| โหลดหน้า (มี `h1`, ไม่มี API ≥400, ไม่มี pageerror) | 27/27 route | 0 | — |
| Horizontal overflow | 162/162 รอบ | 0 | — |
| Contrast ข้อความ (พื้นทึบ) | — | 4 route (ดูด้านล่าง) | 23 route ไม่พบ fail แต่ INCONCLUSIVE (ข้ามองค์ประกอบพื้น gradient/รูป ไม่ได้นับจำนวน) |
| Contrast องค์ประกอบ UI (เส้นขอบ/ไอคอน ≥3:1) | — | — | NOT TESTED |
| Focus มีวงโฟกัส (outline/box-shadow) | 27 route, 108 รอบ ไม่พบจุดที่ไม่มีวง | 0 | INCONCLUSIVE: ไม่ได้วัด contrast ของวง ไม่ได้ตรวจว่าถูกบัง และจำกัด 30 จุด |
| Touch target ≥44px (ไม่นับลิงก์ inline) | 25 route | `/attendance` tablet/desktop: ปุ่ม "มา"/"ลา" กว้าง 39px (สูง 44) | INCONCLUSIVE: `/follow-up` 1 จุด (ผล phone เดิมระบุ 26 route ผ่าน ซึ่งนับเฉพาะ phone) |
| ตารางบนมือถือ | — | — | NOT TESTED เกือบทั้งหมด: มี `<table>` เฉพาะ `/members` |
| Loading / error state | — | — | NOT TESTED (ไม่ได้จำลองการโหลดช้าหรือ API ล้ม) |
| Empty state | เห็นข้อความ empty บน 22 route | — | ไม่ได้ตรวจคุณภาพของแต่ละ state |

## FAIL: Contrast (คำนวณจากสี foreground/background ที่ render จริง; เกณฑ์ WCAG 2.x AA: ข้อความปกติ 4.5, ข้อความใหญ่ 3)

| Route | ธีม | องค์ประกอบ | อัตราส่วน | เกณฑ์ |
|---|---|---|---|---|
| `/attendance` | light | ปุ่ม/ตัวเลขสถานะ "ลา" | 3.43 | 4.5 |
| `/attendance` | light | "มา" | 4.14 | 4.5 |
| `/attendance` | light | "ออนไลน์" | 4.30 | 4.5 |
| `/attendance` | dark | "ขาด" และตัวเลข `0คน` (24px) | 2.75 | 4.5 / 3 |
| `/attendance` | dark | "มา" 3.46, "ลา" 4.18 | 3.46 / 4.18 | 4.5 |
| `/map` | dark | ปุ่ม "แผนที่" (14px) | 2.54 | 4.5 |
| `/profile`, `/app/profile` | dark | ปุ่ม "ออกจากระบบ" (14px) | 2.75 | 4.5 |

- ทุก viewport ให้ผลเดียวกัน (ไม่ขึ้นกับขนาดจอ) รวม 15 จาก 162 รอบ: light 3, dark 12
- ASSUMPTION: สาเหตุคือสีสถานะ (success/warning/error) ถูกใช้เป็นสีตัวอักษรเล็ก 12px บนพื้น tint ใน `Attendance.tsx` (ปุ่มสถานะบรรทัด ~784, ป้ายสรุปบรรทัด ~174) และปุ่มออกจากระบบ `.profile-logout` ใน `index.css` ในโหมดมืด ยังไม่ได้ตรวจ token ที่ใช้จริงของแต่ละจุด

## INCONCLUSIVE: Touch target

- `/follow-up`: `input.size-5.shrink-0` ขนาด 20×20 (checkbox ไม่มี label ในตัวองค์ประกอบ) ทุก viewport ทุกธีม ยังไม่ได้ตรวจว่า `<label>` หรือแถวที่ครอบรับการแตะได้ ≥44px หรือไม่

## Responsive table

- `/members` มี `<table>` 5 คอลัมน์ที่ 360px ตารางมีความกว้าง 0 (ถูกซ่อน) ที่ 768/1280 กว้าง 726/974 ไม่ล้น และไม่มี wrapper `overflow-x` ASSUMPTION: มือถือแสดงเป็น card list ตามกฎใน `AGENTS.md` §6.3 แต่ยังไม่ได้ยืนยันด้วยภาพ
- route อื่นไม่มี `<table>` ในข้อมูลที่ seed แต่ 22 route แสดง empty state จึงยังไม่เห็นเลย์เอาต์รายการจริงของหน้าเหล่านั้น

## Console / network

- Console error และ pageerror: 0 ใน 162 รอบ (ตัวกรองไม่นับ `Failed to load resource`)
- API ตอบ ≥400: 0 ในรอบตรวจการเรนเดอร์ (phone, light, 27 route) ไม่ได้ตรวจใน 162 รอบหลัก
- ข้อสังเกต: `/worship` แสดง `h1` "กิจกรรม" เหมือน `/events` (ไม่ได้ตรวจว่าเป็น alias หรือไม่)

## ข้อจำกัดของ demo

- บทบาทเดียวคือ `admin`: ไม่ได้ตรวจ UI ที่ขึ้นกับบทบาท (`group_leader`, `member`, `team_lead`) และเมนูตามบทบาท
- ไม่มี Clerk, ไม่มี PWA install/offline, ไม่มีกล้อง/QR จริง, Chromium เท่านั้น (ไม่มี Safari/Firefox)
- ข้อมูลน้อย จึงยังไม่เห็นรายการยาว การแบ่งหน้า ข้อความไทยยาว หรือสถานะ error
- Tablet ไม่ได้ตรวจ focus

## ไม่ได้อยู่ในรายงานนี้ (ตามที่ตกลงไว้)

- ไม่ได้แก้ EmptyState/Skeleton/ErrorState ใด ๆ จนกว่าจะตรวจพฤติกรรมของแต่ละหน้า
- Batch 1 ก่อนหน้า (`Privacy.tsx`, `Terms.tsx` tokenization) ตรวจแยก ไม่รวมในตารางด้านบน

## แก้ไข 2026-10-11 (หลัง audit): Contrast

แก้เฉพาะ contrast ของ 4 route ที่ FAIL โดยไม่แตะ core token:

- เพิ่ม semantic token `--color-error-ink` (light `#c23b4d`, dark `#f4a3ac`) เพราะ `--color-error` ไม่ถูก remap ในโหมดมืด (ใช้เป็นสีตัวอักษรได้ 2.75:1)
- `Attendance.tsx`: ป้ายสรุป ปุ่มสถานะ (idle และ active) ใช้ `-ink` token ที่มี dark remap อยู่แล้ว ปุ่ม active ใช้ `text-[var(--color-on-primary)]`
- `Map.tsx`: ปุ่มสลับมุมมองที่เลือกอยู่ใช้ `--color-on-primary` แทน `text-white` (โหมดมืด fill สว่างขึ้น)
- `index.css` (`.chip-error`, `.profile-logout`), `DesignSystem.tsx` (`StatusChip` tone `error`), `MemberProfile.tsx` (ปุ่มออกจากระบบ) ใช้ `--color-error-ink`
- ตรวจซ้ำ 4 route × 3 viewport × 2 ธีม = 24 รอบ: contrast fail 0, overflow 0, focus ไม่มีจุดไร้วง, pageerror 0 (ผลก่อนแก้ 15 รอบ fail)
- ข้อจำกัด: ตรวจซ้ำเฉพาะ 4 route นี้ เพราะ `StatusChip`/`.chip-error` ถูกใช้ในหน้าอื่นด้วย จึง **ยังไม่ได้ตรวจซ้ำ** route อื่นที่ได้รับผลทางอ้อม
- รอบตรวจซ้ำรอบแรกใช้ไม่ได้ (Git Bash แปลง path ของ `ROUTES` ทำให้ไม่ได้ตรวจ `/attendance`) รอบที่นับคือรอบที่ปิด `MSYS_NO_PATHCONV`
