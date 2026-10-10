import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import * as path from "node:path";

/**
 * The premium admin shell (glass, atmosphere, motion) is additive and opt-in:
 *
 * - It lives behind `.pk-premium`, which only `AppLayout` sets, so the member
 *   PWA (`/app/*`, still behind the Q21/Q13 acceptance gates) keeps its look
 *   even though it shares the DesignSystem primitives.
 * - Backdrop blur is reserved for sticky/fixed chrome (`.pk-glass` on the
 *   topbar and bottom nav). Blurring scrolling content costs repaint time.
 * - Motion is defined once as `--pk-*` tokens and goes through the global
 *   prefers-reduced-motion override.
 */

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(REPO_ROOT, rel), "utf8");
const css = read("client/src/index.css");

const listFiles = (rel: string): string[] =>
  readdirSync(path.join(REPO_ROOT, rel), { withFileTypes: true }).flatMap(
    entry =>
      entry.isDirectory()
        ? listFiles(path.join(rel, entry.name))
        : [path.join(rel, entry.name)]
  );

describe("premium shell contract", () => {
  it("defines the motion and glass tokens", () => {
    for (const token of [
      "--pk-ease-out",
      "--pk-ease-in",
      "--pk-dur-fast",
      "--pk-dur-base",
      "--pk-dur-slow",
      "--pk-glass-blur",
    ]) {
      expect(css, `${token} missing`).toContain(`${token}:`);
    }
  });

  it("is opted into only by AppLayout", () => {
    expect(read("client/src/components/layout/AppLayout.tsx")).toContain(
      "pk-premium"
    );
    const memberFiles = [
      ...listFiles("client/src/pages/member"),
      "client/src/components/layout/MemberAppLayout.tsx",
      "client/src/components/MemberList.tsx",
    ];
    for (const file of memberFiles) {
      expect(read(file), `${file} must not use pk-* classes`).not.toMatch(
        /\bpk-(premium|glass|atmosphere|route|stagger|hero|sidebar|surface)\b/
      );
    }
  });

  it("uses .pk-glass only on sticky/fixed chrome", () => {
    const users = listFiles("client/src")
      .filter(file => /\.(tsx|ts)$/.test(file) && !file.endsWith(".test.ts"))
      .filter(file => /\bpk-glass\b/.test(read(file)))
      .map(file => file.split(path.sep).join("/"))
      .sort();
    expect(users).toEqual([
      "client/src/components/layout/MobileBottomNav.tsx",
      "client/src/components/layout/Topbar.tsx",
    ]);
    expect(read("client/src/components/layout/Topbar.tsx")).toMatch(
      /sticky[^"]*pk-glass|pk-glass[^"]*sticky/
    );
    expect(read("client/src/components/layout/MobileBottomNav.tsx")).toMatch(
      /fixed[^"]*pk-glass|pk-glass[^"]*fixed/
    );
  });

  it("keeps the global reduced-motion override that zeroes the pk durations", () => {
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\*,\s*\*:before,\s*\*:after\s*\{[^}]*animation-duration: 0\.01ms !important;[^}]*transition-duration: 0\.01ms !important;/
    );
  });

  it("animates only transform and opacity in the pk keyframes", () => {
    const keyframes = css.match(/@keyframes pk-rise\s*\{[\s\S]*?\n\}/);
    expect(keyframes).not.toBeNull();
    expect(keyframes![0]).not.toMatch(/\b(top|left|right|bottom|width|height|margin|padding)\s*:/);
  });
});
