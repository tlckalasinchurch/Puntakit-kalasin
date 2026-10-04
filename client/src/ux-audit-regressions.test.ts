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
