<!-- last_verified: 2026-10-09 -->
# CURRENT — สถานะปัจจุบัน (เขียนทับทุกครั้งที่ `/wrap`; ประวัติอยู่ที่ `.ai/CHANGELOG.md`)

> บันทึกนี้ **ไม่ใช่หลักฐานสถานะสด** — เทียบกับ `git status --short` ก่อนเชื่อเสมอ ถ้าต่างกัน repo ชนะ

## สถานะที่บันทึก (2026-10-09 ปิดงาน)

- branch `master` · HEAD `3afed5b` · **ไม่มี commit ใหม่** · ไม่มี push/merge/deploy
- worktree อื่น: `Work\_wt-main` @ `4dd66ab` [`port/batch1-d53`] — ไม่ได้แตะ

### การเปลี่ยนแปลงที่ยังไม่ commit (ตาม `git status --short` ที่บันทึก)

| กลุ่ม | ไฟล์ |
|---|---|
| **งาน Member PWA (ของเรา)** | `client/src/components/layout/MemberAppLayout.tsx`, `client/src/pages/member/MemberHome.tsx`, `client/src/components/MemberList.tsx` (ใหม่) |
| **เอกสารข้อกำหนด (ของเรา)** | `docs/adr/adr-002.md` `003` `004` (ใหม่, `proposed`), `PRD.md`, `docs/PUNTAKIT_MISSION_DOMAIN_PLAN.md`, `AGENTS.md`, `docs/README.md`, `docs/adr/README.md` |
| **หน่วยความจำ/handoff (ของเรา)** | `CLAUDE.md`, `.ai/*.md` (ใหม่ 5 ไฟล์), `.agents/skills/{brief,focus,wrap,handoff}/` (ใหม่), `PUNTAKIT_NEXT_SESSION_PLAN_2026-10-10.md` |
| **ไม่ใช่ของเรา — ห้ามแตะ** | `README.md`, `puntakit-readme.patch` |
| **มีอยู่ก่อน — ห้ามลบ** | `.github/copilot-instructions.md`, `_tmp_1984_…`, `PUNTAKIT_NEXT_SESSION_HANDOFF_2026-10-09.md` (เขียนโดยอีกฝ่าย) |

ไฟล์ gitignored ในเครื่อง: `.env.local` (ค่า demo local ล้วน), `.db_data/` (ข้อมูลทดสอบ "ข้อมูลทดสอบ:") — เก็บไว้จนตรวจรับ Member PWA เสร็จ; `.claude/skills/*` (junction ท้องถิ่น ชี้ไป `.agents/skills`)

## งานล่าสุดที่เสร็จ

1. Member PWA Phase 0–1 (shell + `MemberHome` + ปุ่มลงทะเบียน) — เสร็จทางเทคนิค **รอผู้ใช้ตรวจรับภาพ**
2. ข้อกำหนดผลิตภัณฑ์ ADR 002–004 + PRD/แผน/AGENTS ปรับสอดคล้อง; W4 ตัดสินแล้ว (ทางเลือก ก)
3. ระบบหน่วยความจำ/handoff (ไฟล์นี้และ skills) — ตั้งค่าเสร็จ **ยังไม่ได้ทดสอบกับ session ใหม่จริง**

## ตัวบล็อกและคำถามค้าง (รายละเอียดอยู่ที่ไฟล์ที่ชี้)

- **ระบบหน่วยความจำใหม่ยังไม่ได้ทดสอบกับ session ใหม่** (skills ผ่าน junction, `@import`, auto memory) — ขั้นตอนทดสอบอยู่ใน `.ai/HANDOFF.md`; ถ้า `/skills` ไม่เห็น skill ทั้งสี่ ต้องเปลี่ยน junction เป็นสำเนา/symlink
- **ผู้ใช้ยังไม่ได้ตัดสิน:** (ก) ชื่อ skill `handoff` ที่ถูก skill ส่วนตัวบัง (DECISIONS D14) (ข) จะเก็บไฟล์ Claude (`CLAUDE.md`, `.ai/`, skills) ใน repo หรือไม่ เทียบกับแพ็กเกจ `Work\claude-removal` (D16) (ค) คง `@AGENTS.md` import ที่โหลด 250 บรรทัดทุก session หรือไม่ (D17)
- **Q24** production verification: `NOT VERIFIED` รอผู้ดูแล production ส่งตัวเลข read-only → `docs/adr/adr-002.md`
- `MemberHome` (2026-10-10): ผู้ใช้มอบอำนาจตัดสินใจทางเทคนิคด้าน UX แล้ว แก้ลำดับ/กรอบปุ่ม (DECISIONS D18) ตรวจแล้ว: `tsc`, `vitest` 43 ไฟล์/531 tests, build, Chromium 360×740 + 390×844 (ดู `.ai/CHANGELOG.md`) — **ผู้ใช้ยังไม่ได้รับรองภาพ (Q21)** ภาพใหม่ `Work\_shots-member-home-r6\r6\` ยังไม่มี contact sheet; **Q13 ไม่เริ่ม** (ข้อห้ามยังมีผล)
- Open decisions: ADR 002 O1–O6 · ADR 003 S2–S8 · ADR 004 W5–W11 — W8, W10, W11, S3, S7 บันทึกตัวเลือก/ผลกระทบ/คำแนะนำไว้แล้วที่ DECISIONS D19–D23 (ยัง **open** เจ้าของผลิตภัณฑ์ต้องตัดสิน; ADR ยัง `proposed`)
- **⚠️ BLOCKER ใหม่ (2026-10-10): Production deploy จาก `main` (`4dd66ab`) แต่งานทั้งหมดของ session นี้อยู่บน `master` และสองสาขาไม่ต่อกัน (tracker D58, DECISIONS D30)** — release D54 **หยุด** (patch ใช้กับ `main` ไม่ได้; บน `main` D54 ไม่เกิดตามโค้ด — รันจริงกับโค้ดของ `main`); audit/baseline ด้านล่างเป็นของ `master` ไม่ใช่ production; Production จริง **NOT VERIFIED**; ชุดอ้างอิง `Work\_release-d54\`
- **ฐานตรวจโมเดลการดำเนินงาน (2026-10-10):** `docs/PUNTAKIT_MISSION_OPERATING_MODEL_BASELINE.md` — ยังไม่มีรายงานรายสัปดาห์/เป้าหมาย/สถิติตามลำดับชั้น/ระดับแคร์ · **D54 (เบอร์สมาชิกรั่วที่ `GET /groups/:id/members` และ `/groups/:id`) แก้แล้ว 2026-10-10 ในโค้ด/เทสต์เครื่องนี้ (tracker R7; เทสต์ 40 ข้อ; ชุดเต็ม 47 ไฟล์/588 tests ผ่าน) — ยังไม่ deploy ยังไม่ได้ตรวจ production** · D55 (ผู้นำแก้สังกัด/ผู้นำกลุ่มตน), D56, D57 **ยังไม่แก้ รออนุมัติแยก** · BLOCKER ใหม่: N1 (ความหมาย "49 กลุ่ม") ขวางการออกแบบสถิติ · ข้อตัดสินใจ N1–N11 รอเจ้าของ (DECISIONS D28)
- Premium Phase 2 (2026-10-10): จัดองค์ประกอบ `/members` `/groups` `/events` เสร็จตามขอบเขต — `tsc` · `vitest` 46 ไฟล์/548 tests · build ผ่าน · ภาพก่อน–หลัง `Work\_shots-premium-p2\` · StatusChip contrast เดิมยังไม่แก้ · หน้าแอดมินอื่นยังเป็นแค่ shell · ดู `.ai/CHANGELOG.md`
- Premium admin shell (2026-10-10, ทำบางส่วน — ดู `.ai/CHANGELOG.md`): shell + พื้นผิวทุกหน้าแอดมิน, hero เฉพาะ Home; `tsc`/`vitest` 44 ไฟล์ 536 tests/build ผ่าน; 16 หน้า × 4 viewport ไม่มี overflow/console error · **ไม่ได้ใช้ 21st.dev (ไม่มี MCP)** · sign-in/sign-up และ dialog **NOT VERIFIED** · member PWA ถูกกันออกโดย test (D24/D25)
- Q24 (2026-10-10): ค้นไฟล์ใน `Work\` แล้ว ไม่พบหลักฐานจากผู้ดูแล production → **BLOCKED / NOT VERIFIED**

## ข้อห้ามที่ยังมีผล (ผู้ใช้กำกับ — ยกมาตามถ้อยคำ ห้ามตีความขยาย)

ห้ามแก้ application code / shared security code / schema / migration / ข้อมูลจริง · ห้าม commit, push, merge, deploy จนกว่าผู้ใช้อนุมัติแยกต่างหาก · ห้ามเปลี่ยน ADR เป็น `accepted` · ห้ามเริ่ม Q13 (อีก 4 หน้า Member PWA) · ห้ามแตะ `README.md` และ `puntakit-readme.patch` · ห้ามเข้า/เขียน production และห้ามเดา credentials · ห้ามถือว่าตัวเลข 6/20/52/49 ผ่านการตรวจ

## Next action (เดียว)

ผู้ใช้ตอบ Q21 (ผ่าน/ไม่ผ่านภาพ `MemberHome` หลังแก้) และตัดสิน D19–D23 หรือส่งหลักฐาน Q24 — งานที่ไม่ขึ้นกับสามเรื่องนี้ไม่เหลือในแผนที่ไม่ละเมิดข้อห้าม (ถัดไปตามแผน §6 ข้อ 6 คือเทสต์ PGlite ของดัชนี W4 ซึ่งยัง **ไม่ได้รับอนุมัติ**) · ทดสอบระบบหน่วยความจำใน `.ai/HANDOFF.md` ได้ใน session ใหม่
