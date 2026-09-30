# Puntakit — Maintenance & Performance Report

วันที่: 2026-09-30
ช่วง: งานรอบเดียว 10 commits (`8988a4f` → `1211fbe`)
สถานะเริ่มต้น: โฟลเดอร์นี้ไม่มี `.git`, ไม่ได้ติดตั้ง dependencies, ไม่มี `.env.local`, รัน `pnpm dev` ไม่ได้

> ⚠️ **อ่านข้อ 9 ก่อน** — ระหว่างงานนี้พบว่า **production ล่มอยู่ก่อนแล้ว** (API ตอบ 503/500 ทุก route) และได้วินิจฉัยจนพบสาเหตุทั้งสองและแก้ให้กลับมาใช้งานได้แล้ว

---

## 1. สรุปสำหรับผู้บริหาร (อ่าน 30 วินาที)

| เรื่อง | ก่อน | หลัง |
|---|---|---|
| HTML ที่ต้องโหลดทุกหน้า | 368.80 kB (gzip 106.11 kB) | **1.91 kB (gzip 0.94 kB)** |
| JS chunk แรกที่ทุกคนโหลด | 1,605.10 kB (gzip 324.33 kB) | **542.13 kB (gzip 156.58 kB)** |
| หน้าแรกที่ผู้ใช้โหลดจริง (HTML+JS, gzip) | ~430 kB | **~157 kB (−63%)** |
| `vite build` | ~36 วินาที | **~8 วินาที** |
| dependency ที่ไม่มีใครใช้ | 8 ตัว | 0 (ลบแล้ว) |
| `pnpm install` lockfile | — | สั้นลง 2,284 บรรทัด |
| เอกสารที่ขัดกับโค้ด | 5 จุด | แก้แล้วทั้งหมด |
| สิทธิ์การเข้าถึงเมนูตาม role | ไม่มี gating | **มี + ทดสอบในเบราว์เซอร์จริง 3 role** |

**ยังไม่ได้แตะ:** ฟีเจอร์ใด ๆ, schema/DB, route, สิทธิ์การเข้าถึง (ไม่มี route ใดถูกลบหรือเพิ่ม)

---

## 2. งานที่ทำ (10 commits)

| commit | ประเภท | สาระ |
|---|---|---|
| `8988a4f` | baseline | `git init` + commit 222 ไฟล์ ก่อนแก้ไขสิ่งใด (สแกน secrets แล้วไม่พบค่าจริง) |
| `649dc92` | env + docs | ติดตั้ง deps, สร้าง `.env.local` โหมด demo, ปิดกับดัก port, ซ่อมเอกสาร 5 จุดที่หลอกคนอ่าน |
| `cb31607` | RBAC | `shared/roles.ts` เป็นนิยามเดียว (ลบสำเนา 9 ที่) + sidebar gating + แก้ analytics ที่พัง |
| `dde6eae` | docs | บันทึกกับดัก local-demo 2 ข้อที่เจอจากการทดสอบจริง |
| `e95aa90` | perf | ถอด Manus runtime ออกจากทุกหน้า (−367 kB/หน้า) |
| `adedd94` | perf | code splitting ทุก route ด้วย `React.lazy` + `Suspense` |
| `e9c5e6a` | deps | ลบ 8 dependency ที่ไม่มีไฟล์ไหน import |
| `0ffe2e8` | docs | รายงานสรุปงานรอบนี้ |
| `19f3a7b` | deploy | `.vercelignore` — ห้ามอัปโหลด `.db_data` (39 MB) ขึ้น Vercel ทุกครั้งที่ deploy |
| `1211fbe` | **fix** | **กู้ production: `clerkMiddleware()` ไม่เคยได้รับ publishable key (รายละเอียดข้อ 9)** |

---

## 3. รายละเอียดงานสำคัญ

### 3.1 เอกสารที่ขัดกับโค้ด (แก้แล้ว 5 จุด)

| เอกสารเขียนว่า | ความจริง |
|---|---|
| `AGENTS.md` / `CLAUDE.md`: server เป็น "thin static host ไม่มี business logic" | `server/app.ts` mount 14 router + Drizzle + Clerk — เป็น API เต็มตัว |
| `AGENTS.md` / `CLAUDE.md`: "ไม่มีเทสต์ ไม่มี test script" | มี Vitest + CI (`.github/workflows/ci.yml`) + เทสต์จริง 175 รายการ |
| plan Phase 7: Map "BLOCKED รอ Google Maps key" | `/map` ใช้งานจริงด้วย **Leaflet** ไม่มี Google Maps ในโปรเจกต์ |
| plan Phase 2: palette "เลื่อนไป Phase 8" | `index.css` เป็น Design System V2 แล้ว + มีเทสต์ล็อกไว้ |
| `ComingSoon.tsx`: 4 route ยัง "coming soon" | ทำจริงหมดแล้ว เหลือแค่ `/media` กับ `/settings` |

### 3.2 RBAC — นิยามเดียวทั้งระบบ

ปัญหาเดิม: ชุด role เดียวกันถูกเขียนซ้ำ **9 ที่** (server 5 + client 4) ซึ่งเป็น "ระบบสิทธิ์ที่สอง" ที่เอกสารสถาปัตยกรรมห้าม

แก้: `shared/roles.ts` เก็บ `PRIVILEGED_ROLES` / `CREATE_ROLES` / `DELETE_ROLES` / `hasRole` แล้วให้ทั้ง server และ client import จากที่เดียว

**Sidebar gating** — ซ่อนเฉพาะที่ server จะปฏิเสธจริง:

| เมนู | ซ่อนจาก | อ้างอิงฝั่ง server |
|---|---|---|
| `/inbox` | role นอก `CREATE_ROLES` | `server/routes/submissions.ts` บล็อกการสร้าง |
| `/reports` | role นอก `PRIVILEGED_ROLES` | `server/routes/reports.ts` `requireRole` ทั้ง router |

**จงใจไม่ซ่อน `/follow-up`** — server ให้ owner/creator เข้าถึงได้ไม่ว่า role ไหน ถ้าซ่อนตาม role จะทำให้คนที่ถูกมอบหมายงานเข้าเมนูไม่ได้

**ผลทดสอบในเบราว์เซอร์จริง** (headless Chromium + PGlite + API จริง):

| role | `/inbox` | `/reports` | เมนูอื่น 6 รายการ | ขนาด sidebar |
|---|---|---|---|---|
| `admin` | เห็น | เห็น | ครบ | 22,150 |
| `group_leader` | **เห็น** | **ซ่อน** | ครบ | 21,239 |
| `viewer` | ซ่อน | ซ่อน | ครบ | 20,256 |

เคส `group_leader` คือเคสชี้ขาด — ถ้าเขียนผิดแบบ "ซ่อนทุกอย่างสำหรับคนไม่ใช่ admin" จะได้ 0/0 ไม่ใช่ 1/0

### 3.3 เอกสารที่ต้องรู้เพิ่มหลังการทดสอบ

บันทึกไว้ใน `CLAUDE.md` แล้ว:

1. **บัญชี demo** (`demo@puntakit.local`, role `admin`) — role ของมันใน `.db_data` คือสิ่งที่แอปเรนเดอร์ จึงเป็น lever สำหรับทดสอบ UI ตาม role
2. **กับดัก PGlite** — process ที่สองเปิด `.db_data` ซ้อนได้ **โดยไม่มี lock error** แต่ server ที่รันอยู่ยังอ่านค่าเก่า → ต้องหยุด server ก่อนแก้ DB
3. **`member` ถูก redirect** จาก `/` ไป `/app` (PWA) โดย `Home.tsx` → ไม่เคยเห็น admin sidebar (งาน gating จึงมีผลจริงกับ `viewer`/`group_leader`)

---

## 4. งานประสิทธิภาพ (วัดผลจริงทุกตัวเลข)

### 4.1 Manus runtime — สาเหตุ HTML 368 kB

ปลั๊กอิน `vite-plugin-manus-runtime` (29 บรรทัด) **ไม่มี `apply: 'serve'` guard** จึงฉีด runtime ทั้งก้อน (React อีกชุด + Manus editor bridge `@medv/finder` + `modern-screenshot`) เป็น inline script ลงทุกหน้า ทั้ง dev และ production

หลักฐานที่ทำให้ตัดออกได้อย่างมั่นใจ:
- ไม่มีโค้ดใน `client/src` / `server/` / `api/` ที่อ้าง `window.__MANUS_HOST_DEV__`
- ขนาด JS bundle หลักเท่าเดิมทุกไบต์ → แอปไม่ได้ import อะไรจากมัน
- deploy จริงบน Vercel ไม่ใช่ Manus host

ผล: `index.html` **368.80 kB → 1.91 kB**, dev DOM 693,296 → 326,301 ตัวอักษร, build เร็วขึ้น 36s → 8s
ยืนยันด้วยเบราว์เซอร์จริงว่า sidebar เรนเดอร์เหมือนเดิมเป๊ะ (22,150 ตัวอักษร)

**คง dependency ไว้ใน `package.json`** พร้อม comment ใน `vite.config.ts` อธิบายหลักฐานและวิธีเปิดกลับ (ถ้าต้องรันใน Manus builder อีก)

### 4.2 Code splitting

วัดก่อนแก้ด้วย esbuild metafile (45 แพ็กเกจ) — ตัวการจริง:

| แพ็กเกจ | ขนาด (unminified) | ใช้ที่ไหน |
|---|---|---|
| โค้ดแอปทุกหน้า | 591 kB | รวมเป็นก้อนเดียว |
| react-dom | 537 kB | core |
| **leaflet + markercluster** | **456 kB** | **แค่หน้า `/map`** |
| @clerk/react + shared | 180 kB | static |
| @tanstack/query-core | 105 kB | transitive ของ Clerk |
| qrcode | 58 kB | 3 หน้า |

แก้ที่ `client/src/App.tsx` ไฟล์เดียว: 24 หน้าเป็น `React.lazy` + `<Suspense>` ด้วย skeleton (ตาม `design.md` ที่ห้ามใช้ `"..."` เป็น loading) · `NotFound` คงไว้ static เพราะเป็น route fallback และห้าม suspend

| | ก่อน | หลัง |
|---|---|---|
| entry chunk | 1,605.10 kB | **542.13 kB** (gzip 156.58 kB) |
| chunk ของ `/map` | — | 216.98 kB (gzip 57.75) + CSS 17.25 kB |
| CSS | 177.09 kB ก้อนเดียว | 159.84 + 17.25 แยกตาม route |
| จำนวน chunk | 1 | 63 |
| รวม JS ทั้งหมด | 1,605.10 kB | ~1,588 kB |

**path, shell และสิทธิ์การเข้าถึงทุก route ไม่เปลี่ยน** — เปลี่ยนแค่ "ตอนที่โค้ดของหน้าโหลดมาถึง"

### 4.3 ลบ dependency ที่ตาย

ตรวจ import จริงทั้ง 4 source root แล้วพบ 8 ตัวที่ไม่มีไฟล์/config ใดอ้างถึง:
`axios`, `framer-motion`, `streamdown`, `tailwindcss-animate`, `@types/google.maps`, `add`, `autoprefixer`, `postcss`

หลักฐานว่าไม่กระทบ runtime: **hash ของไฟล์ที่ build ออกมาเหมือนเดิมทุกตัว** (`index-B1l42bhh.js` 542.13 kB, `Map-Cuiwv39C.js` 216.98 kB, `index.html` 1.91 kB) → เป็นการลดน้ำหนักติดตั้ง/CI ล้วน ๆ

---

## 5. การตรวจสอบที่ทำจริง (และที่ยังไม่ได้ทำ)

### ทำแล้ว ✅

```
pnpm check  → exit 0
pnpm test   → 15 ไฟล์ / 175 tests passed  (ทุกครั้งหลังแก้)
pnpm build  → exit 0
headless Chromium (Playwright cache) ทดสอบกับ dev server + PGlite + API จริง:
  - role gating 3 role (admin / group_leader / viewer)
  - "/" เรนเดอร์ shell + sidebar และไม่โหลด leaflet
  - "/map" โหลด lazy chunk + CSS ของตัวเอง (leaflet-container = 22)
  - ไม่มี Suspense fallback ค้างอยู่ในทุกกรณี
```

### ยังไม่ได้ทำ (ข้อจำกัดที่ต้องรู้) ⚠️

1. **ไม่ได้เสิร์ฟ `dist/` ในโหมด production จริง** — ดีไซน์บังคับไว้: `NODE_ENV=production` ปฏิเสธ PGlite และบังคับ `CLERK_SECRET_KEY` จึงรัน demo mode ใน production ไม่ได้ตามเจตนา
2. **ไม่ได้ทดสอบเส้นทางที่ `member` deep-link เข้า admin route ตรง ๆ** (ใช้โค้ดพาธเดียวกับ `viewer` แต่ยังไม่วัด)
3. **ยังไม่มี UI/browser test ใน CI** — การทดสอบเบราว์เซอร์ทุกรอบเป็นการทำมือ ไม่กัน regression อัตโนมัติ
4. **ยังไม่เคยทดสอบกับ Neon/Postgres จริง** — ทั้งหมดใช้ PGlite (ไม่มี credential ในสภาพแวดล้อม)

---

## 6. หนี้ที่เหลือ (เรียงตามผลตอบแทน)

| # | เรื่อง | หลักฐาน / หมายเหตุ |
|---|---|---|
| 1 | **entry chunk 542 kB ยังเกินเกณฑ์ 500 kB** | warning ยังขึ้นทุก build — ต้องแยก Clerk/vendor |
| 2 | **primitive ที่ไม่มีใครใช้ 46 ไฟล์ + deps** (`recharts`, `embla`, `vaul`, `cmdk`, `react-day-picker`, `input-otp`, `react-resizable-panels`) | `recharts` ถูก import แค่โดย `ui/chart.tsx` ที่ไม่มีใคร import — ลบต้องลบไฟล์ source ออกจาก registry จึงต้องตัดสินใจเชิง design-system |
| 3 | **peer dependency ไม่ตรง (มีอยู่ก่อนแล้ว)** | `@builder.io/vite-plugin-jsx-loc` ต้องการ `vite ^4\|\|^5` แต่ใช้ Vite 7 · Clerk ต้องการ `react ~19.2.3` แต่มี `19.2.1` |
| 4 | **pnpm 10 บล็อก build script** ของ `@tailwindcss/oxide` + `esbuild` | ยังไม่พัง แต่ควรปักหมุด `pnpm.onlyBuiltDependencies` |
| 5 | **ไม่มี UI test ใน CI** | ทุกวันนี้พึ่ง `check` + unit/integration |
| 6 | `members.ts:185,358` ยังมี inline role list | จงใจไม่ย้าย — โดเมน member CRUD อาจต้องแยกจาก `CREATE_ROLES` |
| 7 | `Feed.tsx:399` มี `bg-white` ที่ซ้ำซ้อน | เศษเล็ก |

---

## 7. หมายเหตุสภาพแวดล้อมการทำงาน

- **shell ต้องใช้สิทธิ์ full-access** — DSH sandbox โหมด workspace-write ทำให้ `pwsh` ล้มเหลวทุกคำสั่ง (exit `3221225794` = DLL init failed) ไม่ใช่ปัญหาของ pwsh เอง
- **กับดัก port ใน dev** — `server/index.ts` ใช้ `PORT || API_PORT || 3000` ขณะที่ Vite dev ก็ใช้ 3000 และ proxy `/api` ไป 3001 → `.env.local` **ต้องมี `API_PORT=3001`** (เพิ่มใน `.env.example` แล้ว)
- **โหมด demo ต้องมี** `PUNTAKIT_DEMO_MODE=1` + `VITE_PUNTAKIT_DEMO_MODE=1` ใน `.env.local` ไม่งั้นทั้ง API และ client จะ throw ตอน start
- **ห้าม commit `.env.local`** — gitignore ครอบไว้แล้วและตรวจแล้วว่าไม่ถูก track

---

## 8. ขั้นตอนถัดไปที่แนะนำ

1. ~~Redeploy บน Vercel~~ **เสร็จแล้ว** — deploy production หลายรอบระหว่างงานนี้ (ดูข้อ 9) และยืนยันแล้วว่า `/api/ready` คืน `database: connected`
2. ตัดสินใจเรื่อง **primitive ที่ตาย 46 ไฟล์** (จะลด lockfile และเวลาติดตั้งได้อีกมาก)
3. อัปเกรด **react เป็น 19.2.3+** และพิจารณาปลั๊กอิน `jsx-loc` ที่ไม่รองรับ Vite 7
4. เพิ่ม **smoke test ปลายทาง** — อย่างน้อยยิง `/api/ready` (ต้องได้ 200 + `database: connected`) และ `/api/auth/me` (ต้องได้ 401 ไม่ใช่ 5xx) หลัง deploy ทุกครั้ง จะจับ downtime แบบข้อ 9 ได้ภายในไม่กี่นาที
5. เพิ่ม **UI smoke test ใน CI** เพื่อกัน regression ของ sidebar/lazy route
6. ทำงานฟีเจอร์ที่เหลือ: Notifications, Search, Admin RBAC UI (ต่อ `/settings`)

---

## 9. เหตุการณ์สำคัญ: production ล่ม และการกู้คืน

### อาการ

`https://puntakit-kalasin.vercel.app` โหลดหน้าได้ แต่ API ทุก route ที่แตะฐานข้อมูลหรือ auth ตอบ error — ผู้ใช้จริง login ไม่ได้

| route | ก่อนแก้ | หลังแก้ |
|---|---|---|
| `/api/health` (liveness) | 200 | 200 |
| `/api/ready` (ฐานข้อมูล) | **503** แล้วกลายเป็น **500** | **200 `{"status":"ready","database":"connected"}`** |
| `/api/auth/me` | **503** แล้วกลายเป็น **500** | **401** (ค่าที่ถูกต้องเมื่อยังไม่ login) |

### หลักฐานว่าไม่ใช่ผลจาก deploy ของรอบนี้

ทดสอบ deployment เก่า 20 ชั่วโมงก่อน (ก่อนงานทั้งหมด) → ได้ 503 `DATABASE_UNAVAILABLE` เหมือนกันเป๊ะ และ preview deployment ก็ 503 เหมือนกัน → ปัญหาอยู่ที่ค่า env var ไม่ใช่ที่ตัว deployment

### สาเหตุที่ 1 — `DATABASE_URL` ใช้งานไม่ได้ (503)

runtime log:
```
DatabaseConfigurationError: DATABASE_URL is required when NODE_ENV=production.
Refusing to fall back to the embedded PGlite database.
```

`vercel env ls production` แสดงว่ามี `DATABASE_URL` (scope Production+Preview สร้างไว้ 4 วันก่อน) แต่ function ไม่ได้รับค่าที่ใช้ได้ — และเพราะเป็น Secret จึงอ่านค่าจริงไม่ได้ (`vercel env pull` คืน `[SENSITIVE]`) → **เจ้าของโปรเจกต์ตั้งค่าใหม่ใน Vercel dashboard** แล้วอาการ 503 หายไป

### สาเหตุที่ 2 — `clerkMiddleware()` ไม่มี publishable key (500) — บั๊กในโค้ด แก้ที่ `1211fbe`

พอ 503 หาย กลายเป็น 500 ทันที และ log บอกชัดเจน:
```
Unhandled Exception: Error: Publishable key is missing.
    at parsePublishableKey
```

`server/app.ts` เรียก `clerkMiddleware()` โดยไม่ส่ง options → ตัว middleware ไปหา `CLERK_PUBLISHABLE_KEY` ใน environment ซึ่ง **โปรเจกต์นี้ไม่เคยตั้งที่ไหนเลย** เพราะเอกสารและ Vercel ใช้ `VITE_CLERK_PUBLISHABLE_KEY` เท่านั้น → ทุก request ที่ผ่าน middleware จึงได้ 500

การแก้: เพิ่ม `resolveClerkPublishableKey()` ใน `server/lib/clerkAuth.ts` ให้รับได้ทั้ง `CLERK_PUBLISHABLE_KEY` และ `VITE_CLERK_PUBLISHABLE_KEY` แล้วส่งเข้า `clerkMiddleware({ publishableKey })` ตรง ๆ และ `isClerkConfigured()` บังคับให้มีทั้งสองส่วน เพื่อให้ deployment ที่ตั้งค่าไม่ครบ **ล้มตอน start ด้วยข้อความที่บอกชื่อตัวแปรครบ** แทนที่จะ 500 ทีละ request

### การยืนยันหลัง deploy (ทำจริงบน production)

```
/api/health  → 200 {"status":"ok"}
/api/ready   → 200 {"status":"ready","database":"connected"}
/api/auth/me → 401
HTML         → 1,797 ไบต์ (จาก 368,128) และไม่มี manus-runtime
entry bundle → โหลดได้ มี Clerk publishable key และอ้าง lazy chunk
lazy chunk   → Home-*.js = 200
log ใหม่     → ไม่มี exception
```

### บทเรียนสำคัญ

- **`pnpm check` + เทสต์ 175 รายการผ่าน ไม่ได้แปลว่า production ทำงาน** — บั๊กทั้งสองอยู่ในชั้นที่ไม่มีเทสต์ครอบ เพราะเทสต์รันด้วย `PUNTAKIT_TEST_AUTH=1` ซึ่งข้าม Clerk middleware ทั้งหมด และใช้ PGlite แทน Neon จริง
- ควรมี **smoke check ปลายทางหลัง deploy** (ข้อ 8.4) เพราะ downtime นี้กินเวลาหลายวันโดยไม่มีใครรู้
- `docs/DEPLOYMENT.md` และ `DEPLOYMENT_CHECKLIST_TH.md` มีขั้นตอนตรวจ 503 อยู่แล้ว แต่ยังไม่มีกลไกที่รันมันอัตโนมัติ
