import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { filterSelectorOptions } from "./components/responsiveSelectorLogic";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");
const read = () =>
  readFileSync(
    path.join(REPO_ROOT, "client", "src", "components", "ResponsiveSelector.tsx"),
    "utf8"
  );

describe("ResponsiveSelector filtering contract", () => {
  const options = [
    { value: "care-1", label: "พันธกิจเมืองกาฬสินธุ์", searchText: "เมือง" },
    { value: "care-2", label: "พันธกิจสมเด็จ", searchText: "สมเด็จ" },
  ];

  it("preserves all options for an empty query and matches Thai labels", () => {
    expect(filterSelectorOptions(options, "")).toEqual(options);
    expect(filterSelectorOptions(options, "กาฬสินธุ์")).toEqual([options[0]]);
  });

  it("matches searchText and returns an empty result when nothing matches", () => {
    expect(filterSelectorOptions(options, "เมือง")).toEqual([options[0]]);
    expect(filterSelectorOptions(options, "ไม่มีรายการนี้")).toEqual([]);
  });
});

describe("ResponsiveSelector interaction contract", () => {
  const source = read();

  it("supports grouped options, selected state, and accessible listbox semantics", () => {
    expect(source).toContain("groups?: SelectorGroup[]");
    expect(source).toContain('role="listbox"');
    expect(source).toContain('role="option"');
    expect(source).toContain("aria-selected={selected}");
    expect(source).toContain("Check");
    expect(source).toContain("<p className=\"type-fine");
  });

  it("provides a searchable empty state and preserves the controlled callback contract", () => {
    expect(source).toContain("onValueChange: (value: string) => void");
    expect(source).toContain('type="search"');
    expect(source).toContain("aria-live=\"polite\"");
    expect(source).toContain("ไม่พบรายการที่ตรงกับ");
    expect(source).toContain("onValueChange(nextValue)");
    expect(source).toContain("setOpen(false)");
  });

  it("uses a bottom sheet on touch layouts and a collision-aware popover on desktop", () => {
    expect(source).toContain("useIsMobile");
    expect(source).toContain('<SheetContent side="bottom"');
    expect(source).toContain("z-[60]");
    expect(source).toContain("h-[min(88dvh,44rem)]");
    expect(source).toContain("overscroll-contain");
    expect(source).toContain("pb-[calc(1rem+var(--safe-b))]");
    expect(source).toContain("<PopoverContent align=\"start\"");
    expect(source).toContain("sideOffset={6}");
  });

  it("keeps selector styling on shared light/dark tokens and 44px targets", () => {
    expect(source).toContain("min-h-11");
    expect(source).toContain("var(--color-canvas)");
    expect(source).toContain("var(--color-ink)");
    expect(source).toContain("var(--color-primary-focus)");
    expect(source).not.toMatch(/(?:bg|text|border)-(?:slate|gray|blue|teal)-\d{2,3}/);
  });
});

// The repository's Vitest environment is node-only and has no DOM adapter or
// Testing Library. These tests intentionally cover the pure filtering rule and
// the stable accessibility/layout contract; browser-level focus, pointer,
// viewport, scroll-lock, and iOS keyboard behavior require visual QA.
