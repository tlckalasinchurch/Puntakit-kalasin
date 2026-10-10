<!-- last_verified: 2026-10-09 -->
# PROJECT — Puntakit Kalasin (ความรู้ถาวรของโปรเจกต์)

> ไฟล์นี้เป็น **ดัชนีความรู้ที่ไม่เปลี่ยนบ่อย** — เนื้อหาจริงอยู่ในเอกสารต้นทางด้านล่าง **ห้ามคัดลอกมาที่นี่** (กฎเดียวกับ `AGENTS.md`) สถานะปัจจุบันอยู่ที่ `.ai/CURRENT.md`

## คืออะไร

เว็บแอปภายในสำหรับคริสตจักรเดียว (ภาษาไทยเป็นหลัก) บริหารคน: สมาชิก กลุ่ม/พันธกิจ เช็คชื่อ เยี่ยมติดตาม กิจกรรม ข้อมูลเป็นข้อมูลส่วนบุคคลของสมาชิก จึงถือความปลอดภัยเป็นเงื่อนไขหลัก ไม่ใช่ SaaS สาธารณะ

## ที่ที่ความจริงอยู่ (อ่านเท่าที่งานต้องใช้)

| เรื่อง | ไฟล์ |
|---|---|
| กฎ ownership, invariants, gate, ข้อห้าม | `AGENTS.md` (โหลดผ่าน `@AGENTS.md` ใน `CLAUDE.md`) |
| สถาปัตยกรรม, glossary, ความเสี่ยง | `ARCHITECTURE.md` |
| ขอบเขตผลิตภัณฑ์ CURRENT เทียบ TARGET | `PRD.md` |
| UI / token / component | `DESIGN_SYSTEM.md` (token จริงอยู่ที่ `client/src/index.css`) |
| ข้อกำหนดโครงสร้างองค์กร / สิทธิ์ / รายงานรายสัปดาห์ (`proposed`) | `docs/adr/adr-002.md` · `003` · `004` |
| โมเดลข้อมูลงานพันธกิจ, import, แผน migration | `docs/PUNTAKIT_MISSION_DOMAIN_PLAN.md` |
| แผนที่เอกสารทั้งหมด | `docs/README.md` |
| คำสั่ง build/test และกับดักการรันในเครื่อง | `CLAUDE.md`, `docs/PUNTAKIT_AGENT_GUIDE.md` |

## กฎโดเมนที่พลาดง่าย (ตัวต้นทางอยู่ในเอกสารข้างบน)

- ตรวจไม่ได้ = เขียน `NOT VERIFIED` ห้ามเดา ห้ามแต่งตัวเลข; ตัวเลขขนาดองค์กร 6/20/52/49 ยังไม่ผ่านการตรวจ
- ห้ามเปลี่ยนป้าย UI ที่มีมติเดิม ("พันธกิจ" บนระดับ `care`) โดยพลการ — ศัพท์ระดับองค์กรอยู่ที่ ADR 002 ที่เดียว
- Standing rules ของข้อมูลนำเข้า (ห้ามคำนวณวันเกิดจากอายุ, ห้ามใช้ชื่อเล่นเป็นตัวตนจริง ฯลฯ) อยู่ที่ `docs/PUNTAKIT_MISSION_DOMAIN_PLAN.md`
- Clerk เป็น identity provider เดียวใน production; ห้ามเปิด demo mode หรือใช้ PGlite ใน production
- Member PWA (`/app/*`) ไม่ใช่หน้าผู้บริหาร — อย่านำรูปแบบไปใช้กับ dashboard ตามบทบาทอื่น
- เอกสารทุกฉบับมี `<!-- last_verified -->`; ADR `accepted` แก้เนื้อหาไม่ได้ (`proposed` แก้ได้)

## ตำแหน่ง checkout

repo หลัก: `Work\Puntakit-kalasin\Puntakit-kalasin-main` (branch `master`) · มี git worktree แยกที่ `Work\_wt-main` (branch `port/batch1-d53`) ซึ่ง **เป็น checkout อีกชุด** มี `CLAUDE.md` เวอร์ชันเก่า — ห้ามนำไปปะปน (auto memory ของ Claude Code ใช้ร่วมกันทุก worktree ของ repo เดียวกัน)
