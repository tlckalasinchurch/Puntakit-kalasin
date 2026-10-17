import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// Premium Teal palette: every text/UI pair the app relies on, measured per
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
] as const)("Premium Teal contrast (%s)", (_name, theme) => {
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
    ["accent-soft on sunken (page-view tab)", color("--color-accent-soft", sunken)],
  ];

  it.each(["--color-ink", "--color-body", "--color-body-muted", "--color-text-secondary", "--color-text-tertiary", "--color-text-quaternary", "--color-primary-ink"])(
    "%s text is >= 4.5:1 on every surface",
    (token) => {
      for (const [name, bg] of surfaces) {
        expect(ratio(color(token), bg), `${token} on ${name}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  );

  it("text on the primary fill (and its hover fill) is >= 4.5:1 in both themes", () => {
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

describe("Premium Teal identity", () => {
  it("fills are teal (lighter in dark) and the canvases are warm white / deep slate", () => {
    expect(resolve(light, "--color-primary")).toBe("#0c7c82");
    expect(resolve(dark, "--color-primary")).toBe("#35b4b0");
    expect(resolve(light, "--color-canvas")).toBe("#fffbf7");
    expect(resolve(dark, "--color-canvas")).toBe("#111827");
    expect(resolve(dark, "--color-surface")).toBe("#1f2937");
    expect(resolve(dark, "--color-surface-elevated")).toBe("#273449");
  });

  it("no retired orange or porcelain literal is left in the token layer or the shell chrome", () => {
    for (const retired of ["#ff6115", "#b93800", "#e8560a", "#ff7a3d", "#ff8a4d", "#fffcf4", "255, 97, 21"]) {
      expect(css.toLowerCase(), `${retired} still in index.css`).not.toContain(retired);
    }
  });

  it("the semantic vocabulary resolves onto the existing tokens in both themes", () => {
    const expected: [string, string][] = [
      ["--color-background", "--color-canvas"],
      ["--color-text-primary", "--color-ink"],
      ["--color-border", "--color-hairline"],
      ["--color-focus-ring", "--color-primary-focus"],
      ["--color-primary-hover", "--color-primary-focus"],
      ["--color-primary-foreground", "--color-on-primary"],
      ["--color-surface-selected", "--color-accent-soft"],
    ];
    for (const theme of [light, dark]) {
      for (const [alias, target] of expected) expect(resolve(theme, alias), alias).toBe(resolve(theme, target));
    }
    expect(resolve(light, "--color-surface-elevated")).toBe(resolve(light, "--color-surface"));
  });

  it("disabled text stays >= 3:1 on the disabled surface, and secondary teal / accent orange are never text", () => {
    for (const theme of [light, dark]) {
      expect(ratio(rgb(resolve(theme, "--color-disabled-ink")), rgb(resolve(theme, "--color-disabled")))).toBeGreaterThanOrEqual(3);
    }
    // #35b4b0 is 2.5:1 on white and #ff8a3d is a limited accent: neither may colour text.
    expect(css).not.toMatch(/(^|[;{\s])color:\s*var\(--color-(secondary|accent-orange)\)/m);
  });
});
