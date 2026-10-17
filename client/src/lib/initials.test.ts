import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { initialOf } from "./initials";

describe("initialOf: Thai names", () => {
  it.each([
    ["สมชาย ใจดี", "ส"],
    ["กัญญา", "ก"],
    ["ก็อต", "ก"], // a tone/vowel mark after the consonant does not become the initial
    ["นางสาวพิมพ์", "น"], // titles are not stripped (policy, not rendering)
  ])("%s -> %s", (name, expected) => expect(initialOf(name)).toBe(expected));

  it.each([
    ["เอก", "อ"],
    ["แสงเดือน", "ส"],
    ["โชติ", "ช"],
    ["ใจดี", "จ"],
    ["ไพบูลย์", "พ"],
    ["เเม็ก", "ม"], // two leading vowels typed in a row
  ])("a leading vowel is skipped: %s -> %s", (name, expected) => expect(initialOf(name)).toBe(expected));

  it("never returns a Thai vowel or tone mark", () => {
    for (const name of ["เอก", "แก", "โต", "ไข", "ใบ", "ะกา", "ำก", "ๆกา", "่กา"]) {
      expect(initialOf(name)).toMatch(/^[\u0E01-\u0E2E?]$/);
    }
  });
});

describe("initialOf: other input", () => {
  it("upper-cases Latin letters and keeps accents", () => {
    expect(initialOf("john doe")).toBe("J");
    expect(initialOf("émile")).toBe("É");
  });

  it("skips leading spaces, punctuation, digits and emoji", () => {
    expect(initialOf("   กมล")).toBe("ก");
    expect(initialOf("(สมชาย)")).toBe("ส");
    expect(initialOf("12 anna")).toBe("A");
    expect(initialOf("😀 ฟ้า")).toBe("ฟ");
  });

  it("handles a letter outside the BMP as one character", () => {
    expect(initialOf("𠀀x")).toBe("𠀀");
  });

  it("falls back to '?' when there is no letter", () => {
    for (const name of ["", "   ", "123", "—", "เ", "😀", null, undefined]) expect(initialOf(name)).toBe("?");
  });
});

describe("initialOf is what Home's recent-members avatar uses (R5)", () => {
  const root = path.resolve(import.meta.dirname, "..", "..", "..");
  const home = readFileSync(path.join(root, "client/src/pages/Home.tsx"), "utf8");

  it("no raw slice(0, 1) of a member name remains in Home", () => {
    expect(home).not.toMatch(/member\.name\.slice\(0, ?1\)/);
    expect(home).toContain("{initialOf(member.name)}");
    expect(home).toContain('import { initialOf } from "@/lib/initials";');
  });
});
