import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");
const home = read("client/src/pages/Home.tsx");
const myWork = read("client/src/components/home/HomeMyWork.tsx");
const org = read("client/src/components/OrgSnapshot.tsx");
const sidebar = read("client/src/components/layout/Sidebar.tsx");

/** `<a …>…</a>` or `<button …>…</button>` that contains `needle`, from its opening tag to its closing tag. */
const around = (source: string, tag: "Link" | "button", needle: string) => {
  const at = source.indexOf(needle);
  expect(at, `${needle} must exist`).toBeGreaterThan(-1);
  const open = source.lastIndexOf(`<${tag}`, at);
  return source.slice(open, source.indexOf(`</${tag}>`, at) + `</${tag}>`.length);
};

describe("Home links: 'ดูทั้งหมด' names are distinct and keep Label in Name (R2)", () => {
  // The visible text stays "ดูทั้งหมด"; a visually hidden suffix is appended, so the accessible
  // name always starts with what is on screen (WCAG 2.5.3) and no aria-label can contradict it.
  const cases: [string, string, "Link" | "button", string][] = [
    ["new members", home, "Link", 'href="/members">'],
    ["announcements", home, "Link", 'href="/announcements">'],
    ["photos", myWork, "Link", 'href="/feed" className="type-caption-strong'],
    ["more shortcuts toggle", myWork, "button", 'aria-controls={moreOpen'],
  ];

  it.each(cases)("%s: visible text first, hidden suffix after, no aria-label", (_name, source, tag, needle) => {
    const el = around(source, tag, needle);
    expect(el).toMatch(/(ดูทั้งหมด|\{moreOpen \? "ซ่อน" : "ดูทั้งหมด"\})\s*<span className="sr-only">/);
    expect(el).not.toContain("aria-label");
  });

  it("the hidden suffixes tell the four apart", () => {
    const suffixes = [home, myWork].flatMap((source) => [...source.matchAll(/<span className="sr-only"> ([^<]+)<\/span>/g)].map((m) => m[1]));
    expect(suffixes).toEqual(expect.arrayContaining(["สมาชิกใหม่ล่าสุด", "ประกาศและข่าวสาร", "ภาพพันธกิจ", "ทางลัดเพิ่มเติม"]));
    expect(new Set(suffixes).size).toBe(suffixes.length);
  });
});

describe("Home disclosure: aria-controls points at something that exists (R3)", () => {
  it("is only set while the controlled list is rendered", () => {
    expect(myWork).toContain('aria-controls={moreOpen ? "home-more-links" : undefined}');
    // the list is rendered under the same condition and carries the id
    expect(myWork).toMatch(/\{moreOpen && moreLinks\.length > 0 && \(\s*<ul id="home-more-links"/);
  });

  it("no other aria-controls on Home refers to an id that is not in the same file", () => {
    for (const source of [home, myWork, org]) {
      for (const [, id] of source.matchAll(/aria-controls="([^"]+)"/g)) {
        expect(source, `id ${id}`).toContain(`id="${id}"`);
      }
    }
  });
});

describe("Home heading hierarchy inside <main> (R4)", () => {
  // The sidebar's <h2> group labels sit in <aside aria-label="เมนูหลัก">, a navigation landmark of
  // their own; they are deliberately left alone. What is locked here is the page content.
  const content = [home, myWork, org];
  const levels = (source: string) => [...source.matchAll(/<(h[1-6])\b|<SectionHeader\b/g)].map((m) => (m[1] ? Number(m[1][1]) : 2));

  it("the page has exactly one h1, and it is in Home", () => {
    expect([...home.matchAll(/<h1\b/g)]).toHaveLength(1);
    for (const source of [myWork, org]) expect(source).not.toMatch(/<h1\b/);
  });

  it("only h1, h2 and h3 are used, and an h3 only ever follows an h2 or another h3 in the same file", () => {
    for (const source of content) {
      const seq = levels(source);
      expect(Math.max(...seq)).toBeLessThanOrEqual(3);
      let current = 1; // the page's h1 comes before every section component
      for (const level of seq) {
        expect(level - current, `h${level} after h${current}`).toBeLessThanOrEqual(1);
        current = level;
      }
    }
  });

  it("the sidebar group labels stay in the navigation landmark, not in the page content", () => {
    expect(sidebar).toContain('aria-label="เมนูหลัก"');
    // A template literal since the rail can visually hide the heading (sr-only) without removing it.
    expect(sidebar).toMatch(/<h2 className=\{?[`"]type-fine mb-1 px-3 font-semibold/);
    for (const source of content) expect(source).not.toContain("Sidebar");
  });
});
