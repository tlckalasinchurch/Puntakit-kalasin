import {
  MEMBERSHIP_CLOSE_REASON_LABELS,
  type MembershipCloseReason,
  type MembershipState,
  type PaymentStatus,
} from "@shared/membership";
import type { StatusTone } from "@/components/DesignSystem";

/** "10 ต.ค. 2569" for a `YYYY-MM-DD` day, stable in every viewer timezone. */
export function formatThaiDay(value: string | null | undefined): string {
  if (!value) return "-";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00+07:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric" });
}

export const STATE_TONE: Record<MembershipState, StatusTone> = {
  none: "neutral",
  trial_active: "info",
  trial_review_due: "warning",
  ordinary_active: "success",
  ordinary_renewal_due: "warning",
  ordinary_overdue: "error",
};

export const PAYMENT_TONE: Record<PaymentStatus, StatusTone> = {
  not_required: "neutral",
  unpaid: "warning",
  paid: "success",
};

/** "อีก 25 วัน" / "เกินกำหนด 12 วัน" / "ครบกำหนดวันนี้" */
export function describeDaysToEnd(days: number | null): string {
  if (days === null) return "";
  if (days > 0) return `อีก ${days.toLocaleString("th-TH")} วัน`;
  if (days === 0) return "ครบกำหนดวันนี้";
  return `เกินกำหนด ${Math.abs(days).toLocaleString("th-TH")} วัน`;
}

export function closeReasonLabel(reason: MembershipCloseReason | null): string {
  return reason ? MEMBERSHIP_CLOSE_REASON_LABELS[reason] : "";
}
