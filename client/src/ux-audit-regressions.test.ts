import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Regression guard for the 2026-10 UX/UI audit fixes.
 *
 * Like design-system-consistency.test.ts these are deliberately cheap and
 * structural: they pin the fix so it cannot silently regress, without trying
 * to verify pixels. Behaviour itself lives in the components these tests read.
 */

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(REPO_ROOT, rel), "utf8");

/** Strip comments so a documented example is not reported as a violation. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("UX audit Batch A — accessibility foundations", () => {
  it("viewport meta does not disable pinch-zoom", () => {
    const html = read("client/index.html");
    const viewport = html.match(/<meta\s+name="viewport"[^>]*>/)?.[0] ?? "";
    expect(viewport).not.toEqual("");
    expect(viewport).not.toMatch(/maximum-scale/i);
    expect(viewport).not.toMatch(/user-scalable\s*=\s*no/i);
    expect(viewport).toMatch(/width=device-width/);
  });

  it("login and sign-up pages link both legal documents", () => {
    const legal = read("client/src/components/LegalLinks.tsx");
    expect(legal).toMatch(/href="\/privacy"/);
    expect(legal).toMatch(/href="\/terms"/);
    for (const page of [
      "client/src/pages/ClerkSignInPage.tsx",
      "client/src/pages/ClerkSignUpPage.tsx",
    ]) {
      expect(read(page)).toMatch(/<LegalLinks\s*\/>/);
    }
  });

  it("Modal keeps keyboard users inside the dialog", () => {
    const src = read("client/src/components/DesignSystem.tsx");
    expect(src).toMatch(/"Tab"/); // explicit focus trap
    expect(src).toMatch(/openModalStack/); // only the topmost modal acts on Escape
    expect(src).toMatch(/tabIndex=\{-1\}/); // card is a focus fallback
  });

  it("Modal asks before discarding dirty form input", () => {
    const src = read("client/src/components/DesignSystem.tsx");
    expect(src).toMatch(/discardGuard/);
    // Dirtiness is detected from real user edits, not from snapshot diffing
    // that would misfire on programmatically filled forms.
    expect(src).toMatch(/addEventListener\("input",\s*markDirty,\s*true\)/);
    expect(src).toMatch(/addEventListener\("change",\s*markDirty,\s*true\)/);
    expect(src).toMatch(/มีข้อมูลที่ยังไม่ได้บันทึก/);
    expect(src).toMatch(/ปิดโดยไม่บันทึก/);
  });

  it("ActionButton and SectionHeader navigate internally through wouter Link", () => {
    const src = stripComments(read("client/src/components/DesignSystem.tsx"));
    expect(src).toContain("from \"wouter\"");
    expect(src).toMatch(/<Link\s+href=\{action\.href\}/);
    // Exactly one raw anchor may remain: the genuinely-external fallback.
    const rawAnchors = src.match(/<a\s+href=\{action\.href\}/g) ?? [];
    expect(rawAnchors.length).toBe(1);
  });

  it("ConfirmDialog still rides on the shared Modal", () => {
    expect(read("client/src/components/ConfirmDialog.tsx")).toMatch(
      /<Modal\s+open/
    );
  });
});

describe("UX audit Batch B — form safety and feedback", () => {
  const FORM_PAGES = [
    "client/src/pages/Announcements.tsx",
    "client/src/pages/Events.tsx",
    "client/src/pages/Ministries.tsx",
    "client/src/pages/Church.tsx",
    "client/src/pages/Feed.tsx",
    "client/src/pages/member/MemberProfile.tsx",
    "client/src/components/PrayerRequestModal.tsx",
  ] as const;

  it("every form surfaces submission failure inline, not only as a toast", () => {
    const offenders: string[] = [];
    for (const rel of FORM_PAGES) {
      const src = read(rel);
      if (!src.includes("FormError")) offenders.push(rel);
    }
    // Inbox has two forms, each with its own error state.
    const inbox = read("client/src/pages/Inbox.tsx");
    expect(inbox).toMatch(/\{captureError && <FormError>/);
    expect(inbox).toMatch(/\{publishError && <FormError>/);
    expect(
      offenders,
      `render the shared <FormError> in the form body:\n${offenders.join("\n")}`
    ).toEqual([]);
  });

  it("Feed and PrayerRequestModal validate required fields inline, not via toast", () => {
    const feed = read("client/src/pages/Feed.tsx");
    expect(feed).toMatch(/<Field label="หัวข้อ" required error=\{titleError/);
    expect(feed).not.toMatch(/toast\.error\("กรุณากรอกหัวข้อ"\)/);

    const prayer = read("client/src/components/PrayerRequestModal.tsx");
    expect(prayer).toMatch(/error=\{titleError/);
    expect(prayer).toMatch(/error=\{contentError/);
    // The submit button stays enabled until the request starts; validation
    // happens on submit with inline errors.
    expect(prayer).toMatch(/disabled=\{submitting\}/);
  });

  it("removing a member from a group asks for confirmation", () => {
    const src = read("client/src/pages/Groups.tsx");
    // Two confirmations: delete group, and the previously unconfirmed member removal.
    expect(src.match(/<ConfirmDialog/g)?.length).toBe(2);
    expect(src).toMatch(/ยืนยันการนำออกจากกลุ่ม/);
    expect(src).toMatch(/setRemoveTarget\(gm\)/);
  });
});

describe("UX audit Batch C — navigation and data access", () => {
  it("Members keeps filters, page and the selected member in the URL", () => {
    const src = read("client/src/pages/Members.tsx");
    expect(src).toMatch(/useSearchParams\(\)/);
    for (const key of ["q", "area", "status", "membershipStatus", "page", "member"]) {
      expect(src).toMatch(new RegExp(`p\\.(?:set|delete)\\("${key}"`));
    }
    // Deep links fetch the member directly; a dead id cleans itself from the URL.
    expect(src).toMatch(/\/api\/members\/\$\{selectedMemberId\}/);
    // List rows open the detail through the URL, not through object state.
    expect(src).not.toMatch(/setSelectedMember\(member\)/);
    expect(src).not.toMatch(/onClick=\{\(\) => setSelectedMember\(m\)\}/);
  });

  it("Feed, Inbox and FollowUps page through the server's meta, not silently capped", () => {
    for (const rel of [
      "client/src/pages/Feed.tsx",
      "client/src/pages/Inbox.tsx",
      "client/src/pages/FollowUps.tsx",
    ]) {
      const src = read(rel);
      expect(src).toMatch(/getWithMeta</);
      expect(src).toMatch(/params\.set\("page", String\(pageToLoad\)\)/);
      expect(src).toMatch(/<ListPager/);
      expect(src).toMatch(/setMeta\(res\.meta \?\? null\)/);
    }
  });

  it("ListPager renders nothing when everything fits on one page", () => {
    const src = read("client/src/components/DesignSystem.tsx");
    expect(src).toMatch(/function ListPager/);
    expect(src).toMatch(/if \(totalPages <= 1\) return null;/);
    expect(src).toMatch(/aria-label="แบ่งหน้าข้อมูล"/);
  });
});
