import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

/** Every TSX file that renders the member PWA (/app/*). */
const MEMBER_FILES = [
  ...readdirSync(path.join(root, "client/src/pages/member")).filter((f) => f.endsWith(".tsx")).map((f) => `client/src/pages/member/${f}`),
  ...readdirSync(path.join(root, "client/src/components/lamb")).filter((f) => f.endsWith(".tsx")).map((f) => `client/src/components/lamb/${f}`),
  "client/src/components/layout/MemberAppLayout.tsx",
];

/** Source with block and line comments removed, so prose about colours is not mistaken for code. */
const code = (rel: string) => read(rel).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const classNames = (src: string) => [...src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)].map((m) => m[1] ?? m[2]);

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe("Member PWA: keyboard focus", () => {
  it("every className that removes the outline draws its own 2px ring instead", () => {
    const offenders: string[] = [];
    for (const rel of MEMBER_FILES) {
      for (const cls of classNames(code(rel))) {
        if (cls.includes("focus-visible:outline-none") && !/focus-visible:ring-2\b/.test(cls)) offenders.push(`${rel}: ${cls.slice(0, 80)}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("Member PWA: colours come from tokens", () => {
  it("no raw hex colours or solid bg-white in member UI code; the QR image and its white backing are the only exceptions", () => {
    // Translucent overlays (bg-white/10 …) on the always-dark QR card and the daylight hero scene are
    // intentional and not matched. A solid white fill is a light-only surface that breaks in dark mode,
    // except behind the QR image, which a scanner needs dark-on-light.
    const offenders: string[] = [];
    for (const rel of MEMBER_FILES) {
      let src = code(rel);
      if (rel.endsWith("MemberHome.tsx")) {
        src = src
          .replace('color: { dark: "#272729", light: "#ffffff" }', "")
          .replace("items-center justify-center rounded-xl bg-white p-2", "");
      }
      for (const m of src.matchAll(/#[0-9a-fA-F]{3,8}\b|\bbg-white(?![\w/-])/g)) offenders.push(`${rel}: ${m[0]}`);
    }
    expect(offenders).toEqual([]);
  });

  it("the QR exception stays documented as not being UI colour", () => {
    expect(read("client/src/pages/member/MemberHome.tsx")).toMatch(/Not UI colour:[\s\S]*?color: \{ dark: "#272729", light: "#ffffff" \}/);
  });
});

describe("Member PWA: teal text on the accent tint passes AA", () => {
  it("light --color-primary (fill teal) on --color-accent-soft fails 4.5:1, --color-primary-ink passes (why the chips use it)", () => {
    const css = read("client/src/index.css");
    const light = (name: string) => css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`))![1]; // first definition = :root (light)
    const tint = light("--color-accent-soft");
    expect(contrast(light("--color-primary"), tint)).toBeLessThan(4.5);
    expect(contrast(light("--color-primary-ink"), tint)).toBeGreaterThanOrEqual(4.5);
  });

  it("no member element puts --color-primary (the fill teal) as text on a plain accent-soft background", () => {
    const offenders: string[] = [];
    for (const rel of MEMBER_FILES) {
      for (const cls of classNames(code(rel))) {
        const onTint = /(^|\s)bg-\[var\(--color-accent-soft\)\]/.test(cls);
        if (onTint && /(^|\s)text-\[var\(--color-primary\)\]/.test(cls)) offenders.push(`${rel}: ${cls.slice(0, 90)}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("Member PWA: text on lifted dark tiles", () => {
  it("--color-on-dark-muted is tuned for plain graphite; on a bg-on-dark/10 tile it drops to ~4.25:1, so the labels use on-dark/80", () => {
    const css = read("client/src/index.css");
    const muted = css.match(/--color-on-dark-muted:\s*(#[0-9a-fA-F]{6})/)![1];
    // white at 10% over graphite #272729 — the tile fill measured in the browser was rgb(60,60,68)
    expect(contrast(muted, "#3c3c44")).toBeLessThan(4.5);
    // white at 80% over that tile: 0.8*255 + 0.2*(60,60,68)
    expect(contrast("#cccccf", "#3c3c44")).toBeGreaterThanOrEqual(4.5);

    const src = read("client/src/pages/member/MemberAttendance.tsx");
    const tiles = [...src.matchAll(/bg-\[var\(--color-on-dark\)\]\/10 p-3">([\s\S]*?)<\/div>/g)].map((m) => m[1]);
    expect(tiles.length).toBe(2);
    for (const body of tiles) {
      expect(body).not.toContain("on-dark-muted");
      expect(body).toContain("text-[var(--color-on-dark)]/80");
    }
  });
});

describe("Member PWA: no dead links", () => {
  /** Route patterns declared in App.tsx, `:param` segments matching any one segment. */
  const routes = [...read("client/src/App.tsx").matchAll(/<Route path="([^"]+)"/g)].map((m) => m[1]).filter((p) => p !== "*");
  const matches = (p: string) =>
    routes.some((r) => new RegExp(`^${r.replace(/:[^/]+/g, "[^/]+")}$`).test(p));

  /** Internal destinations written in a file: href="/x", href: "/x", href={`/x/${id}`} (a ${…} is one segment). */
  const hrefs = (rel: string) =>
    [...code(rel).matchAll(/href(?:=\{?|: )\s*[`"'](\/[^`"'?#]*)/g)].map((m) => m[1].replace(/\$\{[^}]*\}/g, "x"));

  it("knows the member routes, so the check below is not vacuous", () => {
    expect(routes).toContain("/app/reports");
    expect(matches("/app/reports")).toBe(true);
    expect(matches("/app/reports/123")).toBe(false); // the page that never existed
  });

  it("every internal link in the member PWA resolves to a route in App.tsx", () => {
    const dead: string[] = [];
    for (const rel of MEMBER_FILES) for (const href of hrefs(rel)) if (!matches(href)) dead.push(`${rel}: ${href}`);
    expect(dead).toEqual([]);
  });

  it("report rows are read-only cards that carry their own detail, and the list reads the unwrapped API result", () => {
    const src = read("client/src/pages/member/MemberReports.tsx");
    expect(src).not.toMatch(/<Link\b/);
    expect(src).toMatch(/<article\b/);
    expect(src).toContain("sub.rawText");
    // api.get resolves to res.data already; reading `.data` again made the list always empty
    expect(src).toMatch(/api\.get<Submission\[\]>\("\/api\/submissions/);
    expect(src).not.toMatch(/api\.get<\{ data:/);
  });
});

describe("Member reports: statuses", () => {
  it("labels and tones every real submission status, with the same wording as the staff Inbox", async () => {
    const { MISSION_SUBMISSION_STATUSES } = await import("../../shared/schema");
    const body = (rel: string, name: string) => read(rel).match(new RegExp(`const ${name}[^=]*= \\{([\\s\\S]*?)\\n\\};`))![1];
    const pairs = (b: string) => Object.fromEntries([...b.matchAll(/(\w+):\s*"([^"]+)"/g)].map((m) => [m[1], m[2]]));

    const member = pairs(body("client/src/pages/member/MemberReports.tsx", "STATUS_LABELS"));
    const staff = pairs(body("client/src/pages/Inbox.tsx", "STATUS_LABELS"));
    const tones = pairs(body("client/src/pages/member/MemberReports.tsx", "STATUS_TONE"));
    expect(Object.keys(member).sort()).toEqual([...MISSION_SUBMISSION_STATUSES].sort());
    expect(Object.keys(tones).sort()).toEqual([...MISSION_SUBMISSION_STATUSES].sort());
    expect(member).toEqual(staff);
    // the old map (draft/submitted/published) matched only "rejected" and showed raw codes for the rest
    expect(read("client/src/pages/member/MemberReports.tsx")).not.toMatch(/\b(draft|submitted|published):/);
  });
});

describe("Member home: the report CTA that is not available yet", () => {
  const hero = read("client/src/components/lamb/LambHero.tsx");

  it("is a disabled button that looks closed (muted, hairline edge), not a live-looking teal action", () => {
    const button = hero.match(/<button[\s\S]*?<\/button>/)![0];
    expect(button).toContain("disabled");
    expect(button).toContain("text-[var(--color-body-muted)]");
    expect(button).toContain("border-[var(--color-hairline)]");
    expect(button).not.toContain("--color-primary");
  });

  it("explains itself in visible text, not a title tooltip a phone never shows", () => {
    const button = hero.match(/<button[\s\S]*?<\/button>/)![0];
    expect(button).not.toMatch(/\btitle=/);
    expect(button).toContain('aria-describedby="lamb-report-soon"');
    expect(hero).toMatch(/<p id="lamb-report-soon"[^>]*>\s*เร็วๆ นี้/);
  });

  it("only stays disabled while members cannot create reports (POST /api/submissions is CREATE_ROLES-only)", () => {
    expect(read("server/routes/submissions.ts")).toMatch(/submissionsRouter\.post\("\/", requireRole\(\.\.\.CREATE_ROLES\)/);
    expect(read("client/src/App.tsx")).not.toMatch(/path="\/app\/reports\/new"/);
  });
});
