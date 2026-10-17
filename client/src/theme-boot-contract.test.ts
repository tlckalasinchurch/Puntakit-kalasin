import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// First paint must already be in the user's theme: a dark user (dark is the
// default) must never see the light canvas while the app bundle loads.
const root = path.resolve(import.meta.dirname, "..", "..");
const html = readFileSync(path.join(root, "client", "index.html"), "utf8");
const css = readFileSync(path.join(root, "client", "src", "index.css"), "utf8");
const ctx = readFileSync(path.join(root, "client", "src", "contexts", "ThemeContext.tsx"), "utf8");
const manifest = JSON.parse(readFileSync(path.join(root, "client", "public", "manifest.json"), "utf8")) as {
  theme_color: string;
  background_color: string;
};

const darkCanvas = css.slice(css.indexOf("\n.dark {")).match(/--color-canvas:\s*(#[0-9a-f]{6})/i)![1].toLowerCase();
const lightCanvas = css.match(/--color-canvas:\s*(#[0-9a-f]{6})/i)![1].toLowerCase();

describe("theme boot (first paint)", () => {
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? "";

  it("an inline script in <head> sets the theme before the module bundle", () => {
    expect(script).toContain("classList.add(\"dark\")");
    expect(script).toContain("localStorage.getItem(\"theme\")");
    expect(html.indexOf("<script>")).toBeGreaterThan(-1);
    expect(html.indexOf("<script>")).toBeLessThan(html.indexOf("src=\"/src/main.tsx\""));
  });

  it("defaults to dark, matching ThemeProvider defaultTheme=\"dark\", and survives blocked storage", () => {
    expect(script).toMatch(/t = "dark"/);
    expect(script).toMatch(/try \{[\s\S]*localStorage[\s\S]*\} catch/);
    expect(readFileSync(path.join(root, "client", "src", "App.tsx"), "utf8")).toContain("<ThemeProvider defaultTheme=\"dark\"");
  });

  it("the boot script and ThemeContext use the same theme-color values as the CSS canvases", () => {
    expect(script).toContain(`"${darkCanvas}"`);
    expect(script).toContain(`"${lightCanvas}"`);
    expect(ctx).toContain(`"${darkCanvas}" : "${lightCanvas}"`);
    expect(html).toContain(`<meta name="theme-color" content="${darkCanvas}" />`);
  });

  it("the PWA manifest splash colours are the dark canvas", () => {
    expect(manifest.theme_color.toLowerCase()).toBe(darkCanvas);
    expect(manifest.background_color.toLowerCase()).toBe(darkCanvas);
  });

  it("the dark theme paints the root element, not only body/#root", () => {
    const dark = css.slice(css.indexOf("\n.dark {"), css.indexOf("\n}\n", css.indexOf("\n.dark {")));
    expect(dark).toMatch(/background:\s*var\(--color-canvas\)/);
  });
});
