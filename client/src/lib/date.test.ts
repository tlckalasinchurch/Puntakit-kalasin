import { describe, expect, it } from "vitest";
import { dateToIso, formatThaiDate, isoToDate } from "./date";

describe("isoToDate", () => {
  it("parses a YYYY-MM-DD into a local date", () => {
    const d = isoToDate("2026-10-04");
    expect(d).toBeInstanceOf(Date);
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(9); // October is index 9
    expect(d?.getDate()).toBe(4);
  });

  it("returns undefined for empty or malformed input", () => {
    expect(isoToDate("")).toBeUndefined();
    expect(isoToDate("2026/10/04")).toBeUndefined();
    expect(isoToDate("04-10-2026")).toBeUndefined();
  });

  it("rejects impossible dates instead of rolling over", () => {
    expect(isoToDate("2026-02-30")).toBeUndefined();
    expect(isoToDate("2026-13-01")).toBeUndefined();
  });
});

describe("dateToIso", () => {
  it("formats a local date as zero-padded YYYY-MM-DD", () => {
    expect(dateToIso(new Date(2026, 9, 4))).toBe("2026-10-04");
    expect(dateToIso(new Date(2026, 0, 7))).toBe("2026-01-07");
  });

  it("round-trips with isoToDate", () => {
    const d = isoToDate("2026-10-04");
    expect(d).toBeDefined();
    expect(dateToIso(d as Date)).toBe("2026-10-04");
  });
});

describe("formatThaiDate", () => {
  it("returns an empty string when unset", () => {
    expect(formatThaiDate("")).toBe("");
  });

  it("uses the Gregorian year for Thai display", () => {
    expect(formatThaiDate("2026-10-04")).toContain("2026");
  });
});
