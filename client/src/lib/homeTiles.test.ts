import { describe, expect, it } from "vitest";
import { CREATE_ROLES, MEMBERSHIP_VIEW_ROLES, hasRole } from "@shared/roles";
import { USER_ROLES } from "@shared/schema";
import { HOME_TILE_HREF, homeTilesFor, homeMoreLinksFor, BASE_SECONDARY_LINKS } from "./homeTiles";

describe("homeTilesFor", () => {
  it("gives a group leader the three weekly tiles and moves follow-ups into 'ดูทั้งหมด'", () => {
    expect(homeTilesFor("group_leader")).toEqual({ primary: ["care", "photo", "membership"] });
    expect(homeMoreLinksFor("group_leader")[0]).toEqual({ href: "/follow-up", label: "การติดตาม" });
  });

  it.each(["super_admin", "admin", "staff"] as const)("%s keeps all four tiles", (role) => {
    expect(homeTilesFor(role)).toEqual({ primary: ["care", "photo", "membership", "followUp"] });
  });

  it("ministry_leader keeps care, photo and follow-up (no membership tile)", () => {
    expect(homeTilesFor("ministry_leader")).toEqual({ primary: ["care", "photo", "followUp"] });
  });

  it("viewer only keeps the follow-up tile", () => {
    expect(homeTilesFor("viewer")).toEqual({ primary: ["followUp"] });
  });

  it("member and a missing role get no tiles", () => {
    expect(homeTilesFor("member")).toEqual({ primary: [] });
    expect(homeTilesFor(undefined)).toEqual({ primary: [] });
  });

  it.each(USER_ROLES)("%s: tile visibility follows the shared role sets, not a list of its own", (role) => {
    const { primary } = homeTilesFor(role);
    if (role === "member") {
      expect(primary).toEqual([]);
      return;
    }
    expect(primary.includes("care")).toBe(hasRole(role, CREATE_ROLES));
    expect(primary.includes("photo")).toBe(hasRole(role, CREATE_ROLES));
    expect(primary.includes("membership")).toBe(hasRole(role, MEMBERSHIP_VIEW_ROLES));
  });

  it.each(USER_ROLES.filter((r) => r !== "member"))("%s can always reach follow-ups (tile or 'ดูทั้งหมด')", (role) => {
    const { primary } = homeTilesFor(role);
    const hasInSecondary = homeMoreLinksFor(role).some((l) => l.href === HOME_TILE_HREF.followUp);
    expect(primary.includes("followUp") || hasInSecondary).toBe(true);
  });

  it("never lists a tile twice", () => {
    for (const role of USER_ROLES) {
      const { primary } = homeTilesFor(role);
      expect(new Set(primary).size).toBe(primary.length);
    }
  });
});

describe("homeMoreLinksFor (RBP-01 Acceptance Criteria table)", () => {
  const EXPECTED_HREFS: Record<string, string[]> = {
    super_admin: ["/members", "/groups", "/attendance", "/events", "/feed", "/announcements", "/map", "/reports"],
    admin: ["/members", "/groups", "/attendance", "/events", "/feed", "/announcements", "/map", "/reports"],
    staff: ["/members", "/groups", "/attendance", "/events", "/feed", "/announcements", "/map", "/reports"],
    ministry_leader: ["/members", "/groups", "/attendance", "/events", "/feed", "/announcements", "/map", "/ministries"],
    group_leader: ["/follow-up", "/groups", "/members"],
    viewer: ["/members", "/groups", "/attendance", "/events", "/feed", "/announcements", "/map"],
    member: [],
  };

  it.each(USER_ROLES)("%s: returns exact secondary links in order per RBP-01 table", (role) => {
    const links = homeMoreLinksFor(role);
    expect(links.map((l) => l.href)).toEqual(EXPECTED_HREFS[role]);
  });

  it("undefined role (session loading) returns empty list to prevent flashing", () => {
    expect(homeMoreLinksFor(undefined)).toEqual([]);
  });

  it.each(USER_ROLES)("%s: never duplicates hrefs and never duplicates active primary tiles", (role) => {
    const links = homeMoreLinksFor(role);
    const { primary } = homeTilesFor(role);
    const tileHrefs = new Set(primary.map((id) => HOME_TILE_HREF[id]).filter(Boolean));

    // Internal uniqueness:
    const hrefs = links.map((l) => l.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);

    // No overlap with primary tiles:
    for (const href of hrefs) {
      expect(tileHrefs.has(href)).toBe(false);
    }
  });

  it("group_leader returns exactly /follow-up, /groups, /members", () => {
    const links = homeMoreLinksFor("group_leader");
    expect(links.map((l) => l.href)).toEqual(["/follow-up", "/groups", "/members"]);
  });

  it("ministry_leader shows /ministries exactly once at the end", () => {
    const links = homeMoreLinksFor("ministry_leader");
    expect(links.filter((l) => l.href === "/ministries").length).toBe(1);
    expect(links.map((l) => l.href)).toEqual(EXPECTED_HREFS.ministry_leader);
  });

  it("base secondary links contains 7 canonical destinations", () => {
    expect(BASE_SECONDARY_LINKS.map((l) => l.href)).toEqual([
      "/members",
      "/groups",
      "/attendance",
      "/events",
      "/feed",
      "/announcements",
      "/map",
    ]);
  });
});
