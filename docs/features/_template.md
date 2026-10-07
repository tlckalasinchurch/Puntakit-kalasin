<!-- last_verified: 2026-10-07 -->
# <ชื่อ Feature>

> **Template นี้เขียนเฉพาะ feature ที่ถูกแตะจริง** — ไม่ต้องเขียนครบทุก feature ในระบบ
> เป้าหมายคือให้ agent อ่านแล้ว "รู้ว่าจะพังได้ตรงไหน" ก่อนแก้
> ทุกช่องต้องมาจากโค้ดจริง — ตรวจไม่ได้ให้เขียน `NOT VERIFIED` **ห้ามเดา**

| | |
|---|---|
| **สถานะ** | implemented / partial / planned |
| **หน้า (UI)** | `client/src/pages/<...>.tsx` |
| **Route** | `server/routes/<...>.ts` (mount ที่ `<path>`) |
| **Schema** | ตารางที่เกี่ยวข้องใน `shared/schema.ts` |
| **เจ้าของ (owner)** | Frontend / Backend / Database / … |

## Purpose

หนึ่งย่อหน้า: feature นี้แก้ปัญหาอะไรให้ใคร

## Inputs / Outputs

| ทิศทาง | อะไร | ที่มา/ปลายทาง | Validation |
|---|---|---|---|
| in | | | `shared/validation.ts:<schema>` |
| out | | | |

## Flow

1. ผู้ใช้ทำอะไร → เรียกอะไร
2. ฝั่ง server: route → guard → validation → data access → response
3. ฝั่ง client: state → render

## Edge cases ที่ต้องไม่พัง

- [ ] ข้อมูลว่าง (empty state — ต้องไม่ใช่ loading)
- [ ] โหลดไม่สำเร็จ (error state — ต้องมีทาง retry)
- [ ] สิทธิ์ไม่พอ (403) — ต้องเป็นข้อความไทยที่ผู้ใช้เข้าใจ
- [ ] ข้อมูลว่าง/ค่า null ในฟิลด์ที่บังคับ
- [ ] <เพิ่มเฉพาะของ feature นี้>

## UX states

| state | เป็นอย่างไร |
|---|---|
| loading | Skeleton (ไม่ใช่ `"..."`) |
| empty | `EmptyState` + `title`/`description`/`action` |
| error | `ErrorState` — ประโยคไทย, ข้อความเทียบซ่อนหลัง "รายละเอียดทางเทคนิค" |
| <...> | |

## Verification

| | |
|---|---|
| **Quick** | `<คำสั่งเดียวที่เร็ว เช่น pnpm exec vitest run server/routes/<x>.test.ts>` |
| **Full** | `TZ=UTC pnpm install --frozen-lockfile && TZ=UTC pnpm check && TZ=UTC pnpm test && TZ=UTC pnpm build` |
| **Pass criteria** | <ผลที่ต้องเห็นเป๊ะ ๆ ไม่ใช่ "น่าจะผ่าน"> |
| **หลักฐานที่ต้องแนบ** | <คำสั่ง + ผลที่ได้> |

## Related docs

- [`ARCHITECTURE.md`](../../ARCHITECTURE.md) — ถ้าแตะโครงสร้าง/DB/auth
- [`DESIGN_SYSTEM.md`](../../DESIGN_SYSTEM.md) — ถ้าแตะ UI
- [`docs/exec-plans/tech-debt-tracker.md`](../exec-plans/tech-debt-tracker.md) — หนี้ที่เกี่ยวกับ feature นี้
