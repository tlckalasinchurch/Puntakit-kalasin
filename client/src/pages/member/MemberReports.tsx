import { useEffect, useState } from "react";
import { Link } from "wouter";
import { CalendarDays, ChevronRight, ClipboardList, Plus } from "lucide-react";
import { MemberAppLayout } from "@/components/layout/MemberAppLayout";
import { LambMascot } from "@/components/lamb/LambMascot";
import { ListSkeleton } from "@/components/LoadingStates";
import { EmptyState, ErrorState } from "@/components/DesignSystem";
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
      <div className="lamb-theme space-y-4 bg-[#F8F7F1]">
        <header>
          <h1 className="text-2xl font-extrabold text-[var(--color-ink)]">รายงานพันธกิจ</h1>
          <p className="mt-1 text-sm text-[var(--color-body-muted)]">
            บันทึกและติดตามรายงานกิจกรรมพันธกิจของกลุ่ม
          </p>
        </header>

        <Link
          href="/app/reports/new"
          className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#0C7C82] px-6 py-4 font-semibold text-white shadow-sm transition-colors hover:bg-[#0a6b70] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0C7C82] focus-visible:ring-offset-2"
        >
          <Plus size={20} aria-hidden="true" />
          เริ่มบันทึกรายงานใหม่
        </Link>

        {submissions.length > 0 ? (
          <ul className="space-y-3">
            {submissions.map(sub => (
              <li key={sub.id}>
                <Link
                  href={`/app/reports/${sub.id}`}
                  className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0C7C82]"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#E4F7F2] text-[#0C7C82]">
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
            description="เริ่มบันทึกรายงานพันธกิจแรกของกลุ่มได้เลย"
            action={{
              label: "เริ่มบันทึกรายงาน",
              href: "/app/reports/new",
            }}
          />
        )}

        <div className="flex justify-center pt-2">
          <LambMascot pose="clipboard" className="w-32 opacity-80" />
        </div>
      </div>
    </MemberAppLayout>
  );
}
