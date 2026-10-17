import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

// An avatar initial must skip Thai leading vowels (ไ เ แ โ ใ) — `initialOf()` does; a bare
// `name.slice(0, 1)` shows "ไ" for "ไพรินทร์". Keep every avatar on the shared helper.
const src = path.resolve(import.meta.dirname);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(entry)) out.push(full);
  }
  return out;
}

describe("avatar initials", () => {
  it("no component takes a name's first character with slice(0, 1) or charAt(0)", () => {
    const offenders: string[] = [];
    for (const file of walk(src)) {
      const lines = readFileSync(file, "utf8").split(/\r?\n/);
      lines.forEach((line, i) => {
        if (/name\b[^\n]*\.(trim\(\)\.)?(slice\(0, ?1\)|charAt\(0\))/i.test(line)) {
          offenders.push(`${path.relative(src, file)}:${i + 1}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it("the shared avatars use initialOf", () => {
    for (const rel of ["components/DesignSystem.tsx", "pages/Profile.tsx", "pages/Attendance.tsx", "components/membership/MemberCard.tsx"]) {
      expect(readFileSync(path.join(src, rel), "utf8"), rel).toContain("initialOf(");
    }
  });
});
