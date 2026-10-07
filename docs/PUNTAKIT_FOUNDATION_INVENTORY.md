# Puntakit — Foundation Upgrade · PHASE 1 INVENTORY

> **สถานะ:** INSPECT เท่านั้น — ยังไม่แก้ไขเอกสารหรือโค้ดใด ๆ
> **🟢 UPDATE 2026-10-07 (หลัง INSPECT):** PHASE 3 ดำเนินไปแล้ว — `README.md`, `PRD.md`, `ARCHITECTURE.md`, `DESIGN_SYSTEM.md`, `AGENTS.md` มีจริงที่ root แล้ว ตาราง §1 ด้านล่างคือ **สภาพ ณ ก่อนเริ่มงาน** (ยังเขียนว่า ❌) — ห้ามถือเป็นสภาพปัจจุบัน · สถานะล่าสุดดู [`docs/README.md`](./README.md)
> **วันที่:** 2026-10-07 · **Baseline commit:** `d2cd1f2` (สร้าง git baseline ในเครื่องนี้เพื่อให้ทุก diff ตรวจสอบได้)
> **วิธีตรวจ:** อ่านไฟล์จริงทั้งหมด + grep + คำนวณ + **รัน test จริง** (Node 24.21 + pnpm 11.7 จาก DSH bundle)
> ทุกข้อความที่ระบุว่า VERIFIED มีคำสั่ง/ไฟล์:บรรทัดรองรับ · สิ่งที่ตรวจไม่ได้ระบุ **NOT VERIFIED**

---

## 0. Baseline gate (รันจริงแล้ว — มีหลักฐาน)

| Gate | ผล | หลักฐาน |
|---|---|---|
| `pnpm install --frozen-lockfile` | 🟢 exit 0 | 35s |
| `pnpm check` (tsc --noEmit) | 🟢 exit 0 | ไม่มี type error |
| `pnpm test` (vitest + PGlite) | 🟢 **40/40 files · 506/506 tests** | ที่ `TZ=UTC` · 163.2s |
| `pnpm build` (vite + esbuild) | 🟢 exit 0 | emit `dist/public` + `dist/index.js` |

> **ยืนยันซ้ำ 2 ครั้ง** (รันเต็มชุด) — ตัวเลข 506/506 คือค่าที่ใช้อ้างอิงในรายงานสุดท้าย

### 🔎 Finding F1 — test suite ไม่ทน timezone (VERIFIED, พิสูจน์ด้วยการทดลอง)

ตอนรันครั้งแรก suite **แดง 2 tests** ที่ `server/routes/care.test.ts` บนเครื่องนี้ (timezone **UTC-3**) ผมจึงทดลองซ้ำโดยเปลี่ยน `TZ`:

| TZ | ผล `care.test.ts` |
|---|---|
| `UTC` (ตรงกับ CI = ubuntu-latest) | 🟢 6/6 ผ่าน |
| `America/Sao_Paulo` (UTC-3, เครื่องนี้) | 🔴 2 failed \| 4 passed |
| `Asia/Bangkok` (UTC+7, ผู้ใช้จริง) | 🟢 6/6 ผ่าน |

```
→ expected [ '2026-10-06', '2026-09-29', …(1) ] to deeply equal [ '2026-10-07', '2026-09-30', …(1) ]
→ expected null to be 'present'
```

**Root cause:** test ใช้ **date-only string** (`2026-10-07`) แล้วฝั่งโค้ด round-trip ผ่าน `new Date(...)` (parse เป็น UTC midnight) และ format ด้วย **local-time getters** → ที่ timezone ตะวันตกของ UTC จะถอยไป 1 วัน
**ผลกระทบ:** CI เขียว (เพราะ UTC) แต่เป็น **latent defect จริง** สำหรับ deployment ตะวันตกของ UTC และ test suite อ่อนไหวต่อ timezone
**ผลต่อแผน:** ห้ามอ้างว่า "เขียว" โดยไม่ระบุ TZ — เอกสาร Quality Gate ต้องระบุ `TZ=UTC` ให้ตรงกับ CI

---

## 1. มีไฟล์อะไร (inventory)

### Root (24 ไฟล์)
| ไฟล์ | KB | บทบาท |
|---|---|---|
| `AGENTS.md` | 5.5 | คู่มือ agent (ผอม — 84 บรรทัด, 7 หัวข้อ) |
| `brand-spec.md` | 4.2 | brand + token table **(test ผูกอยู่)** |
| `design.md` | 12.5 | "Puntakit Design System" 8 ข้อ **(test ผูกอยู่)** |
| `DESIGN-apple.md` | 36.5 | วิเคราะห์ design system ของ **Apple** — มี YAML frontmatter |
| `MASTER_PROMPT.md` | 11.9 | agent operating prompt (เป้าหมาย/ขอบเขต/contract/workflow/acceptance) |
| `DEPLOYMENT.md` | 4.8 | deployment notes (EN) |
| `DEPLOYMENT_CHECKLIST_TH.md` | 10.2 | เช็คลิสต์ production (TH) 7 ขั้น |
| `template.json` | 14.0 | **scaffold ของ Manus** (vendor) |
| `puntakit-dashboard-ops.skill` | 2.9 | **ไฟล์ ZIP (binary)** มี `SKILL.md` ข้างใน |
| `package.json` / `pnpm-lock.yaml` | 4.4 / 287.5 | — |
| `vite.config.ts` / `vitest.config.ts` / `vercel.json` / `tsconfig*.json` / `drizzle.config.ts` | — | config |
| `.env.example` | 3.8 | 6 env vars |
| `components.json` | 0.4 | shadcn config |
| `.gitignore` / `.prettierrc` / `.prettierignore` / `.vercelignore` / `.gitkeep` | — | — |
| ❌ `README.md` | — | **ไม่มี** |
| ❌ `PRD.md` · `ARCHITECTURE.md` · `DESIGN_SYSTEM.md` | — | **ไม่มี** |

### `docs/` (13 ไฟล์) — สรุปบทบาท
| ไฟล์ | KB | ประเภท |
|---|---|---|
| `PUNTAKIT_AGENT_GUIDE.md` | 12.6 | engineering guide (ย้ายมาจาก `CLAUDE.md` ที่ถอดออก) |
| `PUNTAKIT_PRODUCT_ARCHITECTURE.md` | 20.0 | product hierarchy + domain + security |
| `PUNTAKIT_MISSION_DOMAIN_PLAN.md` | 36.0 | domain model + DB schema + mapping (มี decision log + standing rules) |
| `PUNTAKIT_IMPLEMENTATION_PLAN.md` | 21.4 | แผนเป็น phase + สถานะ DONE |
| `PUNTAKIT_CRUD_MAP.md` | 2.1 | CRUD map |
| `PUNTAKIT_PRODUCT_RESEARCH.md` | 6.6 | research notes |
| `PUNTAKIT_MISSION_SOURCE_AUDIT.md` | 6.9 | audit ไฟล์ต้นทาง (มี sha256) |
| `PUNTAKIT_SESSION_REPORT_2026-09-30.md` | 21.8 | รายงาน maintenance/perf + เหตุการณ์ production ล่ม |
| `PUNTAKIT_AUDIT_FOLLOWUP_2026-10-05.md` | 7.7 | follow-up: ปิดอะไรแล้ว / ต้องการการตัดสินใจ / ค้างอะไร |
| `PUNTAKIT_UX_AUDIT.md` | 8.5 | UX/product audit (เก่า) |
| `PUNTAKIT_UX_AUDIT_FULL_2026-10-03.md` | 5.7 | UX audit (เก่า) |
| `PUNTAKIT_UX_UI_AUDIT_2026-10.md` | 20.4 | UX/UI audit รอบ 1 (2026-10-02) |
| `PUNTAKIT_UX_UI_AUDIT_2026-10-07.md` | 55.7 | **UX/UI audit รอบ 3 (ล่าสุด — canonical)** |

### ตัวชี้วัดระบบ (นับจริง)
```
client .tsx 107 · client .ts 20 · server .ts 79 · shared .ts 12
test files 40 (server/routes 21 · client/src 6 · server/lib 4 · server/db 4 · shared 3 · อื่น ๆ 2)
tests 506 · route modules 19 · ui primitives 53 · SQL migrations 11 (0000–0010) + snapshot 11 + journal
GH workflows 1 · repo agent skills 14 (.agents/skills)
```

---

## 2. ไฟล์ไหนเป็น Source of Truth

**Authority order ที่ประกาศไว้ในโปรเจกต์เอง (และผมยืนยันว่าสอดคล้องกับผู้ใช้กำหนด):**

| ลำดับ | แหล่ง | หลักฐาน |
|---|---|---|
| 1 | Production behavior | CI + Vercel deployments (`vercel[bot]`) |
| 2 | Source code | `shared/schema.ts` = "the single schema source of truth" |
| 3 | DB schema / migration | `server/db/migrations/*.sql` (11) |
| 4 | **Tests** (สัญญาที่บังคับใช้ได้) | **7 ไฟล์ audit-as-code + 506 tests** |
| 5 | เอกสารที่มีอยู่ | ดูตาราง §4 |
| 6 | UX/UI audit รอบ 3 | `docs/PUNTAKIT_UX_UI_AUDIT_2026-10-07.md` |
| 7 | Assumption | — |

**Token SOT:** `client/src/index.css` `:root` — ประกาศไว้ทั้งใน `brand-spec.md:3` และ `design.md:5` ว่า *"ถ้าเอกสารกับ CSS ไม่ตรงกัน ให้ยึด CSS"* 🟢 สอดคล้องกัน ไม่ขัดแย้ง

### 🔒 HARD CONSTRAINTS — เอกสารที่ "ห้ามย้าย ห้ามเปลี่ยนชื่อ" (VERIFIED จาก test)

`client/src/design-tokens.test.ts` อ่านไฟล์เหล่านี้ด้วย **path ตายตัวที่ repo root**:
```ts
const DOCS = ["brand-spec.md", "design.md"].map((f) => path.join(REPO_ROOT, f));
```
และบังคับว่า:
1. ทั้งสองไฟล์ต้องมีสตริง `index.css` (L112)
2. ต้องไม่มีบรรทัดที่ขึ้นต้นด้วย `Deep Navy` หรือ `Church Blue` (L114–115)

→ **`brand-spec.md` และ `design.md` ต้องอยู่ที่ root ด้วยชื่อเดิม** ถ้าย้ายหรือเปลี่ยนชื่อ **test จะพัง**
→ การเพิ่มบรรทัดชี้ไป `DESIGN_SYSTEM.md` ทำได้ปลอดภัย (ไม่ขัด assertion ใด)

นอกจากนี้ `design-tokens.test.ts` ยัง **ล็อกค่าเป๊ะ** ของ `--color-primary`, `--color-primary-focus`, `--color-primary-on-dark`, `--color-ink`, `--color-dark-surface`, `--color-canvas`, `--color-canvas-sunken`, `--color-on-primary` → เอกสารห้ามเสนอค่าที่ขัดกับที่ล็อกไว้

และ `design-system-consistency.test.ts` บังคับ: ห้าม palette เก่าในไฟล์แอพ, ห้ามประกาศ `PageHeader/EmptyState/ErrorState/StatusChip/modal-*` ซ้ำ, ห้าม `.dark .text-*-NNN !important`, 12px floor — **เอกสารต้องไม่ขัดกับ 4 ข้อนี้**

---

## 3. ไฟล์ไหนซ้ำ (overlap)

| กลุ่ม | ไฟล์ | ทับซ้อนกันที่ |
|---|---|---|
| **Design** | `brand-spec.md` + `design.md` + `DESIGN-apple.md` | token table สี/typography/radius/shadow ซ้ำกัน 3 ที่ |
| **Agent** | `AGENTS.md` + `docs/PUNTAKIT_AGENT_GUIDE.md` + `MASTER_PROMPT.md` | วิธีทำงาน/คำสั่ง/ขอบเขตความปลอดภัย |
| **Deploy** | `DEPLOYMENT.md` + `DEPLOYMENT_CHECKLIST_TH.md` | env vars, Vercel, 503 |
| **Audit** | 6 ไฟล์ (UX_AUDIT, UX_AUDIT_FULL, UX_UI_AUDIT ×2, AUDIT_FOLLOWUP, MISSION_SOURCE_AUDIT) | finding ซ้ำ/ทับกันหลายรอบ |
| **Plan** | `PUNTAKIT_IMPLEMENTATION_PLAN.md` + `PUNTAKIT_MISSION_DOMAIN_PLAN.md` | สถานะ phase + schema |
| **Product** | `PUNTAKIT_PRODUCT_ARCHITECTURE.md` + `PUNTAKIT_PRODUCT_RESEARCH.md` | domain, IA |

---

## 4. ไฟล์ไหนล้าสมัย (VERIFIED)

| # | ไฟล์ | หลักฐานว่าล้าสมัย |
|---|---|---|
| S1 | `docs/PUNTAKIT_AGENT_GUIDE.md` | ระบุ route modules **14** แต่ของจริง **19** — ขาด `care`, `clerkWebhook`, `import`, `org`, `orgData` |
| S2 | `docs/PUNTAKIT_UX_AUDIT.md` | §1 ชื่อหัวข้อ *"`CLAUDE.md` is out of date"* — แต่ `CLAUDE.md` **ถูกลบแล้ว** → หลักของเอกสารเป็นโมฆะ |
| S3 | `docs/PUNTAKIT_UX_UI_AUDIT_2026-10.md` | §5 (mobile) ล้าสมัย — รอบ 3 พิสูจน์แล้ว (Members/Groups เปลี่ยนเป็น card list, ไม่มี sub-12px แล้ว) |
| S4 | `docs/PUNTAKIT_PRODUCT_ARCHITECTURE.md` | มีหัวข้อที่ **ประกาศตัวเองว่าถูกแทนที่**: *"New domain model (original proposal — superseded by §…)"* |
| S5 | `design.md` | เลขหัวข้อซ้ำ: `### 8.2 ธีมมืด` (L126) และ `### 8.2 Clay surfaces` (L142) — **VERIFIED** |
| S6 | `design.md` §8 | กฎ *"ปุ่มหลัก: พื้น `--color-primary` ตัวอักษรขาว"* → **ขัดกับ UX/UI audit รอบ 3** ที่พบว่าขาวบน primary ในธีมมืด = 2.54:1 (ต้องใช้ `--color-on-primary`) |
| S7 | `.ai/gemini_38_flash_high_runbook.md` | ตกค้างลำพัง — `WORKFLOW.md` ที่อ้างถึงถูกลบตอนถอด Claude |

---

## 5. ไฟล์ไหนขัดแย้ง (CONFLICTS)

| # | ขัดแย้งระหว่าง | รายละเอียด | ระดับ |
|---|---|---|---|
| C1 | เอกสาร ↔ โค้ด | route modules 14 (doc) vs **19** (code) — ดู S1 | 🔴 สูง |
| C2 | `design.md` ↔ `design.md` | เลขหัวข้อ `8.2` ซ้ำสองที่ — ดู S5 | 🟡 กลาง |
| C3 | `template.json` ↔ `index.css` | `template.json` (vendor Manus) ฝัง `index.css` **เวอร์ชันเก่าที่เป็นธีมน้ำเงิน** (`--primary: var(--color-blue-700)`, oklch) → **ขัดกับระบบ olive ปัจจุบันทั้งไฟล์** ถ้า agent เผลออ่านจะเข้าใจผิดว่าธีมเป็นน้ำเงิน | 🔴 สูง |
| C4 | `DESIGN-apple.md` ↔ ระบบจริง | token names เกือบเหมือน Puntakit (`ink #1d1d1f`, `hairline #e0e0e0`, `canvas-parchment #f5f5f7`, `surface-tile-1 #272729`) แต่ `primary: #0066cc` (Apple blue) — ไฟล์ **ประกาศเองที่ L276** ว่า *"REFERENCE ONLY… not the Puntakit design system"* แต่ L276 คือ **276 บรรทัดเข้าไป** ⇒ frontmatter ที่อ่านง่ายที่สุดคือส่วนที่ทำให้เข้าใจผิด | 🔴 สูง |
| C5 | `puntakit-dashboard-ops.skill` ↔ ธรรมชาติไฟล์ | เป็น **binary ZIP** (magic `PK`) ไม่ใช่ markdown → agent อ่านไม่ได้ และไม่มีเอกสารอธิบายว่าคืออะไร | 🟡 กลาง |
| C6 | `design.md` §8 ↔ audit รอบ 3 | ดู S6 | 🟡 กลาง |
| C7 | `docs/PUNTAKIT_UX_AUDIT.md` ↔ สถานะปัจจุบัน | ดู S2 | 🟡 กลาง |
| C8 | `.gitignore` ↔ พฤติกรรมจริง | มี `!.agents/skills/` (ผมเพิ่มไว้) ทำให้ 240 ไฟล์ใน `.agents/skills` ถูก track ⇒ ต้องยืนยันว่าตั้งใจ (ตรงกับคอมเมนต์ "source of truth is .agents/skills") | 🟢 ต่ำ |

---

## 6–8. Preserve / Merge / Consolidate

### ✅ PRESERVE (ห้ามแตะเนื้อหา)
- `brand-spec.md`, `design.md` — **test ผูกอยู่** (ดู §2 hard constraints)
- `shared/schema.ts`, `client/src/index.css`, `server/routes/**` — source of truth
- **audit ทั้ง 6 ฉบับ** — เป็นประวัติ/หลักฐาน (รวม sha256 ใน MISSION_SOURCE_AUDIT)
- `docs/PUNTAKIT_MISSION_DOMAIN_PLAN.md` — domain SOT (+ decision log + standing rules ที่มีค่ามาก)
- `docs/PUNTAKIT_SESSION_REPORT_2026-09-30.md` §9 — บันทึก production ล่มและการกู้คืน
- `DEPLOYMENT_CHECKLIST_TH.md` — ขั้นตอน ops ที่ใช้จริง
- `.agents/skills/` (14), `patches/`, `.github/workflows/ci.yml`, `referend/`
- `template.json` — **vendor** (AGENTS.md ห้ามแก้ไฟล์ vendor) ⇒ แต่ต้องติดป้ายกันความเข้าใจผิด (ดู C3)

### 🔀 MERGE (รวมเข้าเอกสารแกนใหม่ โดยไม่ลบต้นฉบับ)
| เอกสารใหม่ | รวมจาก |
|---|---|
| `PRD.md` | `PUNTAKIT_PRODUCT_ARCHITECTURE` (hierarchy/security) + `IMPLEMENTATION_PLAN` (roadmap/phase) + `MISSION_DOMAIN_PLAN` (domain/กติกา) + `MASTER_PROMPT` (เป้าหมาย/acceptance) + `PRODUCT_RESEARCH` (บริบท) |
| `ARCHITECTURE.md` | `PUNTAKIT_AGENT_GUIDE` (ส่วน Architecture) + `PUNTAKIT_PRODUCT_ARCHITECTURE` + `DEPLOYMENT.md` + comment ใน `api/index.ts` (เหตุผลที่เลือก named entrypoint) + `MISSION_DOMAIN_PLAN` (data model) + `CRUD_MAP` |
| `DESIGN_SYSTEM.md` | `brand-spec.md` + `design.md` + **UX/UI audit รอบ 3** + `index.css` จริง + `DesignSystem.tsx` จริง |
| `AGENTS.md` (เขียนใหม่) | ของเดิม + `MASTER_PROMPT` (workflow/ข้อห้าม) + `AGENT_GUIDE` (คำสั่ง/กับดัก) |

### ♻️ CONSOLIDATE (ไม่ลบ — ย้ายเข้าโฟลเดอร์ + ติดป้าย)
- audit 6 ฉบับ → `docs/audits/` (canonical = รอบ 3) + `docs/audits/archive/` สำหรับรอบเก่า
- เอกสารที่ถูกแทนที่ (S1, S2, S4) → ติดบรรทัด `> **SUPERSEDED BY …**` แล้วเก็บไว้ (ไม่ลบ) — ตรงกับหลัก PRESERVE→MERGE→IMPROVE
- **ไม่มีไฟล์ใดถูกลบในแผนนี้**

---

## 9. ข้อมูลที่ยังขาด (ต้องถามผู้ใช้ — ห้ามแต่ง)

| # | ข้อมูลที่ขาด | สถานะ |
|---|---|---|
| M1 | `README.md` (ทางเข้าสำหรับมนุษย์) | **ไม่มี** |
| M2 | Personas / บทบาทผู้ใช้ที่นอกเหนือจากโค้ด — `shared/roles.ts` มี enum แต่ไม่มีคำอธิบายว่าใครใช้จริง | **NOT VERIFIED** |
| M3 | Success metrics / KPI ของผลิตภัณฑ์ (จำนวนสมาชิก, การใช้งาน, เป้าหมาย) | **NOT DEFINED** — MASTER_PROMPT มี acceptance criteria ของงาน remediation ไม่ใช่ตัวชี้วัดผลิตภัณฑ์ |
| M4 | จำนวนผู้ใช้จริง / ขนาดข้อมูลจริง / SLA | **NOT VERIFIED** |
| M5 | Business rules ที่ไม่ปรากฏในโค้ด (เช่น กติกาความเป็นส่วนตัวของข้อมูลสมาชิกคริสตจักร) | **NOT VERIFIED** — มี `docs/PUNTAKIT_AUDIT_FOLLOWUP_2026-10-05.md` §2 "Decisions needed from the administrator" ที่ยังค้าง |
| M6 | Roadmap ที่มีวันที่/เจ้าของ (ปัจจุบันมีแต่ phase + DONE) | **NOT DEFINED** |
| M7 | `Out of Scope` ที่ประกาศชัด | **NOT VERIFIED** — กระจายอยู่ตามเอกสาร |
| M8 | เนื้อหาใน `puntakit-dashboard-ops.skill` | **NOT VERIFIED** (binary ZIP) |
| M9 | API inventory ที่ครบ 19 modules | ไม่มีเอกสารรวม (`CRUD_MAP.md` เพียง 2.1 KB) |

---

## 10. Reference projects — เอาแนวคิดอะไร / ข้ามอะไร

### REF #1 Backblaze `ai-saas-starter-kit` (หลัก)
**นำมาใช้:** ① `AGENTS.md` เป็น TOC ไม่ใช่สารานุกรม + ลิงก์ออกเสมอ ② **Rule → Enforced-by table** ที่อ้าง test ID จริง ③ `docs/features/_template.md` ที่มีบล็อก **Verification** (quick cmd / full cmd / pass criteria) ④ `docs/exec-plans/active|completed/` + `tech-debt-tracker.md` ⑤ `<!-- last_verified: YYYY-MM-DD -->` ทุกเอกสาร + ตาราง Doc-Update-Mapping ⑥ quality gate เป็น **คำสั่งเดียว** ที่ยกมาอ้างในทุกเอกสาร ⑦ โครงสร้าง test เชิงสถาปัตยกรรม (`test_structure.py` → port เป็น Vitest)
**ข้าม:** การแบ่ง backend 5 ชั้น, panel review/red-team ต่อ PR, `stripe-setup.md`, middleware narrative

### REF #2 `vibbs/company-os`
**นำมาใช้:** ① แยก 3 ชั้น agent / skill / tool ② frontmatter lineage (`parent`, `depends_on`) ③ **gate ที่บังคับด้วยสคริปต์** ไม่ใช่ด้วยถ้อยคำ ④ PRD→RFC แค่ **2 gate** ⑤ stage-aware gate (advisory → enforced) ⑥ `promotions.log` เป็นบันทึกการอนุมัติที่ grep ได้
**ข้าม:** 9 agents + 3-layer delegation, 8 ใน 10 release bars, COGS ledger, GTM/Growth, 64 skills, brand archetypes
**หมายเหตุผู้วิจัย:** พบ inconsistency จริงใน company-os — `threat-modeling` เขียนออก `artifacts/risk/` แต่ `check-gate.sh release` มองหา `artifacts/security-reviews/` → **อย่าลอกทั้งดุ้น**

### REF #3 arc42 (สำหรับ `ARCHITECTURE.md`)
**KEEP:** ① Introduction & Goals ② System Scope & Context (ย่อ) ③ Solution Strategy ④ Building Block View (2 ระดับ) ⑤ Runtime View (3 scenario เท่านั้น) ⑥ Crosscutting Concepts ⑦ Architecture Decisions (ADR) ⑧ Risks & Technical Debt (สั้น) ⑨ Glossary (**มีค่ามากที่นี่** เพราะต้องแปลไทย↔อังกฤษ)
**MERGE:** Architecture Constraints → §1/§4 · Deployment View → §3 (Vercel + Neon + Clerk = ไม่มี topology ให้บรรยาย) · Quality Requirements → §1 (3–5 scenario ที่วัดได้)
**กลไก ADR:** `docs/adr/adr-000.md` เลขศูนย์นำหน้า เพิ่มทีละ 1 ห้ามใช้เลขซ้ำ · ฟิลด์ **Title, Context, Decision, Status, Consequences** (ต้องมีข้อเสียด้วย) · status: `proposed|accepted|deprecated|superseded by adr-0NN` · **ADR ที่ถูกแทนที่ให้เก็บไว้ ห้ามลบ/เขียนทับ**
**Anti-patterns ที่ต้องหลบ:** template cosplay, ทวนซ้ำกับโค้ด, แผนผังเน่า, ADR เป็นพิธีกรรม, งบบังคับ ~2,000 คำ

### REF #4 `DESIGN.md` (สำหรับ `DESIGN_SYSTEM.md`)
**แกนที่ใช้:** **YAML frontmatter = token ที่ machine อ่านได้ · markdown body = เหตุผล** · token เป็น *normative* ไม่ใช่คำแนะนำ · อ้างกันด้วย `{colors.primary}` · dark mode ประกาศเป็น **variant ไม่ใช่ palette ที่สอง** · states แยกเป็นรายการต่างหาก (`button-primary-hover`) · Do/Don't เป็นประโยคสั่งสั้น ๆ ที่บอกทางเลือกแทน · **"decisions log" สะสมคุณค่า**
**Wiring = สัญญา:** *"Read DESIGN_SYSTEM.md before any visual or UI work. Use only the tokens defined here. Do not invent values."* — ถ้าไม่ wire ใน `AGENTS.md` เอกสารจะเป็นแค่แรงบันดาลใจ
**⭐ `design-tokens.test.ts` ของโปรเจกต์นี้ = linter ของ DESIGN_SYSTEM.md อยู่แล้ว** → ไม่ต้องสร้างเครื่องมือใหม่
**ข้อจำกัดที่ต้องเคารพ:** ไฟล์ควร **รวมกันไม่เกิน ~3,000 tokens** เพื่อไม่ให้ agent มองข้าม
**Anti-pattern ที่เอกสารต้องห้าม:** glassmorphism, gradient hero, neon glow, blob ลอย, การ์ดมีเส้นขอบทุกใบ, pill ทุกปุ่ม, title case, **em dash**, radius ผสมกัน

---

## 11. สถาปัตยกรรมเอกสารเป้าหมาย (ข้อเสนอ)

```
README.md                     🆕 ทางเข้าสำหรับมนุษย์ + doc map
AGENTS.md                     ♻️ เขียนใหม่ = "OS ของ agent": TOC + กฎ + ownership + gate
PRD.md                        🆕 CURRENT vs TARGET, scope/out-of-scope
ARCHITECTURE.md               🆕 arc42 subset + ลิงก์ ADR
DESIGN_SYSTEM.md              🆕 extract จาก UI จริง + audit (ห้าม redesign)
brand-spec.md                 🔒 คงไว้ที่ root (test ผูก) + ชี้ว่า DESIGN_SYSTEM.md เป็นทางเข้า
design.md                     🔒 คงไว้ที่ root (test ผูก) + แก้เลข 8.2 ซ้ำ + แก้กฎ on-primary
docs/
  README.md                   🆕 doc map / index
  adr/adr-000…00N.md          🆕 สกัดจาก "Decision log" ที่มีอยู่ + MASTER_PROMPT
  features/_template.md       🆕 (จาก Backblaze) เขียนเฉพาะ feature ที่แตะ
  exec-plans/{active,completed}/ + tech-debt-tracker.md  🆕
  audits/                     ♻️ ย้าย audit 6 ฉบับ + archive/ ของรอบเก่า
  reference/                  ♻️ ย้าย DESIGN-apple.md, referend/, PRODUCT_RESEARCH
  (ไฟล์ PUNTAKIT_*.md เดิม)   ✅ คงไว้ที่เดิมทั้งหมด
```

⚠️ **ข้อควรพิจารณา:** แผนนี้ *ย้าย* ไฟล์ ซึ่งเสี่ยงต่อลิงก์ที่ชี้กันอยู่ ถ้าต้องการความเสี่ยงต่ำสุด เลือก **"เพิ่มเอกสารใหม่ + ติดป้าย ไม่ย้ายไฟล์"** ได้ (ดูคำถาม Q3)

---

## 12. แผน PHASE 3 + gate

| ขั้น | งาน | Gate (ต้องผ่านก่อนไปขั้นถัดไป) |
|---|---|---|
| 3.0 | ยืนยันขอบเขตกับมนุษย์ (คำถาม §13) | ได้คำตอบ Q1–Q4 |
| 3.1 | `README.md` + `docs/README.md` (doc map) | ลิงก์ในแผนที่ ชี้ไฟล์ที่มีจริง 100% |
| 3.2 | `ARCHITECTURE.md` | ทุกข้อความอ้างไฟล์/บรรทัดจริง · ไม่มี route module ตกหล่น (19) |
| 3.3 | `DESIGN_SYSTEM.md` | token ทุกตัวมีจริงใน `index.css` · ตรงกับ audit รอบ 3 · `pnpm test` ยังเขียว |
| 3.4 | `PRD.md` | แยก CURRENT/TARGET ชัด · ห้ามเขียน feature ที่ยังไม่มีว่า implemented |
| 3.5 | `AGENTS.md` (เขียนใหม่) | มี Rule→Enforced-by ที่อ้าง test จริง · ownership ครบ · Definition of Done |
| 3.6 | ADR + exec-plans + feature template | อย่างละ ≥1 ตัวอย่างที่ใช้จริง |
| 3.7 | ตรวจสอบขั้นสุดท้าย | `pnpm check` + `pnpm test` (TZ=UTC) + `pnpm build` เขียว · ทุกเอกสาร cross-link ไม่มี dead link |

---

## 13. คำถามที่ต้องให้มนุษย์ตัดสิน (blocking)

- **Q1 — ขอบเขต Phase 3:** ทำครบทั้ง 4 เอกสาร + โครงสร้างโฟลเดอร์ หรือเริ่มจาก `ARCHITECTURE.md` + `DESIGN_SYSTEM.md` ก่อน?
- **Q2 — ข้อมูลที่ขาด (§9 M2/M3/M5/M6):** ให้ผมเขียนเป็น **NOT VERIFIED / NOT DEFINED** ตามจริง หรือคุณจะให้ข้อมูลเพิ่ม?
- **Q3 — การย้ายไฟล์ (§11):** ย้ายเข้าโฟลเดอร์ (`docs/adr/`, `docs/audits/`, `docs/reference/`) หรือ **ไม่ย้าย** เพื่อลดความเสี่ยง dead link?
- **Q4 — ภาษาเอกสาร:** เอกสารใหม่ควรเป็น **ไทย** (ตาม `design.md`, `MASTER_PROMPT.md`) หรือ **อังกฤษ** (ตาม `AGENTS.md`, audit รอบ 3) หรือไทยนำ+ศัพท์เทคนิคอังกฤษ?
