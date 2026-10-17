import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");
const home = read("client/src/pages/Home.tsx");
const topbar = read("client/src/components/layout/Topbar.tsx");

/** Position of a needle in Home.tsx, failing loudly when it is missing. */
const at = (needle: string) => {
  const i = home.indexOf(needle);
  expect(i, `Home.tsx must contain ${needle}`).toBeGreaterThan(-1);
  return i;
};

describe("Admin Home: order of sections", () => {
  it("puts what needs attention right after the greeting and shortcuts, before everything editorial", () => {
    // It was the fifth block, 2,622px down on a phone and 2,048px on a desktop, while a code
    // comment claimed it came first.
    const order = [
      'aria-labelledby="home-title"',
      'aria-labelledby="home-attention"',
      "<OrgSnapshot />",
      'aria-labelledby="home-upcoming"',
      'aria-labelledby="home-recent"',
    ].map(at);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("keeps the shortcuts, stats and photos (HomeMyWork) above the attention section", () => {
    expect(at("<HomeMyWork")).toBeLessThan(at('aria-labelledby="home-attention"'));
  });

  it("no longer nests the organisation snapshot in the greeting section", () => {
    const greeting = home.slice(at('aria-labelledby="home-title"'), at('aria-labelledby="home-attention"'));
    expect(greeting).not.toContain("<OrgSnapshot");
  });

  it("its comment describes the order the page really has", () => {
    expect(home).toContain("come right after the greeting and");
    expect(home).not.toContain("without scrolling past the\n            editorial sections");
  });
});

describe("Admin Home: overdue follow-ups appear once, with the days", () => {
  it("ContactGap draws only the member split and takes no overdue list", () => {
    const fn = home.slice(at("function ContactGap("), at("function ContactGap(") + 900);
    expect(fn).not.toMatch(/overdue\s*[:,]/);
    expect(home).not.toContain("เลยกำหนดนานที่สุด");
    expect(home).not.toMatch(/<ContactGap[\s\S]*?overdue=/);
  });

  it("the attention card's overdue list carries the days as well as the subject", () => {
    // The JSX heading is the last occurrence; an earlier one is the ContactGap comment explaining why.
    const start = home.lastIndexOf("รายการที่เลยกำหนด");
    expect(start).toBeGreaterThan(at("function ContactGap("));
    const block = home.slice(start, start + 1400);
    expect(block).toContain("daysOverdue(followUp.dueAt)");
    expect(block).toContain("เลย {daysOverdue(followUp.dueAt)} วัน");
  });
});

describe("Admin Home: no disabled weekly-report placeholder", () => {
  // It was a 90-164px block of "เริ่มรายงานสัปดาห์นี้ / เร็วๆ นี้ / ยังไม่เปิดให้ส่ง" with a disabled button,
  // against the shell's own rule that an entry which opens "coming soon" teaches people not to trust it.
  it("Home no longer renders the placeholder section, its copy or its disabled button", () => {
    expect(home).not.toContain('aria-label="รายงานสัปดาห์"');
    expect(home).not.toContain("เริ่มรายงานสัปดาห์นี้");
    expect(home).not.toContain("ยังไม่เปิดให้ส่ง");
    expect(home).not.toContain("แบบฟอร์มส่งสรุปยอดและกิจกรรมประจำสัปดาห์");
    expect(home).not.toMatch(/\bFileText\b/);
  });

  it("the page still says plainly that there is no weekly report yet (the truthful message is kept)", () => {
    const myWork = read("client/src/components/home/HomeMyWork.tsx");
    expect(myWork).toContain("ระบบยังไม่มีรายงานรายสัปดาห์");
  });

  it("the Member PWA is untouched by this change", () => {
    // Its own report CTA is a separate, deliberate decision (members cannot create reports yet).
    expect(read("client/src/components/lamb/LambHero.tsx")).toContain("lamb-report-soon");
  });
});

describe("Notification bell vs the attention row", () => {
  it("the bell's label says it counts new items; it still reads status=new", () => {
    expect(topbar).toContain("เปิดกล่องข้อมูล มีรายการใหม่ ");
    expect(topbar).not.toContain("ที่รอตรวจสอบ มี ");
    expect(topbar).toContain("/api/submissions?status=new&limit=50");
  });

  it("the attention row keeps the broader 'waiting for review' meaning and its own data source", () => {
    expect(home).toMatch(/label="ข้อมูลที่รอตรวจสอบ"\s+count=\{data\.pendingSubmissionsCount\}/);
  });

  it("the two server definitions are still the ones the labels describe", () => {
    const dashboard = read("server/routes/dashboard.ts");
    expect(dashboard).toMatch(/inArray\(missionSubmissions\.status, \["new", "reviewing", "needs_info"\]\)/);
  });
});
