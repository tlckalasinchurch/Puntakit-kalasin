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
  it("the active label uses primary-ink on the pale accent-soft tint (accent-ladder)", () => {
    const classes = activeRowClasses();
    expect(classes).toContain("text-[var(--color-primary-ink)]");
    expect(classes).toContain("bg-[var(--color-accent-soft)]");
  });

  it("the icon keeps the accent, without a left bar on top of the tint", () => {
    expect(sidebar).toMatch(/isActive\s*\?\s*"text-\[var\(--color-primary\)\]"/);
    expect(sidebar).toContain("pk-nav-active");
    expect(css).not.toMatch(/\.pk-nav-active::before/);
  });

  it("primary-ink on accent-soft clears 4.5:1 in light mode, and light ink on dark surface clears 4.5:1", () => {
    const lightInk = css.match(/:root\s*\{[\s\S]*?--color-primary-ink:\s*(#[0-9a-fA-F]{6})/)?.[1];
    const lightTint = css.match(/:root\s*\{[\s\S]*?--color-accent-soft:\s*(#[0-9a-fA-F]{6})/)?.[1];
    const darkInk = css.match(/\.dark\s*\{[\s\S]*?--color-ink:\s*(#[0-9a-fA-F]{6})/)?.[1];
    const darkSurface = css.match(/\.dark\s*\{[\s\S]*?--color-surface:\s*(#[0-9a-fA-F]{6})/)?.[1];
    expect(lightInk && lightTint && darkInk && darkSurface).toBeTruthy();
    expect(ratio(channels(lightInk!), channels(lightTint!))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(channels(darkInk!), channels(darkSurface!))).toBeGreaterThanOrEqual(7);
  });
});
