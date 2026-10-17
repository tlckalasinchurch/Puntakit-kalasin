import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * The admin sidebar collapses to an icon rail on desktop (>= lg, 1024px) and stays an
 * off-canvas drawer below it. The two states are separate: `collapsed` (desktop) never feeds
 * the drawer, and `menuOpen` (drawer) never feeds the rail. Vitest runs without a DOM here, so
 * these read the shipped source; real behaviour is checked in a browser.
 */
const ROOT = path.resolve(import.meta.dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const sidebar = read("client/src/components/layout/Sidebar.tsx");
const layout = read("client/src/components/layout/AppLayout.tsx");
const logo = read("client/src/components/layout/Logo.tsx");

describe("collapse toggle", () => {
  it("is a real button that reports its state and what it controls", () => {
    expect(sidebar).toMatch(/aria-expanded=\{!collapsed\}/);
    expect(sidebar).toMatch(/aria-controls="app-sidebar"/);
    expect(sidebar).toMatch(/aria-label=\{collapsed \? "ขยายเมนู" : "ย่อเมนู"\}/);
  });

  it("only exists on desktop; the drawer keeps its own close button", () => {
    expect(sidebar).toMatch(/onToggleCollapsed[\s\S]*?hidden[^"`]*lg:flex/);
    expect(sidebar).toMatch(/aria-label="ปิดเมนู"/);
  });

  it("is at least 44px, with a visible focus ring", () => {
    const toggle = sidebar.slice(sidebar.indexOf("onToggleCollapsed"), sidebar.indexOf('aria-label="ปิดเมนู"'));
    expect(toggle).toMatch(/size-11|min-h-11/);
    expect(toggle).toMatch(/focus-visible:ring-2/);
  });
});

describe("collapsed rail", () => {
  it("is applied only from lg up, so the drawer below lg is never narrowed or hidden", () => {
    expect(sidebar).toContain("lg:w-[4.5rem]");
    expect(sidebar).toContain("lg:w-60");
    const labelLine = sidebar.match(/<span className=\{`min-w-0 flex-1[^`]*`\}>\{label\}<\/span>/);
    expect(labelLine, "label span").not.toBeNull();
    expect(labelLine![0]).toContain("lg:sr-only");
    expect(labelLine![0]).not.toMatch(/(^|[\s"`])sr-only/);
  });

  it("keeps an accessible name for every icon (label stays in the DOM as sr-only) and adds a tooltip", () => {
    expect(sidebar).toMatch(/from "@\/components\/ui\/tooltip"/);
    expect(sidebar).toMatch(/<TooltipContent side="right" className="max-lg:hidden">/);
    expect(sidebar).toContain("aria-current={isActive");
  });

  it("marks the active route by more than colour (the bar and the tint stay in the rail)", () => {
    expect(sidebar).toContain("pk-nav-active");
  });

  it("animates the width and respects reduced motion", () => {
    expect(sidebar).toMatch(/lg:transition-\[width\]/);
    expect(sidebar).toContain("motion-reduce:transition-none");
  });

  it("hides the wordmark but keeps the product name for assistive tech", () => {
    expect(logo).toMatch(/textClassName/);
    expect(sidebar).toMatch(/<Logo[^>]*textClassName=\{collapsed \? "lg:sr-only" : undefined\}/);
  });
});

describe("state is separate and safe", () => {
  it("AppLayout keeps `collapsed` and `menuOpen` as independent state", () => {
    expect(layout).toMatch(/const \[menuOpen, setMenuOpen\] = useState\(false\)/);
    expect(layout).toMatch(/const \[collapsed, setCollapsed\] = useState\(\(\) => readStoredCollapsed\(getBrowserStorage\(\)\)\)/);
    expect(layout).not.toMatch(/setMenuOpen\([^)]*collapsed/);
    expect(layout).not.toMatch(/setCollapsed\([^)]*menuOpen/);
  });

  it("persists the choice through the guarded helpers, never raw localStorage", () => {
    expect(layout).toContain("writeStoredCollapsed(getBrowserStorage(), collapsed)");
    expect(layout).not.toMatch(/localStorage/);
  });

  it("closes the drawer (and so releases its scroll lock) when the viewport grows to desktop", () => {
    expect(layout).toMatch(/matchMedia\("\(min-width: 1024px\)"\)/);
    expect(layout).toMatch(/if \(event\.matches\) setMenuOpen\(false\)/);
    expect(layout).toMatch(/removeEventListener\?\.\("change"/);
  });

  it("the main column flexes into the freed space instead of keeping a fixed margin", () => {
    expect(layout).toMatch(/relative flex min-w-0 flex-1 flex-col/);
    expect(layout).not.toMatch(/ml-60|lg:ml-|pl-60|lg:pl-60/);
  });
});

describe("the mobile drawer is unchanged", () => {
  it("still closes on Escape, locks scroll, traps Tab and returns focus", () => {
    expect(sidebar).toMatch(/event\.key === "Escape"/);
    expect(sidebar).toMatch(/document\.body\.style\.overflow = "hidden"/);
    expect(sidebar).toMatch(/event\.key !== "Tab"/);
    expect(sidebar).toMatch(/previousFocus\?\.focus\?\.\(\)/);
  });

  it("keeps the overlay, the dialog role and the menu button's aria wiring", () => {
    expect(sidebar).toMatch(/role=\{open \? "dialog" : undefined\}/);
    expect(sidebar).toMatch(/aria-modal=\{open \? "true" : undefined\}/);
    expect(sidebar).toContain('id="app-sidebar"');
    expect(read("client/src/components/layout/Topbar.tsx")).toMatch(/aria-expanded=\{menuOpen\}/);
  });
});
