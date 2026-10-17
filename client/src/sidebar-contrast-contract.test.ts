import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");
const sidebar = read("client/src/components/layout/Sidebar.tsx");
const css = read("client/src/index.css");

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const luminance = (rgb: number[]) => {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: number[], b: number[]) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const over = (top: number[], alpha: number, base: number[]) => top.map((v, i) => v * alpha + base[i] * (1 - alpha));

/** The `class` string the active nav row gets: the branch after `isActive` in the link's className. */
const activeRowClasses = () => {
  const at = sidebar.indexOf('"pk-nav-active ');
  expect(at, "the active row must carry pk-nav-active").toBeGreaterThan(-1);
  return sidebar.slice(at, sidebar.indexOf('"', at + 1));
};

describe("Sidebar: the active row's label is readable (AA, 4.5:1)", () => {
  // Measured in a browser before this change: the accent as *text* on its own 15% tint was 4.41:1 (dark,
  // Home) and 4.48:1 (light). The label is small text, so it needs 4.5:1. The accent stays on the
  // 3px bar, the icon and the drawer ring (non-text, 3:1), where it already passes.
  it("the active label is on-dark white, not the accent colour", () => {
    const classes = activeRowClasses();
    expect(classes).toContain("text-[var(--color-on-dark)]");
    expect(classes).not.toMatch(/(^|\s)text-\[var\(--color-primary-on-dark\)\]/);
  });

  it("the icon keeps the accent, so the row is still identifiable by more than the label", () => {
    expect(sidebar).toMatch(/isActive\s*\?\s*"text-\[var\(--color-primary-on-dark\)\]"/);
    expect(sidebar).toContain("pk-nav-active");
    expect(css).toMatch(/\.pk-nav-active::before[\s\S]*?background: var\(--color-primary-on-dark\)/);
  });

  it("white on the 15% accent tint clears 4.5:1 with a wide margin, for every accent the app defines", () => {
    const accents = [...css.matchAll(/--color-primary-on-dark:\s*(#[0-9a-fA-F]{6})/g)].map((m) => m[1]);
    const surface = css.match(/--color-dark-surface-2:\s*(#[0-9a-fA-F]{6})/)?.[1];
    expect(accents.length).toBeGreaterThanOrEqual(2);
    expect(surface).toBeDefined();
    for (const accent of accents) {
      const tinted = over(channels(accent), 0.15, channels(surface!));
      expect(ratio([255, 255, 255], tinted), `white on ${accent} @15% over ${surface}`).toBeGreaterThanOrEqual(7);
    }
  });

  it("documents why: the accent as text on its own tint is below AA (the reason it was changed)", () => {
    const light = css.match(/--color-primary-on-dark:\s*(#[0-9a-fA-F]{6})/)![1];
    const surface = css.match(/--color-dark-surface-2:\s*(#[0-9a-fA-F]{6})/)![1];
    const tinted = over(channels(light), 0.15, channels(surface));
    expect(ratio(channels(light), tinted)).toBeLessThan(4.5);
  });
});
