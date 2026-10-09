import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import * as path from "node:path";

/**
 * The prayer-request flow stores the request and nothing more: there is no
 * staff endpoint, no notification and no page that hands a request to a team
 * (`docs/PUNTAKIT_AUDIT_FOLLOWUP_2026-10-05.md` D2, still an open decision).
 *
 * The member-facing copy used to promise the opposite ("ทีมศิษยาภิบาลจะร่วมอธิษฐาน
 * เผื่อท่าน"), which told members a team already had their request in hand. This
 * locks the wording so a future editor cannot reintroduce the promise without
 * also building the receiving side it implies.
 */

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(REPO_ROOT, rel), "utf8");

const modal = read("client/src/components/PrayerRequestModal.tsx");
const memberHome = read("client/src/pages/member/MemberHome.tsx");
const portal = read("server/routes/portal.ts");

/** Any claim that a team already has the request in hand. */
const PROMISES_RECEIPT = /(ทีมศิษยาภิบาล|ร่วมอธิษฐานเผื่อท่าน|ส่งถึงทีม|จะเห็นคำขอนี้)/;

describe("prayer request copy matches what the system actually does", () => {
  it("the member PWA never claims a team already received the request", () => {
    expect(modal).not.toMatch(PROMISES_RECEIPT);
    expect(memberHome).not.toMatch(PROMISES_RECEIPT);
  });

  it("the server's success message states the request is stored and waiting", () => {
    expect(portal).toContain("บันทึกคำขออธิษฐานเรียบร้อยแล้ว");
    expect(portal).toContain("รอผู้รับผิดชอบตรวจสอบ");
    expect(portal).not.toMatch(PROMISES_RECEIPT);
  });

  it("the toast the member sees says the same thing as the server", () => {
    expect(modal).toContain("บันทึกคำขออธิษฐานเรียบร้อยแล้ว");
    expect(modal).toContain("รอผู้รับผิดชอบตรวจสอบ");
  });

  it("the confidential flag reads as a stored marking, not as an audience that exists today", () => {
    expect(modal).toContain("ทำเครื่องหมายว่าลับ");
    expect(modal).toMatch(/จำกัดสิทธิ์ผู้เปิดอ่าน/);
  });

  it("still validates the required fields inline (unchanged by the copy fix)", () => {
    expect(modal).toMatch(/error=\{titleError/);
    expect(modal).toMatch(/error=\{contentError/);
    expect(modal).toMatch(/disabled=\{submitting\}/);
  });
});
