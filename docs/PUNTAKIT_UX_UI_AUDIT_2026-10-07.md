# Puntakit UX / UI Audit — 2026-10-07 (Static, รอบ 3)

> **ขอบเขต:** static source audit ของ `client/src` (107 `.tsx`, `index.css` 1,238 บรรทัด) + ตรวจกับ audit-as-code test ทั้ง 7 ไฟล์
> **ข้อจำกัด:** เครื่องที่ audit **ไม่มี node/pnpm และไม่มี browser** → **ไม่มีการรันแอป, ไม่มี axe, ไม่มี Playwright, ไม่มี screen reader** ทุกข้อสรุปมาจากการอ่านโค้ด + คำนวณ WCAG contrast จากค่า token จริงใน `index.css`
> **ทุก contrast ratio ในเอกสารนี้ผมคำนวณเองซ้ำทั้งหมด** (relative luminance + สูตร WCAG 2.x) ไม่ได้ลอกจากเครื่องมือ
> **audit เดิม [`PUNTAKIT_UX_UI_AUDIT_2026-10.md`](./PUNTAKIT_UX_UI_AUDIT_2026-10.md) §5 ล้าสมัยแล้ว** — Members/Groups/Attendance แก้เป็น card list + responsive grid แล้ว, ไม่มี `text-[10px]`/`text-[11px]` ใน `pages/` แล้ว, ปุ่ม row action เป็น `size-11` (44px) แล้ว → **อย่ารายงาน 4 ข้อนั้นซ้ำ**

---

## 1. บทสรุปผู้บริหาร

Design system ของโปรเจกต์นี้ **แข็งแรงกว่าที่คาดมาก** สำหรับ codebase ขนาดนี้: palette เดียวจริง (retired palette = 0 hit), radius เป็นระบบเดียวจริง, ไม่มี emoji-as-icon, touch target 44px เป็นมาตรฐาน, `prefers-reduced-motion` ครอบด้วย `*` unlayered, label association ครบ และมี **audit-as-code 7 ไฟล์** ที่ล็อกข้อบกพร่องรอบก่อนไว้

ปัญหาจริงที่เหลืออยู่ **กระจุกเป็น 2 ธีมใหญ่** ซึ่งอธิบายข้อบกพร่องส่วนใหญ่ได้:

### 🔴 ธีมที่ 1 — "ระบบสีสถานะไม่รู้จักธีมมืด" (ร้ายแรงสุด)

`.dark` (index.css:1123-1161) remap canvas/ink/neutral/primary/info-soft/info-strong **แต่ไม่ remap `--color-success` / `--color-warning` / `--color-error` / `--color-info` เลย** (นิยามที่ L28-31 ที่เดียว) → สีสถานะทั้งชุดถูกออกแบบมาสำหรับพื้นขาว แล้วถูกนำไปวางบนพื้น `#2a2a2c`

| สถานะ | บน dark canvas `#2a2a2c` | บน chip `/10` ของตัวเอง |
|---|---|---|
| success `#1e8e5a` | **3.46:1** ❌ | 3.04:1 ❌ |
| warning `#c77819` | **4.18:1** ❌ | 3.59:1 ❌ |
| error `#c23b4d` | **2.75:1** ❌ (ตก 3:1 ของ non-text ด้วย) | 2.56:1 ❌ |
| info `#2f6fcc` | **2.91:1** ❌ (ตก 3:1 ด้วย) | 2.31:1 ❌ |

ต่อเนื่องกัน 3 จุดที่เป็นปัญหาเดียวกัน — **"วางสี on-colour ผิดตัว"**:

| จุด | หลักฐาน | ค่า | แก้เป็น |
|---|---|---|---|
| `Logo.tsx:19` | `bg-[var(--color-primary)] text-[var(--color-on-dark)]` | dark: ขาวบน `#7faf72` = **2.54:1** | `text-[var(--color-on-primary)]` → **6.63:1** |
| `Attendance.tsx:136` | `bg-[var(--color-info-strong)] text-[var(--color-on-dark)]` | dark: ขาวบน `#8ab6ef` = **2.10:1** | `text-[var(--color-on-primary)]` |
| `Attendance.tsx:143` | `bg-[var(--color-warning)] text-[var(--color-on-dark)]` | ขาวบน `#c77819` = **3.43:1** ทั้งสองธีม | ใช้พื้น `/10` + ตัวอักษร `--color-warning-ink` |

และ **`--navy`** — ชื่อพาเลตต์ที่ปลดระวางแล้วรอดชีวิตมาโดยเปลี่ยนแค่ "ค่า" (index.css:84 `--navy: var(--color-dark-surface)`) ซึ่ง **ไม่ถูก remap ใน `.dark`**:
`Privacy.tsx:70` / `Terms.tsx:71` ใช้ `color: "var(--navy)"` = `#272729` บน `.login-card` ที่ `background: var(--surface)` = `#2a2a2c` → **1.04:1 = หัวข้อมองไม่เห็นในธีมมืด**

### 🔴 ธีมที่ 2 — "Contrast ที่ยังไม่มี guard ครอบ" (light)

`design-tokens.test.ts:196` ตรวจ contrast แค่คู่เดียว (`on-primary` บน `primary` = ผ่าน 7.79:1) → คู่อื่นไม่มีใครตรวจเลย:

| คู่สี | ค่า | ต้องได้ |
|---|---|---|
| `--color-success` บน chip `/10` (`#E4F1EB`) | **3.56:1** ❌ | 4.5:1 (`StatusChip` เป็น 12px) |
| `--color-warning` บน chip `/10` (`#F8EFE3`) | **3.01:1** ❌ | 4.5:1 |
| `--color-warning` เป็นข้อความบนขาว (`Members.tsx:1410`) | **3.43:1** ❌ | 4.5:1 |
| `--color-text-quaternary #8e8e93` บนขาว | **3.26:1** ❌ | 4.5:1 (ถ้าใช้เป็นข้อความ) |
| `--color-hairline #e0e0e0` vs page `#f5f5f7` | **1.21:1** ❌ | 3:1 (1.4.11 ขอบ control) |
| พื้นปุ่ม secondary `#ffffff` vs page `#f5f5f7` | **1.07:1** ❌ | 3:1 |

**M2 (ขอบ control)** เป็นปัญหาเชิงระบบ: `--color-hairline` ถูกใช้เป็น `border` **140 จุด** รวมปุ่ม icon 44px (`Topbar.tsx:35,53`, `MemberAppLayout.tsx:96,108`) และปุ่ม secondary (`DesignSystem.tsx:65`) ซึ่งพื้นปุ่มขาวต่างจากพื้นเพจแค่ 1.07:1 → **สิ่งเดียวที่บอกขอบเขตปุ่มคือเส้น 1.21:1**

### 🟠 ธีมที่ 3 — "Safe-area บน iOS ใส่ไม่ครบ"

pattern ที่ถูกต้อง **มีอยู่แล้วในเรพ** (`MemberAppLayout.tsx:82,124`, `Topbar.tsx:27`, `MobileBottomNav.tsx:37`, `CareToday.tsx:263`) แต่ตกหล่น 4 จุด:

| จุด | หลักฐาน | ผล |
|---|---|---|
| **member shell (Critical)** | `MemberAppLayout.tsx:117` `pb-[88px]` คงที่ ขณะที่ nav (`:124`) สูงขึ้นตาม `env(safe-area-inset-bottom)` | nav = ~68px + inset; ที่ inset 34px (iPhone home indicator) = **102px > 88px** → เนื้อหาท้ายสุดของทุกหน้า member เลื่อนเข้าไม่ถึง ~14px (`MemberHome.tsx:450`, `MemberProfile.tsx:543-550`) |
| modal bottom sheet | `DesignSystem.tsx:655` `items-end … p-0` + `:728` footer `px-5 py-4` ไม่มี inset | primary action ทุกตัวของ member PWA อยู่ใน gesture zone (`PrayerRequestModal.tsx:118-138`, `Members.tsx:1245`, `ConfirmDialog.tsx:53`) |
| sidebar drawer | `Sidebar.tsx:228` `fixed inset-y-0` ไม่มี `env()` **ขณะที่ `Topbar.tsx:27` มี** | `apple-mobile-web-app-status-bar-style=black-translucent` → แถว Logo อยู่ใต้ status bar |
| `.login-shell` | `index.css:748` `100vh` + `padding: 20px` | หน้า login อยู่ใต้ status bar ในโหมดติดตั้ง PWA |

### ตารางสรุปทั้งหมด

| # | ระดับ | เรื่อง | ไฟล์ |
|---|---|---|---|
| A2 | **Critical** | สีสถานะทั้ง 4 ไม่ถูก remap ใน `.dark` → 2.31–4.18:1 | `index.css:1123-1161` |
| C1 | **Critical** | `--navy` = `#272729` ไม่ถูก remap → หัวข้อ Privacy/Terms มองไม่เห็นในธีมมืด (1.04:1) | `index.css:84`, `Privacy.tsx:70`, `Terms.tsx:71` |
| C2 | **Critical** | Logo cross: ขาวบน primary dark = 2.54:1 — และ guard **ข้ามไฟล์นี้โดยตรง** | `Logo.tsx:19` |
| C3 | **Critical** | member shell บังเนื้อหาท้ายหน้าบนเครื่องมี home indicator | `MemberAppLayout.tsx:117` |
| M1 | Major | `StatusChip` success/warning ตก 4.5:1 (3.56 / 3.01) | `DesignSystem.tsx:186-187` |
| M2 | Major | ขอบ control ตก 3:1 (1.21:1) — 140 จุด | `index.css` hairline |
| M3 | Major | `--color-warning` เป็นข้อความ 14px = 3.43:1 (บนขาว) / 3.01:1 (บน tint) | `Members.tsx:1410`, `ImportDuplicates.tsx:142,207` |
| M4 | Major | info-strong + white label = 2.10:1 (dark) | `Attendance.tsx:136` |
| M5 | Major | dark: `--color-primary-focus` = `--color-primary` → hover ปุ่ม primary **1.00:1 ไม่มี feedback** (28 จุด) + focus ring สีเดียวกับปุ่ม (142 จุด) | `index.css:1137,1139` |
| M6 | Major | dark `--color-text-quaternary` alpha .48 = 4.49:1 | `index.css:1136` |
| A3 | Major | skeleton ทั้ง 7 หน้าเป็น `aria-hidden` โดยไม่มี `role="status"` ครอบ → loading เงียบสนิทสำหรับ SR (หน้าที่ทำถูกแล้วมี 7 หน้าเช่นกัน) | `Feed.tsx:344`, `Inbox.tsx:313`, `Announcements.tsx:142`, `Events.tsx:185`, `FollowUps.tsx:164`, `Profile.tsx:18`, `ImportData.tsx:206` |
| A4 | Major | `<input type="file">` เป็น `sr-only` แต่อยู่ใน tab order → โฟกัสไปที่ของที่มองไม่เห็น | `ImportData.tsx:176-186` |
| A5 | Major | `role="menu"`/`menuitem` แต่ไม่มีคีย์ลูกศร/focus เข้า menu | `Groups.tsx:249-274` |
| A6 | Major | `role="tablist"`/`tab` แต่ไม่มี roving tabIndex/คีย์ลูกศร | `Attendance.tsx:564-591` |
| A7 | Major | MemberProfile grid 2 คอลัมน์ ตัดเบอร์โทร/เบอร์ฉุกเฉินที่ 360px | `MemberProfile.tsx:319,329,398,409` |
| A8 | Major | Map 420px คงที่ ไม่มี `touch-action` → เลื่อนหน้าผ่านไม่ได้ | `Map.tsx:488` |
| A9 | Major | Groups action row ล้นที่ยอด 3 หลัก + `overflow-x-hidden` ตัดขวา | `Groups.tsx:970-984` |
| C4 | Major | เงา 2 ภาษา: Tailwind default ดำ 18 จุด vs `var(--shadow)` graphite 10 จุด | ทั้งโปรเจกต์ |
| C5 | Major | 2 ระบบ typography: `.type-*` vs Tailwind `text-*` (182 จุด); `.type-hero` ไม่ถูกใช้, `.type-body` ใช้แค่ 4 ครั้ง | ทั้งโปรเจกต์ |
| C6 | Major | nested-radius ละเมิด: `.coming-soon-icon` 25px ใน `.coming-soon-card` 18px | `index.css:1033,1039` |
| C7 | Major | ค่า radius/hex hardcode ใน CSS แทน token (`11px`, `18px`, `10px`, `12px`, `25px`) | `index.css:906,952,354,988,1066` |
| C8 | Major | spacing หลุดสเกล (`p-3.5`=14px, `gap-2.5`=10px) หนาแน่นใน member PWA | `MemberProfile.tsx`, `MemberGroup.tsx`, `LoadingStates.tsx` |
| C9 | Major | `Home.tsx` แสดง "loading" เป็นสีแดง/เหลือง → ผู้ใช้เห็นเป็นความล้มเหลว | `Home.tsx:553,563` |
| C10 | Major | `cancelled` = error (Events) vs neutral (FollowUps/Groups/Map) — ค่าเดียวกันสองความหมาย | `Events.tsx:51` |
| C11 | Major | `Profile.tsx` ใช้ icon chip 3 สี (orange/green/blue) ขณะที่ทั้งแอพใช้ accent เดียว | `Profile.tsx:85,112` |
| C12 | Major | ปุ่มล้างคำค้นหา 36px (`size-9`) 2 ที่ vs 44px ใน `GlobalSearch.tsx:108` | `Members.tsx:607`, `Groups.tsx:730` |
| C13 | Major | skeleton Map 420px แต่ component จริง 500px → layout กระโดด | `Map.tsx:423` vs `Map.tsx:119` |
| A10-A16 | Minor | modal ไม่ associate description, `role="alert"`+`aria-live="polite"` ขัดกัน, Sidebar `h2` มาก่อน `h1`, ErrorBoundary ไม่มี `h1`, `img alt=""` ที่เป็นเนื้อหา, lucide icon ไม่ `aria-hidden`, `--muted` นิยามซ้ำ, `th` ไม่มี `scope` | ดู §6 |
| C14-C19 | Minor | sonner ใช้ `next-themes` แต่ไม่มี provider, hex ซ้ำ token, `rounded-2xl` หลุดสเกล, dead CSS 40 selector, `min-h-screen` vs `h-dvh`, ไม่มี `scroll-mt` | ดู §7 |
| G1-G7 | — | **guard มีรู 7 จุด** ที่ทำให้ปัญหาข้างบนผ่าน CI | §9 |

---

## 2. ธีมที่ 1 — ระบบสีสถานะไม่รู้จักธีมมืด

### A2 (Critical) — สีสถานะไม่ถูก remap

`--color-success/warning/error/info` นิยามที่ `index.css:28-31` **ที่เดียว** และไม่ปรากฏใน `.dark` block ใดเลย (`.dark` L1123-1161 remap 23 token แต่ไม่มีสถานะ) ขณะที่ **ธีมมืดเข้าถึงได้จากผู้ใช้** (`Topbar.tsx:50-63`)

**แก้:** เพิ่มใน `.dark` (L1161 ก่อน `}`) — ค่าที่แนะนำต้องผ่าน ≥4.5:1 ทั้งบน `#2a2a2c` และบน `/10` tint ของตัวเอง:

```css
.dark {
  --color-success: #6fc79a;
  --color-warning: #e0a75f;
  --color-error:   #f08a97;
  --color-info:    #8ab6ef;   /* มีอยู่แล้วในชื่อ --color-info-strong */
}
```
> ⚠️ `design-tokens.test.ts:43-48` ล็อกเฉพาะ `:root` token — `--color-success/warning/error/info` **ไม่ได้ถูกล็อก** จึงแก้ได้โดยไม่ทำ test พัง

### C1 (Critical) — `--navy` ที่ไม่ตาย

`index.css:82-89` เก็บ alias เก่าไว้ให้ primitive เดิม cascade ต่อ — เจตนาดี แต่ `--navy: var(--color-dark-surface)` อ้าง token ที่ `.dark` **ไม่ remap** (`--color-dark-surface` = `#272729` คงที่) ทำให้:

| | |
|---|---|
| `Privacy.tsx:70`, `Terms.tsx:71` | `color: "var(--navy)"` → `#272729` |
| `.login-card` | `background: var(--surface)` → `--surface: var(--color-canvas)` → dark `#2a2a2c` |
| **ผลลัพธ์** | **`#272729` บน `#2a2a2c` = 1.04:1 → หัวข้อมองไม่เห็น** |

**แก้:** เปลี่ยน `color: "var(--color-ink)"` ทั้งสองไฟล์ แล้วลบ `--navy` (L84) และ `--blue` (L85) ออก — `--blue` ไม่มีปัญหา contrast แต่ไม่มีผู้ใช้รายใหม่ควรหยิบมันไปใช้ (ผู้ใช้ปัจจุบันคือ `Privacy.tsx:60,75`, `Terms.tsx:62,75` ซึ่งควรย้ายไป `--color-primary`)

### C2 (Critical) — Logo cross glyph

`Logo.tsx:19`: `bg-[var(--color-primary)] text-[var(--color-on-dark)]`
- dark: `--color-primary` = `#7faf72`, `--color-on-dark` = `#ffffff` **ไม่เคยถูก remap** → **2.54:1** (และเป็น icon → ต้องได้ 3:1 ตาม 1.4.11)
- **`design-tokens.test.ts:202` ข้ามไฟล์นี้โดยตรง** (`f.endsWith("Logo.tsx")`) → จุดเดียวที่ละเมิดกฎของตัวเอง คือจุดเดียวที่ guard มองไม่เห็น

**แก้:** `text-[var(--color-on-primary)]` → dark ได้ `#1d1d1f` = **6.63:1** ✅
**บั๊กเดียวกันที่ตัว test จับไม่ได้เพราะ regex ไม่ครอบ:** `Map.tsx:148,370,383` ใช้ `text-white` แทน `text-[var(--color-on-dark)]` ซึ่ง regex ที่ `design-tokens.test.ts:204` มองหาแบบหลังเท่านั้น → **ต้องแก้ 3 จุดนั้นเป็น `text-[var(--color-on-primary)]` ด้วย**

### M4 — info-strong + white

`Attendance.tsx:136`: `bg-[var(--color-info-strong)] text-[var(--color-on-dark)]` → dark ขาวบน `#8ab6ef` = **2.10:1** ❌

### M5 — dark: `--color-primary-focus` ซ้ำกับ `--color-primary`

`index.css:1137` `--color-primary: #7faf72` และ `:1139` `--color-primary-focus: #7faf72` — **ค่าเดียวกัน** แต่ token นี้ถูกใช้ 2 บทบาท:

| บทบาท | จำนวน | ผลใน dark |
|---|---|---|
| `hover:bg-[var(--color-primary-focus)]` | **28 จุด** | พื้นปุ่ม active vs hover = **1.00:1 → ไม่มี hover feedback เลย** |
| `focus-visible:ring-[var(--color-primary-focus)]` | **142 จุด** | focus ring สีเดียวกับปุ่มที่มันล้อม = **1.00:1** |

และ **ไม่มีไฟล์ไหนตั้งสี `ring-offset`** (มีแค่ `ring-offset-2` เปล่า) → Tailwind ใช้ default `#fff` ทั้งสองธีม → dark mode จะได้ **วงขาว 2px** แทนวง olive ที่ตั้งใจ
**แก้:** ให้ `.dark` มี `--color-primary-focus` เป็น olive ที่ต่างชัดจาก `--color-primary` (ค่าให้ designer เคาะ — ต้องห่างพอให้ hover ดูออก และ ring ≥3:1 เทียบทั้งปุ่มและเพจ)

### M6 — dark `--color-text-quaternary`

`rgba(255,255,255,0.48)` บน `#2a2a2c` = **4.49:1** (ตกไป 0.01) → **alpha `0.52` = 5.03:1** ✅

---

## 3. ธีมที่ 2 — Contrast ฝั่ง light

### M1 — `StatusChip` (1.4.3)

`DesignSystem.tsx:185-192`:
```tsx
success: "bg-[var(--color-success)]/10 text-[var(--color-success)]",
warning: "bg-[var(--color-warning)]/10 text-[var(--color-warning)]",
```
`StatusChip` render ที่ `type-fine` = **12px** (`:209`) → normal text ต้องได้ **4.5:1**

| คู่ | ค่า |
|---|---|
| success `#1e8e5a` บนขาว | 4.14:1 ❌ |
| success บน chip `#E4F1EB` *(composite จริงของ `rgba(30,142,90,.12)` บนขาว)* | **3.56:1** ❌ |
| warning `#c77819` บนขาว | 3.43:1 ❌ |
| warning บน chip `#F8EFE3` | **3.01:1** ❌ |
| error `#c23b4d` บน chip `#F9EBED` | 4.50:1 ✅ (เฉียด — เฝ้าระวัง) |

chip เหล่านี้อยู่บนหน้าจอหนาแน่น: `Attendance.tsx:686,688,1013,1017`, `MemberAttendance.tsx:119,133`, `MemberEvents.tsx:220`, `Announcements.tsx:176`, `Feed.tsx:90-91`, `FollowUps.tsx:44,46`, `Groups.tsx:141-148,163`, `Events.tsx:52`
**นอกจากนี้ยังมีชุดที่สองที่ซ้ำปัญหาใน `Attendance.tsx:129,143,155-160,173` (ปุ่มสถานะ + MetricTile) ซึ่งเป็น element คนละตัวกับ `StatusChip`**

### M3 — `--color-warning` เป็นข้อความ

`Members.tsx:1410` (หัวข้อบันทึก pastoral บน `bg-[var(--color-warning-soft)]`) = **3.01:1**, `ImportDuplicates.tsx:142,207,267` (บนขาว) = **3.43:1**
**แก้:** เพิ่ม token สำหรับ "ข้อความเตือน" แยกจาก "พื้นเตือน" — `--color-warning-ink: #9b5e14` (ยืนยันแล้ว: 4.61:1 บน warning-soft, 5.24:1 บนขาว) แล้วคง `#c77819` ไว้ใช้กับพื้น/ไอคอนเท่านั้น

### M2 — ขอบ control (1.4.11)

`--color-hairline: #e0e0e0` เป็น `border` **140 จุด**

| คู่ | ค่า | ต้อง |
|---|---|---|
| hairline vs page `--color-canvas-soft #f5f5f7` | **1.21:1** | 3:1 |
| hairline vs `#ffffff` | 1.32:1 | 3:1 |
| พื้นปุ่ม secondary `--color-canvas #ffffff` vs page | **1.07:1** | — |

`AppLayout.tsx:22` ตั้งพื้นเพจเป็น `canvas-soft` แต่ปุ่ม secondary เป็น `canvas` (ขาว) → ต่างกัน 1.07:1 จึงเหลือแค่เส้น hairline 1.21:1 เป็นตัวบอกขอบเขต

**แก้:** **อย่าเปลี่ยน `--color-hairline`** (มันคือเส้นคั่นประดับที่ถูกต้องและไม่เข้าเกณฑ์ 1.4.11) — เพิ่ม token ใหม่สำหรับ **ขอบ control** เท่านั้น:
```css
--color-border-strong: #86868b;   /* ยืนยัน: 3.33:1 บน canvas-soft, 3.62:1 บนขาว */
```
แล้วเปลี่ยน `border-[var(--color-hairline)]` → `border-[var(--color-border-strong)]` เฉพาะกับ input/select/button/checkbox (ไม่ใช่ divider/card)

---

## 4. ธีมที่ 3 — Safe-area และ layout มือถือ

### C3 (Critical) — member shell

`MemberAppLayout.tsx:116-124` — คอมเมนต์เขียนว่า *"bottom padding clears the fixed nav + safe area"* แต่ `<main>` สงวน **88px คงที่** ขณะที่ nav **โตตาม inset**:

```
nav ≈ 67px (icon 32 + gap 2 + ข้อความ 12px×1.4 ≈ 17 + py-2 ×2 = 16) + 1px border + env(safe-area-inset-bottom)
  inset  0px (browser)  →  68px  →  เหลือ 20px  ✅
  inset 34px (iPhone)   → 102px  >  88px  →  เนื้อหาท้ายสุดเข้าไม่ถึง ~14px  ❌
```
`padding-bottom` กำหนดปลายช่วง scroll → องค์ประกอบสุดท้ายของ **ทุกหน้า member** ถูกตัด (`MemberHome.tsx:450` ปุ่มลงทะเบียน, `MemberProfile.tsx:543-550` ปุ่มออกจากระบบ)

**แก้:** `pb-[calc(88px+env(safe-area-inset-bottom,0px))]`

### ที่เหลือในธีมนี้

| จุด | แก้ |
|---|---|
| `DesignSystem.tsx:728` footer ของ modal (`:655` เป็น bottom sheet `items-end p-0` ใต้ `sm`) | `pb-[calc(1rem+env(safe-area-inset-bottom,0px))]` (และ `:694` body เมื่อไม่มี footer) |
| `ConfirmDialog.tsx:53` วางปุ่ม ยกเลิก/ลบ ใน **body** (`:694`) | ย้ายเข้า `footer` prop ของ Modal |
| `Sidebar.tsx:228` `fixed inset-y-0` | `pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]` |
| `index.css:748` `.login-shell` `100vh` + `padding: 20px` | `min-height: 100dvh; padding: calc(20px+env(safe-area-inset-top,0px)) 20px calc(20px+env(safe-area-inset-bottom,0px))` |
| `index.css:1027` `.coming-soon-page` `100vh` | `100dvh` |
| `MemberAppLayout.tsx:73` `min-h-screen` (ขณะที่ `AppLayout.tsx:22` ใช้ `h-dvh` แล้ว) | `min-h-dvh` |
| ไม่มี `scroll-mt`/`scroll-padding` เลย (0 จุด) → skip link/hash nav ไปใต้ sticky header (76px/60px) | `scroll-mt-20` ที่ `<main id="app-main">` และ `#member-app-main` |

### A7 — MemberProfile ช่องกรอกถูกตัดที่ 360px

`:319`/`:329` — 360 − 32 (`px-4`) − 40 (`p-5`) = 288px; `grid-cols-2 gap-3` = 138px/ช่อง; `pl-10 pr-3` เหลือ **86px** → เบอร์ 10 หลัก (~90px) และ placeholder `08X-XXX-XXXX` (~100px) ถูกตัด ผู้ใช้ตรวจทานเบอร์ที่เพิ่งพิมพ์ไม่ได้
`:398`/`:409` แบบเดียวกัน (เหลือ 110px) → "เช่น บิดา, คู่สมรส" และชื่อ-นามสกุลผู้ติดต่อฉุกเฉินถูกตัด — **เบอร์ฉุกเฉินคือฟิลด์ที่อ่านผิดแล้วเจ็บจริง**
**แก้:** `grid-cols-1 gap-3 sm:grid-cols-2`

### A8 — Map เลื่อนหน้าผ่านไม่ได้

`Map.tsx:488` `h-[420px] … sm:h-[520px]` (ทับ default 500px ใน `Map.tsx:119` ผ่าน twMerge) อยู่ใน scroller ของ `AppLayout.tsx:32` และ `index.css:188-193` ให้ `touch-action: manipulation` เฉพาะ `a, button, label, [role="button"]` → ไม่มีอะไรคุมแผนที่ → ลากนิ้วบนแผนที่ถูก map ยึด gesture
**แก้:** `h-[52vh] min-h-[280px] sm:h-[520px] [touch-action:pan-y]`

### A9 — Groups action row

`Groups.tsx:970-984`: การ์ดกว้าง 288px → ปุ่มหลัก ~117 + เช็คชื่อ ~102 + `size-11` 44 + gap 16 = **279px** (slack 9px ที่ยอด 2 หลัก) ทั้ง label เป็น `whitespace-nowrap` และ `AppLayout.tsx:32` เป็น `overflow-x-hidden` → ยอด 3 หลัก **ถูกตัดขวาทิ้ง ไม่มีการ scroll**
**แก้:** `flex-wrap` + เลิก `whitespace-nowrap`

---

## 5. Accessibility — semantics (ธีมที่ 4)

### A3 (Major) — loading เงียบสนิท 7 หน้า

`LoadingStates.tsx:23,47,73` ตั้ง `aria-hidden="true"` ให้ skeleton ทุกตัว → ถ้าไม่มี `role="status"` ครอบ **ช่วง loading จะไม่ถูกประกาศเลย**

| หน้าที่ **ผิด** (ไม่มี `role="status"`) | หน้าที่ **ถูก** (มีแล้ว) |
|---|---|
| `Feed.tsx:344`, `Inbox.tsx:313`, `Announcements.tsx:142`, `Events.tsx:185`, `FollowUps.tsx:164`, `Profile.tsx:18`, `ImportData.tsx:206` | `Groups.tsx:830`, `Members.tsx:723`, `Attendance.tsx:721,861`, `Reports.tsx:148`, `Map.tsx:422`, `OrgChart.tsx:173` |

**แก้:** `<div role="status" aria-label="กำลังโหลด…">` ครอบ — หรือดีกว่า: ย้าย `role="status"`/`aria-busy` เข้าไปใน `LoadingStates` เอง ให้ทุกที่ได้ฟรี

### A4 (Major) — input ที่โฟกัสได้แต่มองไม่เห็น

`ImportData.tsx:176-186`: `<input type="file" className="sr-only" aria-label="เลือกไฟล์ Excel">` ยังอยู่ใน tab order (ปุ่มจริงอยู่ที่ `:187`) → Tab แล้วโฟกัสไปที่ของที่ถูก clip เหลือ 1px โดยไม่มี indicator
`ImportOrgData.tsx:131-139` ทำถูกแล้ว (`<label htmlFor>` + input ที่มองเห็น)
**แก้:** `tabIndex={-1}` + `aria-hidden="true"` ที่ input ที่ซ่อน (และเอา `aria-label` ออก) หรือทำตาม ImportOrgData

### A5/A6 (Major) — ARIA role ที่สัญญาเกินสิ่งที่ทำได้

| จุด | ปัญหา |
|---|---|
| `Groups.tsx:250,274` `role="menu"` / `role="menuitem"` | AT จะบอกผู้ใช้ให้ใช้ลูกศร แต่คีย์ที่รองรับมีแค่ `Escape` (`:226`) และไม่ย้าย focus เข้า menu → ลูกศร/Home/End/type-ahead ไม่ทำอะไร |
| `Attendance.tsx:566,577` `role="tablist"` / `role="tab"` | ต้องมี roving `tabIndex` + คีย์ลูกศร แต่ทั้ง 4 tab อยู่ใน tab order และไม่มี handler (มีแค่ click `:580`) — panel ถูกต้องแล้ว (`role="tabpanel"` `:680,811,925,1057`) |

**แก้:** ตัด role ที่ไม่ implement ออก (list ของ `<button>` ธรรมดาถูกต้องและไม่ต้องมีคีย์) **หรือ** ทำ APG model ให้ครบ / ใช้ Radix `Tabs` (เป็น dependency อยู่แล้ว)

### A10-A16 (Minor)

| # | เรื่อง | ไฟล์ | แก้ |
|---|---|---|---|
| A10 | modal associate แค่ title ไม่ได้ associate `description` (ไม่มี `id`) → คำอธิบายยืนยันการลบไม่ถูกประกาศ | `DesignSystem.tsx:662,678-682` | `useId()` + `aria-describedby` |
| A11 | `role="alert"` + `aria-live="polite"` บน element เดียว → politeness ขัดกัน อาจประกาศซ้ำ | `DesignSystem.tsx:378-379,700-701` | เก็บอย่างใดอย่างหนึ่ง |
| A12 | Sidebar `h2` (6 กลุ่มเมนู) มาก่อน `<main>` → heading list ของทุกหน้า admin ขึ้นต้นด้วย navigation, `<h1>` ของหน้าอยู่อันดับ 7 | `Sidebar.tsx:250` | ใช้ `<span>` + `aria-labelledby` ที่ `<ul>` |
| A13 | ErrorBoundary (ทั้งหน้า) มีแต่ `<h2>` ไม่มี `<h1>` | `ErrorBoundary.tsx:42` | เปลี่ยนเป็น `<h1>` |
| A14 | `<img alt="">` ทั้งที่เป็นรูปกิจกรรมที่ผู้ใช้อัปโหลด (เนื้อหา ไม่ใช่ประดับ) | `Feed.tsx:378` | `alt={\`ภาพกิจกรรม: ${activity.title}\`}` |
| A15 | lucide icon ไม่มี `aria-hidden="true"` → ถูก expose เป็น unnamed graphic | `Privacy.tsx:60`, `Terms.tsx:62`, `GlobalSearch.tsx:110` | เติม `aria-hidden` (ที่อื่นทำถูกแล้ว เช่น `Members.tsx:846`) |
| A16 | `th` ไม่มี `scope` (ตารางอื่นในเรพมีครบ) | `ImportData.tsx:367-375` | `scope="col"` + `<caption className="sr-only">` |

**A15 ตัวจริง (token):** `--muted` **นิยามซ้ำใน `:root` เดียวกัน** — `index.css:73` (`--color-canvas-soft` = `#f5f5f7`) แล้ว `:87` (`--color-body-muted` = `#6f6f73`) → **ตัวหลังชนะ** ดังนั้น shadcn `bg-muted` = `#6f6f73` (เทาเข้ม) → `bg-muted text-muted-foreground` (เช่น `ui/tabs.tsx:27`, `ui/kbd.tsx:8`, `ui/avatar.tsx:43`) จะได้ **#6f6f73 บน #6f6f73 ≈ 1:1**
วันนี้ยังไม่ปรากฏเพราะหน้าแอพไม่ได้ import primitive เหล่านั้น — **latent แต่พังทันทีที่มีใครหยิบมาใช้**
**แก้:** ลบ `:87` (ให้ `--muted` = พื้น `#f5f5f7` ตามชื่อ) แล้วให้ผู้ใช้ที่เป็นข้อความอ่าน `var(--color-body-muted)` ตรง ๆ (ผู้ใช้เดิม: `.profile small` `:295`, `.page-heading p` `:563`, Privacy/Terms)

---

## 6. Visual coherence (ธีมที่ 5)

### C4 — เงา 2 ภาษา

`@theme inline` (`index.css:114-134`) ประกาศแค่ `--font-sans` + `--color-*` — **ไม่มี `--shadow-*`** มีเพียง `--shadow` เดี่ยว (`:92`, dark `:1160`)

| ภาษาเงา | จำนวน | หมายเหตุ |
|---|---|---|
| `shadow-[var(--shadow)]` | 10 | graphite `rgba(29,29,31,.08)` |
| Tailwind `shadow-sm/md/lg/xl` | **18** | ดำ default — **และมีเพียง 1 จุดที่เข้าถึงได้จริง** (`ui/sheet.tsx:61` `shadow-lg` ผ่าน `OrgChart.tsx:7` / `Map.tsx:21`) |

ส่วนที่เหลือเป็น primitive ใน `components/ui/` ที่ไม่มีใคร import — **ดังนั้นผลกระทบจริงน้อยกว่าที่ตัวเลขบอก** แต่ `MemberAppLayout.tsx:124` เป็นเงา **up-lit** ตัวเดียวในแอพ และเป็น literal `rgba(...)` ที่ซ้ำ hue ของ `--shadow` ด้วย offset คนละแบบ
**แก้:** `shadow-[var(--shadow)]` (หรือเพิ่ม `--shadow-up`), override `ui/sheet.tsx:61`

### C5 — 2 ระบบ typography

มี 182 จุดที่ใช้ `text-(xs|sm|base|lg|xl|2xl|3xl)` เปล่า ๆ ในหน้าจอที่ใช้ `.type-*` ขณะที่สเกลที่เอกสารไว้แทบไม่ถูกใช้: **`.type-hero` (56px) ใช้ 0 ครั้ง**, `.type-body` (17px) ใช้ **4 ครั้ง** (`CareToday.tsx:289,296`, `Home.tsx:1139`, `Map.tsx:170`)
ตัวอย่างชัด: `Attendance.tsx:173-176` metric tile ใช้ `text-xs` (12px) + `text-2xl` (24px) ขณะที่สตริงอื่นในไฟล์เดียวกันใช้ `.type-fine`/`.type-caption`/`.type-body-strong` (`:775,817,874`)
**แก้:** เปลี่ยนเป็น `.type-fine` / `.type-display-md` และตัดสินใจเรื่อง `.type-hero` (ใช้หรือเลิก แล้วอัปเดต `brand-spec.md:82`)

### C6/C7 — Radius

✅ **แก้ความเข้าใจผิดสำคัญ:** radius **ไม่ใช่** 2 ระบบ — `--radius-sm/md/lg/pill` ประกาศที่ `index.css:34-40` ใน `:root` **ที่ไม่มี `@layer`** ซึ่งอยู่ **ก่อน** `@theme inline` (L114) ส่วน Tailwind ใส่ default ใน `@layer theme` และ **unlayered ชนะ layered เสมอ** → `rounded-sm/md/lg` = **8/11/18px = ค่า token เป๊ะ** (43 จุด `rounded-md` + 70 จุด `rounded-[var(--radius-md)]` ให้ผลเดียวกัน)

ที่เหลือจริง:
- **หลุดสเกล:** `rounded-xl` (12px ×1), `rounded-2xl` (16px ×4 — เฉพาะ `App.tsx:77,80` + `ProtectedRoute.tsx:59,62` ซึ่งเป็นบล็อกที่ **คัดลอกกันมา 30 บรรทัด** ขณะที่ `LoadingStates.tsx:18` มี `CARD` ที่ถูกต้องอยู่แล้ว → ควร export `RouteSkeleton` แล้วใช้ร่วมกัน)
- **nested-radius ละเมิด:** `.coming-soon-icon { border-radius: 25px }` อยู่ใน `.coming-soon-card` (18px) → **inner โค้งกว่า outer** ซึ่งเป็น "AI-template tell" ที่ชัดที่สุดในระบบการ์ด; `.profile-avatar` (18px) ใน `.profile-hero` ที่ padding 22px → ควรเป็น `max(0px, calc(18px - 22px))` = 0
- **hardcode แทน token:** `.profile-detail-icon` = `11px` (ซึ่ง *คือ* `--radius-md`), `.mini-icon` = `10px` (ไม่ตรงขั้นไหน), `.coming-soon-note` = `12px`, `.profile-avatar` mobile = `18px` (= `--radius-lg`)

### C8 — Spacing หลุดสเกล

`design.md:87` กำหนดสเกล `4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48` แต่พบ `p-3.5`/`px-3.5`/`py-2.5` (=14px/10px) และ `gap-2.5` (=10px)
จุดกระจุกตัว: `MemberProfile.tsx:301,314,329,349,369,393,409,423`, `MemberGroup.tsx:175,218`, `LoadingStates.tsx:27`, `MemberAppLayout.tsx:117`, `MemberHome.tsx:269,273,290,428` → **โค้ดใหม่ที่สุด หลุดสเกลมากที่สุด**

### C9/C10/C11 — ความหมายของสี

| # | ปัญหา | หลักฐาน |
|---|---|---|
| C9 | เงื่อนไขเดียวกัน (ยังโหลด) ทาสี **แดง** ที่ tile storage และ **เหลือง** ที่ tile database — และ "loading" ถูกเรียกว่า `ขัดข้องชั่วคราว` | `Home.tsx:553` vs `:563` |
| C10 | `cancelled` = `error` (Events) แต่ = `neutral` (FollowUps, Groups `:169`, Map `:51`) → แดงหมายถึงทั้ง "อันตราย" และ "ยกเลิก" | `Events.tsx:51` |
| C11 | จอเดียวใช้ icon chip 3 สี (orange/green/blue) ขณะที่ทั้งแอพใช้ accent เดียว (`bg-[var(--color-accent-soft)] text-[var(--color-primary)]`) | `Profile.tsx:85,112` + `index.css:354-374,903-912` |

### C12/C13 — ความไม่สม่ำเสมอของ control

| # | ปัญหา |
|---|---|
| C12 | ปุ่ม "ล้างคำค้นหา" มี 2 ขนาด: `size-9` (36px, ต่ำกว่า 44px) ที่ `Members.tsx:607` + `Groups.tsx:730` เทียบกับ `size-11` (44px) ที่ `GlobalSearch.tsx:108` และ `Attendance.tsx:714` — **ควบคุมเดียวกัน 2 geometry** |
| C13 | surface เดียวกันสูงไม่ตรงกัน: skeleton Map `h-[420px]` (`Map.tsx:423`) vs component จริง `h-[500px]` (`Map.tsx:119`) → **layout กระโดดตอนโหลด**; และ `max-h-[92dvh]` (`DesignSystem.tsx:665`) vs `max-h-[85vh]` (`Map.tsx:552`) สำหรับบทบาท bottom-sheet เดียวกัน |

---

## 7. Dead CSS และ token ที่ซ้ำซ้อน

สแกน class selector จริงใน `index.css` (98 ตัว) เทียบกับ `.tsx` ทั้งหมด (885 KB, **case-sensitive**): **ใช้ 58 / ไม่ใช้ 40**

รวมของเก่าที่ควรลบ: `blue-eyebrow`, `purple`, `pink`, `orange` (ชื่อจากพาเลตต์ที่ปลดระวาง), และ **ที่อยู่ของกฎ sub-12px ทั้งหมด**: `.summary-card small` (**9px**), `.member-toolbar select` (10px), `.page-heading p` (11px), `.entity-card .entity-meta` (11px), `.coming-soon-note` (11px), `.brand small` (10px) — รวมถึง `.sidebar`, `.topbar`, `type-hero` ที่ไม่ถูกใช้

> **แก้ข้อสรุปที่เกือบรายงานผิด:** กฎ `font-size: 9/10/11px` ใน `index.css` **อยู่ใน selector ที่ตายแล้วทั้งหมด** → **ไม่ใช่ปัญหาการอ่านจริงใน UI ปัจจุบัน** เป็นสุขอนามัยโค้ด + กับดักรอ copy-paste กลับมา (และ input 12px เป็นตัวกระตุ้น iOS zoom-on-focus)
> **ไม่นับเป็น dead:** `.leaflet-control-zoom-in/out` (`:152-157` บังคับ 44px) — Leaflet ใส่คลาสนี้เองตอน runtime

**token ที่ไม่มีผู้ใช้:** `--radius-none`, `--color-info`, `--color-body`, `--color-surface`, `--growth-green`, `--chart-1…6` (ไม่พบ `var(...)` ที่ใด) — **ยืนยันกับ CSS-in-JS ก่อนลบ** และระวัง `--color-surface` ถูกบังด้วย alias `--surface` (`:89`) ที่ `.login-card:757` ใช้อยู่

---

## 8. ตารางค่าทดแทน token (คำนวณยืนยันแล้ว)

| Token | เดิม | แทนด้วย | ยืนยัน |
|---|---|---|---|
| `--color-success` | `#1e8e5a` | `#1a7a4d` | 4.59:1 บน chip, 5.34:1 บนขาว |
| `--color-warning` | `#c77819` | คงไว้สำหรับพื้น/ไอคอน | ขาวบน `#c77819` = 3.43:1 → **ห้ามใช้เป็นพื้นปุ่มที่มีตัวอักษรขาว** |
| *ใหม่* `--color-warning-ink` | — | `#9b5e14` | 4.61:1 บน warning-soft, 5.24:1 บนขาว |
| *ใหม่* `--color-border-strong` | — | `#86868b` | 3.33:1 บน canvas-soft, 3.62:1 บนขาว |
| dark `--color-success` | (ไม่ remap) | `#6fc79a` | ต้อง ≥4.5:1 บน `#2a2a2c` และบน `/10` |
| dark `--color-warning` | (ไม่ remap) | `#e0a75f` | " |
| dark `--color-error` | (ไม่ remap) | `#f08a97` | " |
| dark `--color-info` | (ไม่ remap) | `#8ab6ef` | " |
| dark `--color-text-quaternary` | alpha `.48` (4.49:1) | alpha `.52` | 5.03:1 |
| dark `--color-primary-focus` | `#7faf72` (ซ้ำ primary) | olive ที่ต่างชัด | ต้อง hover ดูออก + ring ≥3:1 |
| `Logo.tsx:19` | `text-[var(--color-on-dark)]` | `text-[var(--color-on-primary)]` | 2.54:1 → 6.63:1 |

> ⚠️ `design-tokens.test.ts:43-48` **ล็อกค่า** `--color-primary`, `--color-primary-focus` (**เฉพาะใน `:root`**), `--color-primary-on-dark`, `--color-ink`, `--color-dark-surface`, `--color-canvas` แบบเป๊ะ
> **การแก้ contrast ข้างบนไม่แตะ token ที่ถูกล็อกเลย** — ทุกตัวที่ต้องแก้ (`--color-success/warning/error/info`, `--color-text-quaternary`, `--color-primary-focus` ใน `.dark`, `--navy`) **ไม่ได้ถูก assert** จึงปลอดภัยกับ test

---

## 9. G1-G7 — รูโหว่ของ test-guard

โปรเจกต์มี audit-as-code 7 ไฟล์ (`ux-audit-regressions.test.ts` 626 บรรทัด ~48 tests) ซึ่ง **ดีมาก** แต่มี 7 จุดที่ guard ครอบไม่ถึง — และปัญหาทุกข้อในเอกสารนี้ผ่าน CI ได้เพราะเหตุนี้:

| # | Guard | รูโหว่ | ทำให้อะไรผ่าน |
|---|---|---|---|
| G1 | `design-tokens.test.ts:196` contrast assertion | ตรวจแค่ `on-primary` บน `primary` | M1, M2, M3, M4, A2 ทั้งหมด |
| G2 | `design-tokens.test.ts:202` "no page sets white text on a primary fill" | (ก) **ข้าม `Logo.tsx` โดยตรง** (ข) regex มองหา `text-[var(--color-on-dark)]` **ไม่ครอบ `text-white`** | C2 + `Map.tsx:148,370,383` |
| G3 | `design-tokens.test.ts:107-119` "dark mode is a token remap" | filter แรก `!/^\s*\.dark\b/` **ตัดบรรทัดที่เริ่มด้วย `.dark` ออก** — ซึ่งคือที่อยู่ของ `.dark .text-x-NNN { !important }` แบบบรรทัดเดียว → **จับเป้าหมายตัวเองไม่ได้** *(ตรวจแล้ว: วันนี้ไม่มี violation จริง — hit เดียวคือในคอมเมนต์ L1119)* | latent |
| G4 | `design-system-consistency.test.ts:122` "12px readability floor" | สแกนเฉพาะ `.ts/.tsx` — **ไม่สแกน `index.css`** | กฎ 9/10/11px (แม้จะอยู่ใน dead selector) |
| G5 | `ux-audit-regressions.test.ts:170` "removed the dead legacy CSS blocks" | เป็น **blocklist ฮาร์ดโค้ด 11 ชื่อ** ไม่ใช่การตรวจ dead code | dead selector 40 ตัว |
| G6 | ไม่มี guard ใด ๆ | ไม่มี test เรื่อง safe-area / `dvh` / `scroll-mt` | C3, M5(ธีม 3) ทั้งหมด |
| G7 | ไม่มี guard ใด ๆ | ไม่มี test เรื่อง ARIA role ที่ต้องมีคีย์配套 | A5, A6 |

**ข้อเสนอ test ใหม่ 4 ตัวที่ปิดรูสำคัญ (ราคาถูก):**

```ts
// ปิด G1 — contrast ของทุกคู่ที่ guard เดิมไม่ครอบ
it("keeps status colours readable on their own tint in BOTH themes", () => {
  const dark = css.slice(css.indexOf("\n.dark {"));           // ต้องอ่านจาก .dark block จริง
  for (const [fg, bg, label] of [
    ["--color-success", "#E4F1EB", "light"], ["--color-warning", "#F8EFE3", "light"],
  ]) expect(ratio(tokens.get(fg)!, bg), label).toBeGreaterThanOrEqual(4.5);
  // และทุก --color-success/warning/error/info ต้องถูกประกาศใน .dark ด้วย
  for (const t of ["--color-success","--color-warning","--color-error","--color-info"])
    expect(dark, `${t} not remapped for dark mode`).toContain(t);
});

// ปิด G2 — ห้าม white on primary ทุก spelling และรวม Logo.tsx
it("no white text on a primary fill, in any spelling, including Logo.tsx", () => {
  const re = /bg-\[var\(--color-primary\)\][^"'`\n]*text-(?:white|\[var\(--color-on-dark\)\])/;
  // ... สแกนทุก .tsx โดยไม่ยกเว้น Logo.tsx
});

// ปิด G4/G5 — dead selector + sub-12px ต้องตรวจจาก CSS จริง
it("index.css declares no font-size below 12px", () => {
  const bad = css.split("\n").map((l,i)=>({l,n:i+1}))
    .filter(({l}) => /font-size:\s*(?:9|10|11)(?:\.\d+)?px/.test(l));
  expect(bad, bad.map(b=>`index.css:${b.n}`).join("\n")).toEqual([]);
});

// ปิด G6 — safe-area ต้องคู่กับ fixed element
it("every fixed bottom element accounts for the bottom inset in its container padding", () => {
  // MemberAppLayout: ถ้ามี pb-[env(safe-area-inset-bottom)] ใน nav
  // แล้ว <main> ต้องมี pb-[calc(...+env(safe-area-inset-bottom))]
});
```

---

## 10. ตรวจแล้วผ่าน (VERIFIED-CLEAN — พร้อมหลักฐาน)

| หัวข้อ | หลักฐาน |
|---|---|
| **พาเลตต์เก่า** | retired utility + `bg-[#…]`/`text-[#…]` = **0 hit** ใน 107 `.tsx` + 20 `.ts` — บังคับด้วย `design-system-consistency.test.ts:49-72` และ `design-tokens.test.ts:60-105` |
| **ภาษา/viewport** | `<html lang="th">`, `viewport-fit=cover`, ไม่ปิด pinch-zoom (มี test) |
| **12px floor ใน UI จริง** | `text-[9/10/11px]` ใน `.tsx` = **0**; เล็กสุดที่ใช้จริงคือ `.type-fine` (12px) ใช้ 96 จุด |
| **Emoji เป็น icon** | **0** ทั้ง `client/src` — non-ASCII ที่พบมีแค่ `→` (`Privacy.tsx:84`) และ `—` (`ImportData.tsx:386`) |
| **Accent เดียว** | `--color-primary` 98, `--color-primary-focus` 146, `--color-info-strong` 5, `--color-accent-soft` 12 — ไม่มี accent แบรนด์ตัวที่สอง (ปัญหา C11 เป็นระดับ *component* ไม่ใช่ระดับ token) |
| **Radius** | ระบบเดียวจริง (ดู §6) |
| **`prefers-reduced-motion`** | `index.css:540-548` unlayered `*{animation/transition-duration:.01ms !important; scroll-behavior:auto !important}` → **ชนะ inline `style={{transition}}`** (`ImportData.tsx:197`) และ Tailwind utility ทุกตัว; มี opts-out เจาะจงที่ `Sidebar.tsx:228`, `MobileBottomNav.tsx:52`, `DesignSystem.tsx:330,774`, `ImportOrgData.tsx:146/150/154`; **ไม่มี animation library ติดตั้งเลย** (ไม่มี framer-motion/motion/gsap/react-spring; `tw-animate-css` เป็น CSS-only) |
| **Focus visible** | 168 `focus-visible:ring`, 139 `focus-visible:outline`, 54 ไฟล์ + global `:focus-visible` fallback |
| **Touch target** | 44px เป็นมาตรฐาน (159 `h-11`); ข้อยกเว้นมี 3: `Members.tsx:607`, `Groups.tsx:730` (C12), `MemberAppLayout.tsx:142` (`h-8 w-12`) |
| **iOS zoom-on-focus** | input ทุกตัวเป็น 16px บนมือถือ (`text-base` หรือ `text-base md:text-sm` — ลดเฉพาะ `md` ขึ้นไป) |
| **ตารางบนมือถือ** | Members `md:hidden` card list + `hidden md:block` table; Groups `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`; Attendance roster เป็น list → **ไม่มีตาราง render ใต้ 768px** ใน 4 หน้าหลัก |
| **Label association** | `Field` สร้าง `htmlFor`/`id`/`aria-describedby`/`aria-invalid` (`DesignSystem.tsx:415-448`) และถูกใช้ทั่ว; Members filter bar ใช้ `htmlFor`/`id` ตรง (`:579-592,617-690`); search เดี่ยวใช้ `aria-label` หรือ wrapping label → **ไม่พบ input/select/textarea ที่ไม่มี label ในขอบเขตที่ตรวจ** |
| **Button vs link / custom clickable** | `onClick` บน div/span/td/tr/li = **0** ทั้ง `client/src`; navigation เป็น `<Link aria-current="page">`; toggle เป็น `<button aria-pressed>` (`Map.tsx:142-145`, `OrgChart.tsx:206-212`) |
| **Icon-only button มีชื่อ** | `Members.tsx:844,853,863`, `Groups.tsx:729`, `Sidebar.tsx:241`, `Topbar.tsx:32,54`, `Attendance.tsx:712,788`, `Feed.tsx:655`, `DesignSystem.tsx:687` |
| **Heading order** | ไม่มีข้ามระดับ (h1→h2→h3) ทุกหน้า — ยกเว้น A12 (Sidebar) และ A13 (ErrorBoundary); `<h2>` ที่ `Home.tsx:528` อยู่ใน `SystemPulse` ที่ **ไม่เคยถูก render** → dead code ไม่ใช่ defect |
| **Modal** | hand-rolled (ไม่มีหน้าไหน import `ui/dialog`) แต่ทำครบ: `role="dialog"`, `aria-modal`, `tabIndex={-1}`, Escape + Tab cycle พร้อม modal stack (`:550-594`), focus in/restore (`:630-643`), scroll lock, `overscroll-behavior: contain`, ปุ่มปิด 44px มีชื่อ (`:684-691`) |
| **สถานะไม่พึ่งสีเดียว** | `StatusChip` ต้องมี text child เสมอ (`:198-216`); ปุ่มสถานะ Attendance มี label + `aria-label` (`:788`); nav active มี pill + weight (`MobileBottomNav.tsx:50-57`, `MemberAppLayout.tsx:141-155`); `DataBar` เป็น `role="img"` + ตัวเลข (`:853-857`) |
| **Hardcoded hex** | เหลือ 5 บรรทัด: theme-color meta (`ThemeContext.tsx:45`), QR options 3 ที่ (`Members.tsx:286`, `MemberHome.tsx:96`, `Attendance.tsx:279` — ค่าตรงกับ token เป๊ะ), `ui/chart.tsx:56` (primitive ที่ไม่ถูก import) |
| **Safe-area pattern** | มีอยู่แล้วที่ `MemberAppLayout.tsx:82,124`, `Topbar.tsx:27`, `MobileBottomNav.tsx:37`, `CareToday.tsx:263` → งานที่เหลือคือทำ *ให้ครบ* ไม่ใช่ประดิษฐ์ใหม่ |
| **Sidebar/Topbar geometry** | `w-60`=240px และ `min-h-19`=76px ตรงกับ `brand-spec.md:107`; nav row `min-h-11` + `aria-current` (`Sidebar.tsx:267`) |
| **Encoding** | `index.css`/`.tsx` เป็น UTF-8 ที่ถูกต้อง — อาการ `â€”` ที่เห็นระหว่าง audit คือ **artifact ของ PowerShell 5.1 ที่อ่านไฟล์เป็น ANSI ไม่ใช่บั๊กของโปรเจกต์** |

---

## 11. NEEDS-MANUAL-CHECK (ต้องรันแอป/อุปกรณ์จริง)

1. **Modal bottom sheet + คีย์บอร์ด iOS** — โฟกัส input ใน sheet ที่ anchor ขอบล่าง (`items-end`, `p-0`): คีย์บอร์ดทับ footer action หรือย่อ sheet?
2. **Gesture ของ Leaflet (A8)** — ค่า `touch-action` ที่ชนะจริงเป็นของ Leaflet ซึ่งไม่ถูก vendor ในเครื่องนี้ (`node_modules` ไม่มี)
3. **ค่า `env(safe-area-inset-*)` จริง** และอะไรกันแน่ที่บัง bottom nav — home indicator หรือ bottom toolbar ของ Safari (ทดสอบทั้ง Safari และโหมดติดตั้ง PWA)
4. **ขนาด input ภายใน `<SignIn/>` ของ Clerk** (`ClerkSignInPage.tsx:72`) — อ่านจาก source ไม่ได้ ถ้า <16px จะเกิด iOS zoom ที่หน้า entry
5. **`role="menu"`/`role="tablist"`** — พฤติกรรมจริงของ NVDA/JAWS กับ role ที่ไม่มีคีย์配套
6. **hand-rolled Modal ที่ใช้ `aria-modal` แต่ไม่มี `inert`/`aria-hidden` บนพื้นหลัง** — virtual cursor เข้าถึงพื้นหลังได้หรือไม่
7. **Sidebar mobile drawer ประกาศเป็น `role="dialog"` (`Sidebar.tsx:232`) ขณะที่เป็น `<aside>`** — ประกาศ landmark ซ้ำหรือไม่
8. **`leading-snug` (1.375) ทับ `.type-body-strong` (1.47)** บนหัวข้อไทย 3 บรรทัด (`Announcements.tsx:175`, `Events.tsx:222`, `Feed.tsx:389`) — สระบน/ล่างชนกันจริงหรือไม่ (ต้องดู Prompt font จริง)
9. **`--color-warning` 14px semibold** — แอพนับเป็น "large text" หรือไม่เป็นการตัดสินใจเชิงดีไซน์
10. **เงา up-lit (`MemberAppLayout.tsx:124`) ชนกับเงา down-lit (`shadow-[var(--shadow)]`) ใน viewport เดียวกัน** — รอยต่ออ่านเป็นมิติหรือเป็นความผิดพลาด
11. **sonner theming** — `ui/sonner.tsx:1,5` import `useTheme` จาก `next-themes` แต่ **ไม่มี provider ไหน mount** (App.tsx:240 mount แค่ `ThemeContext` ของแอพเอง) → toaster ถาม provider ที่ไม่มีอยู่ อาจไม่ตรงกับ toggle ในแอพ
12. **Dynamic type / text scaling 200%** และ reflow (1.4.4, 1.4.10) บน Attendance tab bar และตาราง Members
13. **Groups action row (A9)** — ยอด 3 หลักล้นจริงหรือไม่ (เลขคณิตให้ slack 9px ที่ 2 หลัก)

---

## 12. ลำดับการแก้ที่แนะนำ

| ลำดับ | งาน | เหตุผล |
|---|---|---|
| **1** | `Logo.tsx:19` → `text-[var(--color-on-primary)]` + `Map.tsx:148,370,383` `text-white` → token เดียวกัน | 2.54:1 → 6.63:1, บรรทัดเดียว, แก้บั๊กที่ guard มองไม่เห็น |
| **2** | `Privacy.tsx:70` / `Terms.tsx:71` → `var(--color-ink)`; ลบ `--navy`/`--blue` | ปลด Critical (หัวข้อมองไม่เห็นในธีมมืด) |
| **3** | เพิ่มสีสถานะเข้า `.dark` (4 บรรทัด) | ปลด Critical ที่กระทบทุกหน้าจอที่มีสถานะในโหมดมืด |
| **4** | `MemberAppLayout.tsx:117` safe-area (1 บรรทัด) | ปลด Critical ของมือถือ |
| **5** | safe-area อีก 3 จุด (modal footer, sidebar, `.login-shell`) + `min-h-dvh` | pattern มีอยู่แล้วในเรพ |
| **6** | token contrast: `--color-success`, `--color-warning-ink`, `--color-border-strong`, dark `--color-text-quaternary`, dark `--color-primary-focus` | §8 |
| **7** | เพิ่ม test 4 ตัวใน §9 | กันไม่ให้ทั้งหมดกลับมา |
| **8** | A3 (`role="status"` ที่ `LoadingStates`) — แก้ที่เดียวได้ทั้ง 7 หน้า | คุ้มที่สุดในกลุ่ม a11y |
| **9** | A4, A5, A6, A15 (`--muted` ซ้ำ), A16 | |
| **10** | responsive: `MemberProfile.tsx:319,398`, `Map.tsx:488`, `Groups.tsx:970` | |
| **11** | coherence: เงา, `.type-*` vs `text-*`, nested-radius, spacing, C9-C13 | งานเก็บกวาด (ทำเป็น batch ทีหลังได้) |
| **12** | dead CSS 40 selector + `--muted:87` + token ที่ไม่มีผู้ใช้ | สุขอนามัย |
