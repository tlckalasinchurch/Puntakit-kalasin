import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { EmptyState, ErrorState, InitialsAvatar, Modal, PageHeader, StatusChip } from "@/components/DesignSystem";
import { ListSkeleton } from "@/components/LoadingStates";
import { MembershipPanel } from "@/components/membership/MembershipPanel";
import { api, ApiError } from "@/lib/api";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { PAYMENT_STATUS_LABELS, type MembershipSummary, type MembershipType, type PaymentStatus } from "@shared/membership";
import { PAYMENT_TONE, STATE_TONE, describeDaysToEnd, formatThaiDay } from "@/lib/membershipFormat";
import { usePageTitle } from "@/hooks/usePageTitle";

interface Item {
  memberId: string;
  name: string;
  nickname: string | null;
  memberNo: string | null;
  avatarUrl: string | null;
  careGroup: { id: string; name: string } | null;
  bodyName: string | null;
  term: { id: string; type: MembershipType; startsOn: string; endsOn: string; feeBaht: number; paymentStatus: PaymentStatus; paidAmountBaht: number | null };
  summary: MembershipSummary;
}

interface Overview {
  today: string;
  counts: { total: number; attention: number; unpaid: number; trial_active: number; trial_review_due: number; ordinary_active: number; ordinary_renewal_due: number; ordinary_overdue: number };
  items: Item[];
  truncated?: boolean;
  canRecordPayment: boolean;
}

type Tab = "attention" | "trial" | "ordinary" | "unpaid" | "all";

const INPUT =
  "min-h-11 w-full rounded-[var(--radius-sm)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 text-base md:text-sm text-[var(--color-ink)] placeholder:text-[var(--color-body-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]";

/**
 * Membership review for the people who look after members: a care leader sees
 * their own group, a body leader the care groups under their body, office
 * roles everyone. The server decides who is in scope; this page only lists
 * what it was given.
 */
export default function Memberships() {
  usePageTitle("สถานะสมาชิกรายปี");
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [tab, setTab] = useState<Tab>("attention");
  const [search, setSearch] = useState("");
  const [careGroup, setCareGroup] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await api.get<Overview>("/api/memberships/overview?filter=all&limit=500"));
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError("โหลดข้อมูลไม่สำเร็จ", 0));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const careGroups = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of data?.items ?? []) if (i.careGroup) map.set(i.careGroup.id, i.careGroup.name);
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], "th"));
  }, [data]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.items ?? []).filter((i) => {
      if (tab === "attention" && !i.summary.needsAttention) return false;
      if (tab === "trial" && i.term.type !== "extraordinary") return false;
      if (tab === "ordinary" && i.term.type !== "ordinary") return false;
      if (tab === "unpaid" && !(i.term.type === "ordinary" && i.term.paymentStatus === "unpaid")) return false;
      if (careGroup && i.careGroup?.id !== careGroup) return false;
      if (q && !`${i.name} ${i.nickname ?? ""} ${i.memberNo ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, tab, search, careGroup]);

  const counts = data?.counts;
  const tabs: Array<{ id: Tab; label: string; n: number | undefined }> = [
    { id: "attention", label: "ต้องดำเนินการ", n: counts?.attention },
    { id: "trial", label: "วิสามัญ", n: counts ? counts.trial_active + counts.trial_review_due : undefined },
    { id: "ordinary", label: "สามัญ", n: counts ? counts.ordinary_active + counts.ordinary_renewal_due + counts.ordinary_overdue : undefined },
    { id: "unpaid", label: "ยังไม่ชำระ", n: counts?.unpaid },
    { id: "all", label: "ทั้งหมด", n: counts?.total },
  ];
  const opened = data?.items.find((i) => i.memberId === openId) ?? null;

  return (
    <AppLayout>
      <PageHeader
        title="สถานะสมาชิกรายปี"
        description="วิสามัญทดลองฟรี 1 ปี หัวหน้าแคร์ตรวจสอบเมื่อครบ · สามัญ 100 บาทต่อปี เห็นเฉพาะสมาชิกในขอบเขตของคุณ"
      />

      {error ? (
        <ErrorState title={error.status === 403 ? "คุณไม่มีสิทธิ์ดูหน้านี้" : "โหลดสถานะสมาชิกไม่สำเร็จ"} description={error.message} technical={error.serverMessage} onRetry={error.status === 403 ? undefined : () => void load()} />
      ) : !data ? (
        <ListSkeleton count={5} />
      ) : (
        <div className="space-y-5">
          <div role="tablist" aria-label="กรองตามสถานะ" className="flex flex-wrap gap-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-pill)] border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] ${
                  tab === t.id
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                    : "border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] hover:bg-[var(--color-canvas-soft)]"
                }`}
              >
                {t.label}
                <span className="tabular-nums opacity-90">{t.n ?? "–"}</span>
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_16rem]">
            <label className="relative block">
              <span className="sr-only">ค้นหาชื่อหรือหมายเลขสมาชิก</span>
              <Search size={ICON_SIZE.sm} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-body-muted)]" />
              <input className={`${INPUT} pl-10`} placeholder="ค้นหาชื่อ ชื่อเล่น หรือหมายเลขสมาชิก" value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
            {careGroups.length > 1 && (
              <label className="block">
                <span className="sr-only">กรองตามพันธกิจ</span>
                <select className={INPUT} value={careGroup} onChange={(e) => setCareGroup(e.target.value)}>
                  <option value="">ทุกพันธกิจ</option>
                  {careGroups.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {data.truncated && <p className="type-caption text-[var(--color-body-muted)]">แสดงบางส่วนของรายการ — ใช้ช่องค้นหาเพื่อกรอง</p>}

          {visible.length === 0 ? (
            <EmptyState
              title={tab === "attention" ? "ไม่มีรายการที่ต้องดำเนินการ" : "ไม่พบสมาชิกตามเงื่อนไข"}
              description={
                (counts?.total ?? 0) === 0
                  ? "ยังไม่มีสมาชิกที่ถูกบันทึกสถานะรายปี — เปิดข้อมูลสมาชิกแล้วเริ่มรอบวิสามัญหรือสามัญได้จากหน้ารายละเอียด"
                  : "ลองเปลี่ยนแท็บหรือล้างช่องค้นหา"
              }
            />
          ) : (
            <ul className="space-y-2">
              {visible.map((i) => (
                <li key={i.memberId}>
                  <button
                    type="button"
                    onClick={() => setOpenId(i.memberId)}
                    className="flex w-full min-h-16 items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3 text-left transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
                    aria-label={`ดูสถานะสมาชิกของ ${i.name}`}
                  >
                    {i.avatarUrl ? <img src={i.avatarUrl} alt="" className="size-11 shrink-0 rounded-full object-cover" /> : <InitialsAvatar name={i.name} size={44} />}
                    <span className="min-w-0 flex-1">
                      <span className="type-body-strong block truncate text-[var(--color-ink)]">
                        {i.name}
                        {i.nickname ? ` (${i.nickname})` : ""}
                      </span>
                      <span className="type-fine block truncate text-[var(--color-body-muted)]">
                        {[i.memberNo ? `No. ${i.memberNo}` : null, i.careGroup?.name, i.bodyName].filter(Boolean).join(" · ") || "ยังไม่มีพันธกิจ"}
                      </span>
                      <span className="type-fine mt-1 block tabular-nums text-[var(--color-text-secondary)]">
                        ครบ {formatThaiDay(i.term.endsOn)} · {describeDaysToEnd(i.summary.daysToEnd)}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <StatusChip tone={STATE_TONE[i.summary.state]}>{i.summary.label}</StatusChip>
                      {i.term.paymentStatus !== "not_required" && <StatusChip tone={PAYMENT_TONE[i.term.paymentStatus]}>{PAYMENT_STATUS_LABELS[i.term.paymentStatus]}</StatusChip>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Modal open={opened !== null} onClose={() => setOpenId(null)} title="สถานะสมาชิกรายปี" description={opened?.name} size="wide" discardGuard={false}>
        {opened && <MembershipPanel memberId={opened.memberId} onChanged={() => void load()} />}
      </Modal>
    </AppLayout>
  );
}
