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

  it("the card refinement is a new block appended after the print rules and never touches the card's data", () => {
    const start = css.indexOf("Membership card refinement");
    expect(start).toBeGreaterThan(css.indexOf("/* Print only the card"));
    const block = css.slice(start);
    // Corners follow the card's own box (a % radius), not a viewport-based cqw on the container itself.
    expect(block).toMatch(/\.pk-card\s*\{[^}]*border-radius:\s*[\d.]+%\s*\/\s*[\d.]+%/);
    // Gold frame and sheen are pseudo-elements, and the sheen is dropped when printing.
    expect(block).toContain(".pk-card::before");
    expect(block).toContain(".pk-card::after");
    expect(/@media print\s*\{[^}]*\.pk-card::before\s*\{[^}]*display:\s*none/.test(block)).toBe(true);
    // No animation: the card is a document, not an ornament.
    expect(block).not.toMatch(/@keyframes|animation\s*:/);
    // Plate has ellipsis and name has line-clamp to prevent overflowing on long names
    expect(block).toContain(".pk-card__plate");
    expect(block).toContain("-webkit-line-clamp: 2");
    // Still no baked-in data or contact fields in the card component.
    expect(card).not.toMatch(/phone|email|lineId|address/i);
  });

  it("the memberships page keeps 44px targets, real tabs and the role-scoped API call in the lighter layout", () => {
    const page = read("client/src/pages/Memberships.tsx");
    expect(page).toContain('role="tablist"');
    expect(page).toContain('role="tab"');
    expect(page).toContain("aria-selected={tab === t.id}");
    expect(page).toContain("pk-ms-row");
    expect(page).toContain("ไม่พบสมาชิกที่ตรงกับคำค้น");
    // The list still comes from the one scoped endpoint; the page decides nothing about who may see whom.
    expect(page).toContain('"/api/memberships/overview?filter=all&limit=500"');
    const start = css.indexOf("Membership review");
    expect(start).toBeGreaterThan(css.indexOf("Membership card refinement"));
    const block = css.slice(start);
    const minRem = (selector: string) => {
      const m = new RegExp(`${selector.replace(/[.[\]]/g, "\\$&")}\\s*\\{[^}]*min-height:\\s*([\\d.]+)rem`).exec(block);
      return m ? Number(m[1]) * 16 : 0;
    };
    expect(minRem(".pk-ms-tab")).toBeGreaterThanOrEqual(44);
    expect(minRem(".pk-ms-row")).toBeGreaterThanOrEqual(44);
    // Status is words, not colour alone: the chips render the summary label text.
    expect(page).toContain("{i.summary.label}");
  });

  it("the photo sheet shows upload progress and keeps its tall, full-width pick buttons", () => {
    const sheet = read("client/src/components/home/MissionPhotoSheet.tsx");
    expect(sheet).toContain('role="progressbar"');
    for (const attr of ["aria-valuemin", "aria-valuemax", "aria-valuenow"]) expect(sheet).toContain(attr);
    expect(sheet).toContain("min-h-14"); // 56px pick buttons
    expect(sheet).toContain("sm:flex-row"); // side by side from 640px, stacked on a phone
    expect(sheet).toContain('aria-live="polite"');
    expect(sheet).toContain("ยังไม่เผยแพร่");
    // Save button is disabled only when busy, so save() handles validation messaging
    expect(sheet).toContain("disabled={busy}");
    // The upload pipeline itself is unchanged.
    expect(sheet).toContain("uploadMissionPhoto");
    expect(sheet).toContain('"/api/activities"');
    expect(sheet).toContain('type: "ministry_update"');
  });

  it("the membership panel checks fee against constant and shows read-only notice", () => {
    expect(panel).toContain("value < ORDINARY_FEE_BAHT");
    expect(panel).toContain("อ่านอย่างเดียว");
  });

  it("home quick actions are gated by the shared role sets and render above error", () => {
    expect(home).toMatch(/hasRole\(user\?\.role, CREATE_ROLES\)/);
    expect(home).toMatch(/hasRole\(user\?\.role, MEMBERSHIP_VIEW_ROLES\)/);
    // "ดูทั้งหมด" is a real disclosure, not decoration.
    expect(home).toContain('aria-expanded={moreOpen}');
    // Which tiles a role gets is decided by `homeTilesFor`, not by a role list in the component.
    expect(home).toContain("homeTilesFor(");
    // Tiles render before ErrorState check so user can navigate even if overview fails
    const tilePos = home.indexOf('id="home-quick"');
    const errorPos = home.indexOf("<ErrorState");
    expect(tilePos).toBeGreaterThan(0);
    expect(errorPos).toBeGreaterThan(tilePos);
  });

  it("the home tile block is appended after the existing card rules and keeps text at 12px or more", () => {
    const start = css.indexOf("Home quick actions v2");
    expect(start).toBeGreaterThan(css.indexOf("/* Print only the card"));
    const block = css.slice(start);
    const sizes = [...block.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(0);
    for (const size of sizes) expect(size).toBeGreaterThanOrEqual(12);
  });

  it("tiles and buttons keep a 44px target", () => {
    // Tiles are sized by the `.pk-home-tile` block: whole-tile target, well above 44px.
    expect(home).toContain("pk-home-tile");
    const tile = /\.pk-home-tile\s*\{[^}]*min-height:\s*([\d.]+)rem/.exec(css);
    expect(tile, ".pk-home-tile must set a min-height in rem").toBeTruthy();
    expect(Number(tile![1]) * 16).toBeGreaterThanOrEqual(44);
    expect(panel).toContain("min-h-11");
    expect(read("client/src/pages/Memberships.tsx")).toContain("min-h-11");
  });

  it("E2E-AUDIT items 3, 6, 8, 12, 13 stay fixed", () => {
    // 6: payment date uses the Thai DateField, not a native mm/dd/yyyy input.
    const panel = code("client/src/components/membership/MembershipPanel.tsx");
    expect(panel).toContain("<DateField");
    expect(panel).not.toContain('type="date"');
    // 8: the panel outlives the overview row, so a closed term shows history and the restart buttons.
    const page = code("client/src/pages/Memberships.tsx");
    expect(page).toContain("open={openId !== null}");
    expect(page).not.toContain("opened !== null");
    // 12: viewer must not call /api/care/groups.
    const members = code("client/src/pages/Members.tsx");
    expect(members).toContain("hasRole(user?.role, CREATE_ROLES)");
    expect(members).toContain("if (!canLoadCareGroups)");
    // 3: a group_leader's empty states name the scope instead of claiming the system is empty.
    expect(members).toContain("ยังไม่มีสมาชิกในขอบเขตของคุณ");
    expect(code("client/src/pages/CareToday.tsx")).toContain("ยังไม่มีพันธกิจในขอบเขตของคุณ");
    // 13: recent-member names wrap instead of truncating. (This item also pinned the 44px target of the
    // disabled weekly-report button; that placeholder was removed from Home on purpose, and
    // home-contract.test.ts now asserts it stays gone.)
    const home = code("client/src/pages/Home.tsx");
    expect(home).toContain("line-clamp-2 block break-words");
  });
});
