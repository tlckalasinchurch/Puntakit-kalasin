<!-- last_verified: 2026-10-07 · risks R11–R16 sync จาก tech-debt-tracker D39–D47 (fact-sheet รอบ 2026-10-07) -->
# Architecture

> **เอกสารนี้สะท้อนระบบจริง** ไม่ใช่ระบบที่อยากให้เป็น — ทุกข้อความมาจากโค้ดที่อ่านแล้ว
> **อ่านก่อน** เปลี่ยนโครงสร้าง, เพิ่ม route, แตะ DB หรือแตะ auth
> **SOT ของโค้ด:** `shared/schema.ts` (schema) · `client/src/index.css` (token) · `shared/roles.ts` (สิทธิ์)
> เอกสารนี้ **ชี้ path ไม่ทวนรายละเอียด** — รายละเอียดที่ทวนไว้จะเน่าเมื่อโค้ดเดิน
> อ้างอิงแนวคิด [arc42](https://docs.arc42.org/) แบบย่อ (12 หัวข้อ → 9 ที่มีความหมายจริงกับระบบขนาดนี้)

---

## 1. Introduction & Goals

Puntakit เป็น web app สำหรับบริหารคริสตจักรไทย — จัดการ **คน** (สมาชิก พันธกิจ การเยี่ยมติดตาม) ไม่ใช่จัดการธุรกรรม
ระบบมี 2 surface: **admin app** (เจ้าหน้าที่/ผู้นำ) และ **member PWA** (`/app/*` สำหรับสมาชิกทั่วไป)

**Goals ที่วัดได้ (Quality Requirements — เก็บเฉพาะที่ตรวจสอบได้จริง):**

| # | เป้า | ตรวจอย่างไร |
|---|---|---|
| Q1 | ข้อมูลสมาชิกไม่รั่วข้ามบทบาท — เบอร์โทร/อีเมลถูก mask ตาม role | `MEMBER_CONTACT_ROLES` gating: `members.ts:137`, `attendance.ts:144`, `care.ts:96` |
| Q2 | ใช้งานได้บนมือถือ 360px โดยไม่มีการเลื่อนแนวนอน | `ux-audit-regressions.test.ts` + `design.md` §8.3 |
| Q3 | โหมดมืดต้องไม่พังเมื่อเพิ่มหน้าใหม่ | `design-system-consistency.test.ts` (ห้ามคลาส palette) |
| Q4 | ทุก route ต้องมี test คู่กัน — ยังไม่ถึงเป้า: 21 test files / 19 modules, **5 modules ไม่มีคู่โดยตรง** | `vitest` include `server/**/*.test.ts` · ช่องว่าง = tracker D52 |
| Q5 | ตัวเลข/วันที่ต้องเป็นไทย (`th-TH`) | `ux-audit-regressions.test.ts` (Reports ≥5 `toLocaleString("th-TH")`) |

**Constraints (รวมจาก arc42 §2):** Vercel serverless (request cap 4.5 MB → ต้องมี Vercel Blob path สำหรับ upload), Clerk เป็น SaaS ที่จัดการ session, Neon = connectionless HTTP driver, pnpm + patched `wouter` (ห้ามเปลี่ยน package manager), ไม่มี ESLint (tsc คือด่านเดียว), กลุ่มผู้ใช้คือคริสตจักรไทย → UI ภาษาไทยเป็นค่าเริ่มต้น

**Stakeholders:** เจ้าหน้าที่คริสตจักร (ผู้ใช้หลัก) · ผู้นำแคร์/พันธกิจ (ใช้ `/care` บนมือถือ) · สมาชิก (member PWA) · ผู้ดูแลระบบ (1–2 คน — ดู §11 R1)

## 2. System Scope & Context

```
                        ┌───────────────────────────────┐
   ผู้ใช้ (เบราว์เซอร์/  │        Puntakit (Vercel)      │
   PWA มือถือ)  ────────▶│  static SPA  +  api/index.ts  │
                        │        (1 serverless fn)      │
                        └───┬───────────────┬───────────┘
                            │               │
              Clerk (SaaS)  │               │  Neon Postgres (prod)
              session cookie│               │  PGlite (test/dev)
              + webhook     │               │
                            ▼               ▼
                    ┌──────────────┐  ┌──────────────────┐
                    │ Clerk        │  │ Postgres         │
                    │ (identity)   │  │ (ข้อมูลคริสตจักร) │
                    └──────┬───────┘  └──────────────────┘
                           │ POST /api/webhooks/clerk (Svix-signed)
                           └──────────▶

   Vercel Blob ── ไฟล์ Excel นำเข้า > 4.5 MB (BLOB_READ_WRITE_TOKEN)
   Map tiles ──── basemaps.cartocdn.com · tile.openstreetmap.org (Leaflet)
   Google Fonts ─ fonts.googleapis.com / gstatic.com (Prompt)
```

**ไม่มี** message queue, cache layer, cron, microservice, หรือ service อื่น — เป็น monolith 2 กระบวนการ (static + 1 function)

### Deployment View (รวมไว้ที่นี่ — ระบบมี topology แค่นี้จริง)

| Environment | Client | API | DB | Identity |
|---|---|---|---|---|
| Production | Vercel static (`dist/public`) | `api/index.ts` (maxDuration 60) | Neon (serverless HTTP) | Clerk |
| Local dev | Vite dev server (`:3000`) | `server/index.ts` via tsx (`API_PORT=3001`) | PGlite (`./.db_data`) หรือ Neon | Clerk หรือ demo mode |
| CI | ไม่ build เป็น artifact ที่ deploy | ไม่รัน | **PGlite fallback** | **ไม่ถูกแตะเลย** (`PUNTAKIT_TEST_AUTH=1`) |
| Test | — | in-process supertest | PGlite (migrate ทุกครั้ง) | cookie/JWT ปลอมที่เซ็นในเครื่อง |

> ⚠️ **CI ไม่เคยแตะ Clerk จริงหรือ Neon จริง** → ความล้มเหลวระดับ integration ไม่ถูกจับใน CI (ดู §11 R6)

## 3. Solution Strategy

การตัดสินใจ 8 ข้อที่กำหนดรูปร่างของระบบ (รายละเอียดเชิงเหตุผลอยู่ใน [`docs/adr/`](./docs/adr/))

| # | การตัดสินใจ | ผลที่ตามมา |
|---|---|---|
| S1 | **Drizzle schema เดียว** ที่ `shared/schema.ts` ใช้ทั้ง server และ type ฝั่ง client | ไม่มี type คู่ขนานที่เพี้ยนจากกัน |
| S2 | **หนึ่ง domain = หนึ่ง route module + `.test.ts` คู่กัน** (19 modules) | หาโค้ดเจอง่าย, test อยู่ชิดโค้ด |
| S3 | **Express เดียว** ครอบทั้ง self-host และ serverless ผ่าน `api/index.ts` | logic เดียวกัน 2 ทางรัน ไม่ต้องมี serverless adapter |
| S4 | **path alias** `@/*` (client) และ `@shared/*` (shared) | `vite.config.ts` + `tsconfig.json` ต้อง sync กัน |
| S5 | **Clerk เป็น identity เดียว** + map ลงตาราง `users` ของเราเอง (ไม่ใช้ Clerk เป็น DB ผู้ใช้) | ได้ role/audit ของเรา แต่ต้องมี webhook sync |
| S6 | **Authorization ที่ server เสมอ** ด้วย role sets จาก `shared/roles.ts` | client ซ่อน UI ได้ แต่ไม่มีผลต่อความปลอดภัย |
| S7 | **โหมดมืด = token remap** ที่ `.dark` ไม่ใช่ override | หน้าใหม่ได้โหมดมืดฟรีถ้าใช้ token |
| S8 | **Design token contract ถูกบังคับด้วย test** (`design-tokens.test.ts`) | การเปลี่ยนพาเลตต์ต้องตั้งใจ ไม่ใช่พลาด |

## 4. Building Block View

### Level 1 — ระบบโดยรวม

| Block | รับผิดชอบ | path |
|---|---|---|
| **SPA** | UI + client routing (wouter) + state | `client/src/**` |
| **API** | HTTP, auth, validation, business logic | `server/**` |
| **Shared** | schema, validation, roles, labels ที่ใช้ร่วม | `shared/**` |
| **Serverless entrypoint** | bootstrap DB ต่อ lambda + ส่งทุก `/api/*` เข้า Express | `api/index.ts` |
| **Data** | Postgres ผ่าน Drizzle | `server/db/**` |

### Level 2 — API (19 route modules, 97 endpoints)

Mount order จริงจาก `server/app.ts:107-124` — ก่อนหน้านั้นมี `requestId` (`:40`), raw-body webhook (`:42-46`), `express.json` (`:47`), cookie parser (`:48-58`), `/api/health` (`:62`), และ `clerkMiddleware` (`:103`)

| # | mount | module | guard ระดับ router | หมายเหตุ |
|---|---|---|---|---|
| — | `/api/webhooks` | `clerkWebhook` | — (Svix signature) | **ต้องมาก่อน `express.json`** |
| 1 | `/api/auth` | `auth` | inline `requireAuth` | |
| 2 | `/api/dashboard` | `dashboard` | `requireAuth` | `/operations` เพิ่ม `requireRole(PRIVILEGED)` |
| 3 | `/api/reports` | `reports` | `requireAuth` + `requireRole(PRIVILEGED)` | CSV export 4 ตัว |
| 4 | `/api/members` | `members` | `requireAuth` | contact masking ใน handler |
| 5 | `/api/groups` | `groups` | `requireAuth` | ownership check ใน handler |
| 6 | `/api/activities` | `activities` | `requireAuth` | `canManage` ใน handler |
| 7 | `/api/follow-ups` | `followUps` | `requireAuth` | `canAccess` ใน handler |
| 8 | `/api/submissions` | `submissions` | `requireAuth` | reviewer check ใน handler |
| 9 | `/api/attendance` | `attendance` | `requireAuth` + `requireRole(ADMIN_SHELL)` | |
| 10 | `/api/import` | `import` | `requireAuth` | `requireImportReader` + `requireAdmin` |
| 11 | `/api/org-data` | `orgData` | `requireAuth` + `requireRole(ADMIN)` | |
| 12 | `/api/org` | `org` | `requireAuth` + `requireRole(PRIVILEGED)` | |
| 13 | `/api/care` | `care` | `requireAuth` + `requireRole(CREATE)` | ผูกกับ Clay surface |
| 14 | **`/api/me`** | **`portal`** | `requireAuth` เท่านั้น | member PWA — ชื่อ module ≠ mount path |
| 15 | `/api/announcements` | `announcements` | `requireAuth` | |
| 16 | `/api/events` | `events` | `requireAuth` | |
| 17 | `/api/ministries` | `ministries` | `requireAuth` | |
| 18 | `/api/church-profile` | `churchProfile` | `requireAuth` | |
| — | `/api/health` `:62` · `/api/ready` `:127` · `ALL /api/*` 404 `:153` | — | — | |

**การป้องกันมี 3 ชั้น** (สำคัญ — guard ระดับ router ไม่พอ):
1. **Router-level** — `router.use(requireAuth)` ทุก module
2. **Per-route** — `requireRole(...)` เฉพาะ endpoint ที่ต้อง (เช่น `POST /api/members` = `MEMBER_CREATE_ROLES`)
3. **In-handler ownership / field-level** — `verifyGroupManagementAccess` (`groups.ts:81`), `canManage` (`activities.ts:80`), `canAccess` (`followUps.ts:56`), `getLedGroupIds` (`lib/groupAccess.ts:20`), contact masking ตาม role

### Level 2 — Data (24 ตาราง)

**ไม่มี native PG enum** — `pgEnum` = 0 ที่ทั้งเรพ enum ทั้งหมดเป็น `text("col", { enum: [...] })` + TS union ⇒ **ไม่มีการบังคับค่าที่ระดับฐานข้อมูล**

| กลุ่ม | ตาราง |
|---|---|
| **Identity / audit** | `users` · `user_sessions` (legacy) · `audit_logs` |
| **Core domain** | `members` · `groups` · `group_members` · `attendance_records` · `events` · `event_registrations` · `announcements` · `ministries` · `church_profile` |
| **Ministry OS** | `mission_activities` (**object แกน**) · `mission_activity_participants` · `mission_activity_media` · `follow_ups` · `mission_submissions` |
| **Member portal** | `prayer_requests` · `push_subscriptions` |
| **Import pipeline (L1/L2)** | `import_batches` · `import_source_rows` (verbatim, append-only) · `normalization_rules` (versioned) · `import_row_norm` · `import_duplicate_decisions` (append-only) |

> **Feed / Timeline / Map / Operations ไม่มีตารางของตัวเอง** — เป็น *lens* เหนือ `mission_activities` (design note `shared/schema.ts:454-456`)

รายละเอียดคอลัมน์/FK → `shared/schema.ts` (SOT) · migration 11 ตัว → `server/db/migrations/` + `meta/_journal.json`

## 5. Runtime View

### Scenario A — คำขอ CRUD ที่ต้องยืนยันตัวตน (เส้นทางหลัก)

1. SPA เรียก `fetch` แบบ **same-origin พร้อม `credentials: "include"`** (`client/src/lib/api.ts:111`) — **ไม่มี `Authorization` header ที่ไหนในเรือนี่เลย** ⇒ Clerk **session cookie** คือ transport
2. Vercel rewrite `/api/:path*` → `/api` ส่งเข้า `api/index.ts`
3. `api/index.ts` รอ `ensureBootstrap()` (memoised ต่อ lambda instance) — ล้มเหลว ⇒ ตอบ 503 `DATABASE_UNAVAILABLE` ทันที
4. ส่งเข้า Express → `requestId` middleware ออก id + เริ่มจับเวลา → `express.json`
5. `clerkMiddleware({ publishableKey: resolveClerkPublishableKey() })` อ่าน cookie → `getAuth(req)`
6. `requireAuth` เลือกสาขา: **demo → Clerk → legacy test → 401**
   สาขา Clerk: `clerkClient.users.getUser()` → `provisionClerkUser` (resolve 3 ขั้น: `clerkId` → email ถ้ายังไม่มี clerk_id → สร้างใหม่ role `member`) → `status=suspended` ⇒ 403 → bootstrap admin ถ้า email ยืนยันแล้วและอยู่ใน allow-list
7. `requireRole` / ownership check ใน handler
8. Zod validation จาก `shared/validation.ts` → ล้ม ⇒ `sendValidationError`
9. query ผ่าน Drizzle ตาม driver ที่เลือกไว้
10. ตอบด้วย envelope เดียว → `requestId` log JSON 1 บรรทัดเมื่อ response จบ

### Scenario B — ผู้นำแคร์เช็คชื่อ (เส้นทางที่มีความเสี่ยง date-only)

1. เปิด `/care` (Clay surface) → `GET /api/care/groups` → เลือกกลุ่ม → `GET /api/care/groups/:id/roster?date=YYYY-MM-DD`
2. `care.ts:46` ตรวจรูปแบบวันที่ด้วย regex `^\d{4}-\d{2}-\d{2}$`
3. นับ "ขาดติดกัน" ด้วย day key ที่คำนวณแบบ **UTC** — `care.ts:26` `new Date(d).toISOString().slice(0,10)`, `care.ts:70` `to_char(date,'YYYY-MM-DD')`
4. บันทึกด้วย `POST /api/attendance/bulk` (`requireRole(CREATE_ROLES)`)
5. `attendance.ts:195-199` สร้างหน้าต่าง "วันเดียวกัน" ด้วย **local-time setters** (`setHours(0,0,0,0)` / `setHours(23,59,59,999)`)
6. ⚠️ **ความไม่สอดคล้อง:** ขั้น 3 ใช้ UTC แต่ขั้น 5 ใช้ local time และค่าถูกเก็บเป็น `timestamp with time zone` แม้ความหมายเป็น "วันตามปฏิทิน" ⇒ **วันที่อาจเลื่อน 1 วันใน timezone ตะวันตกของ UTC** — พิสูจน์แล้วและมี reproduction ใน [`docs/PUNTAKIT_FOUNDATION_INVENTORY.md`](./docs/PUNTAKIT_FOUNDATION_INVENTORY.md) §0 F1 (tech-debt T1/T2)

### Scenario C — ความล้มเหลว

| กรณี | พฤติกรรม |
|---|---|
| DB bootstrap ล้ม (Vercel) | 503 `DATABASE_UNAVAILABLE` — memoised promise ถูก reset ให้ cold start ถัดไปลองใหม่ (`api/index.ts:27-35`) · `/api/health` **ไม่ถูก gate** เพื่อให้ liveness ยังตอบได้ |
| DB bootstrap ล้ม (self-host) | `server/index.ts:15-20` await ก่อน listen → ล้ม ⇒ log + `exit(1)` (`:79-83`) |
| Session หมดอายุ (client) | 401 (ยกเว้น `/api/auth/me`) ⇒ ยิง `UNAUTHORIZED_EVENT` ที่ throttle 5 วินาที (`lib/api.ts:93-104`) ⇒ `AuthContext` re-sync แทนการวน redirect |
| Webhook signature ผิด | 400 `INVALID_CLERK_WEBHOOK` · ไม่ตั้ง secret ⇒ 503 `CLERK_WEBHOOK_NOT_CONFIGURED` |
| Error ที่ไม่คาดคิด | central handler → 500 `INTERNAL_SERVER_ERROR` (`details` เฉพาะ non-production) |
| Shutdown (self-host) | `SIGINT`/`SIGTERM` → `server.close()` → `closeDatabase()` ภายใน 10s (`SHUTDOWN_TIMEOUT_MS`) เกิน ⇒ `exit(1)` · **Vercel: ไม่มี shutdown hook — `NOT VERIFIED` ว่า Vercel drain DB handle ให้หรือไม่** |

## 6. Crosscutting Concepts

| เรื่อง | กลไก | ที่อยู่ |
|---|---|---|
| **Validation** | Zod ทั้งระบบ — schema กลางไม่เขียนซ้ำในหน้า | `shared/validation.ts` · `server/lib/errors.ts:102` |
| **Error envelope** | `{success:false, error:{code, message, details?}}` รวมที่ central handler | `server/app.ts:164-192` · `server/lib/errors.ts:3-18` |
| **Success envelope** | `{success:true, data}` (+ `message?`, `meta?` สำหรับ paging) | `server/app.ts:63` · `activities.ts:294` |
| **Identity** | Clerk session cookie + map ลง `users` (3 ขั้น) + webhook sync | `server/lib/clerkAuth.ts:51-192` |
| **Authorization** | 9 role sets + `hasRole()` ใช้ร่วม server/client | `shared/roles.ts` |
| **Ownership** | `groupAccess.ts` + helper ใน handler (ชั้นที่ 3 ของการป้องกัน) | `server/lib/groupAccess.ts` |
| **Audit** | `logAudit()` เขียนลง `audit_logs` (ล้มเหลวไม่ทำ request พัง) | `server/lib/audit.ts:14-34` |
| **Observability** | access log JSON 1 บรรทัด/request + `X-Request-Id` · **ไม่มี redaction** | `server/middleware/requestId.ts:13-41` |
| **Migrations** | PGlite migrate อัตโนมัติ · remote ต้อง `DB_AUTO_MIGRATE=true` หรือ `pnpm db:migrate` | `server/db/bootstrap.ts:49` |
| **i18n** | ไทยเป็นค่าเริ่มต้น · `<html lang="th">` · `th-TH` number formatting · Clerk `clerkThTH` | `client/index.html` · `client/src/App.tsx:257` |
| **Design token** | CSS custom property + **test ทำหน้าที่เป็น linter** | `client/src/index.css` · `design-tokens.test.ts` |
| **Testing** | Vitest + PGlite in-process · test ชิดโค้ด · 7 ไฟล์ audit-as-code | `vitest.config.ts` |

## 7. API contract (สรุปที่ต้องรู้ก่อนแก้)

- **Envelope เดียว** — `{success:true,data}` / `{success:false,error:{code,message,details?}}`
- **ErrorCode union (10):** `VALIDATION_ERROR` `UNAUTHORIZED` `FORBIDDEN` `ACCOUNT_SUSPENDED` `ACCOUNT_LINK_CONFLICT` `NOT_FOUND` `CONFLICT` `RATE_LIMIT_EXCEEDED` `BAD_REQUEST` `INTERNAL_SERVER_ERROR` (`server/lib/errors.ts:3-18`)
- **Code นอก union** (ตั้งใจ/มีอยู่จริง): `DATABASE_UNAVAILABLE` · `CLERK_WEBHOOK_NOT_CONFIGURED` · `INVALID_CLERK_WEBHOOK`
- **ไม่ต้องยืนยันตัวตนโดยเจตนา:** `/api/health` (liveness — เหตุผลในคอมเมนต์ `app.ts:60-61`) · `/api/webhooks/clerk` (Svix signature) · `/api/*` 404 catcher
  `/api/ready` ไม่มี guard และ**ไม่มีคอมเมนต์อธิบาย** → **NOT VERIFIED** (tech-debt D41)
- **Body parsing พิเศษ:** webhook = `express.raw` **ก่อน** `express.json` (Svix ต้องได้ raw byte) · `/api/import/upload` = `express.raw` ระดับ route (limit 120 MiB) เพราะ Vercel จำกัด request 4.5 MB จึงมีเส้นทาง Vercel Blob แยก
- ⚠️ **Deviation:** `announcements.ts:23,56,66` · `events.ts:23,53,63` · `ministries.ts:23,53,63` ส่ง `error` เป็น **string** ไม่ใช่ object → ขัดสัญญา (tech-debt D39, ถูก pin ไว้ที่ `server/routes/validationEnvelope.test.ts:62-75`)

## 8. Architecture Decisions (ADR)

ดัชนีอยู่ที่ [`docs/adr/README.md`](./docs/adr/README.md) · บันทึกที่มีแล้ว: [ADR-000 Clerk](./docs/adr/adr-000.md) · [ADR-001 โหมดมืดเป็น token remap](./docs/adr/adr-001.md)
**กติกา:** ADR เป็น append-only — ตัดสินใจใหม่ให้เขียนไฟล์ใหม่แล้วตั้ง `superseded by` ในไฟล์เก่า (ดู `docs/adr/README.md`)

## 9. Risks & Technical Debt

รายการเต็มพร้อมทางแก้อยู่ที่ [`docs/exec-plans/tech-debt-tracker.md`](./docs/exec-plans/tech-debt-tracker.md) — สรุปความเสี่ยงระดับระบบ:

| # | ความเสี่ยง | หลักฐาน |
|---|---|---|
| R1 | **Bus factor 1** — ผู้ดูแล 1–2 คน ไม่มีเอกสาร handover สำหรับ ops | ประเมินจากบริบท; จำนวนผู้ดูแล = **NOT VERIFIED** |
| R2 | **date-only round-trip ผ่าน local-time getters** — คลาสของ bug ที่เกิดซ้ำได้ (มี 16 คอลัมน์ที่ความหมายเป็นวันตามปฏิทิน) | `attendance.ts:195-199` vs `care.ts:26,70` · inventory §0 F1 |
| R3 | **test suite ไม่ทน timezone** (แดงที่ UTC-3 เขียวที่ UTC) | พิสูจน์ด้วย `TZ` experiment — inventory §0 |
| R4 | **`tsconfig.json` ตัด `**/*.test.ts` ออก** ⇒ `pnpm check` **ไม่ตรวจ type ของ test** | `tsconfig.json:3` · tracker D48 |
| R5 | **ไม่มี rate limiting ที่ถูก mount** — `loginRateLimiter` เป็น dead code | `server/middleware/rateLimit.ts:43-47`, grep ทั้งเรพ = 0 การใช้งาน · tracker D45 |
| R6 | **CI ไม่เคยแตะ Clerk จริง/Neon จริง** — integration failure ไม่ถูกจับ | `vitest.config.ts:8` (`PUNTAKIT_TEST_AUTH=1`) + CI ไม่มี secrets · tracker D50 |
| R7 | **PGlite ≠ Postgres จริง** — พฤติกรรมต่างกัน (constraint, type, timezone) | ใช้ PGlite ทั้ง test และ dev fallback |
| R8 | **Access log ไม่มี redaction** — `url` รวม query string | `server/middleware/requestId.ts:26` · tracker D49 |
| R9 | **ไม่มี native enum ⇒ DB ไม่กันค่าที่ไม่ถูกต้อง** | `pgEnum` = 0 ที่ · tracker D43 |
| R10 | **หนี้ UI จาก audit รอบ 3** (contrast, safe-area, dead CSS, a11y roles) — ตัวเลข 13 รายการในประโยคเดิมล้าสมัยแล้ว ปัจจุบัน tracker เปิดหนี้ UI/A11y ไว้ D1–D20+ | UX/UI audit รอบ 3 + `docs/exec-plans/tech-debt-tracker.md` D1–D20 |
| R11 | **Envelope แตก 3 โมดูล** — `announcements.ts`, `events.ts`, `ministries.ts` ส่ง `error` เป็น string ไม่ใช่ object; client ที่อ่าน `error.code` พังเฉพาะ route เหล่านี้ | `announcements.ts:23,53,63` ฯลฯ · ถูก pin ที่ `server/routes/validationEnvelope.test.ts:62-75` · tracker D39 🟠 P1 |
| R12 | **Blob handshake ไม่ผ่าน envelope** — `POST /api/import/upload/token` คืนผล `handleUpload` ตรง ๆ | `server/routes/import.ts:361-363` → `server/lib/importBlob.ts:23` · tracker D40 🟡 P2 |
| R13 | **`/api/ready` ไม่มี auth guard และไม่มีคอมเมนต์เหตุผล** — เหตุผลเป็น NOT VERIFIED | `server/app.ts:127` · tracker D41 🟡 P2 |
| R14 | **Pending migration นอก chain** — `server/db/pending/0010_group_members_history.sql` ไม่มี journal entry; ชื่อชนกับลำดับ migration จริง (`0009`→`0010`) เสี่ยงรันผิด/มองข้าม | ไฟล์มีจริง + `pendingMigration0010.test.ts` เป็นผู้รันเดียว · tracker D42 · domain plan §13 🟡 P2 |
| R15 | **Legacy cookie/JWT branch ปลอม `super_admin` ได้ถ้าหลุดไป prod** — กันด้วย hard-gate 2 ชั้นอยู่แล้ว ห้ามแตะ | `server/middleware/auth.ts:48-58,117-153` + `server/app.ts:79-88` · tracker D44 🟠 P1 |
| R16 | **Env drift — โค้ดอ่านแต่ `.env.example` ไม่มี** (`PUNTAKIT_TEST_AUTH` · `JWT_SECRET` · `BOOTSTRAP_ADMIN_EMAILS` · `BLOB_READ_WRITE_TOKEN` · `PORT` · `PROBE_BASE_URL`) + ประกาศ analytics 2 ตัวที่ไม่มีโค้ดอ่าน | `.env.example` (77 บรรทัด, ไม่มี 6 ตัว) vs `server/lib/auth.ts:36`, `bootstrapAdmin.ts:21`, `importBlob.ts:15`, `probe-api.ts:11` · tracker D46–D47 🟠 P1 / 🟢 P3 |

## 10. Glossary (ไทย ↔ อังกฤษ)

คำเหล่านี้ **ห้ามแปลกลับ** — โค้ดใช้ค่าอังกฤษ ฐานข้อมูลเก็บค่าอังกฤษ มีเฉพาะข้อความ UI ที่เป็นไทย (`shared/orgView.ts` แปลงกลับสองค่า: `รหัสแคร์`, `หนค. (ต้นฉบับ)`)

| ไทย (UI) | อังกฤษ (โค้ด/DB) | ความหมาย |
|---|---|---|
| พันธกิจ | `care` (`org_level='care'`) | กลุ่มดูแล — หน้าจอ `/groups` |
| บอดี้ | `body` (`org_level='body'`) | ระดับเหนือพันธกิจขึ้นไป |
| ฝ่ายงาน | `ministry` | ทีมงาน — `/ministries`, ตาราง `ministries` |
| สมาชิก | `member` | บุคคลในระบบ |
| การเช็คชื่อ / เข้าร่วม | `attendance` / `present\|absent\|leave\|online` | บันทึกการเข้าร่วม |
| ติดตาม / เยี่ยม | `follow-up` / `follow_ups` | งานที่ต้องทำต่อ |
| คำขออธิษฐาน | `prayer_request` | จาก member portal |
| กิจกรรมพันธกิจ | `mission_activity` | object แกนของ Ministry OS |
| กล่องงาน / รับเข้า | `submission` / Mission Inbox | ข้อมูลดิบที่ยังไม่เป็นทางการ |
| ผู้นำแคร์ | `group_leader` | role |
| ผู้ดูแลระบบ | `admin` / `super_admin` | role |
| ศิษยาภิบาล | (ไม่มีในโค้ด) | ใช้ในข้อความ UI เท่านั้น |

---

## ภาคผนวก — สิ่งที่ยัง **NOT VERIFIED**

1. Vercel drain DB handle ของ `api/index.ts` ให้หรือไม่ (ไม่มี shutdown hook ในไฟล์นั้น)
2. รูปร่าง response ของ Vercel Blob `handleUpload` ที่ `POST /api/import/upload/token` คืน (ไม่ผ่าน envelope — ไม่ได้อ่าน library)
3. เหตุผลที่ `/api/ready` ไม่มี auth guard (ไม่มีคอมเมนต์ในโค้ด)
4. จำนวน assertion ที่รันจริงของ guard test ที่ใช้ loop (นับได้แค่ `expect(` แบบ static)
5. จำนวนผู้ดูแลระบบจริง / จำนวนผู้ใช้ / SLA (ไม่มีการบันทึกไว้ที่ใด)

**หมายเหตุเรื่อง test baseline:** `40 ไฟล์ / 506 tests` เป็นค่าที่ **รันจริงและยืนยันแล้ว** ในสภาพแวดล้อมนี้ที่ `TZ=UTC` (ไม่ใช่การประมาณ) — ดู [`docs/PUNTAKIT_FOUNDATION_INVENTORY.md`](./docs/PUNTAKIT_FOUNDATION_INVENTORY.md) §0
