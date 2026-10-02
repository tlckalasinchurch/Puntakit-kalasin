import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Design System V2 recovery guard.
 *
 * The codebase carried two parallel design systems: the V2 tokens in
 * `index.css` and a legacy Tailwind/raw-hex palette that ~10 pages still used
 * after the V2 migration (see docs/PUNTAKIT_UX_UI_AUDIT_2026-10.md §9). Mixing
 * them is what made the app feel like an admin template and what silently broke
 * dark mode, because dark mode is a token remap on `.dark` — a page that hard-
 * codes `bg-blue-600` cannot be remapped.
 *
 * These tests are deliberately cheap and structural. They do not try to verify
 * pixels; they fail the moment the old palette or the pre-V2 state markup is
 * reintroduced.
 */

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");
const CLIENT_SRC = path.join(REPO_ROOT, "client", "src");
const DESIGN_SYSTEM = "DesignSystem.tsx";

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist") continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|ts)$/.test(entry)) out.push(full);
  }
  return out;
}

/** App code only: generated shadcn primitives are allowed their own palette. */
function appFiles(): string[] {
  return walk(CLIENT_SRC).filter(
    (f) =>
      !f.endsWith(".test.ts") &&
      !f.includes(`${path.sep}components${path.sep}ui${path.sep}`)
  );
}

/** Strip comments so a documented example is not reported as a violation. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("Design System V2 — single palette", () => {
  it("no app file uses the retired Tailwind palette for colour", () => {
    // Utility *prefix* + palette family. `translate-y-1/2` must not match, so
    // the prefix is required and the family is a whole word.
    const paletteRe =
      /\b(?:bg|text|border|from|to|via|ring|divide|fill|stroke|placeholder|shadow|outline|decoration|accent|caret)-(?:slate|blue|indigo|sky|gray|grey|zinc|rose|emerald|amber|purple|violet|teal|orange|lime|cyan|fuchsia|stone|neutral|red|green|yellow)-\d{2,3}\b/;
    // Deliberately token-based exceptions live here, one line each with a reason.
    const allowed = new Set<string>([
      // none: status colour comes from var(--color-success|warning|error|info)
    ]);

    const offenders: string[] = [];
    for (const file of appFiles()) {
      const rel = path.relative(REPO_ROOT, file);
      if (allowed.has(rel)) continue;
      const text = stripComments(readFileSync(file, "utf8"));
      const match = text.match(paletteRe);
      if (match) offenders.push(`${rel} → ${match[0]}`);
    }

    expect(
      offenders,
      `retired palette classes reintroduced (use var(--color-*) or a DesignSystem component):\n${offenders.join("\n")}`
    ).toEqual([]);
  });

  it("no page re-implements the shared states", () => {
    // These four were copy-pasted into six screens with different colours and
    // different wording for the same situation. They now live only in
    // components/DesignSystem.tsx and are imported.
    const banned = [
      /function\s+EmptyState\b/,
      /function\s+ErrorState\b/,
      /function\s+PageHeader\b/,
      /function\s+SectionHeader\b/,
      /function\s+StatusChip\b/,
      /className="modal-backdrop"/,
      /className="modal-card"/,
    ];
    const offenders: string[] = [];
    for (const file of appFiles()) {
      const rel = path.relative(REPO_ROOT, file);
      if (rel.endsWith(DESIGN_SYSTEM)) continue;
      const text = stripComments(readFileSync(file, "utf8"));
      for (const re of banned) {
        const m = text.match(re);
        if (m) offenders.push(`${rel} → ${m[0]}`);
      }
    }
    expect(
      offenders,
      `define these once in components/DesignSystem.tsx and import them:\n${offenders.join("\n")}`
    ).toEqual([]);
  });

  it("keeps dark mode a token remap, not palette overrides", () => {
    const css = readFileSync(path.join(CLIENT_SRC, "index.css"), "utf8");
    // The old implementation forced `.dark .text-slate-800 { … !important }`
    // etc. — a list that had to be manually extended for every new screen.
    const offenders = css
      .split("\n")
      .map((line, i) => ({ line: line.trim(), n: i + 1 }))
      .filter(
        ({ line }) =>
          /^\.dark\s/.test(line) === false &&
          !/^\s*\.dark\b/.test(line)
      )
      .filter(({ line }) =>
        /\bdark\s+\.(?:text|bg|border)-[a-z]+-\d{2,3}.*!important/.test(line)
      )
      .map(({ line, n }) => `index.css:${n} ${line}`);
    expect(offenders).toEqual([]);
  });

  it("keeps real content at or above the 12px readability floor", () => {
    // 10–11px was used for phone numbers, dates and group names — real content,
    // not micro-labels. The floor is .type-fine (12px).
    const offenders: string[] = [];
    for (const file of appFiles()) {
      const rel = path.relative(REPO_ROOT, file);
      const text = stripComments(readFileSync(file, "utf8"));
      const matches = text.match(/\btext-\[(?:9|10|11)px\]/g);
      if (matches) offenders.push(`${rel} → ${[...new Set(matches)].join(", ")}`);
    }
    expect(offenders).toEqual([]);
  });
});
