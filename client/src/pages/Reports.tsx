import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Download, FileBarChart, Lock, RefreshCw, Users } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { DateField } from "@/components/DateField";
import { CardGridSkeleton } from "@/components/LoadingStates";
import {
  EmptyState,
  ErrorState,
  PageHeader,
} from "@/components/DesignSystem";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { REPORT_ROLES } from "@shared/roles";
import { usePageTitle } from "@/hooks/usePageTitle";
import { downloadFile } from "@/lib/download";

interface StatusCount {
  status: string;
  count: number;
}

interface ReportsSummary {
  range: { startDate: string | null; endDate: string | null };
  members: { total: number; newInRange: number; byStatus: StatusCount[] };
  groups: { total: number; byStatus: StatusCount[] };
  attendance: { total: number; byStatus: StatusCount[]; attendanceRate: number };
  events: { total: number; byStatus: StatusCount[] };
}

const EXPORTS: { key: string; label: string }[] = [
  { key: "members", label: "สมาชิก" },
  { key: "attendance", label: "การเข้าร่วม" },
  { key: "groups", label: "พันธกิจ" },
  { key: "events", label: "กิจกรรม" },
];

const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  present: "มา",
  online: "ออนไลน์",
  leave: "ลา",
  absent: "ขาด",
};

function StatusBreakdownCard({
  title,
  items,
  total,
  labelMap,
}: {
  title: string;
  items: StatusCount[];
  total: number;
  labelMap?: Record<string, string>;
}) {
  return (
    <section className="card-surface p-4 sm:p-5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="type-body-strong text-[var(--color-ink)]">{title}</h2>
        <span className="type-caption tabular-nums text-[var(--color-body-muted)]">
          รวม {total.toLocaleString("th-TH")}
        </span>
      </div>
      {items.length === 0 || total === 0 ? (
        <p className="type-caption rounded-[var(--radius-md)] border border-dashed border-[var(--color-hairline)] px-3 py-4 text-center text-[var(--color-body-muted)]">
          ยังไม่มีข้อมูลในช่วงเวลานี้
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const pct = total > 0 ? Math.round((item.count / total) * 1000) / 10 : 0;
            const label = labelMap?.[item.status] ?? item.status;
            return (
              <li key={item.status} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="text-[var(--color-ink)]">{label}</span>
                  <span className="tabular-nums text-[var(--color-body-muted)]">
                    <strong className="font-semibold text-[var(--color-ink)]">
                      {item.count.toLocaleString("th-TH")}
                    </strong>{" "}
                    ({pct.toLocaleString("th-TH", { maximumFractionDigits: 1 })}%)
                  </span>
                </div>
                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-canvas-soft)]"
                  aria-hidden="true"
                >
                  <div
                    className="h-full rounded-full bg-[var(--color-primary)] transition-all"
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const SECONDARY_BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 text-sm font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50";

function buildQuery(startDate: string, endDate: string): string {
  const params = new URLSearchParams();
  if (startDate) params.set("startDate", startDate);
  if (endDate) params.set("endDate", endDate);
  return params.toString();
}

export default function Reports() {
  usePageTitle("รายงาน");
  const { user } = useAuth();
  const canView = Boolean(user?.role && REPORT_ROLES.includes(user.role));

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [summary, setSummary] = useState<ReportsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const rangeError =
    startDate && endDate && startDate > endDate ? "วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น" : undefined;

  const loadSummary = useCallback(async () => {
    if (rangeError) return;
    setIsLoading(true);
    setError(null);
    try {
      const query = buildQuery(startDate, endDate);
      const data = await api.get<ReportsSummary>(`/api/reports/summary${query ? `?${query}` : ""}`);
      setSummary(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "โหลดรายงานไม่สำเร็จ");
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, rangeError]);

  useEffect(() => {
    if (canView) loadSummary();
  }, [canView, loadSummary]);

  const handleExport = (reportKey: string) => {
    if (rangeError) return;
    const query = buildQuery(startDate, endDate);
    downloadFile(`/api/reports/export/${reportKey}.csv${query ? `?${query}` : ""}`);
  };

  if (!canView) {
    return (
      <AppLayout>
        <PageHeader title="รายงาน" description="ภาพรวมสมาชิก การเข้าร่วม พันธกิจ และกิจกรรม" />
        <EmptyState
          icon={Lock}
          title="ไม่มีสิทธิ์เข้าถึง"
          description="หน้านี้จำกัดเฉพาะผู้ดูแลระบบ เจ้าหน้าที่ และผู้นำฝ่ายงาน"
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="รายงาน"
        description="ภาพรวมสมาชิก การเข้าร่วม พันธกิจ และกิจกรรม พร้อมส่งออกเป็น CSV"
        secondaryActions={[
          {
            label: "รีเฟรช",
            icon: RefreshCw,
            onClick: loadSummary,
            disabled: isLoading,
          },
        ]}
      />

      <section className="card-surface mb-4 p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DateField
            label="วันที่เริ่มต้น"
            hint="เว้นว่างไว้เพื่อดูข้อมูลทั้งหมด"
            value={startDate}
            onChange={setStartDate}
            clearable
          />
          <DateField
            label="วันที่สิ้นสุด"
            hint="เว้นว่างไว้เพื่อดูข้อมูลทั้งหมด"
            value={endDate}
            onChange={setEndDate}
            error={rangeError}
            clearable
          />
        </div>
      </section>

      {isLoading ? (
        <section
          className="card-surface mb-4 p-4 sm:p-5"
          role="status"
          aria-label="กำลังโหลดรายงาน"
        >
          <CardGridSkeleton count={4} />
        </section>
      ) : error ? (
        <div className="mb-4">
          <ErrorState technical={error} onRetry={loadSummary} />
        </div>
      ) : summary ? (
        <>
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card-surface p-4">
              <h2 className="type-caption-strong flex items-center gap-2 text-[var(--color-body-muted)]">
                <Users size={ICON_SIZE.sm} aria-hidden="true" /> สมาชิก
              </h2>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--color-ink)]">
                {summary.members.total.toLocaleString("th-TH")}{" "}
                <span className="type-caption font-normal text-[var(--color-body-muted)]">คน</span>
              </p>
              {(startDate || endDate) && (
                <p className="type-caption mt-1 tabular-nums text-[var(--color-body-muted)]">
                  เข้าร่วมใหม่ในช่วงนี้ {summary.members.newInRange.toLocaleString("th-TH")} คน
                </p>
              )}
            </div>
            <div className="card-surface p-4">
              <h2 className="type-caption-strong flex items-center gap-2 text-[var(--color-body-muted)]">
                <FileBarChart size={ICON_SIZE.sm} aria-hidden="true" /> พันธกิจ
              </h2>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--color-ink)]">
                {summary.groups.total.toLocaleString("th-TH")}{" "}
                <span className="type-caption font-normal text-[var(--color-body-muted)]">กลุ่ม</span>
              </p>
            </div>
            <div className="card-surface p-4">
              <h2 className="type-caption-strong flex items-center gap-2 text-[var(--color-body-muted)]">
                <CalendarDays size={ICON_SIZE.sm} aria-hidden="true" /> การเข้าร่วม
              </h2>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--color-ink)]">
                {summary.attendance.attendanceRate.toLocaleString("th-TH", { maximumFractionDigits: 1 })}%
              </p>
              <p className="type-caption mt-1 tabular-nums text-[var(--color-body-muted)]">
                บันทึกทั้งหมด {summary.attendance.total.toLocaleString("th-TH")} รายการ
              </p>
            </div>
            <div className="card-surface p-4">
              <h2 className="type-caption-strong flex items-center gap-2 text-[var(--color-body-muted)]">
                <CalendarDays size={ICON_SIZE.sm} aria-hidden="true" /> กิจกรรม
              </h2>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--color-ink)]">
                {summary.events.total.toLocaleString("th-TH")}{" "}
                <span className="type-caption font-normal text-[var(--color-body-muted)]">รายการ</span>
              </p>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <StatusBreakdownCard
              title="สัดส่วนสถานะการติดตามสมาชิก"
              items={summary.members.byStatus}
              total={summary.members.total}
            />
            <StatusBreakdownCard
              title="สัดส่วนการเข้าร่วม"
              items={summary.attendance.byStatus}
              total={summary.attendance.total}
              labelMap={ATTENDANCE_STATUS_LABELS}
            />
          </div>
        </>
      ) : null}

      <section className="card-surface p-4 sm:p-5">
        <h2 className="type-body-strong text-[var(--color-ink)]">ส่งออกข้อมูล CSV</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {EXPORTS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => handleExport(item.key)}
            >
              <Download size={ICON_SIZE.sm} aria-hidden="true" /> {item.label}
            </button>
          ))}
        </div>
      </section>
    </AppLayout>
  );
}
