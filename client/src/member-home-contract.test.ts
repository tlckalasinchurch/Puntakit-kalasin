import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import * as path from "node:path";

/**
 * MemberHome layout contracts decided while accepting the redesign:
 *
 * - Upcoming events sit directly under the member pass, ahead of "ของฉัน"
 *   and the announcements, so the next event is visible on a 360x740 screen
 *   without scrolling.
 * - The "registered" button keeps a border that is readable on its own
 *   (`--color-hairline` on white is 1.32:1, below the 3:1 non-text minimum).
 * - Only the next event the member can still register for gets the filled
 *   primary button; the rest are outlined.
 */

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");
const source = readFileSync(
  path.join(REPO_ROOT, "client/src/pages/member/MemberHome.tsx"),
  "utf8"
);

describe("MemberHome layout contract", () => {
  it("orders sections: pass, events, mine, announcements", () => {
    const pass = source.indexOf('aria-labelledby="member-pass-heading"');
    const events = source.indexOf('id="member-events-heading"');
    const mine = source.indexOf('id="member-mine-heading"');
    const announcements = source.indexOf('id="member-announcements-heading"');
    expect(pass).toBeGreaterThan(-1);
    expect(events).toBeGreaterThan(pass);
    expect(mine).toBeGreaterThan(events);
    expect(announcements).toBeGreaterThan(mine);
  });

  it("does not draw the registered button border with the hairline token", () => {
    const registered = source.match(/evt\.isRegistered\s*\?\s*"([^"]+)"/);
    expect(registered).not.toBeNull();
    expect(registered![1]).toContain("border-[var(--color-error)]");
    expect(registered![1]).not.toContain("--color-hairline");
  });

  it("fills only the next event the member can still register for", () => {
    expect(source).toMatch(
      /nextRegistrableId\s*=\s*events\.find\(evt\s*=>\s*!evt\.isRegistered\)\?\.id/
    );
    expect(source).toContain("evt.id === nextRegistrableId");
  });
});
