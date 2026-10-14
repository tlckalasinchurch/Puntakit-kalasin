import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import * as path from "node:path";

/**
 * Contract test for the Dual-CTA RSVP on the member events page and the
 * matching mini-cards on the member home page.
 *
 * The pattern comes from the audited reference app (ตีแบด): a soft low-
 * commitment action ("สนใจ") beside a primary hard-commit action ("จะมา").
 *
 * Source-level on purpose, like the other contract tests in this folder: it
 * pins the decisions that must not drift silently — in particular that the
 * soft action stays client-only, because this API has no interest endpoint.
 */

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(REPO_ROOT, rel), "utf8");
/** Source without comments, so a doc comment that names a label is not a match. */
const code = (rel: string) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

const EVENTS = "client/src/pages/member/MemberEvents.tsx";
const HOME = "client/src/pages/member/MemberHome.tsx";

/** Every <button>…</button> block in a source. Buttons never nest here. */
function buttons(src: string): string[] {
  return [...src.matchAll(/<button\b[\s\S]*?<\/button>/g)].map(m => m[0]);
}

describe("member events — dual-CTA RSVP", () => {
  it("offers both a soft \"สนใจ\" and a primary \"จะมา\" action", () => {
    const src = code(EVENTS);
    expect(src).toContain("<span>สนใจ</span>");
    expect(src).toContain("<span>จะมา</span>");
  });

  it("routes the soft action to a modal and the primary action to registration", () => {
    const src = code(EVENTS);
    const soft = buttons(src).find(b => b.includes(">สนใจ<"));
    const primary = buttons(src).find(b => b.includes(">จะมา<"));
    const cancel = buttons(src).find(b => b.includes("ยกเลิกการลงทะเบียน"));

    expect(soft, "no \"สนใจ\" button").toBeDefined();
    expect(primary, "no \"จะมา\" button").toBeDefined();
    expect(cancel, "no cancel button").toBeDefined();

    // The soft action must never touch the network — it only records intent locally.
    expect(soft!).toContain("setInterestedEvent");
    expect(soft!).not.toContain("api.");
    expect(soft!).not.toContain("handleToggleRegistration");

    // The primary action and the cancel action are the two that register.
    expect(primary!).toContain("handleToggleRegistration");
    expect(cancel!).toContain("handleToggleRegistration");
  });

  it("does not invent an interest endpoint", () => {
    const src = code(EVENTS);
    // Handles both `"/api/events"` and `` `/api/me/events/${id}/register` ``.
    const paths = [
      ...new Set(
        [...src.matchAll(/api\.\w+(?:<[^>]*>)?\(\s*["'`]([^"'`]+)["'`]/g)].map(
          m => m[1]
        )
      ),
    ];
    expect(paths).toEqual([
      "/api/events",
      "/api/announcements",
      "/api/me/events/my",
      "/api/me/events/${eventId}/register",
    ]);
    expect(paths.some(p => /interest/i.test(p))).toBe(false);
  });

  it("keeps a 44px minimum touch target on every RSVP action", () => {
    const src = code(EVENTS);
    const rsvp = buttons(src).filter(
      b =>
        b.includes(">สนใจ<") ||
        b.includes(">จะมา<") ||
        b.includes("ยกเลิกการลงทะเบียน")
    );
    expect(rsvp).toHaveLength(3);
    for (const b of rsvp) expect(b).toContain("min-h-11");
  });

  it("reuses the shared Modal instead of declaring a local one", () => {
    const src = code(EVENTS);
    expect(src).toContain("<Modal");
    // design-system-consistency.test.ts bans both of these in app code.
    expect(src).not.toMatch(/className="modal-card"/);
    expect(src).not.toMatch(/className="modal-backdrop"/);
  });
});

describe("member home — RSVP consistency with the events page", () => {
  it("uses the same dual CTA on its event mini-cards", () => {
    const src = code(HOME);
    expect(src).toContain("<span>สนใจ</span>");
    // "จะมา" may be wrapped in <span> or sit bare inside a ternary.
    expect(src).toMatch(/<span>จะมา<\/span>|"จะมา"/);
  });

  it("keeps the soft action client-only, like the events page", () => {
    const src = code(HOME);
    const soft = buttons(src).find(b => b.includes(">สนใจ<"));
    expect(soft, "no \"สนใจ\" button on home").toBeDefined();
    expect(soft!).toContain("setInterestedEvent");
    expect(soft!).not.toContain("api.");
    expect(soft!).not.toContain("handleRegisterEvent");
  });

  it("keeps Lamb-edition scoping on home: no V2-brand or badminton tokens", () => {
    // Home is lamb-theme; it must not leak the reference app's palette or
    // claim the V2 olive where the approved Lamb teal is in force.
    const src = code(HOME);
    expect(src).not.toMatch(/#01c853/i);
    expect(src).not.toMatch(/#02c954/i);
    expect(src).not.toMatch(/#fe6b35/i);
    expect(src).not.toMatch(/Noto Sans Thai/);
  });
});
