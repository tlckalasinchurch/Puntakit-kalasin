import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { careNumberOf, formatCardDate, plateTextOf } from "./components/membership/MemberCard";
import { planImageSize } from "./lib/imageSizing";
import { describeDaysToEnd, formatThaiDay } from "./lib/membershipFormat";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(REPO_ROOT, rel), "utf8");
/** Source without comments, so a doc comment that mentions a field is not a reference to it. */
const code = (rel: string) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("membership card helpers", () => {
  it("takes the care number from the care group's name", () => {
    expect(careNumberOf("แคร์ 13")).toBe("13");
    expect(careNumberOf("พันธกิจที่ 07")).toBe("7");
    expect(careNumberOf("แคร์ ไม่มีเลข")).toBeNull();
    expect(careNumberOf(null)).toBeNull();
  });

  it("puts the nickname on the plate, else the first word of the name", () => {
    expect(plateTextOf("สุรชัย ทดสอบ", "ชัย")).toBe("ชัย");
    expect(plateTextOf("สุรชัย ทดสอบ", "  ")).toBe("สุรชัย");
    expect(plateTextOf("สุรชัย ทดสอบ", null)).toBe("สุรชัย");
  });

  it("formats dates as dd/mm/yyyy on Thailand's calendar day, whatever the viewer's timezone", () => {
    expect(formatCardDate("2024-12-31")).toBe("31/12/2024");
    // 20:00 UTC on 30 Dec is already 31 Dec in Thailand.
    expect(formatCardDate("2024-12-30T20:00:00.000Z")).toBe("31/12/2024");
    expect(formatCardDate(null)).toBeNull();
    expect(formatCardDate("not a date")).toBeNull();
  });

  it("describes days left in plain Thai", () => {
    expect(describeDaysToEnd(25)).toContain("25");
    expect(describeDaysToEnd(0)).toBe("ครบกำหนดวันนี้");
    expect(describeDaysToEnd(-3)).toContain("เกินกำหนด");
    expect(describeDaysToEnd(null)).toBe("");
    expect(formatThaiDay("2026-10-10")).toMatch(/2569/);
  });
});

describe("planImageSize", () => {
  it("never upscales and keeps the aspect ratio", () => {
    const p = planImageSize(4000, 3000, { maxEdge: 1600 });
    expect(p.dw).toBe(1600);
    expect(p.dh).toBe(1200);
    const small = planImageSize(800, 600, { maxEdge: 1600 });
    expect([small.dw, small.dh]).toEqual([800, 600]);
  });

  it("centre-crops to the requested aspect (card portrait 4:5)", () => {
    const wide = planImageSize(4000, 3000, { maxEdge: 1000, aspect: 4 / 5 });
    expect(wide.sw / wide.sh).toBeCloseTo(0.8, 2);
    expect(wide.sx).toBeGreaterThan(0);
    expect(wide.sy).toBe(0);
    expect(Math.max(wide.dw, wide.dh)).toBe(1000);
    const tall = planImageSize(3000, 6000, { maxEdge: 1000, aspect: 4 / 5 });
    expect(tall.sw / tall.sh).toBeCloseTo(0.8, 2);
    expect(tall.sx).toBe(0);
    expect(tall.sy).toBeGreaterThan(0);
  });
});

/**
 * Source-level contracts (same style as the other client contract tests).
 */
describe("membership UI contracts", () => {
  const card = code("client/src/components/membership/MemberCard.tsx");
  const panel = read("client/src/components/membership/MembershipPanel.tsx");
  const cardPanel = read("client/src/components/membership/MemberCardPanel.tsx");
  const home = read("client/src/components/home/HomeMyWork.tsx");
  const css = read("client/src/index.css");

  it("the card never touches contact fields", () => {
    for (const forbidden of ["phone", "email", "lineId", "address", "emergency"]) {
      expect(card, `MemberCard must not reference ${forbidden}`).not.toMatch(new RegExp(forbidden, "i"));
    }
  });

  it("the card carries no baked-in name, number or date (it only renders props)", () => {
    expect(card).not.toMatch(/\b\d{5}\b/); // no printed member number
    expect(card).toContain("card.name");
    expect(card).toContain("card.memberNo");
    expect(card).toContain("card.avatarUrl");
  });

  it("card text never drops below 12px (every size in the card CSS uses max(12px, …) or is larger)", () => {
    const block = css.slice(css.indexOf(".pk-card {"), css.indexOf("/* Print only the card"));
    const sizes = [...block.matchAll(/font-size:\s*([^;]+);/g)].map((m) => m[1].trim());
    expect(sizes.length).toBeGreaterThan(8);
    for (const size of sizes) {
      // plate/number/photo-initial are display type: a bare cqw value is fine only if it is large.
      if (/^max\(1[2-9]px/.test(size)) continue;
      const cqw = /^([\d.]+)cqw$/.exec(size);
      expect(cqw && Number(cqw[1]) >= 6, `font-size ${size} could fall below 12px on a phone`).toBeTruthy();
    }
  });

  it("the membership panel takes the fee and rules from shared/membership, not literals", () => {
    expect(panel).toContain("ORDINARY_FEE_BAHT");
    expect(panel).not.toMatch(/amountBaht:\s*100\b/);
    // Payment is only offered when the API says the caller may record it.
    expect(panel).toContain("permissions.canRecordPayment");
    expect(panel).toContain("permissions.canDecide");
  });

  it("uploads go through the resizing helper, never a raw File", () => {
    expect(cardPanel).toContain("prepareImage");
    expect(read("client/src/components/home/MissionPhotoSheet.tsx")).toContain("prepareImage");
  });

  it("home quick actions are gated by the shared role sets", () => {
    expect(home).toMatch(/hasRole\(user\?\.role, CREATE_ROLES\)/);
    expect(home).toMatch(/hasRole\(user\?\.role, MEMBERSHIP_VIEW_ROLES\)/);
    // "ดูทั้งหมด" is a real disclosure, not decoration.
    expect(home).toContain('aria-expanded={moreOpen}');
  });

  it("tiles and buttons keep a 44px target", () => {
    expect(home).toContain("min-h-28");
    expect(panel).toContain("min-h-11");
    expect(read("client/src/pages/Memberships.tsx")).toContain("min-h-11");
  });
});
