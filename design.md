# Puntakit Design System

กฎการออกแบบของแอป Puntakit — ทุกหน้าและทุก component ต้องใช้ token ชุดเดียวกันนี้

> **Source of truth:** `client/src/index.css` (`:root`) — ถ้าเอกสารนี้กับ CSS ไม่ตรงกัน
> ให้ยึด CSS เป็นหลัก แล้วแก้เอกสารนี้ทันที

ค่าสีทุกตัวด้านล่างอ้างอิงจาก `brand-spec.md` และ CSS custom properties ใน `index.css`

## 1. สีหลัก (Brand Colors)

| Token | ค่า | การใช้งาน |
|---|---|---|
| `--color-primary` | `#315c2b` | สีเดียวที่ interactive — ลิงก์ ปุ่มหลัก ไอคอน focus |
| `--color-primary-focus` | `#3f7337` | hover / pressed / focus ring |
| `--color-primary-on-dark` | `#7faf72` | ข้อความเน้นบนพื้น graphite |
| `--color-ink` | `#1d1d1f` | สีตัวอักษรหลัก |
| `--color-body-muted` | `#6f6f73` | สีตัวอักษรรอง |
| `--color-canvas` | `#ffffff` | พื้นผิวการ์ด |
| `--color-canvas-soft` | `#f5f5f7` | พื้นหล่ม สลับแถวตาราง |
| `--color-hairline` | `#e0e0e0` | เส้นขอบการ์ดและ input |
| `--color-dark-surface` | `#272729` | sidebar, tooltip, พื้นมืด |

โทน graphite (`#272729` / `#2a2a2c` / `#252527`) ใช้กับ chrome สีเข้มทั้งหมด

## 2. สี Semantic (สถานะ)

| Token | ค่า | ความหมาย |
|---|---|---|
| `--color-success` | `#1e8e5a` | สำเร็จ / ใช้งานอยู่ / ยืนยันแล้ว |
| `--color-warning` | `#c77819` | คำเตือน / รอดำเนินการ |
| `--color-error` | `#c23b4d` | ข้อผิดพลาด / ลบ / อันตราย |
| `--color-info` | `#2f6fcc` | ข้อมูลทั่วไปเท่านั้น |
| `--color-info-strong` | `#2f72bf` | ตัวอักษร/ไอคอน info บนพื้นขาว |

สี accent ทำกิจกรรมเฉพาะ (ใช้ได้ แต่ต้องมีความหมาย): `--care-purple: #7950d8`,
`--relationship-pink: #e85d78`, `--activity-orange: #f3a23a`

**กติกาสี:**
- ห้ามไล่สี (gradient) ที่ไม่มีความหมาย
- ห้ามใช้สีรุ้งพร่ามัวในหน้าเดียวเกิน 3 โทน
- สีตามสถานะห้ามเปลี่ยนความหมาย — ทุก stat / badge ต้องอิง semantic สีนี้
- ห้าม hardcode hex ใน component ใหม่ — ใช้ `var(--token)` เสมอ

## 3. Typography

- ฟอนต์: **Prompt** (thai-first) → `system-ui, sans-serif`
- ใช้ฟอนต์เดียว ห้ามเพิ่มฟอนต์ที่สอง
- ใช้คลาส `.type-*` ที่ `index.css` เตรียมไว้ ห้ามกำหนดขนาดฟอนต์ inline
  (`.type-hero` `.type-display-lg` `.type-display-md` `.type-lead` `.type-body`
  `.type-body-strong` `.type-caption` `.type-caption-strong` `.type-fine`)
- ความยาวบรรทัด body ไม่เกิน ~70 ตัวอักษร
- หัวข้อใช้ letter-spacing ติดลบ, body ใช้ปกติ
- eyebrow ใช้สี `--color-primary` ไม่ใช่ uppercase ซ้ำทุกจุด

## 4. Radius Scale

| Token | ค่า | ใช้กับ |
|---|---|---|
| `--radius-lg` | `18px` | การ์ดหลัก |
| `--radius-md` | `11px` | การ์ดย่อย / แผงใน |
| `--radius-sm` | `8px` | chip / รายการเล็ก |
| `--radius-xs` | `5px` | องค์เล็ก |
| `--radius-pill` | `9999px` | ปุ่ม pill |

## 5. Shadow Scale

| ชื่อ | ค่า | ใช้กับ |
|---|---|---|
| ไม่มี | — | chrome, การ์ดปกติ (chrome ต้องแบน) |
| `--shadow` | `0 10px 28px rgba(29,29,31,.08)` | การ์ดที่ยกลอยจริง |
| overlay | เงาดำเข้มกว่า | sidebar mobile, dropdown, modal |

**เฉดเงาต้องเป็นสีดำกลางเท่านั้น ห้ามมีโทนสี** — เงาสีน้ำเงินจะขัดกับ chrome graphite

## 6. Z-index Scale

| ชั้น | ค่า | ใช้กับ |
|---|---|---|
| base | 0 | เนื้อหาปกติ |
| sticky | 30 | topbar |
| overlay | 40 | backdrop |
| drawer/dropdown | 50 | sidebar mobile, dropdown, modal |

## 7. Spacing Scale (4px base)

`4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48` px
- ระยะในการ์ด: 16–24px, ระหว่างการ์ด: 16px, ระยะหน้า: 24px
- touch target ขั้นต่ำ 44 × 44px

## 8. Component Rules

- **การ์ด**: พื้น `--color-canvas` + เส้นขอบ `1px var(--color-hairline)` +
  radius-lg — ห้ามซ้อนเงาหลายชั้น
- **ปุ่มหลัก**: พื้น `--color-primary` ตัวอักษรขาว มี icon 1 ตัวเสมอ
- **ปุ่มอันตราย**: ใช้ `--color-error`
- **สถานะ (badge/chip)**: ใช้ semantic สีเท่านั้น
- **Loading (กติกาบังคับ)**:
  - **Skeleton** = เนื้อหาหน้า (ตาราง, การ์ด, แบบฟอร์ม) → `client/src/components/LoadingStates.tsx`
  - **Spinner** = ปุ่มหรือ action สั้น ๆ เท่านั้น (submit, refresh)
  - ห้ามใช้ `"..."` หรือจุดไข่ปลาแทน loading
  - **Empty state / Error state ต้องแยกจาก loading** และห้ามแสดงพร้อมกัน
- **ข้อมูลจริง**: ตัวเลขสถิติ/ชื่อ/อีเมล ต้องมาจาก API เท่านั้น — ถ้าไม่มี API
  ให้แสดง empty state ห้าม hardcode
- **Motion**: ใช้เฉพาะเพื่อตอบสนองการกระทำของผู้ใช้ (เปิด ขยาย ยืนยัน)
  ห้ามมี animation เข้าเลยที่ไม่ได้เกิดจากผู้ใช้ และต้องเคารพ `prefers-reduced-motion`
- **Legal**: ทุกหน้า login และ profile ต้องมีลิงก์ `/privacy` และ `/terms`
