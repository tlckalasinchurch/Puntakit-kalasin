import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, CircleDollarSign, RefreshCw, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { ErrorState, StatusChip } from "@/components/DesignSystem";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import { ICON_SIZE } from "@/lib/icon-sizes";
import {
  PAYMENT_STATUS_LABELS,
  MEMBERSHIP_TYPE_LABELS,
  ORDINARY_FEE_BAHT,
  type MembershipSummary,
  type MembershipCloseReason,
  type MembershipType,
  type PaymentStatus,
} from "@shared/membership";
import { PAYMENT_TONE, STATE_TONE, closeReasonLabel, describeDaysToEnd, formatThaiDay } from "@/lib/membershipFormat";

export interface TermDto {
  id: string;
  type: MembershipType;
  status: "open" | "closed";
  startsOn: string;
  endsOn: string;
  closedReason: MembershipCloseReason | null;
  closedAt: string | null;
  decisionNote: string | null;
  feeBaht: number;
  paymentStatus: PaymentStatus;
  paidAmountBaht: number | null;
  paidAt: string | null;
  paymentNote: string | null;
}

interface MemberMembership {
  member: { id: string; name: string; memberNo: string | null };
  today: string;
  summary: MembershipSummary;
  terms: TermDto[];
  permissions: { canDecide: boolean; canRecordPayment: boolean };
}

type Pending =
  | { kind: "start"; type: MembershipType }
  | { kind: "decision"; decision: "convert_to_ordinary" | "renew" | "not_continued"; termId: string }
  | { kind: "payment"; termId: string };

const BTN =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-pill)] px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50";
const BTN_PRIMARY = `${BTN} bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-focus)]`;
const BTN_OUTLINE = `${BTN} border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] hover:bg-[var(--color-canvas-soft)]`;
const INPUT =
  "min-h-11 w-full rounded-[var(--radius-sm)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 text-base md:text-sm text-[var(--color-ink)] placeholder:text-[var(--color-body-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]";

const DECISION_COPY: Record<string, { title: string; confirm: string; help: string }> = {
  convert_to_ordinary: {
    title: "เปลี่ยนเป็นสมาชิกสามัญ",
    confirm: "ยืนยันเปลี่ยนเป็นสามัญ",
    help: `รอบวิสามัญจะถูกปิดเป็นประวัติ และเปิดรอบสามัญใหม่ ค่าสมาชิก ${ORDINARY_FEE_BAHT} บาทต่อปี (ยังไม่ชำระจนกว่าเจ้าหน้าที่จะบันทึก)`,
  },
  renew: {
    title: "ต่ออายุอีก 1 ปี",
    confirm: "ยืนยันต่ออายุ",
    help: `เปิดรอบใหม่ต่อจากรอบเดิม ค่าสมาชิก ${ORDINARY_FEE_BAHT} บาท (ยังไม่ชำระจนกว่าเจ้าหน้าที่จะบันทึก) รอบเดิมเก็บไว้เป็นประวัติ`,
  },
  not_continued: {
    title: "ไม่ต่อสถานะสมาชิก",
    confirm: "ยืนยันไม่ต่อ",
    help: "รอบนี้จะถูกปิดและสมาชิกจะไม่มีสถานะปัจจุบัน ประวัติทั้งหมดยังอยู่ครบ",
  },
};

/**
 * One member's membership: where they are now, what the care leader can do
 * about it, and the full cycle history. Rules live in `shared/membership.ts`;
 * who may do what is decided by the API — `permissions` only mirrors it.
 */
export function MembershipPanel({ memberId, onChanged }: { memberId: string; onChanged?: () => void }) {
  const [data, setData] = useState<MemberMembership | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState(String(ORDINARY_FEE_BAHT));
  const [paidOn, setPaidOn] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await api.get<MemberMembership>(`/api/memberships/members/${memberId}`));
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError("โหลดสถานะสมาชิกไม่สำเร็จ", 0));
    }
  }, [memberId]);

  useEffect(() => {
    setData(null);
    setPending(null);
    void load();
  }, [load]);

  const open = (next: Pending) => {
    setPending(next);
    setNote("");
    setFormError(null);
    setAmount(String(ORDINARY_FEE_BAHT));
    setPaidOn(data?.today ?? "");
  };

  const submit = async () => {
    if (!pending || saving) return;
    setSaving(true);
    setFormError(null);
    try {
      if (pending.kind === "start") {
        await api.post(`/api/memberships/members/${memberId}/terms`, { type: pending.type });
        toast.success(pending.type === "extraordinary" ? "เริ่มสมาชิกวิสามัญแล้ว" : "เริ่มสมาชิกสามัญแล้ว");
      } else if (pending.kind === "decision") {
        await api.post(`/api/memberships/terms/${pending.termId}/decision`, { decision: pending.decision, note: note.trim() || undefined });
        toast.success("บันทึกการตัดสินใจแล้ว");
      } else {
        const value = Number(amount);
        if (!Number.isInteger(value) || value < 1) {
          setFormError("กรอกจำนวนเงินเป็นจำนวนเต็มบาท");
          setSaving(false);
          return;
        }
        await api.patch(`/api/memberships/terms/${pending.termId}/payment`, { amountBaht: value, paidOn: paidOn || undefined, note: note.trim() || undefined });
        toast.success("บันทึกการชำระเงินแล้ว");
      }
      setPending(null);
      await load();
      onChanged?.();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ ลองอีกครั้ง");
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return <ErrorState inset title={error.status === 403 ? "คุณไม่มีสิทธิ์ดูสถานะสมาชิกคนนี้" : "โหลดสถานะสมาชิกไม่สำเร็จ"} description={error.message} technical={error.serverMessage} onRetry={error.status === 403 ? undefined : () => void load()} />;
  }
  if (!data) {
    return (
      <div role="status" aria-label="กำลังโหลดสถานะสมาชิก" className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  const { summary, terms, permissions } = data;
  const current = terms.find((t) => t.status === "open") ?? null;
  const history = terms.filter((t) => t.status === "closed");

  return (
    <div className="space-y-4">
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip tone={STATE_TONE[summary.state]}>{summary.label}</StatusChip>
          {current && current.paymentStatus !== "not_required" && (
            <StatusChip tone={PAYMENT_TONE[current.paymentStatus]}>
              {current.paymentStatus === "paid" ? `ชำระแล้ว ${current.paidAmountBaht ?? current.feeBaht} บาท` : `${PAYMENT_STATUS_LABELS.unpaid} ${current.feeBaht} บาท`}
            </StatusChip>
          )}
        </div>
        {current ? (
          <dl className="type-caption mt-3 grid gap-x-6 gap-y-1 text-[var(--color-text-secondary)] sm:grid-cols-2">
            <div className="flex gap-2">
              <dt className="shrink-0">ประเภท:</dt>
              <dd className="font-semibold text-[var(--color-ink)]">{MEMBERSHIP_TYPE_LABELS[current.type]}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0">เริ่ม:</dt>
              <dd className="font-semibold tabular-nums text-[var(--color-ink)]">{formatThaiDay(current.startsOn)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0">{current.type === "extraordinary" ? "ครบช่วงทดลอง:" : "ครบรอบ:"}</dt>
              <dd className="font-semibold tabular-nums text-[var(--color-ink)]">
                {formatThaiDay(current.endsOn)} · {describeDaysToEnd(summary.daysToEnd)}
              </dd>
            </div>
            {current.paymentStatus === "paid" && current.paidAt && (
              <div className="flex gap-2">
                <dt className="shrink-0">ชำระเมื่อ:</dt>
                <dd className="font-semibold tabular-nums text-[var(--color-ink)]">{formatThaiDay(current.paidAt)}</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="type-caption mt-2 text-[var(--color-body-muted)]">
            {permissions.canDecide ? "เริ่มรอบสมาชิกได้ด้านล่าง วิสามัญทดลองฟรี 1 ปี หรือสามัญ 100 บาทต่อปี" : "ยังไม่มีการบันทึกสถานะสมาชิกของคนนี้"}
          </p>
        )}
        {summary.state === "trial_review_due" && (
          <p className="type-caption mt-3 rounded-[var(--radius-sm)] bg-[var(--color-warning-soft)] p-3 text-[var(--color-ink)]">
            ครบช่วงทดลองแล้วหรือใกล้ครบ — ให้หัวหน้าแคร์ตรวจสอบและตัดสินใจ ระบบจะไม่เปลี่ยนเป็นสามัญเอง
          </p>
        )}

        {permissions.canDecide && !pending && (
          <div className="mt-4 flex flex-wrap gap-2">
            {!current && (
              <>
                <button type="button" className={BTN_PRIMARY} onClick={() => open({ kind: "start", type: "extraordinary" })}>
                  <UserCheck size={ICON_SIZE.sm} aria-hidden="true" />
                  เริ่มวิสามัญ (ทดลองฟรี 1 ปี)
                </button>
                <button type="button" className={BTN_OUTLINE} onClick={() => open({ kind: "start", type: "ordinary" })}>
                  <BadgeCheck size={ICON_SIZE.sm} aria-hidden="true" />
                  เริ่มสามัญ ({ORDINARY_FEE_BAHT} บาท/ปี)
                </button>
              </>
            )}
            {current?.type === "extraordinary" && (
              <button type="button" className={BTN_PRIMARY} onClick={() => open({ kind: "decision", decision: "convert_to_ordinary", termId: current.id })}>
                <BadgeCheck size={ICON_SIZE.sm} aria-hidden="true" />
                เปลี่ยนเป็นสามัญ
              </button>
            )}
            {current?.type === "ordinary" && (
              <button type="button" className={BTN_PRIMARY} onClick={() => open({ kind: "decision", decision: "renew", termId: current.id })}>
                <RefreshCw size={ICON_SIZE.sm} aria-hidden="true" />
                ต่ออายุอีก 1 ปี
              </button>
            )}
            {current && (
              <button type="button" className={BTN_OUTLINE} onClick={() => open({ kind: "decision", decision: "not_continued", termId: current.id })}>
                <UserX size={ICON_SIZE.sm} aria-hidden="true" />
                ไม่ต่อสถานะ
              </button>
            )}
          </div>
        )}
        {permissions.canRecordPayment && current?.type === "ordinary" && current.paymentStatus === "unpaid" && !pending && (
          <div className="mt-2">
            <button type="button" className={BTN_OUTLINE} onClick={() => open({ kind: "payment", termId: current.id })}>
              <CircleDollarSign size={ICON_SIZE.sm} aria-hidden="true" />
              บันทึกการชำระเงิน
            </button>
          </div>
        )}

        {pending && (
          <form
            className="mt-4 space-y-3 rounded-[var(--radius-md)] bg-[var(--color-canvas-soft)] p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <h4 className="type-caption-strong text-[var(--color-ink)]">
              {pending.kind === "start"
                ? pending.type === "extraordinary"
                  ? "เริ่มสมาชิกวิสามัญ"
                  : "เริ่มสมาชิกสามัญ"
                : pending.kind === "decision"
                  ? DECISION_COPY[pending.decision].title
                  : "บันทึกการชำระเงินค่าสมาชิก"}
            </h4>
            <p className="type-caption text-[var(--color-text-secondary)]">
              {pending.kind === "start"
                ? pending.type === "extraordinary"
                  ? "ทดลองเป็นสมาชิกฟรี 1 ปี นับจากวันนี้ ครบแล้วหัวหน้าแคร์ต้องตรวจสอบเอง"
                  : `ค่าสมาชิก ${ORDINARY_FEE_BAHT} บาทต่อปี นับจากวันนี้ (ยังไม่ชำระจนกว่าเจ้าหน้าที่จะบันทึก)`
                : pending.kind === "decision"
                  ? DECISION_COPY[pending.decision].help
                  : "บันทึกเฉพาะเมื่อได้รับเงินแล้วจริง ระบบไม่ได้รับเงินและไม่เก็บข้อมูลบัตรธนาคาร"}
            </p>
            {pending.kind === "payment" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="type-caption-strong text-[var(--color-ink)]">จำนวนเงิน (บาท)</span>
                  <input className={`${INPUT} mt-1`} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </label>
                <label className="block">
                  <span className="type-caption-strong text-[var(--color-ink)]">วันที่รับเงิน</span>
                  <input className={`${INPUT} mt-1`} type="date" value={paidOn} max={data.today} onChange={(e) => setPaidOn(e.target.value)} />
                </label>
              </div>
            )}
            {pending.kind !== "start" && (
              <label className="block">
                <span className="type-caption-strong text-[var(--color-ink)]">หมายเหตุ (ไม่บังคับ)</span>
                <input className={`${INPUT} mt-1`} maxLength={pending.kind === "payment" ? 300 : 500} value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
            )}
            {formError && (
              <p role="alert" className="type-caption text-[var(--color-error)]">
                {formError}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={saving} className={BTN_PRIMARY}>
                {saving ? "กำลังบันทึก…" : pending.kind === "decision" ? DECISION_COPY[pending.decision].confirm : "ยืนยัน"}
              </button>
              <button type="button" disabled={saving} className={BTN_OUTLINE} onClick={() => setPending(null)}>
                ยกเลิก
              </button>
            </div>
          </form>
        )}
      </div>

      {history.length > 0 && (
        <section aria-label="ประวัติรอบสมาชิก">
          <h4 className="type-caption-strong mb-2 text-[var(--color-ink)]">ประวัติรอบสมาชิก</h4>
          <ol className="space-y-2">
            {history.map((t) => (
              <li key={t.id} className="rounded-[var(--radius-md)] border border-[var(--color-hairline)] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="type-caption-strong text-[var(--color-ink)]">{MEMBERSHIP_TYPE_LABELS[t.type]}</span>
                  <StatusChip tone="neutral">{closeReasonLabel(t.closedReason)}</StatusChip>
                  {t.paymentStatus !== "not_required" && (
                    <StatusChip tone={PAYMENT_TONE[t.paymentStatus]}>
                      {t.paymentStatus === "paid" ? `ชำระแล้ว ${t.paidAmountBaht ?? t.feeBaht} บาท` : "ไม่ได้ชำระ"}
                    </StatusChip>
                  )}
                </div>
                <p className="type-fine mt-1 tabular-nums text-[var(--color-body-muted)]">
                  {formatThaiDay(t.startsOn)} – {formatThaiDay(t.endsOn)}
                  {t.decisionNote ? ` · ${t.decisionNote}` : ""}
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
