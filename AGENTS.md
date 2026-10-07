<!-- last_verified: 2026-10-07 -->
# AGENTS.md

> **ไฟล์นี้คือ control surface สำหรับ coding agent ทุกตัว — อ่านก่อนเริ่มงานใด ๆ**
> เป็น **สารบัญ + กฎ** ไม่ใช่สารานุกรม: เนื้อหาลึกอยู่ในเอกสารที่ลิงก์ไว้ **ห้ามคัดลอกเนื้อหามาที่นี่**
> "Repository knowledge is the system of record — สิ่งที่ agent หาไม่เจอ = ไม่มีอยู่"

**บรรทัดเดียวที่ต้องจำ:** `pnpm install --frozen-lockfile && pnpm check && pnpm test && pnpm build` ต้องเขียวทั้งหมดก่อน merge

---

## 1. เอกสารที่ต้องอ่าน (progressive disclosure — อ่านเท่าที่งานต้องใช้)

| ลำดับ | ไฟล์ | อ่านเมื่อ |
|---|---|---|
| 1 | ไฟล์นี้ | **ทุกครั้ง** |
| 2 | [`README.md`](./README.md) | ต้องรู้ว่าโปรเจกต์คืออะไร/รันยังไง |
| 3 | [`ARCHITECTURE.md`](./ARCHITECTURE.md) | **ก่อน** เปลี่ยนโครงสร้าง, เพิ่ม route, แตะ DB, แตะ auth |
| 4 | [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) | **ก่อน** แตะ UI/สี/typography/component ใด ๆ |
| 5 | [`PRD.md`](./PRD.md) | ต้องรู้ว่า feature อยู่ในขอบเขตหรือไม่ |
| 6 | [`docs/README.md`](./docs/README.md) | หาเอกสารอื่น (แผนที่ทั้งหมด) |
| 7 | [`docs/PUNTAKIT_AGENT_GUIDE.md`](./docs/PUNTAKIT_AGENT_GUIDE.md) | ต้องการรายละเอียด env/กับดักการรันในเครื่อง |
| 8 | [`docs/PUNTAKIT_UX_UI_AUDIT_2026-10-07.md`](./docs/PUNTAKIT_UX_UI_AUDIT_2026-10-07.md) | แตะ UI แล้วต้องรู้ deviation ที่ค้างอยู่ |
| 9 | [`docs/adr/`](./docs/adr/) | ก่อนเปลี่ยนการตัดสินใจเชิงสถาปัตยกรรมที่มีอยู่ |

## 2. Repository map

```
client/src      SPA (React 19 + Vite + wouter + Tailwind v4 + shadcn/ui)   → alias @/*
  ├ components/   ของกลางอยู่ที่ DesignSystem.tsx · ui/ = shadcn primitive 53 ตัว (generated)
  ├ pages/        admin 25 หน้า + member PWA 5 หน้า (pages/member/)
  ├ contexts/ hooks/ lib/
server/         Express API (relative imports — ไม่อยู่ใน Vite build graph)
  ├ app.ts        mount route modules ทั้งหมด
  ├ routes/       19 module · มี .test.ts คู่ 14 — 5 ไม่มี (announcements/auth/churchProfile/events/ministries → tracker D52)
  ├ middleware/   auth (requireAuth · requireRole · requireAdmin) · requestId (access log)
  ├ db/           config (driver selection) · client · bootstrap · migrations (11 SQL)
  └ lib/          clerkAuth · bootstrapAdmin · auth · audit · errors · groupAccess · importBlob
shared/         schema.ts (SOT) · validation.ts (Zod) · roles.ts (SOT) · labels · orgView · import*
api/index.ts    Vercel serverless entrypoint (ชื่อนี้โดยเจตนา — ดู ARCHITECTURE.md)
docs/           เอกสารโปรเจกต์ + adr/ + exec-plans/ + features/
```

## 3. Source of truth — เรียงตามความน่าเชื่อถือ

1. **Production behavior** → 2. **Source code** → 3. **DB schema/migration** → 4. **Tests** → 5. **เอกสาร** → 6. **UX/UI audit** → 7. **Assumption**

- **ตรวจไม่ได้ = เขียน `NOT VERIFIED` ห้ามเดา ห้ามแต่ง**
- **Token SOT = `client/src/index.css` (`:root`)** — ถ้าเอกสารขัดกับ CSS **ยึด CSS แล้วแก้เอกสาร**
- **Schema SOT = `shared/schema.ts`** — เอกสารต้อง **ชี้ path** ไม่ทวนคอลัมน์ (ทวนแล้วจะเน่า)
- **Roles SOT = `shared/roles.ts`** — ใช้ทั้ง server และ client **ห้ามเขียนรายการ role inline ซ้ำ**

## 4. Tech stack ที่ล็อกไว้ (ห้ามเปลี่ยนโดยไม่มี ADR)

React 19 · Vite 7 · **wouter** (ไม่ใช่ Next.js) · Tailwind v4 (CSS-first ไม่มี `tailwind.config.js`) · shadcn/ui (Radix) · Express 4 · Drizzle ORM · PostgreSQL (Neon prod / PGlite test) · Clerk · Vitest · **pnpm** · Vercel

---

## 5. Agent ownership — ใครแตะอะไรได้

> **บังคับด้วยการ review ไม่ใช่ sandbox** — ไม่มีอะไรทางเทคนิคกันการแก้ข้ามพื้นที่ สิ่งที่กันคือ gate §7 + การ review
> agent **ห้ามแก้งานนอก ownership โดยพลการ** ถ้าจำเป็นต้องข้าม ให้ประกาศ + ขอความเห็นชอบก่อน

| Agent | เป็นเจ้าของ | **ห้ามแตะ** |
|---|---|---|
| **Orchestrator** | การจัดเส้นทางงาน, ตรวจ gate, ตัดสินชี้ขาด, รายงานสุดท้าย | ห้ามเขียนโค้ดเอง |
| **Architect** | `ARCHITECTURE.md`, `docs/adr/**`, ขอบเขต Crosscutting, โครงสร้างโฟลเดอร์ | ห้ามเปลี่ยน schema ฝ่ายเดียว · ห้ามเปลี่ยน stack |
| **Frontend** | `client/src/**` (ยกเว้น `components/ui/`) | `server/**`, `shared/schema.ts`, `api/**` · **ห้าม hand-edit** `components/ui/*` (generated — regenerate ผ่าน shadcn CLI) |
| **Backend** | `server/routes/**`, `server/lib/**`, `server/app.ts`, `server/middleware/**` | `client/src/**`, `server/db/migrations/**` (ของ Database) |
| **Database** | `shared/schema.ts`, `server/db/**` | `client/src/**` · ห้ามใส่ business logic ใน route แทน |
| **Security** | `server/middleware/auth.ts`, `shared/roles.ts`, `server/lib/clerkAuth.ts`, `server/lib/bootstrapAdmin.ts`, CSP ใน `vercel.json` | **ห้ามลดทอน validation ใด ๆ โดยไม่ได้รับคำสั่งชัดเจน** — เสียงของ Security ชนะเมื่อเป็น CRITICAL/HIGH |
| **DevOps** | `.github/workflows/**`, `vercel.json`, `DEPLOYMENT*.md`, `api/index.ts` | business logic ใน `client/`/`server/routes` |
| **Performance** | การจูน query/index, bundle size, การ render | **ห้ามเปลี่ยน observable behavior** เพื่อให้ได้ตัวเลข |
| **QA** | `**/*.test.ts(x)`, `vitest.config.ts` | **ห้ามลดทอน/ลบ test เพื่อให้ผ่าน** — ให้แก้โค้ดหรือแจ้งเจ้าของ |
| **Reliability** | logger, `/api/health`, `/api/ready`, error envelope, graceful shutdown | รูปแบบ response ที่ client พึ่งพา (ต้องประสาน Backend) |

**โซนที่ต้องประสาน (shared zone):** `shared/validation.ts`, `const.ts`, `labels.ts`, `orgView.ts`, `import*.ts` → แก้ได้แต่ต้องแจ้ง Architect + Backend
**การชี้ขาดเมื่อขัดกัน:** Security ชนะเรื่องความปลอดภัย · Database ชนะเรื่อง schema · Architect ชนะเรื่องขอบเขต · Orchestrator ตัดสินสุดท้าย

---

## 6. กฎ (invariants)

### 6.1 Architecture rules
- **aliases `@/*` และ `@shared/*` ต้องสอดคล้องกันระหว่าง `vite.config.ts` กับ `tsconfig.json`** — แก้ข้างเดียว = bundle พัง
- `client/src` เป็น SPA ที่ route ฝั่ง client เท่านั้น (**wouter**) — **ห้ามนำ convention ของ Next.js** (`app/`, `pages/` router) เข้ามา
- `server/index.ts` จำกัดที่ startup + static + graceful shutdown · business logic อยู่ใน `server/routes/<domain>.ts` + `.test.ts` คู่กันเสมอ
- **ห้ามให้ client เข้าถึง DB ตรง ๆ** — ต้องผ่าน server route
- `shared/` ใช้ร่วม client/server — ใส่ได้เฉพาะชนิดข้อมูล/ค่าคงที่/validation

### 6.2 Coding rules
- TypeScript เข้ม — **ห้าม `any` ใหม่** (ของเดิมที่ `async (m: any)` ในเทสต์ให้คงไว้)
- ไฟล์ควร **< ~300 บรรทัด** ถ้าเกินให้แยก
- Validation ใช้ **Zod จาก `shared/validation.ts`** ไม่เขียนใหม่ในหน้า
- **ไม่มี project logger** — การ log คือ `middleware/requestId.ts` (access log JSON 1 บรรทัดต่อ request) + `lib/audit.ts` (`logAudit()` เขียนลงตาราง `audit_logs`) โค้ดที่เหลือใช้ `console.*` ตามที่เขียนไว้ — **อย่าเพิ่ม abstraction การ log ใหม่**
- **ห้าม log credential** — access log บันทึก `url` **รวม query string** และ `userAgent` ดิบ โดยไม่มีการ redact (ดู tech-debt D49)
- **ไม่มี ESLint** ⇒ `pnpm check` (tsc) คือด่านเดียว — อย่าพึ่ง formatter ให้จับ bug

### 6.3 UI rules
- **อ่าน `DESIGN_SYSTEM.md` ก่อนแตะ UI ทุกครั้ง** · ห้าม hardcode สี ใช้ `var(--color-*)` เท่านั้น
- ใช้คลาส `.type-*` — **ห้ามกำหนดขนาดฟอนต์ inline** และห้ามต่ำกว่า 12px กับเนื้อหาจริง
- ใช้ของกลางจาก `components/DesignSystem.tsx` — **ห้ามประกาศ `PageHeader`/`SectionHeader`/`EmptyState`/`ErrorState`/`StatusChip`/`Field`/`Modal` ซ้ำในหน้า**
- Touch target ≥ **44×44px** (`min-h-11`/`size-11`) · ปุ่ม icon ต้องมี `aria-label`
- **ห้ามสื่อสถานะด้วยสีอย่างเดียว** — `StatusChip` ต้องมีข้อความเสมอ
- **ห้ามใช้ emoji เป็น icon** ใน UI
- ตาราง > 4 คอลัมน์ ต้องเปลี่ยนเป็น card list ที่ breakpoint `md`

### 6.4 Database rules
- `shared/schema.ts` = SOT · migration อยู่ใน `server/db/migrations` — **ห้ามแก้ DB นอกเส้นทางนี้**
- เลือก driver ด้วย `DATABASE_DRIVER` (`neon` | `postgres` | `pglite`) — **production ต้อง fail fast ห้าม fallback ไป PGlite**
- PGlite ใช้ได้เฉพาะ local dev / test · `bootstrapDatabase()` migrate PGlite อัตโนมัติ แต่ remote migrate เฉพาะเมื่อ `DB_AUTO_MIGRATE=true` หรือสั่ง `pnpm db:migrate`
- **ระวังกับดัก date-only:** ค่า `date` ต้องไม่ round-trip ผ่าน local-time getters (ดู `docs/PUNTAKIT_FOUNDATION_INVENTORY.md` §0 F1)

### 6.5 API rules
- หนึ่ง domain = หนึ่ง route module + หนึ่ง `.test.ts`
- ทุก response ใช้ **envelope กลาง** (ดู `ARCHITECTURE.md`) — ห้ามส่ง shape ที่ต่างออกไป
- ใส่ guard ของ middleware ให้ชัด (`requireAuth` · `requireRole(...)` · `requireAdmin`) — **route ที่ไม่ใส่ guard ต้องมีเหตุผลในคอมเมนต์**
  > `requireStaffOrAdmin` **ไม่มีอยู่ในโค้ดแล้ว** (ถูกลบเพราะไม่มีใคร import — rationale อยู่ที่ `server/middleware/auth.ts:171-176`) ห้ามอ้างถึง
- ตรวจ auth/role **ที่ server เสมอ** — การซ่อน UI ไม่ใช่การป้องกัน
- **Deviation ที่ยังไม่แก้:** `announcements.ts`, `events.ts`, `ministries.ts` ส่ง `error` เป็น string เปล่าแทน object (ดู `docs/exec-plans/tech-debt-tracker.md` D39)

### 6.6 Security rules
- **Clerk เป็น identity provider เดียวใน production** · cookie/JWT มีไว้สำหรับ route test (`PUNTAKIT_TEST_AUTH=1`) เท่านั้น
- **ห้ามเปิด demo mode ใน production** (`PUNTAKIT_DEMO_MODE=1` + non-production เท่านั้น) และ **ห้ามให้ production ตกไป PGlite**
- Authorization ใช้ `shared/roles.ts` ผ่าน `requireRole`/`requireAdmin` — **ห้ามสร้างระบบสิทธิ์ที่สอง**
- Webhook ต้อง verify signature (Svix) และ **ต้อง parse raw body ก่อน `express.json()`**
- **ห้าม commit secret** · `.env.local` ถูก gitignore — ค่าจริงอยู่ใน Vercel env / secret store
- **Security ห้ามถูกลดทอนโดย agent อื่น**

### 6.7 Testing rules
- ทุก behaviour change **ต้องมี/แก้ test** — `pnpm check` + `pnpm test` เขียวคือมาตรฐาน
- test อยู่ข้างโค้ดที่มันทดสอบ (`members.ts` ↔ `members.test.ts`)
- **รันด้วย `TZ=UTC` ให้ตรงกับ CI** — suite นี้ไวต่อ timezone
- **ห้ามลดทอน test เพื่อให้ผ่าน** · ห้ามลบ test โดยไม่แจ้ง QA
- งาน UI ที่แตะ token/component ต้องผ่าน guard ใน §7

### 6.8 Git rules
- **ห้าม force-push ไป `main`** · ห้าม rewrite history ที่ push แล้ว
- อย่า overwrite งานของผู้ใช้ — ตรวจ `git status` ก่อน และ **ห้าม commit ไฟล์ที่ผู้ใช้ยังแก้ไม่เสร็จ**
- หนึ่งการเปลี่ยนแปลง = หนึ่งเจตนา (อย่าปน refactor ใหญ่กับฟีเจอร์)
- **เอกสารต้องอัปเดตใน PR เดียวกับโค้ดที่ทำให้มันเปลี่ยน** (ดู §8)

### 6.9 Deployment rules
- Host = Vercel: static client + **หนึ่ง** serverless function (`api/index.ts`) · Neon = Postgres
- ต้องมี `CLERK_SECRET_KEY` และ publishable key ไม่งั้น middleware throw และทุก request หลัง guard จะได้ 500
- `/api/health` = liveness (ห้ามผูกกับ DB) · `/api/ready` = readiness (503 `DATABASE_UNAVAILABLE`)
- ก่อน deploy: [`DEPLOYMENT_CHECKLIST_TH.md`](./DEPLOYMENT_CHECKLIST_TH.md)

---

## 7. Mechanical enforcement — Rule → Enforced-by

**กฎที่บังคับด้วยโค้ดได้ ให้บังคับด้วยโค้ด** (ถ้อยคำในเอกสารเชื่อถือได้น้อยกว่า test)

| กฎ | บังคับโดย |
|---|---|
| ห้ามนำพาเลตต์ที่ปลดระวางกลับมา (`#173b70`, `#2f72bf`, `#122d54`, `#14263d`, `#224e88`) | `client/src/design-tokens.test.ts` |
| Token แกนต้องมีค่าเป๊ะตามที่ประกาศ (`--color-primary`, `--color-ink`, `--color-canvas`, `--color-dark-surface`, `--color-canvas-sunken`, `--color-on-primary`) | `client/src/design-tokens.test.ts` |
| `--shadow` ต้องไม่กลับไปเป็น `none` (การ์ดเคยแบนเงียบ ๆ) | `client/src/design-tokens.test.ts` |
| `brand-spec.md` + `design.md` ต้องอ้าง `index.css` และไม่โฆษณาพาเลตต์เก่า | `client/src/design-tokens.test.ts` |
| **ห้าม `brand-spec.md` / `design.md` ออกจาก repo root หรือเปลี่ยนชื่อ** | `client/src/design-tokens.test.ts` (อ่าน path ตายตัว) |
| ห้ามคลาสพาเลตต์ Tailwind (`bg-blue-600` ฯลฯ) ในไฟล์แอป | `client/src/design-system-consistency.test.ts` |
| ห้ามประกาศ `EmptyState`/`ErrorState`/`PageHeader`/`SectionHeader`/`StatusChip`/`modal-backdrop`/`modal-card` ซ้ำในหน้า | `client/src/design-system-consistency.test.ts` |
| โหมดมืดต้องเป็น token remap (ห้าม `.dark .text-x-NNN !important`) | `client/src/design-system-consistency.test.ts` |
| เนื้อหาจริงต้อง ≥ 12px | `client/src/design-system-consistency.test.ts` |
| 55 กฎ regression จาก UX audit (skip link, focus trap, ปุ่ม 44px, ฟอร์ม ≥16px บนมือถือ, ฯลฯ) | `client/src/ux-audit-regressions.test.ts` |
| วงจร session/auth ต้อง sync ไม่วนลูป | `client/src/auth-session-contract.test.ts` |
| สัญญา role gate | `client/src/role-gate-contract.test.ts` |
| สัญญารายการสมาชิก | `client/src/members-list-contract.test.ts` |
| **ทั้งหมด** | `.github/workflows/ci.yml` (Node 24) |

## 8. Doc update mapping — เปลี่ยนอะไร ต้องแก้เอกสารไหน

| เปลี่ยน | อัปเดต |
|---|---|
| token / component / state ของ UI | `DESIGN_SYSTEM.md` (+ `design.md` ถ้าเป็นกฎ) |
| โครงสร้าง, route, DB, auth, deployment | `ARCHITECTURE.md` |
| ขอบเขตผลิตภัณฑ์ / roadmap | `PRD.md` |
| การตัดสินใจเชิงสถาปัตยกรรม | `docs/adr/adr-NNN.md` ใหม่ (ห้ามแก้ของเก่า) |
| หนี้ทางเทคนิค | `docs/exec-plans/tech-debt-tracker.md` |
| แผนงานที่ทำอยู่ | `docs/exec-plans/active/YYYY-MM-DD-<slug>.md` |
| feature ที่แตะ | `docs/features/<feature>.md` |
| env var / ขั้นตอน deploy | `DEPLOYMENT.md`, `.env.example` |

ทุกเอกสารต้องมี `<!-- last_verified: YYYY-MM-DD -->` และ **อัปเดตวันที่เมื่อแก้เนื้อหา**

---

## 9. Workflow — ทุกงานต้องเดินตามนี้ และมีหลักฐานทุกขั้น

```
INSPECT → PLAN → IMPLEMENT → TEST → VERIFY → REPORT
```

1. **INSPECT** — อ่านโค้ดจริงก่อน · `git status` · ระบุ source of truth ของเรื่องนั้น
2. **PLAN** — ระบุไฟล์ที่จะแตะ + เจ้าของ (owner) + ผลกระทบ · ถ้าเป็นการตัดสินใจเชิงสถาปัตยกรรม ให้เขียน ADR ก่อน
3. **IMPLEMENT** — แก้ให้เล็กและตรงเจตนา ทำตามกฎ §6
4. **TEST** — เพิ่ม/แก้ test สำหรับ behaviour ที่เปลี่ยน
5. **VERIFY** — รัน gate จริง **ห้ามอนุมาน**
6. **REPORT** — สรุปพร้อมหลักฐาน (คำสั่ง + ผลที่ได้) · **"น่าจะใช้ได้" ไม่ใช่หลักฐาน → เขียน `NOT VERIFIED`**

### Quality gate (คำสั่งเดียว)

```bash
TZ=UTC pnpm install --frozen-lockfile && TZ=UTC pnpm check && TZ=UTC pnpm test && TZ=UTC pnpm build
```

## 10. Definition of Done

- [ ] `pnpm check` ผ่าน (ไม่มี type error)
- [ ] `pnpm test` ผ่าน **ที่ `TZ=UTC`** (506 tests เป็น baseline ณ 2026-10-07)
- [ ] `pnpm build` ผ่าน
- [ ] behaviour ที่เปลี่ยนมี test รองรับ และ **test ไม่ถูกลดทอน**
- [ ] UI ผ่าน `DESIGN_SYSTEM.md` (token เท่านั้น, state ครบ, touch ≥44px, contrast ผ่าน)
- [ ] route ที่เพิ่ม/แก้ มี guard ที่ถูกต้อง + มี `.test.ts`
- [ ] เอกสารตาม §8 อัปเดตแล้ว + `last_verified` ใหม่
- [ ] ถ้าเป็นการตัดสินใจเชิงสถาปัตยกรรม → มี ADR
- [ ] รายงานมีหลักฐาน (คำสั่ง/ผล) — ส่วนที่ไม่มีคือ `NOT VERIFIED`

## 11. Forbidden actions (เด็ดขาด)

1. ลดทอน/ปิด validation, auth guard, หรือ signature verification
2. ลบ/ทำให้ test อ่อนลงเพื่อให้ suite ผ่าน
3. เปลี่ยน architecture, stack, package manager, หรือ routing library โดยไม่มี ADR
4. เขียนทับหรือ revert งานของผู้ใช้ · `git push --force` ไป `main`
5. แก้ `client/src/components/ui/**` ด้วยมือ (generated)
6. hardcode สี/ขนาดฟอนต์ · ใช้พาเลตต์ที่ปลดระวาง · นำ emoji มาเป็น UI icon
7. เปิด demo mode หรือ fallback ไป PGlite ใน production
8. commit secret/credential
9. แก้ `shared/schema.ts` โดยไม่อัปเดต migration
10. อ้างว่าเสร็จโดยไม่มีหลักฐานการรัน — **ถ้าไม่มีหลักฐาน ให้เขียน `NOT VERIFIED`**

## 12. When unsure

- **ถามก่อน**ทำสิ่งที่ไม่กลับได้ (ลบข้อมูล, rotate credential, deploy production, force-push)
- เลือกรูปแบบที่ **มีอยู่แล้วในเรพ** ดีกว่าประดิษฐ์ abstraction ใหม่
- ถ้าเอกสารกับโค้ดขัดกัน → **ยึดโค้ด** แล้วแก้เอกสารใน PR เดียวกัน และบันทึกใน §Report
- ถ้าไม่รู้ว่าใครเป็นเจ้าของ → **Orchestrator** ตัดสิน
- กับดักของเล่นในเครื่อง (พอร์ต, demo mode, PGlite) → [`docs/PUNTAKIT_AGENT_GUIDE.md`](./docs/PUNTAKIT_AGENT_GUIDE.md)
