<!-- last_verified: 2026-10-09 -->
# HANDOFF — สำหรับ session ถัดไป (เขียนทับทุกครั้งที่ `/handoff`)

> ผู้ใช้ไม่ต้องการให้อธิบายซ้ำ เริ่มด้วย `/brief` แล้วทำต่อ รายละเอียดเต็มและลำดับงานอยู่ที่ **`PUNTAKIT_NEXT_SESSION_PLAN_2026-10-10.md`** (ไม่คัดลอกมาที่นี่) ถ้ายังไม่เห็นสถานะ ให้ตรวจ `git status --short` ก่อน

**บันทึกเมื่อ:** 2026-10-09 14:30 (-0300) · branch `master` · HEAD `3afed5b` · **ไม่มี commit ใหม่** ในงานนี้ · dev server (3000/3001) ตอบ 200 ตอนบันทึก — หลังเปิดโปรแกรมใหม่ต้องตรวจก่อน

## ขั้นแรก: ทดสอบระบบหน่วยความจำใหม่ (ยังไม่เคยทดสอบกับ session ใหม่)

เปิดโปรแกรมใน `Puntakit-kalasin-main` → (1) พิมพ์ `/skills` ควรเห็น `brief` `focus` `wrap` `handoff` (ถ้า `handoff` อธิบายว่า "Compact the current conversation…" = skill ส่วนตัวบังอยู่ ตามที่คาด) (2) `/memory` เห็นไฟล์ `puntakit-*` และ auto memory เปิด (3) `/brief` ควรสรุปสถานะจริง ข้อห้าม Q24 `NOT VERIFIED` และ next action โดยไม่ถามกลับ (4) ถามว่า "ห้ามทำอะไรตอนนี้" ควรตอบตรง `CURRENT.md` (แปลว่า `@import` ทำงาน) (5) ถ้าไม่เห็น skill ทั้งสี่ → junction ใช้ไม่ได้ ให้เปลี่ยนเป็นสำเนา/symlink แล้วรายงานผู้ใช้ — สคริปต์ตรวจโครงสร้าง: `node Work\_tools-member-pwa\validate-memory-setup.js <repoRoot>`

## ลำดับเริ่มต้น

1. `/brief` (หรือทำตามมือ: อ่านไฟล์นี้ → `.ai/CURRENT.md` → `.ai/DECISIONS.md`; ตรวจ `git status --short`, branch, HEAD, `git worktree list`)
2. อ่าน `PUNTAKIT_NEXT_SESSION_PLAN_2026-10-10.md` §6 (ลำดับงาน) และ §7 (คำสั่งที่ใช้ได้จริงบนเครื่องนี้ — ไม่มี `pnpm` บน PATH)
3. อ่าน `docs/adr/adr-002.md`, `adr-003.md`, `adr-004.md` (ทั้งหมด `proposed`) เมื่อแตะเรื่ององค์กร/สิทธิ์/รายงาน

## ข้อห้ามที่ต้องรักษา (ยกตามถ้อยคำ)

ห้ามแก้ application code / shared security code / schema / migration / ข้อมูลจริง · ห้ามรัน migration · ห้าม commit, push, merge, deploy เว้นแต่ผู้ใช้อนุมัติแยกต่างหาก · ห้ามเปลี่ยน ADR เป็น `accepted` · ห้ามเริ่ม Q13 · ห้ามแตะ `README.md` และ `puntakit-readme.patch` · ห้ามเข้า production หรือเดา credentials · ตัวเลข 6/20/52/49 และ Q24 คง `NOT VERIFIED` จนกว่ามีหลักฐาน

## Next action

2026-10-10 (**อ่านก่อน**): Production = สาขา `main` แต่ repo ที่เปิดอยู่คือ `master` ซึ่งไม่ต่อกับ `main` — อย่า commit/push/merge/deploy งานจาก `master` และอย่าถือว่าผล audit ของ `master` เป็นของ production · ดู `Work\_release-d54\RELEASE_REPORT.md` · รอเจ้าของตัดสิน DECISIONS D30 · 2026-10-10 (D54 แก้แล้วในเครื่อง — บน `master` เท่านั้น): ปิดบังเบอร์ที่ `/groups/:id/members` + `/groups/:id` (`groups.ts`, `members.ts`, เทสต์ใหม่ `groupMemberPrivacy.test.ts` 40 ข้อ) — **ยังไม่ commit/deploy/ตรวจ production** · ต้องให้เจ้าของอนุมัติการ deploy แยก · D55–D57 ยังเปิด · พบ/แก้ผลข้างเคียง line ending (LF→CRLF) ของไฟล์ที่ผมแก้ด้วย Python — ใช้ Edit tool หรือเขียนไฟล์แบบคงบรรทัด `\n` เมื่อแก้ไฟล์ repo · 2026-10-10 (Operating Model Baseline): เอกสารฐานตรวจที่ `docs/PUNTAKIT_MISSION_OPERATING_MODEL_BASELINE.md` — อ่านก่อนวางแผนรายงาน/เป้าหมาย/สิทธิ์ · **ก่อนขยาย UI ที่แสดงข้อมูลสมาชิก ต้องปิด D54–D57 (ต้องได้รับอนุมัติ) และให้เจ้าของตัดสิน N1** · ยังไม่ได้แก้อะไรในโค้ด · 2026-10-10 (Premium Phase 2): `/members` `/groups` `/events` จัดองค์ประกอบแล้ว (D26) ยังไม่ commit · ค้าง: Modal/ฟอร์มของสามหน้า, หน้าแอดมินที่เหลือ (Feed, Attendance, Announcements, Reports ฯลฯ), เห็นภาพ sign-in จริง, แก้ contrast ของ `StatusChip` ที่ token · 2026-10-10 (premium shell): เพิ่ม premium layer เฉพาะ admin shell (D24) — ยังไม่ commit · ค้าง: เห็นภาพ sign-in จริง, motion ของ Modal/Drawer, composition เฉพาะหน้าอื่นนอกจาก Home, baseline ภาพ before/after · ปลดล็อก member PWA ต้องรอ Q21+Q13 (D25) · 2026-10-10: `MemberHome` แก้แล้ว (DECISIONS D18) และตรวจผ่านตาม `.ai/CHANGELOG.md` · Q24 BLOCKED (ไม่มีหลักฐาน) · W8/W10/W11/S3/S7 มีคำแนะนำที่ D19–D23 รอเจ้าของผลิตภัณฑ์ · ยังไม่ได้ commit · ขั้นต่อไป: ตรวจว่าผู้ใช้ตอบ Q21 / D19–D23 / Q24 แล้วหรือยัง (ถามซ้ำไม่เกินหนึ่งครั้ง) ห้ามเริ่ม Q13 จนกว่าผู้ใช้รับรองภาพและสั่งแยก

## ผลตรวจที่บันทึกไว้ (ไม่ใช่การตรวจสด — ต้องรันซ้ำก่อนอ้าง)

`tsc` ผ่าน · `vitest` 43 ไฟล์ / 531 tests ผ่านที่ `TZ=UTC` · `vite build` + `esbuild` server ผ่าน (รันล่าสุด 2026-10-10 หลังแก้ `MemberHome`) · **NOT VERIFIED:** สแกน QR ด้วยกล้องจริง, safe-area บน iPhone, dark mode, screen reader, ดัชนี W4 (ไม่มี DDL/เทสต์), ระบบ memory/skills กับ session ใหม่

## ระวัง

- 2026-10-10: skill ส่วนตัว `~/.claude/skills/{brief,wrap,handoff}` มีข้อความ "Project override" ให้ทำตาม `.claude/skills/<ชื่อ>/SKILL.md` ของโปรเจกต์ก่อน (ยังไม่ได้ทดสอบใน session ใหม่) — ถ้าไม่ทำงาน ให้ทำตามมือด้านล่าง
- ชื่อ skill `handoff` ของโปรเจกต์ถูก skill ส่วนตัวชื่อเดียวกันบัง — ถ้า `/handoff` เปิดข้อความ "Compact the current conversation…" ให้ทำตาม `.agents/skills/handoff/SKILL.md` ด้วยมือ (DECISIONS D14)
- `PUNTAKIT_NEXT_SESSION_HANDOFF_2026-10-09.md` ที่รากเขียนโดยอีกฝ่าย และกล่าวว่า W4 เป็นตัวบล็อก — **ล้าสมัยแล้ว** (W4 ตัดสินแล้ว ดู D6)
