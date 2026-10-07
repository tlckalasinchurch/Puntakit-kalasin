<!-- last_verified: 2026-10-07 -->
# Puntakit Kalasin — Ministry Operating System

เว็บแอปบริหารคริสตจักรภาษาไทยเป็นหลัก (Thai-first) สำหรับ **คริสตจักรชีวิตสุขสันต์กาฬสินธุ์**
ใช้ภายในองค์กร ไม่ใช่ SaaS สาธารณะ — ข้อมูลเป็นข้อมูลส่วนบุคคลของสมาชิกคริสตจักร จึงต้องถือความปลอดภัยเป็นเงื่อนไขสำคัญ

> **เอกสารนี้เป็นทางเข้าสำหรับมนุษย์** · ถ้าเป็น AI agent ให้เริ่มที่ [`AGENTS.md`](./AGENTS.md) แทน
> แผนที่เอกสารทั้งหมดอยู่ที่ [`docs/README.md`](./docs/README.md)

---

## ระบบนี้ทำอะไร

**CURRENT (มีอยู่จริงในโค้ด):** People (`members`) · Groups (พันธกิจ/บอดี้) · Attendance · Events · Announcements · Ministries (ฝ่ายงาน) · Church profile · Reports · Map
และชั้น Ministry OS: Ministry Activity · Feed · Timeline · Mission Inbox · Follow-up · Operations (`/`)
**TARGET (ยังไม่ทำ):** Notifications · cross-domain Search · Administration/RBAC UI
`MissionActivity` ใน `shared/schema.ts` คือ object แกน — Feed/Timeline/Map/Operations เป็น *lens* ที่มอง object เดียวกัน ไม่ใช่ตารางแยก

รายละเอียดผลิตภัณฑ์ → [`PRD.md`](./PRD.md) · สถาปัตยกรรม → [`ARCHITECTURE.md`](./ARCHITECTURE.md)

---

## Tech stack

| ชั้น | เทคโนโลยี |
|---|---|
| Frontend | React 19 + Vite 7 + **wouter** (client-side routing เท่านั้น — **ไม่ใช่ Next.js**) + Tailwind v4 (CSS-first) + shadcn/ui (Radix) |
| Backend | Express 4 + TypeScript, mount เป็น **Vercel serverless function** ผ่าน `api/index.ts` |
| Database | PostgreSQL ผ่าน **Drizzle ORM** — prod = **Neon** (serverless HTTP), test = **PGlite** (embedded) |
| Auth | **Clerk** (production) + cookie/JWT สำหรับ route test (`PUNTAKIT_TEST_AUTH=1`) |
| Test | Vitest + PGlite — **40 ไฟล์ / 506 tests** |
| Package manager | **pnpm** (`packageManager: pnpm@10.4.1`) — มี patch ของ `wouter` ผ่าน `patchedDependencies` **ห้ามเปลี่ยน package manager** |
| Host | Vercel (static client + 1 serverless function), CI = GitHub Actions Node 24 |

---

## โครงสร้าง source

```
client/src   → SPA  (alias @/*)        107 .tsx · 53 ui primitives · 30 pages
server/      → Express API (relative imports, ไม่อยู่ใน Vite build graph)
shared/      → schema + validation + roles + labels  (alias @shared/*)
api/index.ts → Vercel serverless entrypoint
```

**3 source roots นี้ผูกกันด้วย path alias** — `vite.config.ts` และ `tsconfig.json` ต้องสอดคล้องกันเสมอ ถ้าแก้ alias ต้องแก้ทั้งคู่

---

## เริ่มใช้งาน

```bash
pnpm install          # ติดตั้ง deps (patch ถูก apply อัตโนมัติ)
pnpm dev              # รัน Vite dev server + Express API พร้อมกัน
pnpm build            # vite build (client → dist/public) + esbuild (server → dist/index.js)
pnpm start            # NODE_ENV=production node dist/index.js
pnpm check            # tsc --noEmit — การตรวจ static หลักของโปรเจกต์
pnpm test             # vitest run
pnpm format           # prettier --write .
pnpm probe:api        # ยิงตรวจ API
pnpm db:generate      # drizzle-kit generate
pnpm db:push          # drizzle-kit push
pnpm db:migrate       # apply migrations (อ่าน .env.local)
```

**ต้องมี `.env.local`** — ไม่มีแล้ว API จะ throw ตอน start และ `App.tsx` จะ throw ก่อน render
รายการ env var ทั้งหมด → [`.env.example`](./.env.example) และ [`DEPLOYMENT.md`](./DEPLOYMENT.md)
รันแบบไม่มี credential ของ Clerk ได้ (demo mode) → ดู [`docs/PUNTAKIT_AGENT_GUIDE.md`](./docs/PUNTAKIT_AGENT_GUIDE.md)

⚠️ **กับดักที่เจอบ่อย — พอร์ตชนกัน:** `server/index.ts` ฟัง `PORT || API_PORT || 3000` ขณะที่ Vite dev server ก็ default `3000` และ proxy `/api` ไป `API_PORT || 3001`
→ **ต้องตั้ง `API_PORT=3001`** ไม่งั้นสองโปรเซสแย่งพอร์ตกันและ proxy จะชี้กลับมาที่ Vite เอง

---

## Quality gate — คำสั่งเดียวที่ต้องเขียวก่อน merge

```bash
pnpm install --frozen-lockfile && pnpm check && pnpm test && pnpm build
```

นี่คือชุดเดียวกับที่ `.github/workflows/ci.yml` รันบน **Node 24 / ubuntu-latest**
- **ไม่มี ESLint** ในโปรเจกต์นี้ — `pnpm check` (TypeScript) คือการตรวจ static อย่างเดียว
- `pnpm build` อยู่ใน gate เพราะการเปลี่ยนที่ type-check ผ่านแต่ bundle ไม่ได้ (alias พัง, Vite plugin ไม่รองรับ, asset หาย) จะไปพังตอน deploy แทน — ดู `docs/PUNTAKIT_SESSION_REPORT_2026-09-30.md` §9
- รัน test ที่ **`TZ=UTC`** ให้ตรงกับ CI (ดู [`docs/PUNTAKIT_FOUNDATION_INVENTORY.md`](./docs/PUNTAKIT_FOUNDATION_INVENTORY.md) §0 — suite นี้ไวต่อ timezone)

---

## เอกสาร

| อยากรู้อะไร | อ่าน |
|---|---|
| ผลิตภัณฑ์ทำอะไร เพื่อใคร | [`PRD.md`](./PRD.md) |
| ระบบทำงานอย่างไร | [`ARCHITECTURE.md`](./ARCHITECTURE.md) |
| UI ต้องเป็นอย่างไร | [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) |
| กฎการออกแบบฉบับละเอียด | [`design.md`](./design.md) · [`brand-spec.md`](./brand-spec.md) |
| AI agent ต้องทำงานอย่างไร | [`AGENTS.md`](./AGENTS.md) |
| แผนที่เอกสารทั้งหมด | [`docs/README.md`](./docs/README.md) |
| Deploy / env / 503 | [`DEPLOYMENT.md`](./DEPLOYMENT.md) · [`DEPLOYMENT_CHECKLIST_TH.md`](./DEPLOYMENT_CHECKLIST_TH.md) |
| Domain model + schema | [`docs/PUNTAKIT_MISSION_DOMAIN_PLAN.md`](./docs/PUNTAKIT_MISSION_DOMAIN_PLAN.md) |
| UX/UI audit ล่าสุด | [`docs/PUNTAKIT_UX_UI_AUDIT_2026-10-07.md`](./docs/PUNTAKIT_UX_UI_AUDIT_2026-10-07.md) |

---

## กฎเหล็ก 5 ข้อ

1. **Source of truth เรียงตาม:** production behavior → source code → DB schema/migration → tests → เอกสาร → audit → assumption (ตรวจไม่ได้ = `NOT VERIFIED` ห้ามเดา)
2. **Token SOT = `client/src/index.css` `:root`** — ถ้าเอกสารขัดกับ CSS ให้ยึด CSS
3. **Schema SOT = `shared/schema.ts`** — migration อยู่ใน `server/db/migrations` ห้ามแก้ DB นอกเส้นทางนี้
4. **ห้าม hardcode สี** — ใช้ `var(--color-*)` เท่านั้น ไม่งั้นหน้าที่ใช้ palette ดิบจะพังในโหมดมืดทันที (โหมดมืดคือ *token remap* ที่ `.dark` ไม่ใช่ override)
5. **สีตามสถานะห้ามเปลี่ยนความหมาย** — success/warning/error/info มีความหมายตายตัว

License: **MIT**
