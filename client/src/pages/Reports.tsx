import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Download, FileBarChart, Lock, RefreshCw, Users } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { CardGridSkeleton } from "@/components/LoadingStates";
import {
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
} from "@/components/DesignSystem";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { PRIVILEGED_ROLES as REPORT_ROLES } from "@shared/roles";

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

const SECONDARY_BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 text-sm font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50";

function buildQuery(startDate: string, endDate: string): string {
  const params = new URLSearchParams();
  if (startDate) params.set("startDate", startDate);
  if (endDate) params.set("endDate", endDate);
  return params.toString();
}

export default function Reports() {
  const { user } = useAuth();
  const canView = Boolean(user?.role && REPORT_ROLES.includes(user.role));

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [summary, setSummary] = useState<ReportsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
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
  }, [startDate, endDate]);

  useEffect(() => {
    if (canView) loadSummary();
  }, [canView, loadSummary]);

  const handleExport = (reportKey: string) => {
    const query = buildQuery(startDate, endDate);
    window.open(`/api/reports/export/${reportKey}.csv${query ? `?${query}` : ""}`, "_blank");
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
          <Field label="วันที่เริ่มต้น" hint="เว้นว่างไว้เพื่อดูข้อมูลทั้งหมด">
            {(props) => (
              <input
                id={props.id}
                aria-describedby={props["aria-describedby"]}
                aria-invalid={props["aria-invalid"]}
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="min-h-11 w-full rounded-[var(--radius-sm)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 text-sm text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
              />
            )}
          </Field>
          <Field label="วันที่สิ้นสุด" hint="เว้นว่างไว้เพื่อดูข้อมูลทั้งหมด">
            {(props) => (
              <input
                id={props.id}
                aria-describedby={props["aria-describedby"]}
                aria-invalid={props["aria-invalid"]}
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="min-h-11 w-full rounded-[var(--radius-sm)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 text-sm text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
              />
            )}
          </Field>
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
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card-surface p-4">
            <h2 className="type-caption-strong flex items-center gap-2 text-[var(--color-ink)]">
              <Users size={ICON_SIZE.sm} aria-hidden="true" /> สมาชิก
            </h2>
            <p className="type-caption mt-2 text-[var(--color-body-muted)]">
              ทั้งหมด {summary.members.total} คน
            </p>
            <p className="type-caption text-[var(--color-body-muted)]">
              เข้าร่วมใหม่ในช่วงนี้ {summary.members.newInRange} คน
            </p>
          </div>
          <div className="card-surface p-4">
            <h2 className="type-caption-strong flex items-center gap-2 text-[var(--color-ink)]">
              <FileBarChart size={ICON_SIZE.sm} aria-hidden="true" /> พันธกิจ
            </h2>
            <p className="type-caption mt-2 text-[var(--color-body-muted)]">
              ทั้งหมด {summary.groups.total} กลุ่ม
            </p>
          </div>
          <div className="card-surface p-4">
            <h2 className="type-caption-strong flex items-center gap-2 text-[var(--color-ink)]">
              <CalendarDays size={ICON_SIZE.sm} aria-hidden="true" /> การเข้าร่วม
            </h2>
            <p className="type-caption mt-2 text-[var(--color-body-muted)]">
              บันทึกทั้งหมด {summary.attendance.total} รายการ
            </p>
            <p className="type-caption text-[var(--color-body-muted)]">
              อัตราการมา {summary.attendance.attendanceRate}%
            </p>
          </div>
          <div className="card-surface p-4">
            <h2 className="type-caption-strong flex items-center gap-2 text-[var(--color-ink)]">
              <CalendarDays size={ICON_SIZE.sm} aria-hidden="true" /> กิจกรรม
            </h2>
            <p className="type-caption mt-2 text-[var(--color-body-muted)]">
              ทั้งหมด {summary.events.total} รายการ
            </p>
          </div>
        </div>
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
