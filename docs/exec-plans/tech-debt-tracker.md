<!-- last_verified: 2026-10-07 -->
# Technical Debt Tracker

รายการหนี้ทางเทคนิคที่ **ตรวจสอบแล้ว** ว่ามีอยู่จริงในโค้ด/เอกสาร
แหล่งที่มา: [`docs/PUNTAKIT_UX_UI_AUDIT_2026-10-07.md`](../PUNTAKIT_UX_UI_AUDIT_2026-10-07.md) (audit รอบ 3), [`docs/PUNTAKIT_FOUNDATION_INVENTORY.md`](../PUNTAKIT_FOUNDATION_INVENTORY.md) (INSPECT 2026-10-07)

> **กติกา:** ทุกอย่างที่ถูก "เลื่อนออกไป" จากแผนงาน ต้องมาลงตาราง `Open` ที่นี่ · เมื่อแก้แล้วให้ย้ายไป `Resolved` พร้อมหลักฐาน **ห้ามลบแถวทิ้ง**

## Open

| # | เรื่อง | ผลกระทบ | ทางแก้ที่เสนอ | ความสำคัญ |
|---|---|---|---|---|
| D1 | **สี status ทั้ง 4 ไม่ถูก remap ใน `.dark`** — success 3.46:1 · warning 4.18:1 · error 2.75:1 · info 2.91:1 บน `#2a2a2c` | ทุกหน้าจอที่มีสถานะอ่านไม่ชัดในโหมดมืด · ตก WCAG 1.4.3 + 1.4.11 | เพิ่ม ramps ใน `.dark` (ค่าคำนวณแล้วใน audit §8) | 🔴 P0 |
| D2 | `--navy` (`index.css:84`) = `--color-dark-surface` ซึ่ง `.dark` **ไม่ remap** → `Privacy.tsx:70`/`Terms.tsx:71` = **1.04:1** | หัวข้อในหน้าบังคับใช้ทางกฎหมาย **มองไม่เห็น** ในโหมดมืด | ใช้ `var(--color-ink)` แล้วลบ alias `--navy`/`--blue` | 🔴 P0 |
| D3 | `Logo.tsx:19` `text-[var(--color-on-dark)]` บน primary → โหมดมืด **2.54:1** | โลโก้ผิด AA และเป็นกฎที่ test **ข้ามไฟล์นี้โดยตรง** | เปลี่ยนเป็น `--color-on-primary` (→ 6.63:1) · และ `Map.tsx:148,370,383` `text-white` | 🔴 P0 |
| D4 | `--color-primary-focus` = `--color-primary` (#7faf72) ใน `.dark` → **1.00:1** | hover ของปุ่ม primary **ไม่มี feedback** (28 จุด) และ focus ring สีเดียวกับปุ่ม (142 จุด) | แยกค่า dark focus เป็น olive ที่ต่างชัด | 🔴 P0 |
| D5 | `--color-hairline` เป็นขอบ control **140 จุด** แต่เทียบพื้นเพจแค่ **1.21:1** | ตก WCAG 1.4.11 — ขอบเขต input/ปุ่มมองไม่เห็น | เพิ่ม `--color-border-strong` แล้วใช้เฉพาะขอบ control (คง hairline ไว้กับเส้นประดับ) | 🔴 P0 |
| D6 | member shell `pb-[88px]` คงที่ ขณะที่ bottom nav โตตาม `env(safe-area-inset-bottom)` | เครื่องมี home indicator: เนื้อหาท้ายสุดของ **ทุกหน้า member** เลื่อนเข้าไม่ถึง ~14px | `pb-[calc(88px+env(safe-area-inset-bottom,0px))]` | 🔴 P0 |
| D7 | safe-area ตกหล่น 3 จุด: modal footer (`DesignSystem.tsx:728`), sidebar drawer (`Sidebar.tsx:228`), `.login-shell` (`index.css:748`) | ปุ่มหลักไปอยู่ใน gesture zone · โลโก้ใต้ status bar ในโหมดติดตั้ง PWA | ใช้ pattern ที่มีอยู่แล้วในเรพ (`Topbar.tsx:27` ฯลฯ) | 🔴 P0 |
| D8 | `StatusChip` success/warning ต่ำกว่า 4.5:1 ทั้งโหมดสว่าง (3.56 / 3.01) | chip สถานะบน Attendance/Feed/FollowUps/Groups อ่านยาก | ปรับค่า token (audit §8) | 🟠 P1 |
| D9 | `--color-warning` ใช้เป็น **ข้อความ** 14px (3.43:1 บนขาว / 3.01:1 บน tint) | `Members.tsx:1410` เป็นหัวข้อเนื้อหาจริง | เพิ่ม `--color-warning-ink` | 🟠 P1 |
| D10 | dark `--color-text-quaternary` alpha `.48` = **4.49:1** (ตกไป 0.01) | ขอบเขต AA ในโหมดมืด | alpha `.52` → 5.03:1 | 🟠 P1 |
| D11 | `role="status"` ไม่ได้ครอบ skeleton 7 หน้า (`Feed`, `Inbox`, `Announcements`, `Events`, `FollowUps`, `Profile`, `ImportData`) ขณะที่ `LoadingStates` ตั้ง `aria-hidden` | ช่วงโหลด **เงียบสนิท** สำหรับ screen reader (ตก WCAG 4.1.3) | ย้าย `role="status"` เข้า `LoadingStates` แก้ที่เดียวได้ทุกหน้า | 🟠 P1 |
| D12 | `ImportData.tsx:176-186` input `type=file` เป็น `sr-only` แต่ยังอยู่ใน tab order | โฟกัสไปที่ control ที่มองไม่เห็น (ตก 2.4.7) | `tabIndex={-1}` + `aria-hidden` หรือทำตาม `ImportOrgData.tsx:131-139` | 🟠 P1 |
| D13 | `Groups.tsx:249-274` `role="menu"`/`menuitem` ไม่มีคีย์ลูกศร/ย้าย focus | AT สัญญาสิ่งที่ทำไม่ได้ (ตก 4.1.2 + 2.1.1) | ตัด role ออก หรือทำ APG model / ใช้ Radix | 🟠 P1 |
| D14 | `Attendance.tsx:564-591` `role="tablist"`/`tab` ไม่มี roving tabIndex/คีย์ลูกศร | เช่นเดียวกับ D13 | เพิ่ม `tabIndex={isActive?0:-1}` + handler | 🟠 P1 |
| D15 | `MemberProfile.tsx:319,398` grid 2 คอลัมน์ ตัดเบอร์โทร/เบอร์ฉุกเฉินที่ 360px | ผู้ใช้ตรวจทานเบอร์ที่พิมพ์ไม่ได้ — เบอร์ฉุกเฉินอ่านผิดแล้วเจ็บ | `grid-cols-1 sm:grid-cols-2` | 🟠 P1 |
| D16 | `Map.tsx:488` สูงคงที่ 420px และไม่มี `touch-action` | เลื่อนหน้าผ่านแถบแผนที่ไม่ได้บนมือถือ | `h-[52vh]` + `[touch-action:pan-y]` | 🟠 P1 |
| D17 | `Groups.tsx:970-984` action row ล้นที่ยอด 3 หลัก + `overflow-x-hidden` ตัดขวา | ปุ่มถูกตัดโดยไม่มีการ scroll | `flex-wrap` + เลิก `whitespace-nowrap` | 🟠 P1 |
| D18 | **ปน 2 ภาษาเงาน** — Tailwind default ดำ 18 จุด vs `var(--shadow)` graphite 10 จุด | ความลึกไม่สม่ำเสมอ (จุดที่เข้าถึงได้จริงคือ `ui/sheet.tsx:61`) | ประกาศ `--shadow-*` ใน `@theme` หรือ override `sheet.tsx` | 🟡 P2 |
| D19 | **ปน 2 ระบบ typography** — 182 จุดใช้ `text-*` เปล่า เทียบ `.type-*` · `.type-hero` ใช้ 0 ครั้ง · `.type-body` 4 ครั้ง | สเกลที่เอกสารไว้แทบไม่ถูกใช้ | ย้ายไป `.type-*` และตัดสินใจเรื่อง `.type-hero` | 🟡 P2 |
| D20 | nested-radius ละเมิด — `.coming-soon-icon` 25px ใน `.coming-soon-card` 18px | inner โค้งกว่า outer = "AI-template tell" ที่ชัดที่สุด | `inner = outer − padding` | 🟡 P2 |
| D21 | ค่า radius hardcode ใน CSS แทน token (`11px` `18px` `10px` `12px` `25px`) | จะเพี้ยนเงียบ ๆ เมื่อสเกลเปลี่ยน | ใช้ `var(--radius-*)` | 🟡 P2 |
| D22 | spacing หลุดสเกล (`p-3.5`=14px `gap-2.5`=10px) กระจุกใน member PWA | เพิ่มความไม่สม่ำเสมอในโค้ดใหม่ที่สุด | `p-4`/`gap-3` | 🟡 P2 |
| D23 | `Home.tsx:553,563` แสดง "ยังโหลด" เป็น **แดง/เหลือง** และเรียก `ขัดข้องชั่วคราว` | ผู้ใช้เห็นเป็นความล้มเหลวทั้งที่ยังไม่รู้ผล | ใช้ tone neutral จนกว่าจะรู้ผลจริง | 🟡 P2 |
| D24 | `Events.tsx:51` `cancelled` = `error` แต่ `FollowUps.tsx:47`/`Groups.tsx:169`/`Map.tsx:51` = `neutral` | ค่าเดียวกันสองความหมาย — แดงแปลว่าทั้ง "อันตราย" และ "ยกเลิก" | ทำให้เป็น `neutral` ให้ตรงกัน | 🟡 P2 |
| D25 | `Profile.tsx:85,112` ใช้ icon chip 3 สี (orange/green/blue) ขณะที่ทั้งแอปใช้ accent เดียว | "mixed parts" signature ขัดกับกฎสีเดียว | ใช้ `bg-[var(--color-accent-soft)] text-[var(--color-primary)]` | 🟡 P2 |
| D26 | ปุ่มล้างคำค้นหา **2 ขนาด** — `size-9` (36px, ต่ำกว่า 44px) ที่ `Members.tsx:607`/`Groups.tsx:730` เทียบกับ `size-11` ที่ `GlobalSearch.tsx:108` | ตก WCAG 2.5.8 + control เดียวกัน 2 geometry | รวมเป็น component เดียวที่ 44px | 🟡 P2 |
| D27 | skeleton Map `h-[420px]` (`Map.tsx:423`) vs component จริง `h-[500px]` (`Map.tsx:119`) | **layout กระโดด** ตอนโหลด | ใช้ค่าค่าคงที่ร่วมกัน | 🟡 P2 |
| D28 | **dead CSS 40 จาก 98 selector** ใน `index.css` (รวม `blue-eyebrow`/`purple`/`pink`/`orange` และที่อยู่ของกฎ 9–11px ทั้งหมด) | 31.9 KB มีส่วนที่ตายแล้ว + กับดักรอ copy-paste | ลบ selector ที่ยืนยันว่าไม่มีผู้ใช้ (ยกเว้น `.leaflet-control-*`) | 🟡 P2 |
| D29 | `--muted` **declare ซ้ำ** ใน `:root` (`:73` แล้ว `:87`) → ตัวหลังชนะ ⇒ `bg-muted` = เทาเข้ม | `bg-muted text-muted-foreground` ≈ **1:1** (ยังไม่ปรากฏเพราะ primitive เหล่านั้นไม่ถูก import) | ลบ `:87` | 🟡 P2 |
| D30 | modal ไม่ associate `description` (`DesignSystem.tsx:662` มีแต่ `aria-labelledby`) | คำอธิบายยืนยันการลบไม่ถูกประกาศ | `useId()` + `aria-describedby` | 🟢 P3 |
| D31 | `role="alert"` + `aria-live="polite"` บน element เดียว (`DesignSystem.tsx:378,700`) | politeness ขัดกัน อาจประกาศซ้ำ | เก็บอย่างใดอย่างหนึ่ง | 🟢 P3 |
| D32 | `Sidebar.tsx:250` ใช้ `h2` เป็น label กลุ่มเมนู (6 กลุ่ม) มาก่อน `<main>` | heading list ของทุกหน้า admin ขึ้นต้นด้วย navigation, `h1` อยู่ลำดับ 7 | ใช้ `<span>` + `aria-labelledby` ที่ `<ul>` | 🟢 P3 |
| D33 | `ErrorBoundary.tsx:42` ทั้งหน้ามีแต่ `h2` ไม่มี `h1` | หน้า error ไม่มี primary heading | เปลี่ยนเป็น `h1` | 🟢 P3 |
| D34 | `Feed.tsx:378` `<img alt="">` ทั้งที่เป็นรูปกิจกรรมที่ผู้ใช้อัปโหลด | เนื้อหาหายจาก accessibility tree (ตก 1.1.1) | `alt` ที่สื่อความหมาย | 🟢 P3 |
| D35 | `ImportData.tsx:367-375` `th` ไม่มี `scope` (ตารางอื่นในเรพมีครบ) | ตก 1.3.1 | `scope="col"` + `<caption className="sr-only">` | 🟢 P3 |
| D36 | `Privacy.tsx:60`, `Terms.tsx:62`, `GlobalSearch.tsx:110` lucide icon ไม่มี `aria-hidden` | ถูก expose เป็น unnamed graphic | เติม `aria-hidden="true"` | 🟢 P3 |
| D37 | ไม่มี `scroll-mt`/`scroll-padding` เลย (0 จุด) | skip link/hash nav เลื่อนไปใต้ sticky header (76px/60px) | `scroll-mt-20` ที่ `<main>` | 🟢 P3 |
| D38 | `.type-hero` นิยามไว้แต่ไม่ถูกใช้ (และ `brand-spec.md` ยังโฆษณา) | token ตายในสเกลที่ประกาศ | ใช้หรือเลิกแล้วอัปเดตเอกสาร | 🟢 P3 |
| T1 | **test อ่อนไหวต่อ timezone** — `care.test.ts` แดงที่ UTC-3 แต่เขียวที่ UTC/UTC+7 (พิสูจน์แล้ว) | CI เขียวแต่นักพัฒนาตะวันตกของ UTC จะเจอแดงที่ไม่ใช่ความผิดตัวเอง | บังคับ `TZ=UTC` ใน config หรือแก้การจัดการ date-only ให้เป็น UTC-safe | 🟠 P1 |
| T2 | **date-only round-trip ผ่าน local-time getters** (สาเหตุของ T1) | เป็น bug class จริงต่อ deployment ตะวันตกของ UTC | จัดการ `date` เป็น string ตลอดทาง หรือใช้ UTC getters | 🟠 P1 |
| T3 | guard มีรู 7 จุด (G1–G7 ใน audit §9) | ปัญหา D1–D5, D11 ผ่าน CI ได้ | เพิ่ม test 4 ตัวตาม audit §9 | 🟠 P1 |
| T4 | `design-tokens.test.ts` "dark mode is a token remap" กรองบรรทัดที่ขึ้นต้น `.dark` **ออก** → จับเป้าหมายตัวเองไม่ได้ | guard ที่มีอยู่ไม่ทำงานตามชื่อ | แก้ filter | 🟡 P2 |
| T5 | `design-system-consistency.test.ts` 12px-floor **ไม่สแกน `.css`** | กฎ sub-12px ใน CSS รอด (ปัจจุบันอยู่ใน selector ที่ตายแล้ว) | ขยายการสแกนไปที่ `index.css` | 🟡 P2 |
| T6 | `ux-audit-regressions.test.ts` dead-CSS check เป็น **blocklist 11 ชื่อ** ไม่ใช่การตรวจ dead code | dead selector 40 ตัวผ่าน | เปลี่ยนเป็นตรวจจากผู้ใช้จริง | 🟡 P2 |
| DOC1 | `docs/PUNTAKIT_AGENT_GUIDE.md` ระบุ route modules **14** แต่ของจริง **19** (ขาด `care`, `clerkWebhook`, `import`, `org`, `orgData`) | agent อ่านแล้วเข้าใจผิดว่าไม่มีโมดูลเหล่านั้น | แก้เป็น 19 + ชี้ `server/app.ts` | 🟠 P1 |
| DOC2 | `docs/PUNTAKIT_UX_AUDIT.md` §1 อ้าง `CLAUDE.md` ที่ถูกลบแล้ว | เอกสารตั้งต้นบนหลักที่หายไป | ติดป้าย SUPERSEDED | 🟡 P2 |
| DOC3 | `template.json` (vendor Manus) ฝัง `index.css` **ธีมน้ำเงินเก่า** (`--primary: var(--color-blue-700)`) | agent ที่อ่านไฟล์นี้จะเข้าใจผิดว่าธีมเป็นน้ำเงิน | ใส่หมายเหตุใน `docs/README.md` (ทำแล้ว) **ห้ามแก้ไฟล์ vendor** | 🟡 P2 |
| DOC4 | `DESIGN-apple.md` (root, 36.5 KB) มี token ชื่อใกล้เคียงของจริงมาก แต่ `primary` เป็น Apple blue · คำเตือน "REFERENCE ONLY" อยู่ที่ **L276** | agent อ่าน frontmatter แล้วเข้าใจผิดว่าเป็นระบบของโปรเจกต์ | ใส่หมายเหตุใน `docs/README.md` (ทำแล้ว) หรือย้ายเข้า `docs/reference/` **เมื่อได้รับอนุมัติให้ย้ายไฟล์** | 🟡 P2 |
| DOC5 | `puntakit-dashboard-ops.skill` เป็น **binary ZIP** ไม่มีคำอธิบาย | agent อ่านไม่ได้และไม่รู้ว่าคืออะไร | แตกไฟล์เก็บเป็น markdown หรือเขียนคำอธิบาย | 🟢 P3 |
| DOC6 | `design.md` มีเลขหัวข้อ `### 8.2` **ซ้ำสองที่** (`:126` ธีมมืด, `:142` Clay) | อ้างอิงผิดตำแหน่ง | แก้เป็น 8.4 | 🟢 P3 |
| DOC7 | `design.md` §8 กฎ *"ปุ่มหลัก: ตัวอักษรขาว"* ขัดกับ audit (ต้องใช้ `--color-on-primary`) | เอกสารสอนให้ทำสิ่งที่ audit ห้าม | แก้กฎให้ตรงกับ `on-primary` | 🟠 P1 |

| D39 | `announcements.ts:23,56,66` · `events.ts:23,53,63` · `ministries.ts:23,53,63` ส่ง `error` เป็น **string เปล่า** ไม่ใช่ object | ขัดสัญญา envelope ที่ `server/routes/validationEnvelope.test.ts:62-75` ล็อกไว้ — client ที่อ่าน `error.code` จะพังกับ route เหล่านี้ | ใช้ `AppError`/`sendValidationError` ตามเส้นทางกลาง | 🟠 P1 |
| D40 | `POST /api/import/upload/token` (`import.ts:363`) คืนผลจาก Vercel Blob ตรง ๆ ไม่ผ่าน envelope | response ไม่เป็นไปตามสัญญา | ห่อด้วย envelope หรือบันทึกเป็นข้อยกเว้นอย่างเป็นทางการ | 🟡 P2 |
| D41 | `/api/ready` ไม่มี auth guard และ **ไม่มีคอมเมนต์อธิบายเหตุผล** | เหตุผลตรวจไม่ได้ (`NOT VERIFIED`) | ตัดสินใจ + เขียนเหตุผล หรือใส่ guard | 🟡 P2 |
| D42 | `server/db/pending/0010_group_members_history.sql` อยู่นอก `migrations/` ไม่มี journal entry ไม่เคยถูกอ่าน — gated ด้วย verdict `CLEAR` | migration ที่ตั้งใจไม่ให้รัน อาจถูกรันผิดหรือถูกมองข้าม | ตั้งชื่อ/วางที่ให้ชัด หรือย้ายไป exec-plan | 🟡 P2 |
| D43 | DB ไม่มี native enum (`pgEnum` = 0 ที่) — enum ทั้งหมดเป็น `text({enum:[...]})` | เอกสารที่บอกว่า "DB-level enum" จะผิด และไม่มี constraint ระดับฐานข้อมูลกันค่าที่ไม่ถูกต้อง | ระบุใน `ARCHITECTURE.md` ให้ตรงความจริง | 🟢 P3 |
| D44 | cookie/JWT branch ของ `requireAuth` (`middleware/auth.ts:117-153`) — คอมเมนต์ที่ `:48-56` เตือนว่า **token ปลอมที่เป็น super_admin จะผ่านทุก gate** | ถ้าหลุดไป production คือช่องโหว่ระดับสูงสุด | มี hard-gate กันอยู่แล้ว (`app.ts:79-88`) — รักษา gate นี้ไว้และอย่าแตะ | 🟠 P1 |

| D45 | `server/middleware/rateLimit.ts` (`loginRateLimiter`) **ไม่ถูก import/mount ที่ไหนเลย** (grep ทั้งเรพ = 0) | ดูเหมือนมี rate limiting แต่ไม่มีจริง — login ไม่ถูกจำกัด | mount ที่ login path หรือลบไฟล์ทิ้ง | 🟠 P1 |
| D46 | env var **6 ตัวที่โค้ดอ่านแต่หายจาก `.env.example`**: `PUNTAKIT_TEST_AUTH` · `JWT_SECRET` · `BOOTSTRAP_ADMIN_EMAILS` · `BLOB_READ_WRITE_TOKEN` · `PORT` · `PROBE_BASE_URL` (+ `CLERK_PUBLISHABLE_KEY` มีแต่คอมเมนต์ ไม่มีบรรทัดตั้งค่า) | คนตั้ง deploy ใหม่ไม่รู้ว่าต้องตั้งอะไร · `BLOB_READ_WRITE_TOKEN` ขาด ⇒ import ไฟล์ใหญ่พังเงียบ ๆ | เติมใน `.env.example` + `DEPLOYMENT.md` | 🟠 P1 |
| D47 | `.env.example:76-77` ประกาศ `VITE_ANALYTICS_ENDPOINT` / `VITE_ANALYTICS_WEBSITE_ID` แต่ **ไม่มีโค้ดอ่าน** | ตั้งค่าแล้วไม่มีผล — ทำให้เข้าใจผิดว่ามี analytics | ลบ หรือทำ analytics จริง | 🟢 P3 |
| D48 | `tsconfig.json:3` ตัด `**/*.test.ts` ออก ⇒ `pnpm check` **ไม่ตรวจ type ของ test 40 ไฟล์** | type error ใน test ไปพังตอนรันแทนที่จะจับที่ gate | เพิ่ม tsconfig สำหรับ test หรือเอา exclusion ออก | 🟠 P1 |
| D49 | access log บันทึก `url` **รวม query string** และ `userAgent` ดิบ **โดยไม่มีการ redact** | คำค้นหา/id หลุดเข้า log ทุกบรรทัด | redact query ที่ละเอียดอ่อน | 🟡 P2 |
| D50 | **CI ไม่เคยแตะ Clerk จริงหรือ Neon จริง** และไม่รัน lint / `prettier --check` / coverage / e2e | integration failure ไม่ถูกจับก่อน deploy (blind spot ที่ `SESSION_REPORT` §9 เตือนไว้เอง) | เพิ่ม smoke test หลัง deploy หรือ CI job ที่ใช้ Clerk test instance | 🟠 P1 |
| D51 | `docs/PUNTAKIT_AGENT_GUIDE.md` อ้าง `server/lib/logger.*` ที่ไม่มีอยู่ และ `AGENTS.md` เคยอ้างตาม | agent หา logger ไม่เจอ | แก้แล้ว (2026-10-07) — บันทึกไว้เป็นบทเรียน | 🟢 P3 |
| D52 | **5 route modules ไม่มี `.test.ts` คู่ของตัวเอง** — `announcements`, `auth`, `churchProfile`, `events`, `ministries` (มี 21 test files แต่ 19 modules; มีแค่ `validationEnvelope.test.ts` แตะ validation ผิว) — ขัดคำอ้างใน `AGENTS.md` เดิมว่า "19 module แต่ละตัวมี test คู่" | guard/permission/CRUD ของ 5 modules พื้นนี้ไม่มี test ล็อก — regression หลุดได้เงียบ | เพิ่ม test คู่ตาม pattern route+test ที่มีอยู่ (เรียงตามความเสี่ยง: `auth` → `events` → `announcements` → `ministries` → `churchProfile`) | 🟠 P1 |

## Resolved

| # | เรื่อง | แก้เมื่อ | หลักฐาน |
|---|---|---|---|
| R1 | `CLAUDE.md` ชี้ทาง agent ผิดรุ่น (ผูกกับ Claude โดยเฉพาะ) | 2026-10-07 | ลบ `CLAUDE.md` + ย้ายเนื้อหาเป็น `docs/PUNTAKIT_AGENT_GUIDE.md` |
| R2 | งาน Claude workflow ที่ค้างในเรพ (`.ai/WORKFLOW.md`, opus blueprint, `.ai/workflow/`) | 2026-10-07 | ลบ 4 path — ดู patch `claude-removal.patch` |
| R3 | ไม่มีเอกสารแกน (`PRD`/`ARCHITECTURE`/`DESIGN_SYSTEM`/`README`) | 2026-10-07 | สร้างครบในการยกระดับ Foundation ครั้งนี้ |
