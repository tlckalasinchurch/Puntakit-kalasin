/**
 * Read-side helpers for the org chart (ศบ. -> body -> care group -> member).
 *
 * The loaded dataset keeps the leader names of a care group and the source
 * details of a member as labelled lines of text (`groups.description`,
 * `members.notes`). These helpers read those lines back into fields. The
 * lines are written by `server/lib/orgDataset.ts`; both files share the
 * labels below. Anything that does not match is ignored, never guessed.
 */

export const HEAD_ROLE = "ศบ.อาจารย์ / หัวหน้าทีม";

const clean = (v: string | undefined): string | null => {
  const t = (v ?? "").replace(/\s+/g, " ").trim();
  return t === "" || t === "-" ? null : t;
};

function lineValue(text: string | null | undefined, label: string): string | null {
  if (!text) return null;
  for (const line of text.split("\n")) {
    if (line.startsWith(`${label}: `)) return clean(line.slice(label.length + 2));
  }
  return null;
}

export function parseCareGroupDescription(description: string | null | undefined) {
  return {
    careLeaderName: lineValue(description, "หนค. (ต้นฉบับ)"),
    coordinatorName: lineValue(description, "ผู้ประสานงาน (ต้นฉบับ)"),
    careCode: lineValue(description, "รหัสแคร์"),
  };
}

export function parseMemberNotes(notes: string | null | undefined) {
  const age = lineValue(notes, "อายุ (ต้นฉบับ)");
  return {
    age: age && /^\d{1,3}$/.test(age) ? Number(age) : null,
    ageRaw: age,
    occupation: lineValue(notes, "อาชีพ"),
    workplace: lineValue(notes, "สถานที่เรียน/ทำงาน"),
    beliefYear: lineValue(notes, "ปีรับเชื่อ (ต้นฉบับ)"),
    goal: lineValue(notes, "เป้าหมายในการสร้าง"),
    builder: lineValue(notes, "ผู้รับผิดชอบสร้าง"),
    nameMissing: (notes ?? "").includes("ไม่มีชื่อ-สกุลในต้นฉบับ"),
  };
}
