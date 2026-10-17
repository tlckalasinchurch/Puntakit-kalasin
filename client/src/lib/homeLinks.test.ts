import { describe, expect, it } from "vitest";
import { mergeHomeLinks } from "./homeLinks";

const base = [
  { href: "/members", label: "สมาชิก" },
  { href: "/groups", label: "พันธกิจ" },
];

describe("mergeHomeLinks", () => {
  it("keeps every base link in order", () => {
    expect(mergeHomeLinks(base, [], new Set())).toEqual(base);
  });

  it("appends a role link whose destination is not yet reachable", () => {
    const out = mergeHomeLinks(base, [{ href: "/reports", label: "รายงานและสถิติ" }], new Set());
    expect(out.map(l => l.href)).toEqual(["/members", "/groups", "/reports"]);
  });

  it("drops a role link that duplicates a base link, keeping the base label", () => {
    const out = mergeHomeLinks(base, [{ href: "/members", label: "จัดการสมาชิก" }], new Set());
    expect(out).toEqual(base);
  });

  it("drops a role link already shown as a tile", () => {
    const out = mergeHomeLinks(base, [{ href: "/care", label: "เช็คชื่อพันธกิจ" }], new Set(["/care"]));
    expect(out).toEqual(base);
  });

  it("keeps a role link whose tile is not rendered for this user", () => {
    const out = mergeHomeLinks(base, [{ href: "/care", label: "เช็คชื่อพันธกิจ" }], new Set());
    expect(out.map(l => l.href)).toContain("/care");
  });

  it("does not add the same extra destination twice", () => {
    const extra = [
      { href: "/reports", label: "รายงานและสถิติ" },
      { href: "/reports", label: "รายงาน" },
    ];
    expect(mergeHomeLinks(base, extra, new Set()).filter(l => l.href === "/reports")).toHaveLength(1);
  });
});
