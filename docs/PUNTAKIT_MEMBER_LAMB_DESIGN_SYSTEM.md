# Puntakit Member Lamb Design System

เอกสารสรุปแนวทางการออกแบบและโค้ดที่ใช้กับหน้า **Member Dashboard (`/app`)** และ **Profile / Settings (`/app/profile`)** หลังการปรับธีม Puntakit Lamb Edition

> **Brand promise:** พันธกิจ · กลุ่ม · คน · เติบโตไปด้วยกัน
>
> แอปสมาชิกที่อบอุ่น ใช้งานง่าย และพาสมาชิกไปยังงานที่สำคัญได้ทันที

## 1. Design direction

### Visual movement

**Warm editorial dashboard** — ใช้การ์ดพื้นขาวบนพื้นหลังครีมอุ่น วางลำดับข้อมูลจาก Hero ไปยังทางลัดและข้อมูลสำคัญ เพื่อให้หน้าแรกอ่านเหมือนหน้าเริ่มต้นของแอปที่เป็นมิตร ไม่ใช่แผงควบคุมที่หนาแน่น

### Core principles

1. **อบอุ่นและเข้าถึงง่าย** — ใช้ภาพมาสคอต ลูกเล่นมุมโค้ง และพื้นที่ว่างมากพอ
2. **Action-first** — ฟังก์ชันที่ใช้บ่อยอยู่ในรูปแบบการ์ดกดง่ายและมีพื้นที่สัมผัสอย่างน้อย 44px
3. **ข้อมูลจริงเท่านั้น** — จำนวน badge, ข้อมูลสมาชิก, กิจกรรม และประกาศมาจาก API ของสมาชิก
4. **Responsive by default** — มือถือใช้ลำดับแนวตั้ง, แท็บเล็ตเพิ่มพื้นที่และแบ่งคอลัมน์, Desktop ใช้ editorial two-column layout

### Brand personality

**เป็นมิตร · สดใส · ไว้วางใจได้**

## 2. Color tokens

| Purpose | Token / value | Usage |
|---|---|---|
| Signature teal | `#0C7C82` | Wordmark, primary action, icon accent, focus ring |
| Soft mint | `#E4F7F2` | Icon tile, identity card, hover surface |
| Warm canvas | `#F8F7F1` | Member App page background |
| Ink | `var(--color-ink)` | Headings and primary content |
| Muted body | `var(--color-body-muted)` | Supporting text and metadata |
| Error | `var(--color-error)` | Notification badge |
| Dark surface | `var(--color-dark-surface)` | Digital member pass |
| Divider | `var(--color-divider)` | Card borders and section separators |

### Color rules

- ห้ามใช้สี palette เก่า เช่น `slate-*`, `teal-*`, `red-*` ใน component ใหม่
- สีสถานะต้องใช้ semantic token เช่น `--color-error`, `--color-success-soft`
- Focus ring ต้องมองเห็นได้ชัดเจนและใช้สี signature teal หรือ token ที่เหมาะกับพื้นหลัง

## 3. Typography

- ใช้ Prompt / system Thai-first ตาม Design System หลัก
- หัวข้อหน้า Profile ใช้ `text-2xl` และขยายเป็น `sm:text-3xl`
- ข้อความช่วยเหลือและ metadata ใช้ขั้นต่ำ 12px (`text-xs` หรือ `.type-fine`)
- ข้อความใน badge ต้องอ่านได้และไม่ใช้สีเป็นตัวสื่อความหมายเพียงอย่างเดียว

## 4. Dashboard structure

ไฟล์หลัก:

- `client/src/pages/member/MemberHome.tsx`
- `client/src/components/layout/MemberAppLayout.tsx`
- `client/src/components/lamb/LambHero.tsx`
- `client/src/components/lamb/LambSecondaryCards.tsx`
- `client/src/components/lamb/LambQuickActions.tsx`

ลำดับการแสดงผล:

1. Header / Puntakit wordmark / member context
2. Hero welcome card
3. Secondary cards: ชวนเข้ากลุ่ม, ดูแผนที่, ช่วยเหลือ
4. Quick actions: ข่าวสาร, รายงาน, กลุ่มของฉัน, ตั้งค่า
5. Digital member pass / QR
6. ประกาศจากคริสตจักร
7. กิจกรรมที่กำลังจะมาถึง
8. Bottom navigation 5 รายการ

### Quick action interaction

Quick action cards ใช้ interaction แบบ **press feedback**:

- Hover: ยกขึ้นเล็กน้อย `translateY(-2px)` และเพิ่ม shadow
- Active: ย่อลง `scale(0.98)` เพื่อยืนยันว่ารับการกดแล้ว
- Icon tile: ขยายเล็กน้อยเมื่อ hover และยุบเล็กน้อยเมื่อกด
- ใช้ `duration-200 ease-out` เพื่อให้เร็วและไม่รบกวนการใช้งาน
- ปิด transform และ animation เมื่อผู้ใช้เปิด `prefers-reduced-motion`

## 5. Realtime notification badge

### Behavior

หน้า Dashboard เรียก `GET /api/me/portal` ตอนเปิดหน้า และ refresh ทุก **30 วินาที** เฉพาะเมื่อ tab อยู่ในสถานะ visible

```ts
const PORTAL_REFRESH_INTERVAL_MS = 30_000;
```

จำนวน `recentAnnouncements.length` จะถูกส่งเข้า `LambQuickActions` เป็น `notificationCount`

```tsx
<LambQuickActions notificationCount={announcements.length} />
```

### Badge rules

- แสดงเฉพาะเมื่อจำนวนมากกว่า 0
- แสดงจำนวนจริงถึง 9 และแสดง `9+` เมื่อมากกว่า 9
- มี `aria-label` เช่น `3 การแจ้งเตือนใหม่`
- ใช้ `aria-live="polite"` เพื่อประกาศการเปลี่ยนแปลงแบบไม่รบกวนผู้ใช้
- ใช้ `motion-safe:animate-pulse` และปิดด้วย `motion-reduce:animate-none`
- ลิงก์ไปยัง `/app/events` ซึ่งเป็น route ที่มีอยู่จริง

### Why polling

ระบบใช้ polling แบบเบาแทนการเปิด WebSocket ใหม่ เพราะ endpoint portal มีข้อมูลประกาศที่ scope ตามสมาชิกอยู่แล้ว และการ refresh ทุก 30 วินาทีช่วยลดภาระเครือข่ายพร้อมรักษาความสดของ badge ในระดับที่เหมาะกับประกาศคริสตจักร

## 6. Profile / Settings structure

ไฟล์หลัก:

- `client/src/pages/member/MemberProfile.tsx`

องค์ประกอบสำคัญ:

1. Header พร้อมปุ่มกลับ Dashboard
2. Identity card พื้น mint แสดงชื่อ, email, membership status และ role
3. ฟอร์มแก้ไขข้อมูลติดต่อ
4. ข้อมูลบุคคลติดต่อฉุกเฉิน
5. Consent / PDPA checkbox
6. การแจ้งเตือนบนอุปกรณ์นี้
7. Privacy และ Terms links
8. Logout action

### Responsive form rules

- มือถือ: ทุก field group ใช้ 1 คอลัมน์ เพื่อไม่บีบ placeholder และ label
- `sm` ขึ้นไป: เบอร์โทร / Line ID และข้อมูลฉุกเฉินแบ่ง 2 คอลัมน์
- ปุ่มทุกปุ่มสูงอย่างน้อย 44px
- การ์ดใช้ `rounded-3xl`, `p-5`, และ `sm:p-6`
- Profile identity ใช้ mint surface เพื่อเชื่อมโยงกับ Dashboard Hero

## 7. Member App shell

`MemberAppLayout` รองรับ canvas กว้างสูงสุด 1536px แต่ยังรักษาการจัดวางมือถือด้วย padding responsive:

- Mobile: `px-4`, bottom nav fixed
- Tablet: `sm:px-6`
- Desktop: `lg:px-10`, hero และ secondary cards แบ่งเป็น two-column
- Main background: `#F8F7F1`
- Bottom navigation: fixed, 5 destinations, touch target อย่างน้อย 44px

## 8. Accessibility and motion

- ทุก quick action มี focus ring
- Notification badge มี accessible label และ polite live region
- รูปมาสคอตมี alt text
- รองรับ `prefers-reduced-motion`
- ไม่ใช้ animation ที่เป็น decorative อย่างเดียวโดยไม่มีความหมายต่อ interaction
- Badge ไม่ใช้สีอย่างเดียว ต้องมีตัวเลข/ข้อความกำกับ

## 9. Validation checklist

- `pnpm check`
- `pnpm build`
- `pnpm test` — ชุดทดสอบทั้งหมดต้องผ่าน
- ตรวจ `git diff --check`
- ตรวจ mobile width: 360–414px ไม่มี horizontal overflow
- ตรวจ tablet width: 768–1024px การ์ดและฟอร์มไม่บีบจนอ่านยาก
- ตรวจ reduced motion: interaction ไม่ทำให้เกิด animation ที่หลีกเลี่ยงไม่ได้
- ตรวจ protected route ด้วย session จริงก่อนปล่อย production
