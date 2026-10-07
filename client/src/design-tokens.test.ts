import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

// client/src -> client -> repo root
const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");
const CSS = path.join(REPO_ROOT, "client", "src", "index.css");
const DOCS = ["brand-spec.md", "design.md"].map((f) =>
  path.join(REPO_ROOT, f)
);

const css = readFileSync(CSS, "utf8");

/** Every `--token: value` declared in the :root block. */
function rootTokens(): Map<string, string> {
  const start = css.indexOf(":root");
  const end = css.indexOf("\n}", start);
  const body = css.slice(start, end);
  const tokens = new Map<string, string>();
  for (const line of body.split("\n")) {
    const m = line.match(/^\s*(--[\w-]+)\s*:\s*(.+?);/);
    if (m) tokens.set(m[1], m[2].trim());
  }
  return tokens;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist") continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|css)$/.test(entry)) out.push(full);
  }
  return out;
}

const tokens = rootTokens();

describe("design token source of truth", () => {
  it("declares the core V2 brand tokens", () => {
    // The values the whole UI is built on. If one of these changes, the docs
    // and every component need to change with it.
    expect(tokens.get("--color-primary")).toBe("#315c2b");
    expect(tokens.get("--color-primary-focus")).toBe("#3f7337");
    expect(tokens.get("--color-primary-on-dark")).toBe("#7faf72");
    expect(tokens.get("--color-ink")).toBe("#1d1d1f");
    expect(tokens.get("--color-dark-surface")).toBe("#272729");
    expect(tokens.get("--color-canvas")).toBe("#ffffff");
  });

  it("defines a real elevation token", () => {
    // --shadow was `none` while three rules consumed var(--shadow), so every
    // card silently rendered flat. Guard against a regression to a no-op.
    const shadow = tokens.get("--shadow");
    expect(shadow).toBeDefined();
    expect(shadow).not.toBe("none");
    expect(shadow).toMatch(/rgba?\(/);
  });

  it("does not reintroduce the retired blue identity", () => {
    // Church Blue / Deep Navy were the pre-V2 palette. They were still hiding
    // in the PWA manifest, the theme-color meta and the app icon, so the scan
    // covers shipped assets as well as source.
    const retired = ["#173b70", "#2f72bf", "#122d54", "#14263d", "#224e88"];
    for (const dir of ["client/src"]) {
      for (const file of walk(path.join(REPO_ROOT, dir))) {
        if (file.endsWith("design-tokens.test.ts")) continue; // this file names them
        const text = readFileSync(file, "utf8");
        for (const hex of retired) {
          // A token declaration or a named status color is allowed; a raw
          // usage in a rule or class is not.
          const usages = text.match(new RegExp(hex, "gi")) ?? [];
          for (const _ of usages) {
            const isDeclared = new RegExp(
              `--color-[\\w-]+:\\s*${hex}`,
              "i"
            ).test(text);
            expect(
              isDeclared,
              `${hex} used outside a token declaration in ${path.relative(
                REPO_ROOT,
                file
              )}`
            ).toBe(true);
          }
        }
      }
    }

    // Shipped assets: nothing in the installed app may carry the old blue.
    const shipped = [
      "client/index.html",
      "client/public/manifest.json",
      "client/public/icon.svg",
    ];
    for (const rel of shipped) {
      const text = readFileSync(path.join(REPO_ROOT, rel), "utf8");
      for (const hex of retired) {
        expect(
          text.toLowerCase(),
          `${rel} still uses the retired ${hex}`
        ).not.toContain(hex);
      }
    }
  });

  it("keeps the docs in sync with the tokens they document", () => {
    for (const doc of DOCS) {
      const text = readFileSync(doc, "utf8");
      // Every doc must declare index.css as the source of truth, so a future
      // reader knows which side to fix.
      expect(text).toMatch(/index\.css/);
      // The docs must not advertise the retired palette as current tokens.
      expect(text).not.toMatch(/^Deep Navy/m);
      expect(text).not.toMatch(/^Church Blue/m);
    }
  });

  it("keeps neutral text and hairlines hue-free", () => {
    // Secondary text, table headers and hairlines were inherited from the pre-V2
    // blue palette (#8495a7, #5d728a, #6d8198 …) and read cool against the
    // graphite chrome. They now come from --color-text-*. A blue-*gray* is
    // identifiable by blue leading a red and green that are close to each other;
    // the deliberate accents (info blue, care purple, success green) have a wide
    // red/green gap, so they are not caught here.
    const blueGray = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      const r = (n >> 16) & 255,
        g = (n >> 8) & 255,
        b = n & 255;
      return b > r + 12 && b > g + 12 && Math.abs(r - g) < 30;
    };

    const lines = css.split("\n");
    // Locate the :root block BY LINE so the skip range cannot silently cover
    // the rest of the file (comparing character offsets to line numbers does).
    let rootStart = -1;
    let rootEnd = lines.length - 1;
    for (let i = 0; i < lines.length; i++) {
      if (rootStart === -1) {
        if (/^:root/.test(lines[i])) rootStart = i;
      } else if (/^\}/.test(lines[i])) {
        rootEnd = i;
        break;
      }
    }
    expect(rootStart, ":root block not found").toBeGreaterThanOrEqual(0);

    const offenders: string[] = [];
    lines.forEach((line, i) => {
      if (i >= rootStart && i <= rootEnd) return; // token declarations
      const decl =
        line.match(/^\s*color:\s*(#[0-9a-fA-F]{6})\b/) ||
        line.match(/\bborder[a-z-]*\s*:[^;]*\s(#[0-9a-fA-F]{6})\b/);
      if (!decl) return;
      if (blueGray(decl[1])) offenders.push(`line ${i + 1}: ${decl[1]}`);
    });

    expect(offenders, `blue-tinted neutrals in index.css:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("exposes the neutral text ramp that rules depend on", () => {
    // Rules across the legacy sheet resolve their secondary text through these.
    for (const token of [
      "--color-text-secondary",
      "--color-text-tertiary",
      "--color-text-quaternary",
    ]) {
      expect(tokens.get(token), `${token} missing`).toMatch(/^#[0-9a-f]{6}$/i);
    }
    // A sunken surface is neutral, not blue-white.
    expect(tokens.get("--color-canvas-sunken")).toBe("#f2f2f4");
  });
});

describe("text on a primary fill", () => {
  /** WCAG relative luminance of a #rrggbb colour. */
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a: string, b: string) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  it("keeps --color-on-primary readable on --color-primary in light and dark mode", () => {
    const dark = css.slice(css.indexOf("\n.dark {"));
    const darkPrimary = dark.match(/--color-primary:\s*(#[0-9a-f]{6})/i)![1];
    const darkOnPrimary = dark.match(/--color-on-primary:\s*(#[0-9a-f]{6})/i)![1];
    // Light mode: --color-on-primary falls back to --color-on-dark (#ffffff).
    expect(tokens.get("--color-on-primary")).toBe("var(--color-on-dark)");
    expect(ratio("#ffffff", tokens.get("--color-primary")!)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(darkOnPrimary, darkPrimary)).toBeGreaterThanOrEqual(4.5);
  });

  it("no page sets white text on a primary fill", () => {
    const offenders = walk(path.join(REPO_ROOT, "client", "src")).filter((f) => {
      if (!f.endsWith(".tsx") || f.endsWith("Logo.tsx")) return false;
      const src = readFileSync(f, "utf8");
      return /["'`][^"'`\n]*bg-\[var\(--color-primary\)\][^"'`\n]*text-\[var\(--color-on-dark\)\]/.test(src);
    });
    expect(offenders.map((f) => path.relative(REPO_ROOT, f))).toEqual([]);
  });
});
