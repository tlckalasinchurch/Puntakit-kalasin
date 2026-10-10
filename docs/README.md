<!-- last_verified: 2026-10-10 -->
# Puntakit — Documentation Map

แผนที่เอกสารทั้งหมดของโปรเจกต์ ใช้ไฟล์นี้เป็นจุดเริ่มต้นก่อนอ่านเอกสารใด ๆ
**เอกสารที่อยู่นอกแผนที่นี้ = ยังไม่ถูกจัดประเภท ห้ามถือเป็น source of truth**

## เอกสารแกน (root — cross-cutting contracts)

| ไฟล์ | ตอบคำถามอะไร | สถานะ |
|---|---|---|
| [`README.md`](../README.md) | โปรเจกต์นี้คืออะไร เริ่มยังไง | 🟢 **canonical** |
| [`PRD.md`](../PRD.md) | ทำอะไร เพื่อใคร ทำไม — CURRENT vs TARGET | 🟢 **canonical** |
| [`ARCHITECTURE.md`](../ARCHITECTURE.md) | ระบบทำงานอย่างไรจริง ๆ | 🟢 **canonical** |
| [`DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md) | UI ต้องเป็นอย่างไร (token/components/states) | 🟢 **canonical** |
| [`AGENTS.md`](../AGENTS.md) | agent ต้องทำงานอย่างไร + ownership + gate | 🟢 **canonical** |
| [`brand-spec.md`](../brand-spec.md) | brand + ตาราง token (ฉบับย่อ) | 🔒 **test-locked** — ห้ามย้าย/เปลี่ยนชื่อ |
| [`design.md`](../design.md) | กฎการออกแบบฉบับละเอียด | 🔒 **test-locked** — ห้ามย้าย/เปลี่ยนชื่อ |
| [`DEPLOYMENT.md`](../DEPLOYMENT.md) | วิธี deploy + env vars | 🟢 canonical |
| [`DEPLOYMENT_CHECKLIST_TH.md`](../DEPLOYMENT_CHECKLIST_TH.md) | เช็คลิสต์ production 7 ขั้น | 🟢 canonical (ops) |
| [`MASTER_PROMPT.md`](../MASTER_PROMPT.md) | prompt งาน remediation 503 | 🟡 งานจบแล้ว — เก็บไว้เป็นประวัติ |
| [`DESIGN-apple.md`](../DESIGN-apple.md) | วิเคราะห์ design ของ **Apple** | 📚 **REFERENCE ONLY** (ห้ามใช้เป็น token ของโปรเจกต์) |
| [`template.json`](../template.json) | scaffold ของ Manus (vendor) | ⚙️ **vendor** — ผัง `index.css` ข้างในเป็นธีมน้ำเงินเก่า **อย่าใช้อ้างอิง** |

## เอกสารโปรเจกต์ (`docs/PUNTAKIT_*.md`)

| ไฟล์ | บทบาท | สถานะ |
|---|---|---|
| [`PUNTAKIT_FOUNDATION_INVENTORY.md`](./PUNTAKIT_FOUNDATION_INVENTORY.md) | ผล INSPECT + จำแนกเอกสาร + baseline gate | 🟢 canonical |
| [`PUNTAKIT_MISSION_DOMAIN_PLAN.md`](./PUNTAKIT_MISSION_DOMAIN_PLAN.md) | domain model, schema, mapping, decision log | 🟢 **canonical** |
| [`PUNTAKIT_MISSION_OPERATING_MODEL_BASELINE.md`](./PUNTAKIT_MISSION_OPERATING_MODEL_BASELINE.md) | **ฐานตรวจที่ยืนยันแล้ว** (2026-10-10): โมเดลการดำเนินงานเป้าหมาย เทียบกับโค้ดจริง · สิทธิ์ที่บังคับจริง · ช่องว่าง · ทะเบียนข้อตัดสินใจ · ลำดับงาน (ไม่ใช่การตัดสินใจ — ข้อเสนออยู่ที่ ADR 002–004) | 🟢 canonical (baseline) |
| [`PUNTAKIT_IMPLEMENTATION_PLAN.md`](./PUNTAKIT_IMPLEMENTATION_PLAN.md) | แผนเป็น phase + สถานะ | 🟢 canonical (roadmap) |
| [`PUNTAKIT_PRODUCT_ARCHITECTURE.md`](./PUNTAKIT_PRODUCT_ARCHITECTURE.md) | product hierarchy, IA, security model | 🟡 มีหัวข้อที่ประกาศตัวเองว่าถูกแทนที่ |
| [`PUNTAKIT_AGENT_GUIDE.md`](./PUNTAKIT_AGENT_GUIDE.md) | engineering guide (จาก `CLAUDE.md` เดิม) | 🟡 **route list ล้าสมัย** (14 vs 19 จริง) |
| [`PUNTAKIT_CRUD_MAP.md`](./PUNTAKIT_CRUD_MAP.md) | CRUD map | 🟡 บาง (2.1 KB) เทียบกับ 19 route modules |
| [`PUNTAKIT_AUDIT_FOLLOWUP_2026-10-05.md`](./PUNTAKIT_AUDIT_FOLLOWUP_2026-10-05.md) | ปิดอะไรแล้ว / ค้างอะไร / ต้องการการตัดสินใจ | 🟡 open items |
| [`PUNTAKIT_PRODUCT_RESEARCH.md`](./PUNTAKIT_PRODUCT_RESEARCH.md) | research notes | 📚 reference |
| [`PUNTAKIT_MISSION_SOURCE_AUDIT.md`](./PUNTAKIT_MISSION_SOURCE_AUDIT.md) | audit ไฟล์ต้นทาง (มี sha256) | 📚 evidence |
| [`adr/adr-002.md`](./adr/adr-002.md) · [`003`](./adr/adr-003.md) · [`004`](./adr/adr-004.md) | โครงสร้างองค์กรสามระดับ + ศัพท์ + ขั้นตอนตรวจ production (002) · สิทธิ์/`team_lead` (003) · รายงานรายสัปดาห์/ตัวชี้วัด (004) | 🟠 **proposed** — ข้อกำหนดเป้าหมาย ยังไม่ผ่านการตรวจรับ ยังไม่ implemented |
| [`PUNTAKIT_SESSION_REPORT_2026-09-30.md`](./PUNTAKIT_SESSION_REPORT_2026-09-30.md) | maintenance/perf + production incident §9 | 📚 historical |
| [`PUNTAKIT_UX_UI_AUDIT_2026-10-07.md`](./PUNTAKIT_UX_UI_AUDIT_2026-10-07.md) | **UX/UI audit รอบ 3** | 🟢 **canonical** (audit) |
| [`PUNTAKIT_UX_UI_AUDIT_2026-10.md`](./PUNTAKIT_UX_UI_AUDIT_2026-10.md) | UX/UI audit รอบ 1 | ⛔ **SUPERSEDED BY รอบ 3** (โดยเฉพาะ §5 mobile) |
| [`PUNTAKIT_UX_AUDIT_FULL_2026-10-03.md`](./PUNTAKIT_UX_AUDIT_FULL_2026-10-03.md) | UX audit เต็ม | ⛔ SUPERSEDED BY รอบ 3 |
| [`PUNTAKIT_UX_AUDIT.md`](./PUNTAKIT_UX_AUDIT.md) | UX/product audit | ⛔ SUPERSEDED — §1 อ้าง `CLAUDE.md` ที่ถูกลบแล้ว |

## กติกาการตั้งชื่อ

| รูปแบบ | ความหมาย | ตัวอย่าง |
|---|---|---|
| `UPPERCASE.md` (root) | **สัญญา** ข้ามระบบ — แก้ต้องตั้งใจ | `ARCHITECTURE.md`, `AGENTS.md` |
| `docs/PUNTAKIT_<เรื่อง>.md` | บันทึกของโปรเจกต์ (มีอายุ) | `PUNTAKIT_MISSION_DOMAIN_PLAN.md` |
| `*_<YYYY-MM-DD>.md` | snapshot ณ วันนั้น — **ห้ามแก้ย้อนหลัง** | `PUNTAKIT_SESSION_REPORT_2026-09-30.md` |
| `docs/adr/adr-NNN.md` | Architecture Decision Record | `docs/adr/adr-000.md` |
| `docs/exec-plans/active\|completed/` | แผนงานที่กำลังทำ/จบแล้ว | `docs/exec-plans/active/` |
| `docs/features/<feature>.md` | เอกสารต่อ feature | `docs/features/_template.md` |
| `docs/reference/` | วัสดุอ้างอิงภายนอก — **ยังไม่มีโฟลเดอร์นี้** (จะสร้างเมื่อได้รับอนุมัติให้ย้ายไฟล์ เช่น `DESIGN-apple.md`) | — |

## กฎที่ห้ามละเมิด

1. **Token SOT คือ `client/src/index.css` (`:root`)** — ถ้าเอกสารกับ CSS ไม่ตรงกัน ให้ยึด CSS แล้วแก้เอกสาร
2. **ห้ามย้าย/เปลี่ยนชื่อ `brand-spec.md` และ `design.md`** — `client/src/design-tokens.test.ts` อ่านไฟล์เหล่านี้จาก repo root ด้วยชื่อตายตัว ถ้าย้าย test จะพัง
3. **Schema SOT คือ `shared/schema.ts`** — เอกสารต้องชี้ path ไม่ทวนคอลัมน์
4. เอกสารทุกฉบับต้องมี `<!-- last_verified: YYYY-MM-DD -->` และ **อัปเดตใน PR เดียวกับโค้ดที่ทำให้มันเปลี่ยน**
5. ห้ามเขียน feature ที่ยังไม่มีว่า implemented — ถ้าตรวจไม่ได้ให้เขียน **NOT VERIFIED**
