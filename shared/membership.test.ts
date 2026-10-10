import { describe, expect, it } from "vitest";
import {
  ORDINARY_FEE_BAHT,
  addYears,
  currentTerm,
  daysBetween,
  formatMemberNo,
  isDateOnly,
  summarizeMembership,
  todayInThailand,
  type TermLike,
} from "./membership.js";

const term = (over: Partial<TermLike> = {}): TermLike => ({
  type: "extraordinary",
  status: "open",
  startsOn: "2026-01-01",
  endsOn: "2027-01-01",
  paymentStatus: "not_required",
  ...over,
});

describe("date helpers (no timezone drift)", () => {
  it("adds whole years and clamps 29 Feb", () => {
    expect(addYears("2026-03-15", 1)).toBe("2027-03-15");
    expect(addYears("2024-02-29", 1)).toBe("2025-02-28");
    expect(addYears("2024-02-29", 4)).toBe("2028-02-29");
  });

  it("counts days between date-only strings, negative when past", () => {
    expect(daysBetween("2026-10-10", "2026-10-11")).toBe(1);
    expect(daysBetween("2026-10-10", "2026-09-30")).toBe(-10);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
  });

  it("validates calendar dates", () => {
    expect(isDateOnly("2026-02-29")).toBe(false);
    expect(isDateOnly("2024-02-29")).toBe(true);
    expect(isDateOnly("2026-13-01")).toBe(false);
    expect(isDateOnly("26-1-1")).toBe(false);
  });

  it("computes today in Thailand (UTC+7), not in UTC", () => {
    // 20:00 UTC on 9 Oct is already 10 Oct in Thailand.
    expect(todayInThailand(new Date("2026-10-09T20:00:00Z"))).toBe("2026-10-10");
    expect(todayInThailand(new Date("2026-10-09T16:59:00Z"))).toBe("2026-10-09");
  });
});

describe("summarizeMembership", () => {
  it("has no state without a term", () => {
    const s = summarizeMembership([], "2026-10-10");
    expect(s.state).toBe("none");
    expect(s.needsAttention).toBe(false);
  });

  it("a trial far from its end is active and needs nobody", () => {
    const s = summarizeMembership([term()], "2026-03-01");
    expect(s.state).toBe("trial_active");
    expect(s.needsAttention).toBe(false);
    expect(s.type).toBe("extraordinary");
  });

  it("a trial inside the 30-day window is due for the care leader's review, never auto-converted", () => {
    const s = summarizeMembership([term()], "2026-12-15");
    expect(s.state).toBe("trial_review_due");
    expect(s.needsAttention).toBe(true);
    // Past its end it is STILL a trial awaiting review — nothing flips it to ordinary.
    const late = summarizeMembership([term()], "2027-06-01");
    expect(late.state).toBe("trial_review_due");
    expect(late.type).toBe("extraordinary");
  });

  it("an ordinary term goes active -> renewal due -> overdue", () => {
    const o = term({ type: "ordinary", paymentStatus: "paid", endsOn: "2027-01-01" });
    expect(summarizeMembership([o], "2026-06-01").state).toBe("ordinary_active");
    expect(summarizeMembership([o], "2026-12-20").state).toBe("ordinary_renewal_due");
    expect(summarizeMembership([o], "2027-01-02").state).toBe("ordinary_overdue");
  });

  it("an unpaid ordinary term needs attention even mid-year", () => {
    const o = term({ type: "ordinary", paymentStatus: "unpaid" });
    const s = summarizeMembership([o], "2026-03-01");
    expect(s.state).toBe("ordinary_active");
    expect(s.needsAttention).toBe(true);
    expect(s.paymentStatus).toBe("unpaid");
  });

  it("uses only the open term; closed terms are history", () => {
    const closed = term({ status: "closed", type: "extraordinary" });
    const open = term({ type: "ordinary", startsOn: "2026-02-01", endsOn: "2027-02-01", paymentStatus: "paid" });
    expect(currentTerm([closed, open])).toBe(open);
    expect(summarizeMembership([closed], "2026-03-01").state).toBe("none");
  });
});

describe("constants and formatting", () => {
  it("fee is 100 baht a year", () => {
    expect(ORDINARY_FEE_BAHT).toBe(100);
  });

  it("formats the card number with zero padding and handles missing", () => {
    expect(formatMemberNo(304)).toBe("00304");
    expect(formatMemberNo(1)).toBe("00001");
    expect(formatMemberNo(null)).toBeNull();
  });
});
