import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// Bottom nav (.pk-nav-item) contrast, resolved from the real tokens in
// index.css for each theme — nothing here is a copied result.
const css = readFileSync(path.join(import.meta.dirname, "index.css"), "utf8");

/** Top-level `--token: value` declarations of every block opened by `selector`. */
function declarations(selector: string): Map<string, string> {
  const out = new Map<string, string>();
  const blocks = css.matchAll(new RegExp(String.raw`^${selector.replace(".", String.raw`\.`)} \{([\s\S]*?)^\}`, "gm"));
  for (const [, body] of blocks) {
    for (const m of body.matchAll(/^\s*(--[\w-]+)\s*:\s*([^;]+);/gm)) out.set(m[1], m[2].trim());
  }
  return out;
}

const root = declarations(":root");
const dark = new Map([...root, ...declarations(".dark")]);

function resolve(theme: Map<string, string>, name: string): string {
  let value = theme.get(name);
  expect(value, `${name} must be declared`).toBeDefined();
  for (let i = 0; i < 5; i++) {
    const ref = value!.match(/^var\((--[\w-]+)\)$/);
    if (!ref) return value!;
    value = theme.get(ref[1]);
    expect(value, `${ref[1]} must be declared`).toBeDefined();
  }
  throw new Error(`${name}: var() chain too deep`);
}

type RGB = [number, number, number];
function rgb(value: string, under?: RGB): RGB {
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) return [0, 2, 4].map(i => parseInt(hex[1].slice(i, i + 2), 16)) as RGB;
  const rgba = value.match(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/);
  if (rgba && under) {
    const a = Number(rgba[4]);
    return [1, 2, 3].map((n, i) => Math.round(Number(rgba[n]) * a + under[i] * (1 - a))) as RGB;
  }
  throw new Error(`unsupported colour: ${value}`);
}

const luminance = (c: RGB) => {
  const [r, g, b] = c.map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: RGB, b: RGB) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe.each([
  ["light", root],
  ["dark", dark],
] as const)("bottom nav contrast (%s)", (_name, theme) => {
  const surface = rgb(resolve(theme, "--shell-nav-surface"));
  const pill = rgb(resolve(theme, "--shell-nav-active-bg"), surface);
  const activeInk = rgb(resolve(theme, "--shell-nav-active-ink"));
  const inactiveInk = rgb(resolve(theme, "--shell-nav-ink"));

  // Labels sit under the icon pill, on the nav surface.
  it("active label is >= 4.5:1 on the nav surface", () => {
    expect(ratio(activeInk, surface)).toBeGreaterThanOrEqual(4.5);
  });
  it("inactive label is >= 4.5:1 on the nav surface", () => {
    expect(ratio(inactiveInk, surface)).toBeGreaterThanOrEqual(4.5);
  });
  // Icons sit on the pill; WCAG 1.4.11 non-text contrast.
  it("active icon is >= 3:1 on the active pill", () => {
    expect(ratio(activeInk, pill)).toBeGreaterThanOrEqual(3);
  });
  it("active indicator bar is >= 3:1 on the nav surface", () => {
    expect(ratio(rgb(resolve(theme, "--shell-nav-indicator")), surface)).toBeGreaterThanOrEqual(3);
  });
});
