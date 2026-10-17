import { useEffect, useState } from "react";
import { Link } from "wouter";
import { CalendarDays, ChevronRight, ClipboardList, Plus } from "lucide-react";
import { MemberAppLayout } from "@/components/layout/MemberAppLayout";
import { LambMascot } from "@/components/lamb/LambMascot";
import { ListSkeleton } from "@/components/LoadingStates";
import { EmptyState, ErrorState, StatusChip } from "@/components/DesignSystem";
import { api, ApiError } from "@/lib/api";
import { usePageTitle } from "@/hooks/usePageTitle";

interface Submission {
  id: string;
  status: string;
  rawText: string | null;
  submittedByLabel: string | null;
  createdAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "ร่าง",
  submitted: "ส่งแล้ว",
  published: "เผยแพร่แล้ว",
  rejected: "ตีกลับ",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-[var(--color-canvas-soft)] text-[var(--color-body-muted)]",
  submitted: "bg-[var(--color-info-soft)] text-[var(--color-info-ink)]",
  published: "bg-[var(--color-success-soft)] text-[var(--color-success-ink)]",
  rejected: "bg-[var(--color-error-soft)] text-[var(--color-error-ink)]",
};

/**
 * Member reports — list of mission reports with a CTA to create a new one.
 */
export default function MemberReports() {
  usePageTitle("รายงาน");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubmissions = async () => {
    setError(null);
    try {
      const res = await api.get<{ data: Submission[] }>("/api/submissions?limit=20");
      setSubmissions(res.data ?? []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "โหลดรายงานไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, []);

  if (loading) {
    return (
      <MemberAppLayout>
        <ListSkeleton count={3} />
      </MemberAppLayout>
    );
  }

  if (error) {
    return (
      <MemberAppLayout>
        <ErrorState
          title="โหลดรายงานไม่สำเร็จ"
          description="ลองอีกครั้งในภายหลัง"
          technical={error}
          retryLabel="ลองอีกครั้ง"
          onRetry={() => {
            setLoading(true);
            void fetchSubmissions();
          }}
        />
      </MemberAppLayout>
    );
  }

  return (
    <MemberAppLayout>
      <div className="lamb-theme space-y-4 bg-[var(--lamb-canvas)]">
        <header>
          <h1 className="text-2xl font-extrabold text-[var(--color-ink)]">รายงานพันธกิจ</h1>
          <p className="mt-1 text-sm text-[var(--color-body-muted)]">
            บันทึกและติดตามรายงานกิจกรรมพันธกิจของกลุ่ม
          </p>
        </header>

        {/* Member report form not built yet: shown as unavailable instead of a link to a missing page. */}
        <div className="flex items-center justify-center gap-3 rounded-2xl bg-[var(--color-canvas-soft)] px-6 py-4">
          <button
            type="button"
            disabled
            title="ฟอร์มบันทึกรายงานกำลังจัดเตรียม ยังไม่เปิดให้ใช้งาน"
            className="flex min-h-11 cursor-not-allowed items-center justify-center gap-2 font-semibold text-[var(--color-body-muted)]"
          >
            <Plus size={20} aria-hidden="true" />
            เริ่มบันทึกรายงานใหม่
          </button>
          <StatusChip tone="neutral">เร็วๆ นี้</StatusChip>
        </div>

        {submissions.length > 0 ? (
          <ul className="space-y-3">
            {submissions.map(sub => (
              <li key={sub.id}>
                <Link
                  href={`/app/reports/${sub.id}`}
                  className="flex items-center gap-4 rounded-2xl bg-[var(--color-surface)] p-4 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent-soft)] text-[var(--lamb-primary)]">
                    <ClipboardList size={22} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[var(--color-ink)]">
                      {sub.submittedByLabel || "รายงานพันธกิจ"}
                    </span>
                    <span className="mt-0.5 flex items-center gap-2 text-xs text-[var(--color-body-muted)]">
                      <CalendarDays size={12} aria-hidden="true" />
                      {new Date(sub.createdAt).toLocaleDateString("th-TH", {
                        dateStyle: "medium",
                      })}
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[sub.status] ?? STATUS_COLORS.draft}`}
                      >
                        {STATUS_LABELS[sub.status] ?? sub.status}
                      </span>
                    </span>
                  </span>
                  <ChevronRight
                    size={18}
                    aria-hidden="true"
                    className="shrink-0 text-[var(--color-text-quaternary)]"
                  />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={ClipboardList}
            title="ยังไม่มีรายงาน"
            description="ยังไม่มีรายงานที่บันทึกไว้ ฟอร์มบันทึกรายงานสำหรับสมาชิกกำลังจัดเตรียม"
          />
        )}

        <div className="flex justify-center pt-2">
          <LambMascot pose="clipboard" className="w-32 opacity-80" />
        </div>
      </div>
    </MemberAppLayout>
  );
}
