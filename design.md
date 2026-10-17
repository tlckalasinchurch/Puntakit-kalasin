# Puntakit Design System

กฎการออกแบบของแอป Puntakit — ทุกหน้าและทุก component ต้องใช้ token ชุดเดียวกันนี้

> **Source of truth:** `client/src/index.css` (`:root`) — ถ้าเอกสารนี้กับ CSS ไม่ตรงกัน
> ให้ยึด CSS เป็นหลัก แล้วแก้เอกสารนี้ทันที

ค่าสีทุกตัวด้านล่างอ้างอิงจาก `brand-spec.md` และ CSS custom properties ใน `index.css`

## 1. สีหลัก (Brand Colors) — Neon Orange & Porcelain

ใช้สีส้มอย่างมีกลยุทธ์ — เฉพาะปุ่มหลัก สถานะเลือก ตัวบอกตำแหน่ง และจุดเน้น ไม่ใช้กับทุกปุ่ม ทุกไอคอน หรือทุกเส้นขอบ
พื้นหน้าเป็นพอร์ซเลน (ครีมอุ่น) การ์ดเป็นขาว ตัวอักษรเป็นชาร์โคล

| Token | ค่า | การใช้งาน |
|---|---|---|
| `--color-primary` | `#ff6115` | **พื้น (fill)** ของปุ่มหลัก/สถานะเลือก — ตัวอักษรบนพื้นนี้ใช้ `--color-on-primary` เสมอ |
| `--color-on-primary` | `#171717` | ตัวอักษรบนพื้นส้ม **5.95:1** — ห้ามใช้สีขาว (ขาวบนส้มได้ 3.01:1 ไม่ผ่าน) |
| `--color-primary-focus` | `#e8560a` | hover / pressed fill (ชาร์โคลบนสีนี้ 4.92:1) และ focus ring (3.55:1 บนพอร์ซเลน) |
| `--color-primary-ink` | `#b93800` | ส้มที่เป็น **ตัวอักษร/ลิงก์/ไอคอน** บนพื้นสว่าง (5.64:1 บนพอร์ซเลน, 4.97:1 บน `--color-accent-soft`) |
| `--color-primary-on-dark` | `#ff6115` | จุดเน้นบนพื้นชาร์โคล (sidebar) 5.95:1 |
| `--color-accent-soft` | `#ffeadb` | พื้น chip/ไอคอนอ่อน |
| `--color-ink` | `#171717` | สีตัวอักษรหลัก (17.49:1 บนพอร์ซเลน) |
| `--color-body-muted` | `#5c554a` | สีตัวอักษรรอง (7.18:1) |
| `--color-canvas` | `#fffcf4` | พื้นหลังหน้า — Porcelain (card ใช้ `--color-surface: #ffffff`) |
| `--color-canvas-soft` | `#f7f2e7` | พื้นหล่ม สลับแถวตาราง |
| `--color-canvas-sunken` | `#f1ebdd` | พื้นจม (inset wells, hover fills) |
| `--color-hairline` | `#e6dfcf` | เส้นขอบการ์ดและ input |
| `--color-dark-surface` | `#171717` | sidebar, tooltip, พื้นมืด |

> **กฎส้ม:** `#ff6115` เป็นสีพื้นเท่านั้น ห้ามใช้เป็นสีตัวอักษรบนพื้นสว่าง (2.94:1) — ใช้ `--color-primary-ink`
> ห้ามเขียน `color: #fff` หรือ `text-white` บนพื้นส้ม และห้ามให้ส้มเป็นตัวบอกสถานะเพียงอย่างเดียว (ใช้ไอคอนหรือข้อความคู่)

โทนชาร์โคล (`#171717` / `#1f1f1f` / `#141414`) ใช้กับ chrome สีเข้มทั้งหมด · โลโก้คงสีต้นฉบับ ไม่เปลี่ยนตามธีม

## 1b. โหมดมืด (ค่าเริ่มต้นตั้งแต่ 2026-10-15)

Dark ไม่ใช่แค่กลับสีของ light แต่เป็นพาเลตตัวเองและเป็นค่าเริ่มต้นของแอป
(`ThemeProvider defaultTheme="dark"`) ปุ่มสลับธีมยังอยู่ · `.dark` เป็น **token remap**
ห้ามใช้ class override + `!important` · first paint ตั้ง class `dark` และ `theme-color` จากสคริปต์ใน
`client/index.html` ก่อนโหลด bundle (`theme-boot-contract.test.ts`)

| Token | ค่า | contrast |
|---|---|---|
| `--color-canvas` | `#171717` | — |
| `--color-canvas-soft` | `#2a2a2a` | — |
| `--color-surface` | `#202020` | — |
| `--color-canvas-sunken` | `#121212` | — |
| `--color-ink` | `#fffcf4` | 17.49:1 บน canvas |
| `--color-text-secondary` | `#d2ccbf` | 11.21:1 |
| `--color-text-tertiary` | `#b3aca0` | 7.96:1 |
| `--color-text-quaternary` | `#a59e92` | ≥ 4.5:1 บนทุกพื้น (วัดใน `palette-contrast.test.ts`) |
| `--color-primary` | `#ff6115` | พื้นปุ่ม 5.95:1 กับ canvas |
| `--color-on-primary` | `#171717` | 5.95:1 บนพื้นส้ม |
| `--color-primary-focus` | `#ff8a4d` | hover fill (ชาร์โคลบนสีนี้ 7.68:1) และ focus ring |
| `--color-primary-ink` | `#ff7a3d` | ส้มเป็นตัวอักษร 6.92:1 บน canvas |
| `--color-accent-soft` | `rgba(255,97,21,0.16)` | พื้น chip |

> ทุกคู่สีข้างต้นถูกวัดจาก token จริงใน `client/src/palette-contrast.test.ts` ทั้งสองธีม

**กระจก (glass)** — chrome ในโหมดมืดเป็นกระจก ไม่ใช่สีทึบ: `--glass-fill` ·
`--glass-fill-strong` · `--glass-line` · `--glass-line-bright` · `--glass-blur`
การ์ดดูเป็นกระจกจาก **เส้นสว่างขอบบน** ไม่ใช่เงาทิ้งอย่างเดียว

**หน้า member ใช้พาเลตเดียวกัน** — `.lamb-theme` ถูกรวมเป็น alias ของ token กลางแล้ว

**ยังไม่ย้ายมาพาเลตนี้ (เฟสถัดไป):** บัตรสมาชิก (`--card-emerald-*`, `--card-gold-*`),
ภาพ Lamb, ไอคอนแอป และสีกราฟ (`--chart-*`) · หน้า PIN sign-in ใช้ token กลางแล้ว (โลโก้วางบนแผ่นสีขาว)

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
  ห้ามมี animation เข้าเลยที่ไม่ได้จากผู้ใช้ และต้องเคารพ `prefers-reduced-motion`
- **Legal**: ทุกหน้า login และ profile ต้องมีลิงก์ `/privacy` และ `/terms`

### 8.1 คอมโพเนนต์กลางที่ต้องใช้ (ห้ามเขียนซ้ำในหน้า)

สถานะทั้งสี่แบบเคยถูกเขียนใหม่แยกกันใน 6+ หน้า ด้วยสีและถ้อยคำไม่ตรงกัน
ตั้งแต่ Design System V2 ให้ใช้ของกลางใน `client/src/components/DesignSystem.tsx`
เท่านั้น — ห้ามประกาศ `PageHeader`/`EmptyState`/`ErrorState`/`StatusChip`/`Modal`
/`Field` ซ้ำในไฟล์หน้า

| คอมโพเนนต์ | ใช้กับ | กติกา |
|---|---|---|
| `PageHeader` | หัวหน้าทุกหน้า | `title` 1 บรรทัด + `description` 1 ประโยค + `primaryAction` **ไม่เกิน 1 ปุ่ม** ที่เหลือใส่ `secondaryActions` |
| `SectionHeader` | หัวข้อบล็อกในหน้า | `h2` + ลิงก์ "ดูทั้งหมด" ได้ 1 ลิงก์ |
| `EmptyState` | เมื่อไม่มีข้อมูล | ต้องมี `title` + `description` ที่บอกว่าขาดอะไร + `action` ทางไปต่อ (ยกเว้นไม่มีจริง ๆ) |
| `ErrorState` | เมื่อโหลด/บันทึกไม่สำเร็จ | `title` เป็นประโยคไทยที่ผู้ใช้เข้าใจ, ข้อความเทคนิคใส่ `technical` ซ่อนหลัง "รายละเอียดทางเทคนิค" — ห้ามแสดง error ดิบเป็นข้อความหลัก |
| `StatusChip` | ทุกสถานะ | ใช้ `tone` จาก `success`/`warning`/`error`/`info`/`neutral` เท่านั้น และต้องมีข้อความกำกับเสมอ (ห้ามสื่อด้วยสีอย่างเดียว) |
| `Modal` | ทุก dialog | ให้ role=dialog, Escape, focus trap และ scroll containment มาแล้ว — ห้ามใช้ `.modal-card` ตรง ๆ อีก |
| `Field` | ทุกช่องกรอก | ผูก `label`/`hint`/`error` ให้อัตโนมัติ — ห้ามใช้ placeholder แทน label |

### 8.2 ธีมมืด

โหมดมืดทำงานด้วยการ **remap token** ที่ `.dark` ใน `client/src/index.css`
(`--color-canvas`, `--color-ink`, `--color-hairline`, …) ไม่ใช่การ override
คลาส Tailwind ด้วย `!important` อีกต่อไป เพราะฉะนั้น **ทุกสีต้องมาจาก
`var(--color-*)` หรือคลาสใน `DesignSystem.tsx`** — ถ้าใส่สี palette ดิบ
(`slate-*`, `blue-*`, `gray-*`) หน้าที่นั้นจะพังในโหมดมืดทันที

### 8.3 มือถือก่อน (390px)

- ทุกหน้าต้องใช้ได้ที่ 360–414px โดย **ไม่มีการเลื่อนแนวนอน**
- ตารางที่มีมากกว่า 4 คอลัมน์ ต้องเปลี่ยนเป็นการ์ด/รายการที่ breakpoint `md`
- ตัวควบคุมที่กดได้ต้องสูงอย่างน้อย 44px (`min-h-11`) และมีระยะห่างพอ
- ข้อความจริงต้องไม่เล็กกว่า `.type-fine` (12px)
- ปุ่ม/ลิงก์ต้องมี focus ring จาก `:focus-visible` เสมอ

### 8.2 Clay surfaces (opt-in, care-leader screens)

หน้าที่ใช้งานบนมือถือมือเดียว (ตอนนี้คือ `/care` เช็คชื่อแคร์) ใช้พื้นผิวแบบ Clay: พื้นเขียวเสจอ่อน
การ์ดนูนนุ่ม ปุ่มที่ "จม" เมื่อกด ส่วนที่เหลือของแอปยังเป็น chrome แบบแบนตามข้อ 5

- Token และคลาสอยู่ท้าย `client/src/index.css` (`--clay-*`, `.clay-screen`, `.clay-card`,
  `.clay-card-soft`, `.clay-btn`, `.clay-chip`, `.clay-tile`, `.clay-progress`, `.clay-badge`,
  `.clay-tag`) มีค่าโหมดมืดใน `.dark` ใช้สี `hsl()` เพื่อไม่ชนกับการสแกน hex ใน `design-tokens.test.ts`
- ใช้เงาหลายชั้นได้เฉพาะคลาส `clay-*` เท่านั้น (ข้อยกเว้นของข้อ 8 "ห้ามซ้อนเงาหลายชั้น")
- ปุ่มหลักใช้ `--color-primary` ตัวอักษร `--color-on-dark` เหมือนเดิม; chip สีมิ้นต์/พีช/เนยมีสีตัวอักษรของตัวเอง
  คอนทราสต์ ≥ 4.5:1 ทั้งโหมดสว่างและมืด
- ทุกปุ่มสูงอย่างน้อย 44px; สถานะ "เลือกแล้ว" ต้องมีเครื่องหมายถูก ไม่ใช้สีอย่างเดียว
- ขยายไปหน้าอื่นทีละหน้า ห้ามผสมกับการ์ดแบบแบนในหน้าเดียวกันโดยไม่มีเหตุผล

## แผนที่ (`/map`, ตัวปักพิกัด)

- แผนที่ถนนใช้ OpenStreetMap (ชื่อถนน/หมู่บ้านภาษาไทย) และกลับด้านสีด้วย CSS ในโหมดมืด (`.pk-map-dark`) · ภาพดาวเทียมใช้ Esri World Imagery · ปุ่มสลับ `[ แผนที่ถนน | ดาวเทียม ]` อยู่มุมขวาบนของแผนที่
- CARTO Voyager/Dark Matter ถูกทดลองแล้วใช้ไม่ได้ (ไทล์ที่ไม่มี key ถูกประทับ "API KEY REQUIRED") ถ้าปริมาณใช้งานเกินนโยบายของ OSM ให้เปลี่ยนไปใช้ผู้ให้บริการที่มี key
- หมุดแยกสีตามบอดี้ (`lib/geo.ts` → `bodyColor`) และมีตัวกรองตามบอดี้ที่ระบุชื่อ จึงไม่ใช้สีอย่างเดียวสื่อความหมาย
- ตัวปักพิกัด (`components/map/LocationPicker.tsx`) ปักได้ 3 วิธี: ตำแหน่งปัจจุบัน (GPS), แตะ/ลากหมุด, วางลิงก์ Google Maps หรือ `lat, lng` (ลิงก์ย่อ maps.app.goo.gl อ่านพิกัดไม่ได้) บันทึกผ่าน `PUT /api/groups/:id` เดิม (สิทธิ์เดิม: ผู้ดูแลระบบ/หัวหน้าฝ่ายงาน หรือผู้นำกลุ่มนั้น)
- แสดงเฉพาะพันธกิจที่มีพิกัดจริงในระบบ ไม่มีพิกัดตัวอย่าง
