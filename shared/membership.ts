/**
 * Annual membership lifecycle — one definition shared by the API and the UI.
 *
 * Product rules (owner brief, 2026-10-10):
 * - วิสามัญ (`extraordinary`): free one-year trial. When it ends the care
 *   leader reviews it; it is NEVER converted automatically and never billed.
 * - สามัญ (`ordinary`): 100 baht per year. Every yearly cycle is its own term
 *   row, so renewal history is kept and never overwritten.
 *
 * Dates are plain `YYYY-MM-DD` strings on purpose (no `Date` round-trip, so no
 * timezone drift — see AGENTS.md §6.4). "Today" is always passed in.
 *
 * Nothing here records a payment as received on its own: `paid` only exists
 * when an authorised person recorded it (`membership_terms.payment_*`).
 */

export const MEMBERSHIP_TYPES = ["extraordinary", "ordinary"] as const;
export type MembershipType = (typeof MEMBERSHIP_TYPES)[number];

export const MEMBERSHIP_TYPE_LABELS: Record<MembershipType, string> = {
  extraordinary: "วิสามัญ (ทดลอง)",
  ordinary: "สามัญ",
};

/** `open` = the current cycle; `closed` = history (see `closedReason`). */
export const MEMBERSHIP_TERM_STATUSES = ["open", "closed"] as const;
export type MembershipTermStatus = (typeof MEMBERSHIP_TERM_STATUSES)[number];

export const MEMBERSHIP_CLOSE_REASONS = [
  "converted_to_ordinary",
  "renewed",
  "not_continued",
] as const;
export type MembershipCloseReason = (typeof MEMBERSHIP_CLOSE_REASONS)[number];

export const MEMBERSHIP_CLOSE_REASON_LABELS: Record<MembershipCloseReason, string> = {
  converted_to_ordinary: "เปลี่ยนเป็นสามัญ",
  renewed: "ต่ออายุแล้ว",
  not_continued: "ไม่ต่อสถานะ",
};

export const PAYMENT_STATUSES = ["not_required", "unpaid", "paid"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  not_required: "ไม่มีค่าสมาชิก",
  unpaid: "ยังไม่ชำระ",
  paid: "ชำระแล้ว",
};

/** Ordinary membership fee per year, in baht. */
export const ORDINARY_FEE_BAHT = 100;
/** Trial length and ordinary cycle length, in years. */
export const TERM_YEARS = 1;
/** A term counts as "due" this many days before it ends. */
export const DUE_WINDOW_DAYS = 30;

/** What the person looking at a member should read at a glance. */
export const MEMBERSHIP_STATES = [
  "none",
  "trial_active",
  "trial_review_due",
  "ordinary_active",
  "ordinary_renewal_due",
  "ordinary_overdue",
] as const;
export type MembershipState = (typeof MEMBERSHIP_STATES)[number];

export const MEMBERSHIP_STATE_LABELS: Record<MembershipState, string> = {
  none: "ยังไม่มีสถานะสมาชิก",
  trial_active: "วิสามัญ · อยู่ในช่วงทดลอง",
  trial_review_due: "วิสามัญ · ถึงกำหนดให้หัวหน้าแคร์ตรวจสอบ",
  ordinary_active: "สามัญ · ปกติ",
  ordinary_renewal_due: "สามัญ · ใกล้ถึงกำหนดต่ออายุ",
  ordinary_overdue: "สามัญ · เกินกำหนดต่ออายุ",
};

/** The slice of a term row the status logic needs. */
export interface TermLike {
  type: MembershipType;
  status: MembershipTermStatus;
  /** `YYYY-MM-DD` */
  startsOn: string;
  /** `YYYY-MM-DD` (exclusive end: the term covers startsOn .. endsOn - 1 day) */
  endsOn: string;
  paymentStatus: PaymentStatus;
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parses `YYYY-MM-DD` into a UTC day number so arithmetic never depends on the local zone. */
function dayNumber(value: string): number {
  const m = DATE_ONLY.exec(value);
  if (!m) throw new Error(`Not a YYYY-MM-DD date: ${value}`);
  return Math.floor(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000);
}

export function isDateOnly(value: string): boolean {
  const m = DATE_ONLY.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return dayNumber(to) - dayNumber(from);
}

/** `value` plus whole years, clamping 29 Feb to 28 Feb in non-leap years. */
export function addYears(value: string, years: number): string {
  const m = DATE_ONLY.exec(value);
  if (!m) throw new Error(`Not a YYYY-MM-DD date: ${value}`);
  const year = Number(m[1]) + years;
  const month = Number(m[2]);
  const day = Number(m[3]);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${String(year).padStart(4, "0")}-${pad(month)}-${pad(Math.min(day, lastDay))}`;
}

/** Today as `YYYY-MM-DD` in Thailand (UTC+7), the only zone this church operates in. */
export function todayInThailand(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() + 7 * 3_600_000);
  return shifted.toISOString().slice(0, 10);
}

/** The member's current term: the open one with the latest start. */
export function currentTerm<T extends TermLike>(terms: readonly T[]): T | null {
  const open = terms.filter((t) => t.status === "open");
  if (open.length === 0) return null;
  return open.reduce((latest, t) => (t.startsOn > latest.startsOn ? t : latest));
}

export interface MembershipSummary {
  state: MembershipState;
  label: string;
  type: MembershipType | null;
  startsOn: string | null;
  endsOn: string | null;
  /** Days until `endsOn` (negative = already past). Null without a current term. */
  daysToEnd: number | null;
  paymentStatus: PaymentStatus | null;
  /** True when someone has to act now: review a trial, or renew / collect an ordinary term. */
  needsAttention: boolean;
}

export function summarizeMembership(terms: readonly TermLike[], today: string): MembershipSummary {
  const term = currentTerm(terms);
  if (!term) {
    return {
      state: "none",
      label: MEMBERSHIP_STATE_LABELS.none,
      type: null,
      startsOn: null,
      endsOn: null,
      daysToEnd: null,
      paymentStatus: null,
      needsAttention: false,
    };
  }
  const daysToEnd = daysBetween(today, term.endsOn);
  const due = daysToEnd <= DUE_WINDOW_DAYS;
  let state: MembershipState;
  if (term.type === "extraordinary") {
    state = due ? "trial_review_due" : "trial_active";
  } else if (daysToEnd < 0) {
    state = "ordinary_overdue";
  } else {
    state = due ? "ordinary_renewal_due" : "ordinary_active";
  }
  const unpaidOrdinary = term.type === "ordinary" && term.paymentStatus === "unpaid";
  return {
    state,
    label: MEMBERSHIP_STATE_LABELS[state],
    type: term.type,
    startsOn: term.startsOn,
    endsOn: term.endsOn,
    daysToEnd,
    paymentStatus: term.paymentStatus,
    needsAttention: state === "trial_review_due" || state === "ordinary_renewal_due" || state === "ordinary_overdue" || unpaidOrdinary,
  };
}

/** Formats `memberNo` as the printed card number ("00304"). */
export function formatMemberNo(memberNo: number | null | undefined): string | null {
  if (memberNo === null || memberNo === undefined) return null;
  return String(memberNo).padStart(5, "0");
}
