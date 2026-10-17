import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..");
const topbar = readFileSync(path.join(root, "client/src/components/layout/Topbar.tsx"), "utf8");

/** The avatar `<button …>…</button>`: from the opening tag that carries aria-haspopup to its closing tag. */
const avatarButton = () => {
  const at = topbar.indexOf('aria-haspopup="dialog"');
  expect(at, "the avatar must declare that it opens a dialog").toBeGreaterThan(-1);
  return topbar.slice(topbar.lastIndexOf("<button", at), topbar.indexOf("</button>", at) + "</button>".length);
};

describe("Topbar avatar: asking before logging out", () => {
  // It was `onClick={() => void logout()}`: one tap, beside the theme and inbox buttons, ended the session.
  it("tapping the avatar opens a confirmation instead of logging out", () => {
    const button = avatarButton();
    expect(button).toContain("onClick={() => setConfirmingLogout(true)}");
    expect(button).not.toContain("logout");
  });

  it("logout() is called in exactly one place: the dialog's confirm action", () => {
    // `void logout()` is the call; a bare `logout()` also appears in an explanatory comment.
    expect(topbar.match(/void logout\(\)/g)).toHaveLength(1);
    const confirm = topbar.slice(topbar.indexOf("onConfirm={"));
    expect(confirm.slice(0, 700)).toContain("logout()");
  });

  it("uses the app's existing ConfirmDialog, with a neutral tone and Thai wording", () => {
    expect(topbar).toContain('import { ConfirmDialog } from "@/components/ConfirmDialog";');
    expect(topbar).toContain('title="ออกจากระบบ?"');
    expect(topbar).toContain('tone="primary"');
    expect(topbar).toContain('confirmLabel="ออกจากระบบ"');
    expect(topbar).toContain('busyLabel="กำลังออกจากระบบ…"');
  });

  it("cancelling does not log out, and the dialog is not left stuck if the session survives", () => {
    const cancel = topbar.slice(topbar.indexOf("onCancel={"), topbar.indexOf("onConfirm={"));
    expect(cancel).toContain("setConfirmingLogout(false)");
    expect(cancel).not.toContain("logout");
    expect(topbar).toMatch(/void logout\(\)\.finally\(\(\) => \{\s*setLoggingOut\(false\);\s*setConfirmingLogout\(false\);/);
  });

  it("the dialog is a sibling of the header, never inside it (the header clips overflow and has a backdrop filter)", () => {
    expect(topbar.indexOf("<ConfirmDialog")).toBeGreaterThan(topbar.indexOf("</header>"));
    expect(topbar).toMatch(/return \(\s*<>\s*<header/);
  });

  it("keeps the avatar a real, labelled, focus-ringed button", () => {
    const button = avatarButton();
    expect(button).toContain('type="button"');
    expect(button).toContain('aria-label="ออกจากระบบ"');
    expect(button).toContain("focus-visible:ring-2");
  });
});
