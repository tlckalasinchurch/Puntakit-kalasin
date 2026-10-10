<!-- last_verified: 2026-10-10 -->
---
version: 1
name: Puntakit Design System
description: >
  ระบบดีไซน์ของ Puntakit — quiet graphite chrome, rounded white surfaces และสี interactive เดียวคือ olive.
  แอปต้องสงบเพื่อให้ "คน" เป็นเนื้อหาหลัก. Church blue / Deep Navy เป็นอัตลักษณ์เดิมที่ปลดระวางแล้วทั้งหมด.
audience: AI coding agents และนักพัฒนาที่แก้ UI ของ Puntakit
source_of_truth:
  tokens: client/src/index.css
  components: client/src/components/DesignSystem.tsx
  primitives: client/src/components/ui
  audit: docs/PUNTAKIT_UX_UI_AUDIT_2026-10-07.md
  brand: brand-spec.md
  rules: design.md

colors:
  # ── Field: สี interactive เดียวของทั้งแอป ──
  primary: "#315c2b"            # ลิงก์ ปุ่มหลัก ไอคอน focus — สี chromatic เดียวที่อนุญาต
  primary-focus: "#3f7337"      # hover / pressed / focus ring
  primary-on-dark: "#7faf72"    # ข้อความเน้นบนพื้น graphite
  accent-soft: "#e8f0e4"        # พื้น chip อ่อนบนขาว
  on-primary: "#ffffff"         # ⚠️ light เท่านั้น — dark ใช้ #1d1d1f (ดู variants.dark)

  # ── Chrome & surfaces (บันได neutral 3 ขั้น) ──
  ink: "#1d1d1f"                # หัวข้อ + body
  body-muted: "#6f6f73"         # ข้อความรอง label metadata
  canvas: "#ffffff"             # พื้นการ์ด
  canvas-soft: "#f5f5f7"        # หล่ม, สลับแถวตาราง, พื้นเพจของ admin shell
  surface: "#fafafc"            # ขั้นระหว่าง canvas กับ canvas-soft
  canvas-sunken: "#f2f2f4"      # พื้น recessed (inset well / hover fill)
  divider: "#f0f0f0"            # เส้นคั่น *ภายใน* การ์ด (ประดับ)
  hairline: "#e0e0e0"           # เส้นขอบการ์ด + input  (= --border, --input)

  # ── Graphite (dark chrome) ──
  dark-surface: "#272729"       # sidebar, tooltip, พื้นมืด
  dark-surface-2: "#2a2a2c"     # gradient start / พื้นมืดยกขึ้น
  dark-surface-3: "#252527"     # gradient end / พื้นมืดยุบลง
  on-dark: "#ffffff"
  on-dark-muted: "#a1a1a6"
  on-dark-hairline: "#3a3a3c"
  black: "#000000"              # พื้นหลังเพจในโหมดมืด

  # ── Status (ความหมายตายตัว — ห้ามเปลี่ยน) ──
  success: "#1e8e5a"
  warning: "#c77819"
  error: "#c23b4d"
  info: "#2f6fcc"
  info-strong: "#2f72bf"        # ข้อความ/ไอคอน info บนขาว
  info-soft: "#e6f1ff"

  # ── Neutral text ramp (เอกสารเก่าอ้างถึง) ──
  text-secondary: "#55555a"
  text-tertiary: "#6f6f73"
  text-quaternary: "#8e8e93"    # ⚠️ non-text เท่านั้น — 3.26:1 บนขาว ไม่ผ่าน 4.5:1

  # ── Activity accents (semantic, ไม่เกิน 3 โทนต่อหน้า) ──
  care-purple: "#7950d8"        # กิจกรรมพันธกิจ/อธิษฐาน
  relationship-pink: "#e85d78"  # ความสัมพันธ์ / follow-up
  activity-orange: "#f3a23a"    # กิจกรรม / การนัดหมาย

  # ── Chart series (ใช้ตามลำดับ ห้ามสลับ) ──
  chart-1: "#548bd9"
  chart-2: "#44b889"
  chart-3: "#f1a73b"
  chart-4: "#df5b79"
  chart-5: "#7e5ad6"
  chart-6: "#45a8a4"

typography:
  family: 'Prompt, system-ui, sans-serif'   # ฟอนต์เดียว ห้ามเพิ่มฟอนต์ที่สอง — Thai-first
  weights: [400, 500, 600, 700, 800]
  scale:                                    # ใช้คลาส .type-* เท่านั้น ห้าม inline size
    hero:            { size: 56px, weight: 600, lineHeight: 1.07 }
    display-lg:      { size: 40px, weight: 600, lineHeight: 1.1 }
    display-md:      { size: 34px, weight: 600, lineHeight: 1.15 }
    lead:            { size: 28px, weight: 400, lineHeight: 1.35 }
    body:            { size: 17px, weight: 400, lineHeight: 1.47 }
    body-strong:     { size: 17px, weight: 600, lineHeight: 1.47 }
    caption:         { size: 14px, weight: 400, lineHeight: 1.45 }
    caption-strong:  { size: 14px, weight: 600, lineHeight: 1.45 }
    fine:            { size: 12px, weight: 400, lineHeight: 1.4 }   # ขั้นต่ำสุดที่อนุญาต
  rules:
    - ความยาวบรรทัด body ≤ ~70 ตัวอักษร
    - หัวข้อใช้ letter-spacing ติดลบ, body ปกติ
    - eyebrow ใช้สี primary ไม่ใช่ uppercase ซ้ำทุกจุด

spacing:
  base: 4px
  scale: [4, 8, 12, 16, 20, 24, 32, 40, 48]
  page: 24px
  card_padding: 16-24px
  between_cards: 16px
  touch_target_min: 44px

radius:                 # ประกาศใน :root แบบ unlayered → ทับ namespace ของ Tailwind
  none: 0px             # ทำให้ rounded-sm/md/lg ของ Tailwind = ค่าโปรเจกต์โดยอัตโนมัติ
  xs: 5px
  sm: 8px
  md: 11px
  lg: 18px
  pill: 9999px
  circle: 50%
  aliases: { tile: md, panel: md, card: lg }

elevation:
  none: 'chrome + การ์ดปกติ ต้องแบน'          # ค่าเริ่มต้น
  standard: '0 10px 28px rgba(29,29,31,.08)'  # การ์ดที่ยกลอยจริง (--shadow)
  overlay: 'เงาดำเข้มกว่า'                    # sidebar mobile / dropdown / modal
  rule: 'เฉดเงาต้องเป็นดำกลาง ห้ามมีโทนสี'

z_index: { base: 0, sticky: 30, overlay: 40, drawer_and_modal: 50 }

layout:
  sidebar: 240px graphite
  topbar: 76px sticky
  member_header: 60px sticky
  content_max: 1440px
  split: '70/30 main/right'
  breakpoints: { sm: 640px, md: 768px, lg: 1024px, xl: 1280px }
  responsive_rule: 'ตาราง > 4 คอลัมน์ ต้องเปลี่ยนเป็น card/list ที่ md'

motion:
  # กำหนดเมื่อ 2026-10-10 — ใช้ใน admin shell (.pk-premium) เท่านั้น; member PWA ยังไม่ได้รับ
  easing: { out: 'cubic-bezier(0.22, 1, 0.36, 1)  (--pk-ease-out)', in: 'cubic-bezier(0.4, 0, 1, 1)  (--pk-ease-in)' }
  duration: { fast: 160ms, base: 240ms, slow: 480ms }   # --pk-dur-fast / --pk-dur-base / --pk-dur-slow
  rule: >
    ใช้เฉพาะเพื่อตอบสนองการกระทำของผู้ใช้ (เปิด/ขยาย/ยืนยัน) — ห้าม animation เข้าเอง
    และทุกอย่างต้องถูกปิดโดย prefers-reduced-motion
  reduced_motion: 'index.css มี global override ที่ * { animation/transition-duration: .01ms !important }'
---

# Puntakit Design System

> **WIRING (ผูกพัน):** อ่านไฟล์นี้ก่อนทำงานด้านภาพหรือ UI ทุกครั้ง
> ใช้เฉพาะ token ที่ประกาศไว้ใน frontmatter นี้ **ห้ามคิดค่าใหม่ขึ้นเอง** และต้องทำให้ state ตรงตามที่ระบุ
> ถ้าไฟล์นี้กับ `client/src/index.css` (`:root`) ขัดกัน → **ยึด `index.css` แล้วแก้ไฟล์นี้**

---

## 1. Product context

แอปบริหารคริสตจักรไทยที่ **ข้อมูลคือคน** — สมาชิก พันธกิจ การเยี่ยมติดตาม
หน้าจอจึงต้อง "สงบ": chrome สีเทากราไฟต์หุ้มเนื้อหาที่เป็นพื้นขาวโค้งมน และมีสีเน้นเพียงสีเดียว
ไม่ใช่ dashboards ที่แข่งขันกันเรียกความสนใจ · ไม่ใช่หน้า marketing · ไม่ใช่ SaaS หลาย tenant

**ไม่ใช่อะไร:** ไม่ใช่ Next.js (ใช้ wouter) · ไม่ใช่ธีมมืดเป็นค่าเริ่มต้น · ไม่ใช่แอปที่ผู้ใช้สมัครเอง (สมาชิกถูกเพิ่มโดยคริสตจักร)

## 2. Aesthetic direction

> **"ห้องอ่านหนังสือของโบสถ์: ผนังกราไฟต์ กระดาษขาว และหมึกเขียวโอลีฟหนึ่งขวด"**

Chrome ถอยหลัง พื้นผิวขาวยกขึ้นเบา ๆ และมีสีเขียวโอลีฟเดียวทำหน้าที่ "สิ่งที่กดได้"
ไม่มี gradient ประดับ ไม่มีเงานุ่มฟู ไม่มีสีรุ้ง — ความหมายทั้งหมดมาจาก *ตำแหน่งและน้ำหนัก* ไม่ใช่สี

- **Looks like:** เครื่องมือภายในที่นิ่ง สะอาด อ่านง่ายบนมือถือ · ตัวอักษรไทยเป็นพระเอก
- **Doesn't look like:** template admin ธีมน้ำเงิน · landing page SaaS · แดชบอร์ดที่มี 6 สี
- **Premium admin shell (2026-10-10, ตามคำสั่งผู้ใช้):** ชั้น *เพิ่มเติม* บน admin shell เท่านั้น (`.pk-premium` ที่ `AppLayout`) — กระจกโปร่ง (`.pk-glass`) เฉพาะ chrome ที่ sticky/fixed (topbar, bottom nav), บรรยากาศไล่เฉด (`.pk-atmosphere`), hero กราไฟต์ที่ Home (`.pk-hero`), เงาสองชั้นแบบกลางของการ์ด (`.card-surface`/`.pk-surface`), ขีดโอลีฟนำหัวเรื่อง (`[data-pk="page-title"]`) และ motion token `--pk-*` ทุกเฉดสีมาจาก token เดิมผ่าน `color-mix` ไม่มี hex ใหม่ และ **ไม่เปลี่ยนค่า token แกน** — กฎ "ไม่มี gradient ประดับ" ด้านบนยังใช้กับ member PWA และทุกที่นอก shell นี้ · ล็อกขอบเขตด้วย `client/src/premium-shell-contract.test.ts`
- **Real-world references:** neutral ladder ของ Apple (นำมาใช้) — แต่ **เปลี่ยนสี interactive จาก Action Blue เป็น olive** (`DESIGN-apple.md` คือบันทึกการวิเคราะห์ต้นทาง ไม่ใช่ระบบของเรา)

## 3. Colour

**กฎ:** สี interactive มี **หนึ่งเดียว** (`primary`) — ใช้ "หนึ่งหรือสองจุดต่อหน้าจอ ไม่ใช่ทุกที่"
สี status มี **ความหมายตายตัว ห้ามเปลี่ยน** และสี accent ของกิจกรรมใช้ได้แต่ต้องมีความหมาย

### 3.1 โหมดมืด = **variant ไม่ใช่ palette ที่สอง**

โหมดมืดทำงานโดย **remap token** ที่ `.dark` ใน `index.css` (23 token) — **ไม่ใช่** override คลาส Tailwind ด้วย `!important`
⇒ **ทุกสีต้องมาจาก `var(--color-*)`** ถ้าใส่ palette ดิบ (`slate-*`, `blue-*`, `gray-*`) หน้านั้นจะพังในโหมดมืดทันที
(บังคับใช้ด้วย `client/src/design-system-consistency.test.ts`)

**ค่าที่ถูก remap ใน `.dark`:** `canvas #2a2a2c` · `canvas-soft #252527` · `surface #272729` · `canvas-sunken #202022` · `ink/body #ffffff` · `body-muted rgba(255,255,255,.64)` · `hairline rgba(255,255,255,.14)` · `divider rgba(255,255,255,.09)` · `text-* rgba(255,255,255,.82/.64/.48)` · `primary #7faf72` · `on-primary #1d1d1f` · `primary-focus #7faf72` · `accent-soft rgba(127,175,114,.16)` · `info-soft rgba(47,111,204,.24)` · `info-strong #8ab6ef` · `shadow rgba(0,0,0,.32)`

### 3.2 สถานะ contrast ที่ **ตรวจแล้ว** (คำนวณจาก token จริง — WCAG 2.x)

| คู่สี | อัตราส่วน | 4.5:1 | 3:1 |
|---|---|---|---|
| ink `#1d1d1f` บน canvas | 16.83:1 | ✅ | ✅ |
| body-muted `#6f6f73` บน canvas / canvas-soft | 5.00 / 4.60:1 | ✅ | ✅ |
| primary `#315c2b` เป็นข้อความบนขาว | 7.79:1 | ✅ | ✅ |
| ขาวบน primary (ปุ่ม) | 7.79:1 | ✅ | ✅ |
| primary บน accent-soft | 6.68:1 | ✅ | ✅ |
| error `#c23b4d` บนขาว / บน error-soft | 5.22 / 4.50:1 | ✅ | ✅ |
| info `#2f6fcc` บนขาว | 4.92:1 | ✅ | ✅ |
| **success `#1e8e5a` เป็นข้อความบนขาว** | **4.14:1** | ❌ | ✅ |
| **success บน success-soft (`#E4F1EB`)** | **3.56:1** | ❌ | ✅ |
| **warning `#c77819` เป็นข้อความบนขาว** | **3.43:1** | ❌ | ✅ |
| **warning บน warning-soft (`#F8EFE3`)** | **3.01:1** | ❌ | ✅ |
| **text-quaternary `#8e8e93` บนขาว** | **3.26:1** | ❌ | ✅ |
| **hairline `#e0e0e0` เทียบพื้นเพจ `#f5f5f7`** | **1.21:1** | — | ❌ |
| **สถานะทั้ง 4 เป็นข้อความบน `.dark` canvas `#2a2a2c`** | **2.75–4.18:1** | ❌ | ผสม |

> ⚠️ แถวที่ ❌ คือ **deviation ที่ยังไม่แก้** (รายละเอียด + ค่าทดแทนที่คำนวณแล้วอยู่ใน [`docs/PUNTAKIT_UX_UI_AUDIT_2026-10-07.md`](./docs/PUNTAKIT_UX_UI_AUDIT_2026-10-07.md) §2, §8)
> **ห้ามถือว่าเป็นค่าที่ถูกต้อง** — และการแก้ต้องแก้ที่ `index.css` **ไม่ใช่ override ในหน้า**

## 4. Typography

ฟอนต์เดียว **Prompt** (Thai-first) — ห้ามเพิ่มฟอนต์ที่สอง · ใช้คลาส `.type-*` เท่านั้น (ห้าม `text-[13px]` หรือ `font-size` inline)

| คลาส | size / weight / line-height | ใช้กับ |
|---|---|---|
| `.type-hero` | 56 / 600 / 1.07 | ยังไม่มีผู้ใช้ (0 จุด) — ถ้าไม่ใช้ให้เลิก |
| `.type-display-lg` | 40 / 600 / 1.1 | หัวหน้า hero |
| `.type-display-md` | 34 / 600 / 1.15 | ตัวเลขสถิติขนาดใหญ่ |
| `.type-lead` | 28 / 400 / 1.35 | คำโปรย |
| `.type-body` | 17 / 400 / 1.47 | เนื้อความ |
| `.type-body-strong` | 17 / 600 / 1.47 | ชื่อรายการ/หัวข้อการ์ด |
| `.type-caption` | 14 / 400 / 1.45 | label, metadata |
| `.type-caption-strong` | 14 / 600 / 1.45 | label เน้น |
| `.type-fine` | 12 / 400 / 1.4 | **ขั้นต่ำสุด** — nav, meta |

**Thai-specific:** ภาษาไทยมีสระบน/ล่างสูงกว่า Latin ⇒ line-height ต้อง **ไม่ต่ำกว่า 1.4 สำหรับข้อความหลายบรรทัด**
ค่าต่ำอย่าง 1.07–1.15 ของ `hero/display` ใช้กับ **บรรทัดเดียว** เท่านั้น และ `leading-snug` (1.375) ที่ทับ `.type-body-strong` (1.47) บนหัวข้อไทยที่ตัด 2–3 บรรทัด **เป็นความเสี่ยงจริง** (ดู audit §6 C5)

## 5. Spacing, layout, elevation

- **สเกล:** 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 — ของกลางในหน้า 16–24px, ระหว่างการ์ด 16px, ระยะหน้า 24px
  (ค่าอย่าง `p-3.5`=14px / `gap-2.5`=10px **หลุดสเกล** — ดู audit §6 C8)
- **Layout:** 240px graphite sidebar · 76px sticky topbar · member PWA ใช้ header 60px + bottom nav · content ล็อกที่ 1440px · สัดส่วน 70/30
- **Elevation:** chrome และการ์ดปกติ **แบน** (ไม่มีเงา) · เฉพาะสิ่งที่ลอยจริงใช้ `--shadow · เฉดต้องเป็นดำกลาง ห้ามมีโทนสี
- **Nested radius:** element ในภาชนะที่โค้ง ต้องใช้ `inner = outer − padding` — `outer 18px + padding 22px ⇒ inner = 0` ไม่ใช่ 18px
- **z-index:** base 0 · sticky 30 · overlay 40 · drawer/modal 50 (ห้ามตั้งค่าลอย ๆ นอกสเกลนี้)

## 6. Components & states

### 6.1 ของกลาง — ห้ามเขียนซ้ำในหน้า

สถานะ 4 แบบเคยถูกเขียนใหม่แยกกันใน 6+ หน้า ด้วยสีและถ้อยคำไม่ตรงกัน ตั้งแต่ Design System V2 **ต้องใช้ของกลางเท่านั้น**
(บังคับด้วย `client/src/design-system-consistency.test.ts`)

| Component | ไฟล์ | กติกา |
|---|---|---|
| `PageHeader` | `components/DesignSystem.tsx` | `title` 1 บรรทัด + `description` 1 ประโยค + `primaryAction` **≤ 1 ปุ่ม** ที่เหลือใส่ `secondaryActions` |
| `SectionHeader` | " | `h2` + ลิงก์ "ดูทั้งหมด" ได้ ≤ 1 |
| `EmptyState` | " | ต้องมี `title` + `description` ที่บอกว่าขาดอะไร + `action` ทางไปต่อ |
| `ErrorState` | " | `title` เป็นประโยคไทยที่ผู้ใช้เข้าใจ · ข้อความเทคนิคซ่อนหลัง "รายละเอียดทางเทคนิค" |
| `StatusChip` | " | `tone` ∈ `success\|warning\|error\|info\|neutral` **และต้องมีข้อความกำกับเสมอ** |
| `Modal` | " | ให้ `role=dialog`, Escape, focus trap, scroll containment มาแล้ว |
| `ConfirmDialog` | `components/ConfirmDialog.tsx` | ยืนบน `Modal` · `details` = ข้อเท็จจริงที่ยืนยัน 1 บรรทัด/แถว · `isSubmitting` ปิดปุ่มทั้งสองกัน double submit · `error` = ข้อความเมื่อคำสั่งล้ม (render `role="alert"` ใน dialog) — **การลบล้างข้อมูลต้องมาทางนี้เท่านั้น ห้ามเขียน dialog เฉพาะหน้า** |
| `Field` | " | ผูก `label`/`hint`/`error` อัตโนมัติ — **ห้ามใช้ placeholder แทน label** |
| `DataBar`, `InitialsAvatar`, `MetricTile`, `ListPager`, `FilterDisclosure` | " | ใช้ของกลางเท่านี้ |

### 6.2 Enumerating states (ต้องทำให้ครบทุกตัว)

| ชนิด | States ที่ต้องรองรับ |
|---|---|
| ปุ่ม (primary) | default · hover (`--color-primary-focus`) · pressed · `focus-visible` (ring 2px + offset 2px) · disabled (`opacity-50`) · loading (spinner ในปุ่ม) |
| ปุ่ม (secondary) | default · hover (`--color-canvas-soft`) · pressed · focus · disabled |
| ปุ่ม (danger) | พื้น `--color-error` |
| ช่องกรอก | default · focus · filled · disabled · invalid (`aria-invalid` + `FieldError` `role="alert"`) |
| Chip/Status | 5 tone × (มีข้อความเสมอ) — **ห้ามสื่อด้วยสีอย่างเดียว** |
| โหลด | **Skeleton** = เนื้อหาหน้า (ตาราง/การ์ด/ฟอร์ม) · **Spinner** = ปุ่ม/action สั้น ๆ — **ห้ามใช้ `"..."` หรือจุดไข่ปลาแทน loading** |
| ว่าง / ผิดพลาด | ต้อง **แยกจาก loading** และห้ามแสดงพร้อมกัน |

### 6.3 ฟอร์ม ตาราง การ์ด นำทาง

- **ฟอร์ม:** ทุกช่องต้องมี `label` ที่ผูกจริง (`htmlFor`/`id`) · error ต้องผูกด้วย `aria-describedby` + `aria-invalid` · บนมือถือ font-size ต้อง **≥16px** กัน iOS zoom-on-focus (`text-base md:text-sm`)
- **ตาราง:** ต้องมี `<caption>` (จะ `sr-only` ก็ได้) + `scope="col"` · **> 4 คอลัมน์ ต้องเปลี่ยนเป็น card list ที่ `md`**
- **การ์ด:** พื้น `--color-canvas` + เส้นขอบ 1px `--color-hairline` + `--radius-lg` · **ห้ามซ้อนเงาหลายชั้น** (ยกเว้นคลาส `clay-*`)
- **นำทาง:** ใช้ `<Link>` + `aria-current="page"` · ปุ่ม icon ต้องมี `aria-label` · active state ต้องมี cue ทางรูปร่าง ไม่ใช่สีอย่างเดียว

## 7. Accessibility (WCAG 2.2 AA — เป้าที่ผูกพัน)

1. **ข้อความ** ≥ 4.5:1 · **non-text/UI boundary** ≥ 3:1 (ปัจจุบัน **hairline 1.21:1 ตกข้อนี้** — deviation)
2. **Touch target** ≥ 44×44px (`min-h-11` / `size-11`) — เป็นมาตรฐานที่ใช้จริง 159 จุด
3. **Focus:** ทุก element ที่โฟกัสได้ต้องมี `focus-visible` ring (168 ring / 139 outline usages + global fallback ใน `index.css`)
4. **ห้ามสื่อความหมายด้วยสีอย่างเดียว** — `StatusChip` ต้องมีข้อความ, ปุ่มสถานะต้องมี label + `aria-label`
5. **`prefers-reduced-motion`** — มี global override ที่ครอบ `*` ด้วย `!important` (ชนะ inline style)
6. **ภาษา:** `<html lang="th">` · `viewport-fit=cover`
7. **รูป:** รูปที่เป็น *เนื้อหา* ต้องมี `alt` ที่สื่อความหมาย — `alt=""` เฉพาะของประดับ (`Feed.tsx:378` เป็น deviation)

## 8. Do / Don't

**Do**
- ใช้ `var(--color-*)` และคลาส `.type-*` เท่านั้น
- ใช้ `PageHeader`/`StatusChip`/`EmptyState`/`ErrorState`/`Modal`/`Field` จาก `DesignSystem.tsx`
- ทำให้ทุก state ครบ (default/hover/pressed/focus/disabled/loading/empty/error)
- ตรวจ contrast ด้วยการคำนวณเมื่อเพิ่มคู่สีใหม่
- ใช้ 44px เป็นพื้นของ touch target
- อัปเดตไฟล์นี้ **ใน PR เดียวกัน** เมื่อเพิ่ม/เปลี่ยน token หรือ component

**Don't**
- ❌ hardcode hex หรือใช้ palette ดิบ (`slate-*`, `blue-*`, `gray-*`) — หน้า will พังในโหมดมืด
- ❌ กำหนดขนาดฟอนต์ inline หรือใช้ค่าต่ำกว่า 12px กับเนื้อหาจริง
- ❌ ประกาศ `PageHeader`/`EmptyState`/`ErrorState`/`StatusChip`/`modal-card` ซ้ำในหน้า
- ❌ override โหมดมืดด้วย `.dark .text-x-NNN { !important }`
- ❌ gradient ที่ไม่มีความหมาย · สี accent เกิน 3 โทนต่อหน้า · เปลี่ยนความหมายสี status
- ❌ ใช้ emoji เป็น icon ใน UI (ปัจจุบัน 0 จุด — รักษาไว้)
- ❌ ใช้ `bg-muted text-muted-foreground` (token `--muted` ถูก declare ซ้ำ ⇒ ได้เทาเข้มบนเทาเข้ม ≈ 1:1)
- ❌ ผสม Clay surface กับการ์ดแบนในหน้าเดียวกันโดยไม่มีเหตุผล
- ❌ ใช้เลขอ้างอิง `#1d1d1f` แบบตรง ๆ — ให้ใช้ token (จะทำให้สแกนหาพาเลตต์เก่าใน test พลาด)

## 9. Clay surfaces (opt-in — เฉพาะหน้า care-leader)

หน้าที่ใช้มือเดียวบนมือถือ (ปัจจุบัน `/care` เช็คชื่อแคร์) ใช้พื้นผิวแบบ **Clay**: พื้นเขียวเสจอ่อน การ์ดนูนนุ่ม ปุ่มที่จมเมื่อกด
ส่วนที่เหลือของแอปยังเป็น chrome แบนตาม §5

- Token/คลาสอยู่ท้าย `index.css` (`--clay-*`, `.clay-screen`, `.clay-card`, `.clay-btn`, `.clay-chip`, `.clay-tile`, `.clay-progress`, `.clay-badge`, `.clay-tag`) มีค่าโหมดมืดใน `.dark` และเขียนเป็น `hsl()` **เพื่อไม่ชนกับการสแกน hex ใน `design-tokens.test.ts`**
- **ข้อยกเว้นเดียว** ของกฎ "ห้ามซ้อนเงาหลายชั้น"
- ปุ่มหลักยังใช้ `--color-primary`; chip มิ้นต์/พีช/เนยมีสีตัวอักษรของตัวเอง contrast ≥ 4.5:1 ทั้งสองโหมด
- ทุกปุ่ม ≥ 44px · สถานะ "เลือกแล้ว" ต้องมีเครื่องหมายถูก ไม่ใช้สีอย่างเดียว
- **ขยายทีละหน้า ห้ามผสมในหน้าเดียว**

## 10. ข้อที่ยัง **NOT DEFINED** (ห้ามแต่งขึ้นเอง)

| หัวข้อ | สถานะ |
|---|---|
| Motion tokens (easing/duration) | **กำหนดแล้ว 2026-10-10** (`--pk-ease-*`, `--pk-dur-*`) สำหรับ admin shell — member PWA **ยัง NOT DEFINED** |
| Typography tokens สำหรับ `<code>`/mono | **NOT DEFINED** (มีที่ใช้ `font-mono` บ้างแต่ไม่มี token) |
| Focus ring token แยกสำหรับ dark | **NOT DEFINED** — `.dark` ตั้ง `--color-primary-focus = #7faf72` เท่ากับ `--color-primary` ⇒ hover ของปุ่ม primary **ไม่มี feedback** (1.00:1) และ ring สีเดียวกับปุ่ม = deviation |
| Token สำหรับขอบ control ที่ผ่าน 3:1 | **NOT DEFINED** — audit เสนอ `--color-border-strong: #86868b` แต่ **ยังไม่มีใน `index.css`** |
| Token สี status สำหรับโหมดมืด | **NOT DEFINED** — `.dark` ไม่ remap success/warning/error/info เลย |

## 11. Decisions log

| วันที่ | ตัดสินใจ | เหตุผล |
|---|---|---|
| — | ปลดระวาง Church Blue / Deep Navy → olive `#315c2b` เป็นสี interactive เดียว | อัตลักษณ์เดิมอ่านเย็น ขัดกับ chrome กราไฟต์ · บังคับด้วย `design-tokens.test.ts` |
| — | โหมดมืดเป็น **token remap** ที่ `.dark` ไม่ใช่ override ด้วย `!important` | การ override ต้องไล่เพิ่มทุกครั้งที่มีหน้าใหม่ และพลาดง่าย |
| — | ประกาศ `--radius-*` ใน `:root` **แบบ unlayered** เพื่อทับ namespace `--radius-*` ของ Tailwind | ทำให้ `rounded-sm/md/lg` ของ Tailwind = 8/11/18px ของโปรเจกต์โดยอัตโนมัติ ⇒ **ไม่มีสองระบบ radius** (ยืนยันแล้ว) |
| — | ใช้ **Clay surface** เฉพาะหน้า care-leader | หน้าจอใช้มือเดียวต้องการ affordance ต่างจาก desktop chrome |
| — | สีใน Clay เขียนเป็น `hsl()` | เพื่อไม่ให้ชนกับการสแกน hex ของ `design-tokens.test.ts` |
| — | `--color-on-primary` ในโหมดมืด = `#1d1d1f` (ไม่ใช่ขาว) | ขาวบน `#7faf72` = 2.54:1 ไม่ผ่าน AA — ต้องใช้ `on-primary` ไม่ใช่ `on-dark` |
| 2026-10-07 | บันทึก deviation 13 รายการจาก UX/UI audit รอบ 3 **โดยไม่ redesign** | audit เป็น source of truth — บทบาทของเอกสารนี้คือ *extract → document → standardize* |
| 2026-10-10 | เพิ่ม premium layer (glass/atmosphere/hero/motion) เฉพาะ admin shell ผ่าน `.pk-premium` — **ไม่แก้ token แกน** และไม่แตะ member PWA | ผู้ใช้สั่งยกระดับภาพทั้งเว็บ แต่ member PWA ยังอยู่หลังเกณฑ์ตรวจรับ Q21/Q13 และใช้ primitives ร่วมกัน จึงผูกเอฟเฟกต์กับ scope ของ shell · glass ใช้เฉพาะ sticky/fixed เพราะ blur บนเนื้อหาที่เลื่อนทำให้ repaint หนัก · tint olive จำกัดในแถบ topbar เพราะ body-muted บน canvas-soft มี contrast 4.6:1 ไม่มีที่ให้พื้นเข้มขึ้น |
| 2026-10-09 | `ConfirmDialog` มี prop `error` (แสดง `role="alert"` ขณะอยู่ใน dialog) | เดิม action ล้มแล้วเห็นแค่ toast ที่อาจพลาดไป หรือ dialog ค้างโดยไม่มีคำอธิบาย — ตอนนี้ผิดพลาดต้องถูกอ่าน **ที่จุดที่กระทำ** |
| 2026-10-09 | ข้อความตอบรับคำขออธิษฐาน เปลี่ยนเป็น "บันทึก…แล้ว รอผู้รับผิดชอบตรวจสอบ" | ระบบยังไม่มี endpoint/notification ฝ่ายทีม (D2 ยังไม่ตัดสิน) — copy ห้ามอ้างว่าทีมได้รับเรื่องแล้ว · ล็อกด้วย `client/src/prayer-request-copy-contract.test.ts` |
