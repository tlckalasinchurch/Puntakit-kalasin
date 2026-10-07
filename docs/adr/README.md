<!-- last_verified: 2026-10-07 -->
# Architecture Decision Records (ADR)

บันทึกการตัดสินใจเชิงสถาปัตยกรรมของ Puntakit — ตามแนวคิด arc42 §9 + Nygard

## กฎ

1. **ไฟล์ละหนึ่งการตัดสินใจ** · ชื่อ `adr-NNN.md` เลขศูนย์นำหน้า 3 หลัก เริ่ม `000` เพิ่มทีละ 1
2. **ห้ามใช้เลขซ้ำ** และ **ห้ามลบหรือเขียนทับ ADR เก่า** — ถ้าตัดสินใจใหม่ ให้เขียนไฟล์ใหม่แล้วตั้ง `Status: superseded by adr-0NN` ในไฟล์เก่า (พร้อมลิงก์) ประวัติคือคุณค่าทั้งหมด
3. ความยาว **1–2 หน้า** ประโยคเต็ม ไม่ใช่ bullet ล้วน
4. ต้องมี **Consequences** ที่รวมข้อเสีย/ผลข้างเคียงด้วย ไม่ใช่ข้อดีอย่างเดียว
5. ไฟล์ที่ `Status: accepted` หรือ `superseded` แล้ว **ห้ามแก้เนื้อหา** แก้ได้แค่บรรทัด Status

## Template

```markdown
# ADR NNN: <ชื่อสั้น ๆ เป็นคำนาม>

- **Status:** proposed | accepted | deprecated | superseded by [adr-0NN](./adr-0NN.md)
- **Date:** YYYY-MM-DD
- **Deciders:** <ใคร>
- **Supersedes:** <ลิงก์ ถ้ามี>

## Context
ข้อเท็จจริงและแรงกดดันที่ทำให้ต้องตัดสินใจ — เขียนให้คนที่ไม่มีบริบทอ่านแล้วเข้าใจ

## Decision
ตัดสินใจอะไร (ประโยคเดียว) แล้วตามด้วยรายละเอียดที่จำเป็น

## Consequences
**ดี:** …
**แย่:** … (ต้องมี)
**เป็นกลาง:** …

## Alternatives considered
| ทางเลือก | ทำไมไม่เลือก |
|---|---|
```

## ดัชนี

| # | เรื่อง | Status | วันที่ |
|---|---|---|---|
| [000](./adr-000.md) | Clerk เป็น identity provider เดียวใน production | accepted | 2026-10-07 (บันทึกย้อนหลัง) |
| [001](./adr-001.md) | โหมดมืดเป็น token remap ไม่ใช่ class override | accepted | 2026-10-07 (บันทึกย้อนหลัง) |

## ผู้สมัครที่ยังไม่ได้เขียน (ต้องเก็บจากเจ้าของโปรเจกต์ — ห้ามแต่งเหตุผลเอง)

| เรื่อง | หลักฐานที่มีอยู่ในเรพ | สถานะ |
|---|---|---|
| ใช้ **wouter** ไม่ใช่ Next.js / React Router | `docs/PUNTAKIT_AGENT_GUIDE.md` ระบุชัดว่าเป็น SPA client-side routing | **NOT VERIFIED** — ยังไม่พบเหตุผลว่าทำไมเลือก |
| Vercel entrypoint เป็น **named `api/index.ts`** ไม่ใช่ `[...path].ts` | มีคอมเมนต์อธิบายเหตุผลใน `api/index.ts` แล้ว → เขียน ADR ได้ทันที | พร้อมเขียน |
| ประกาศ `--radius-*` ใน `:root` **แบบ unlayered** เพื่อทับ namespace ของ Tailwind | ตรวจกลไกแล้วด้วยตนเอง (cascade layer) | พร้อมเขียน |
| ปิด `vite-plugin-manus-runtime` | เอกสารระบุว่า plugin inline React ซ้ำ ~367 kB โดยไม่มี `apply:'serve'` | **NOT VERIFIED** — ต้องอ่านคอมเมนต์ใน `vite.config.ts` ยืนยัน |
| ใช้ PGlite เป็น test database แทน Postgres จริง | `vitest.config.ts` + `PUNTAKIT_TEST_AUTH=1` | พร้อมเขียน |
| เก็บ `brand-spec.md`/`design.md` ไว้ที่ root แม้มี `DESIGN_SYSTEM.md` | **`design-tokens.test.ts` อ่าน path ตายตัว** → การคงไว้คือการตัดสินใจ ไม่ใช่ความบังเอิญ | พร้อมเขียน |
