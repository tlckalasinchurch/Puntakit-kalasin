import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// Orange & Porcelain palette: every text/UI pair the app relies on, measured per
// theme from the real tokens in index.css (no copied results). Light = :root,
// dark = :root with the .dark block layered over it.
const css = readFileSync(path.join(import.meta.dirname, "index.css"), "utf8");

function declarations(selector: string): Map<string, string> {
  const out = new Map<string, string>();
  const open = String.raw`^${selector.replace(".", String.raw`\.`)} \{([\s\S]*?)^\}`;
  for (const [, body] of css.matchAll(new RegExp(open, "gm"))) {
    for (const m of body.matchAll(/^\s*(--[\w-]+)\s*:\s*([^;]+);/gm)) out.set(m[1], m[2].trim());
  }
  return out;
}

const light = declarations(":root");
const dark = new Map([...light, ...declarations(".dark")]);

type RGB = [number, number, number];

function resolve(theme: Map<string, string>, name: string): string {
  let value = theme.get(name);
  expect(value, `${name} must be declared`).toBeDefined();
  for (let i = 0; i < 6; i++) {
    const ref = value!.match(/^var\((--[\w-]+)\)$/);
    if (!ref) return value!;
    value = theme.get(ref[1]);
    expect(value, `${ref[1]} must be declared`).toBeDefined();
  }
  throw new Error(`${name}: var() chain too deep`);
}

function rgb(value: string, under?: RGB): RGB {
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)) as RGB;
  const rgba = value.match(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/);
  if (rgba && under) {
    const a = Number(rgba[4]);
    return [1, 2, 3].map((n, i) => Math.round(Number(rgba[n]) * a + under[i] * (1 - a))) as RGB;
  }
  throw new Error(`unsupported colour: ${value}`);
}

const luminance = (c: RGB) => {
  const [r, g, b] = c.map((v) => {
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
  ["light", light],
  ["dark", dark],
] as const)("Orange & Porcelain contrast (%s)", (_name, theme) => {
  const color = (token: string, under?: RGB) => rgb(resolve(theme, token), under);
  const canvas = color("--color-canvas");
  const surface = color("--color-surface");
  const soft = color("--color-canvas-soft");
  const sunken = color("--color-canvas-sunken");
  const accent = color("--color-accent-soft", canvas);
  const accentOnSurface = color("--color-accent-soft", surface);

  const surfaces: [string, RGB][] = [
    ["canvas", canvas],
    ["surface", surface],
    ["canvas-soft", soft],
    ["canvas-sunken", sunken],
    ["accent-soft", accent],
    ["accent-soft on surface", accentOnSurface],
  ];

  it.each(["--color-ink", "--color-body", "--color-body-muted", "--color-text-secondary", "--color-text-tertiary", "--color-text-quaternary", "--color-primary-ink"])(
    "%s text is >= 4.5:1 on every surface",
    (token) => {
      for (const [name, bg] of surfaces) {
        expect(ratio(color(token), bg), `${token} on ${name}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  );

  it("text on the primary fill (and its hover fill) is >= 4.5:1 — never white on orange", () => {
    const onPrimary = color("--color-on-primary");
    expect(ratio(onPrimary, color("--color-primary"))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(onPrimary, color("--color-primary-focus"))).toBeGreaterThanOrEqual(4.5);
  });

  it("the focus ring (--color-primary-focus) is >= 3:1 on canvas and surface", () => {
    const ring = color("--color-primary-focus");
    expect(ratio(ring, canvas)).toBeGreaterThanOrEqual(3);
    expect(ratio(ring, surface)).toBeGreaterThanOrEqual(3);
  });

  it.each([
    ["success", "--color-success-ink", "--color-success-soft"],
    ["warning", "--color-warning-ink", "--color-warning-soft"],
    ["info", "--color-info-ink", "--color-info-soft"],
    ["error", "--color-error-ink", "--color-error-soft"],
  ])("%s ink is >= 4.5:1 on the canvas and on its own tint", (_status, inkToken, softToken) => {
    const ink = color(inkToken);
    expect(ratio(ink, canvas)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(ink, color(softToken, canvas))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(ink, color(softToken, surface))).toBeGreaterThanOrEqual(4.5);
  });

  it("chrome on the dark surface (sidebar): on-dark, muted and the accent are >= 4.5:1", () => {
    const chrome = color("--color-dark-surface");
    for (const token of ["--color-on-dark", "--color-on-dark-muted", "--color-primary-on-dark"]) {
      expect(ratio(color(token), chrome), token).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("Orange & Porcelain identity", () => {
  it("fills are Neon Orange in both themes and the canvases are porcelain / charcoal", () => {
    expect(resolve(light, "--color-primary")).toBe("#ff6115");
    expect(resolve(dark, "--color-primary")).toBe("#ff6115");
    expect(resolve(light, "--color-canvas")).toBe("#fffcf4");
    expect(resolve(dark, "--color-canvas")).toBe("#171717");
  });

  it("no retired teal/sage brand literal is left in the token layer or the shell chrome", () => {
    for (const retired of ["#0c7c82", "#09696e", "#2fc4bd", "#5fd7d1", "#7faf72", "#061a1f"]) {
      expect(css.toLowerCase(), `${retired} still in index.css`).not.toContain(retired);
    }
  });
});
