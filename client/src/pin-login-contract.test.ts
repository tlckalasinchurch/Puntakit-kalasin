import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

// The sign-in screen is a restyle only: PIN authentication and its flow are unchanged,
// the Puntakit logo sits on a white plate (it is a JPG on white), and the colours come
// from the shared Premium Teal tokens in both themes.
const root = path.resolve(import.meta.dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");
const page = read("client/src/pages/PinSignInPage.tsx");
const css = read("client/src/index.css");
const block = css.slice(css.indexOf("/* First-party PIN authentication"), css.indexOf("/* Lamb Edition"));

describe("PIN sign-in page", () => {
  it("keeps PIN as the only credential and the existing login call", () => {
    expect(page).toContain('api.post("/api/auth/login", { pin })');
    expect(page).toContain("window.location.assign");
    for (const forbidden of ["<input", "type=\"email\"", "type=\"password\"", "Google", "oauth", "ลืมรหัสผ่าน", "forgot"]) {
      expect(page.toLowerCase(), `must not contain ${forbidden}`).not.toContain(forbidden.toLowerCase());
    }
    expect(page).toContain("หากลืม PIN กรุณาติดต่อผู้ดูแลระบบ");
    expect(page).toContain("<LegalLinks />");
    expect(page).toContain("pin-login__error");
  });

  it("shows the supplied logo on a white plate, with alt text and a real file", () => {
    expect(page).toContain('src="/puntakit-logo.jpg"');
    expect(page).toContain('alt="โลโก้ Puntakit"');
    const file = path.join(root, "client", "public", "puntakit-logo.jpg");
    expect(existsSync(file)).toBe(true);
    const bytes = readFileSync(file);
    expect([bytes[0], bytes[1]]).toEqual([0xff, 0xd8]); // JPEG, not a renamed PNG
    expect(statSync(file).size).toBeLessThan(100 * 1024);
    // The JPG has a white background, so no transparent look is faked: it gets a white plate.
    expect(block).toMatch(/\.pin-login__plate \{[^}]*background:\s*#fff/);
  });

  it("uses the shared theme tokens, not a private palette", () => {
    expect(block).not.toMatch(/--pin-(bg|text|mint|champagne|glass)/);
    // No local redefinition of a shared colour token (a `--color-x:` declaration inside the screen).
    expect(block).not.toMatch(/^\s*--color-[\w-]+\s*:/m);
    for (const retired of ["#0c7c82", "#7ff0dd", "#e8d3a8", "backdrop-filter"]) {
      expect(block.toLowerCase(), retired).not.toContain(retired);
    }
    // The primary fill carries --color-on-primary (never a hard-coded colour).
    expect(block).toMatch(/\.pin-login__submit \{[^}]*background:\s*var\(--color-primary\);[^}]*color:\s*var\(--color-on-primary\)/);
  });

  it("fills the visible viewport and keeps touch targets >= 44px", () => {
    expect(block).toMatch(/min-height:\s*var\(--app-vh\)/);
    expect(block).toMatch(/\.pin-login__keypad button \{[^}]*min-height:\s*3\.5rem/);
    expect(block).toMatch(/\.pin-login__submit \{[^}]*min-height:\s*3\.5rem/);
  });

  it("shows the brand panel beside the card only from 900px up", () => {
    expect(block).toMatch(/\.pin-login__brand \{\s*display:\s*none/);
    expect(block).toMatch(/@media \(min-width: 900px\)[\s\S]*\.pin-login__brand \{\s*display:\s*block/);
  });
});
