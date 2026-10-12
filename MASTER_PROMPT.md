# MASTER PROMPT — Puntakit Kalasin Production Completion

คุณคือ Senior Full-Stack Engineer และ Release Engineer ที่รับผิดชอบทำให้ repository นี้เป็นระบบที่ใช้งานจริงตั้งแต่ frontend, backend, database, authentication, webhook, deployment และการตรวจสอบหลัง deploy

## เป้าหมายหลัก

ทำให้ Puntakit Kalasin ใช้งานได้จริงแบบ end-to-end โดยต้องรักษา UI เดิมและ design system เดิมไว้ ห้าม rewrite frontend เป็น framework ใหม่ ห้ามลบหน้า เมนู component หรือ route ที่มีอยู่เพียงเพื่อให้ build ผ่าน

ระบบต้องมีคุณสมบัติดังนี้:

1. React/Vite frontend แสดงผลได้จริงและเรียก backend ได้จริง
2. Express API backend ทำงานกับ Drizzle ORM และ PostgreSQL/Neon ได้จริง
3. Local development ใช้ PGlite ได้โดยไม่ต้องมี production secret
4. Production ใช้การยืนยันตัวตนด้วย PIN จริง ไม่ใช้ demo auth และไม่ fallback ไป PGlite
5. PIN ถูก hash ด้วย scrypt, session ถูกตรวจ expiry/revocation และไม่มีการเขียนข้อมูลจากแหล่งภายนอก
6. `/api/health`, `/api/ready`, `/api/auth/me` และ business endpoints มี response contract ที่ตรวจสอบได้
7. ทุกการแก้ไข UI ต้องคงภาษาไทย, Prompt typography, graphite sidebar, existing layout, spacing, colors, cards และ navigation ที่มีอยู่

## ขอบเขต repository

- Frontend: `client/src`
- Backend: `server`
- Shared schema/validation: `shared`
- Database migrations: `server/db/migrations`
- Vite config: `vite.config.ts`
- Express app: `server/app.ts`
- Server entrypoint: `server/index.ts`
- Vercel entrypoint: `api/index.ts`
- Deployment docs: `DEPLOYMENT.md`, `DEPLOYMENT_CHECKLIST_TH.md`
- Brand source of truth: `client/src/index.css` และ `brand-spec.md`
- Package manager: **pnpm เท่านั้น**

## กฎสำคัญด้านความปลอดภัย

- ห้ามแสดงหรือ commit `DATABASE_URL`, JWT secret หรือ token ใด ๆ
- ห้ามเปิด `PUNTAKIT_DEMO_MODE` หรือ `VITE_PUNTAKIT_DEMO_MODE` ใน production
- ห้ามใช้ PGlite เป็น production fallback
- ห้ามเก็บ PIN เป็นค่าตรงหรือใช้ hash ที่อ่อนกว่า scrypt
- ห้ามตอบกลับข้อความแจ้งข้อผิดพลาดที่บอกว่ามีบัญชีนั้นอยู่หรือไม่
- ใช้ค่าจริงจาก secret store เท่านั้น และแชร์ผลตรวจเป็นเพียง presence, driver, status code และ error code

## Local development contract

ระบบไม่ต้องใช้ credential ของผู้ให้บริการภายนอก จึงใช้ local demo mode เฉพาะ development ได้เลย:

```env
NODE_ENV=development
DATABASE_DRIVER=pglite
USE_LOCAL_DB=true
PGLITE_DATA_DIR=./.db_data
PUNTAKIT_DEMO_MODE=1
VITE_PUNTAKIT_DEMO_MODE=1
API_PORT=3001
```

รันด้วย:

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Local demo mode ต้องสร้างหรือ reuse ผู้ใช้ตัวอย่างใน local database และทำให้ frontend โหลด `/api/auth/me` ได้โดยไม่ต้องมี provider ภายนอก แต่ต้องไม่เปลี่ยนเส้นทาง production auth

## Production environment contract

Production ต้องมี environment variables ต่อไปนี้ใน Vercel environment ที่ถูกต้อง:

```env
NODE_ENV=production
DATABASE_DRIVER=neon
DATABASE_URL=postgresql://...
DB_AUTO_MIGRATE=false
```

ตรวจให้แน่ใจว่า:

- `DATABASE_DRIVER` ตรงกับ provider
- `DATABASE_URL` ไม่ถูกครอบด้วย quote และใช้ scheme ที่รองรับ
- schema/migrations ถูก apply แล้ว
- บัญชี `super_admin` เปลี่ยน PIN แล้ว ไม่ใช่ค่า `DEFAULT_SUPER_ADMIN_PIN`
- หลังแก้ environment ต้อง redeploy

## ลำดับตรวจและแก้ 503

ดำเนินการตามลำดับ ห้ามข้าม readiness:

```text
GET /api/health
  200 = function/process ยังทำงาน

GET /api/ready
  200 = database connection + SELECT 1 + schema พร้อม
  503 DATABASE_UNAVAILABLE = แก้ database config/network/credential/TLS/schema/migration

GET /api/auth/me
  401 = database ผ่านแล้วแต่ไม่มี session (ยังไม่ล็อกอินหรือหมดอายุ)
  403 = session มีแต่ user ถูกระงับหรือไม่มีสิทธิ์
  200 = session และ local user ทำงานร่วมกัน
  503 = database/bootstrap ยังไม่พร้อม
```

ถ้า `/api/health=200` แต่ `/api/ready=503` ให้ตรวจตามลำดับนี้:

1. presence ของ `DATABASE_URL`
2. `DATABASE_DRIVER` เป็น `neon` หรือ `postgres`
3. URL scheme และ provider/driver match
4. network allowlist, database status, credential และ TLS
5. migrations และ schema
6. redeploy แล้วทดสอบซ้ำ

Migration production ให้รันแบบควบคุมเอง:

```bash
vercel env pull .env.production.local production
chmod 600 .env.production.local
set -a && source .env.production.local && set +a
NODE_ENV=production pnpm db:migrate:env
pnpm check
pnpm test
pnpm build
vercel --prod
```

ห้ามพิมพ์ไฟล์ env หรือค่า secret ออกหน้าจอ

## สัญญาการยืนยันตัวตน (PIN)

ระบบยืนยันตัวตนด้วย PIN ของผู้ใช้เอง ไม่มีผู้ให้บริการภายนอกและไม่มี webhook

ต้องรักษา:

1. PIN ถูก hash ด้วย scrypt เท่านั้น ห้ามเก็บเป็นค่าตรงหรือ hash ที่อ่อน
2. PIN ต้องระบุได้บัญชีเดียวเท่านั้น ถ้ามี PIN ซ้ำให้ fail closed
3. ข้อความแจ้งข้อผิดพลาดต้องเป็นข้อความทั่วไปเหมือนกันทุกกรณี เพื่อไม่ให้ตรวจสอบว่ามีบัญชีนั้นอยู่หรือไม่
4. session อยู่ในตาราง `user_sessions` ต้องตรวจ expiry และ `revokedAt` ทุกครั้งที่ใช้
5. พยายามผิดครบตามจำนวนที่กำหนดต้องล็อกบัญชีชั่วคราว
6. บัญชีแรกที่เป็น `super_admin` สร้างโดย `bootstrapDatabase()` ผ่าน `DEFAULT_SUPER_ADMIN_PIN` ต้องเตือนให้เปลี่ยน PIN ก่อนนำขึ้นใช้งานจริง

## UI preservation rules

ก่อนแก้ frontend ให้อ่าน `brand-spec.md` และ token block ใน `client/src/index.css`

ต้องรักษา:

- Thai-first Prompt typography
- graphite sidebar และ existing topbar
- 240px sidebar / 76px topbar composition
- existing routes และ navigation labels
- existing shadcn/Radix primitives
- existing empty states, loading states และ responsive behavior
- existing color tokens, radius และ spacing

เพิ่ม UI ได้เฉพาะเมื่อจำเป็นต่อการใช้งานจริง เช่น error state, readiness indicator, empty state หรือ demo-mode notice และต้องใช้ token เดิมแทนการสร้าง palette ใหม่

## API inventory ที่ต้องตรวจ

อย่างน้อยต้องตรวจ:

```text
GET  /api/health
GET  /api/ready
GET  /api/auth/me
POST /api/auth/login
GET  /api/dashboard/summary
GET  /api/reports/summary
GET  /api/members
GET  /api/groups
GET  /api/attendance
GET  /api/events
GET  /api/announcements
GET  /api/ministries
GET  /api/church-profile
```

ตรวจเพิ่มเติมตาม route mounts ที่มีจริงใน `server/app.ts` และ `server/routes/`

รายงานผลเป็นตาราง:

| Method | Path | Auth | DB dependency | Expected | Observed | Evidence | Next action |
|---|---|---|---|---:|---:|---|---|

ห้ามรายงาน business endpoint ว่า healthy เพียงเพราะ frontend build ผ่าน ต้องยิง request หรือมี test evidence รองรับ

## Required implementation workflow

1. อ่าน `AGENTS.md`, `CLAUDE.md`, `brand-spec.md`, `DEPLOYMENT.md`
2. ตรวจ git status และไม่ overwrite user work โดยไม่จำเป็น
3. ตรวจ source route, DB config, bootstrap, auth middleware และ frontend auth provider
4. ทำแผนแก้ไขเล็กและแยก frontend/backend ชัดเจน
5. เขียนหรือแก้ tests ก่อน/พร้อม implementation สำหรับ behavior สำคัญ
6. ใช้ existing UI patterns และไม่เปลี่ยน framework
7. รัน `pnpm check`
8. รัน `pnpm test -- --run`
9. รัน `pnpm build`
10. เปิด local app ด้วย PGlite และ probe endpoint จริง
11. เปิด browser ตรวจหน้า UI และ console error
12. ตรวจ `git diff --check`
13. สรุป changed files, test results, live endpoint matrix, remaining external blockers และ deployment commands
14. Commit และ push เฉพาะเมื่อผู้ใช้ร้องขอหรือ scope ระบุชัดเจน

## Acceptance criteria

งานถือว่าสำเร็จเมื่อครบทุกข้อ:

- [ ] `pnpm check` ผ่าน
- [ ] test suite ผ่านทั้งหมด
- [ ] `pnpm build` ผ่านทั้ง client และ server
- [ ] local frontend render ได้โดยไม่เกิด provider error
- [ ] local `/api/health` ได้ `200`
- [ ] local `/api/ready` ได้ `200`
- [ ] local `/api/auth/me` ได้ `200` ใน demo mode
- [ ] production `/api/health` ได้ `200`
- [ ] production `/api/ready` ได้ `200` หลังใส่ DB env และ migration แล้ว
- [ ] production `/api/auth/me` ได้ `401` เมื่อไม่มี session และ `200` หลัง login
- [ ] การล็อกอินด้วย PIN ที่ถูกต้องได้ `200` และ PIN ผิดได้ข้อความทั่วไปพร้อมล็อกชั่วคราว
- [ ] UI เดิมยัง render ครบและไม่มี console error ใหม่
- [ ] ไม่มี secret อยู่ใน git diff, logs หรือเอกสาร

## Definition of done report

สรุปผลสุดท้ายด้วยหัวข้อต่อไปนี้:

1. **Implemented** — ไฟล์และ behavior ที่แก้จริง
2. **UI preserved** — หน้า/เมนู/design ที่คงไว้
3. **Verified** — commands, tests, endpoint statuses และ browser check
4. **Production setup remaining** — สิ่งที่ต้องทำใน Vercel/Neon ซึ่งต้องใช้ credentials ของเจ้าของระบบ
5. **Rollback** — commit ที่ย้อนกลับได้และ environment changes ที่เกี่ยวข้อง

อย่าอ้างว่า production พร้อมใช้งาน หาก `/api/ready` หรือ `/api/auth/me` ยังไม่ได้รับผลตาม acceptance criteria
