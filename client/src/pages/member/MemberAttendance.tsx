import { useEffect, useState, useMemo } from "react";
import {
  CalendarCheck2,
  QrCode,
  Globe,
  Clock,
  RefreshCw,
  CheckCircle2,
  CalendarDays,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { MemberAppLayout } from "@/components/layout/MemberAppLayout";
import { EmptyState, ErrorState, StatusChip } from "@/components/DesignSystem";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { api, ApiError } from "@/lib/api";
import { ListSkeleton } from "@/components/LoadingStates";

interface AttendanceRecord {
  id: string;
  date: string;
  serviceType: string;
  status: "present" | "absent" | "leave" | "online";
  checkInMethod: "manual" | "qr_self" | "officer_scan" | "bulk_import";
  groupName: string | null;
}

type FilterType = "all" | "sunday" | "care";

const FILTER_LABELS: Record<FilterType, string> = {
  all: "ทั้งหมด",
  sunday: "นมัสการวันอาทิตย์",
  care: "พันธกิจ",
};

export default function MemberAttendance() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [error, setError] = useState<string | null>(null);

  const fetchAttendance = async (notify = false) => {
    setError(null);
    try {
      const res = await api.get<AttendanceRecord[]>("/api/me/attendance");
      setRecords(res);
      if (notify) {
        toast.success("อัปเดตประวัติการเข้าร่วมเรียบร้อยแล้ว");
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "โหลดประวัติการเข้าร่วมไม่สำเร็จ"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    void fetchAttendance(true);
  };

  const attendedCount = useMemo(() => {
    return records.filter(r => r.status === "present" || r.status === "online")
      .length;
  }, [records]);

  const filteredRecords = useMemo(() => {
    if (filterType === "all") return records;
    if (filterType === "sunday")
      return records.filter(r => r.serviceType === "sunday_service");
    if (filterType === "care")
      return records.filter(
        r => r.serviceType === "cell_group" || r.groupName !== null
      );
    return records.filter(
      r => r.serviceType !== "sunday_service" && r.serviceType !== "cell_group"
    );
  }, [records, filterType]);

  const formatThaiDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("th-TH", {
      weekday: "long",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getServiceTypeLabel = (type: string) => {
    switch (type) {
      case "sunday_service":
        return "นมัสการวันอาทิตย์";
      case "prayer_meeting":
        return "อธิษฐานวันพุธ";
      case "cell_group":
        return "พันธกิจ";
      case "special_event":
        return "กิจกรรมพิเศษ";
      default:
        return type || "กิจกรรมคริสตจักร";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "present":
        return (
          <StatusChip tone="success" className="gap-1.5">
            <CheckCircle2 size={ICON_SIZE.xs} aria-hidden="true" />
            เข้าร่วมแล้ว
          </StatusChip>
        );
      case "online":
        return (
          <StatusChip tone="info" className="gap-1.5">
            <Globe size={ICON_SIZE.xs} aria-hidden="true" />
            ออนไลน์
          </StatusChip>
        );
      case "leave":
        return (
          <StatusChip tone="warning" className="gap-1.5">
            <Clock size={ICON_SIZE.xs} aria-hidden="true" />
            ลากิจ/ป่วย
          </StatusChip>
        );
      default:
        return <StatusChip tone="neutral">ขาด</StatusChip>;
    }
  };

  const getMethodBadge = (method: string) => {
    switch (method) {
      case "qr_self":
        return (
          <span className="type-fine inline-flex items-center gap-1 text-[var(--color-body-muted)]">
            <QrCode size={ICON_SIZE.xs} aria-hidden="true" />
            <span>สแกนคิวอาร์โค้ด</span>
          </span>
        );
      case "officer_scan":
        return (
          <span className="type-fine inline-flex items-center gap-1 text-[var(--color-body-muted)]">
            <CheckCircle2 size={ICON_SIZE.xs} aria-hidden="true" />
            <span>เจ้าหน้าที่เช็กชื่อ</span>
          </span>
        );
      default:
        return null;
    }
  };

  const consistencyLabel =
    attendedCount >= 8
      ? "สัตย์ซื่อสม่ำเสมอ"
      : attendedCount > 0
        ? "เข้าร่วมต่อเนื่อง"
        : "เริ่มต้นนมัสการ";

  return (
    <MemberAppLayout title="ประวัติการเข้าร่วม">
      <header>
        <h1 className="type-lead font-semibold text-[var(--color-ink)]">
          ประวัติการเข้าร่วม
        </h1>
        <p className="type-caption mt-1 text-[var(--color-body-muted)]">
          ดูความสม่ำเสมอในการมานมัสการและเข้าร่วมพันธกิจของคุณ
        </p>
      </header>

      {/* Attendance summary — graphite chrome, token text only. */}
      <section className="rounded-[var(--radius-lg)] bg-gradient-to-br from-[var(--color-dark-surface-2)] to-[var(--color-dark-surface)] p-4 text-[var(--color-on-dark)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-on-dark)]/10">
              <CalendarCheck2
                size={ICON_SIZE.lg}
                aria-hidden="true"
                className="text-[var(--color-primary-on-dark)]"
              />
            </span>
            <div className="min-w-0">
              <p className="type-body-strong">บันทึกการนมัสการ</p>
              <p className="type-fine text-[var(--color-on-dark-muted)]">
                ความสัตย์ซื่อในการร่วมสามัคคีธรรม
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="รีเฟรชประวัติการเข้าร่วม"
            aria-busy={refreshing}
            title="รีเฟรชข้อมูล"
            className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-on-dark)]/10 text-[var(--color-on-dark)] transition-colors hover:bg-[var(--color-on-dark)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-on-dark)] disabled:opacity-50 motion-reduce:transition-none"
          >
            <RefreshCw
              size={ICON_SIZE.md}
              aria-hidden="true"
              className={
                refreshing ? "animate-spin motion-reduce:animate-none" : ""
              }
            />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--color-on-dark-hairline)] pt-4">
          <div className="rounded-[var(--radius-md)] bg-[var(--color-on-dark)]/10 p-3">
            <p className="type-fine text-[var(--color-on-dark-muted)]">
              เข้าร่วมทั้งหมด
            </p>
            <p className="mt-1 flex items-baseline gap-1">
              <span className="type-lead font-bold">{attendedCount}</span>
              <span className="type-fine text-[var(--color-on-dark-muted)]">
                ครั้ง
              </span>
            </p>
          </div>
          <div className="rounded-[var(--radius-md)] bg-[var(--color-on-dark)]/10 p-3">
            <p className="type-fine text-[var(--color-on-dark-muted)]">
              สถานะความสม่ำเสมอ
            </p>
            <p className="type-caption mt-1 flex items-center gap-1.5 font-semibold">
              <Sparkles
                size={ICON_SIZE.sm}
                aria-hidden="true"
                className="shrink-0 text-[var(--color-primary-on-dark)]"
              />
              <span>{consistencyLabel}</span>
            </p>
          </div>
        </div>
      </section>

      {/* Filters — wraps instead of scrolling horizontally at 360px. */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(FILTER_LABELS) as FilterType[]).map(value => {
          const isActive = filterType === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={isActive}
              onClick={() => setFilterType(value)}
              className={`type-caption-strong inline-flex min-h-11 items-center rounded-[var(--radius-pill)] px-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] motion-reduce:transition-none ${
                isActive
                  ? "bg-[var(--color-primary)] text-[var(--color-on-dark)]"
                  : "border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] hover:bg-[var(--color-canvas-soft)]"
              }`}
            >
              {value === "all"
                ? `${FILTER_LABELS[value]} (${records.length})`
                : FILTER_LABELS[value]}
            </button>
          );
        })}
      </div>

      {loading && <ListSkeleton count={3} />}

      {!loading && error && (
        <ErrorState
          title="โหลดประวัติการเข้าร่วมไม่สำเร็จ"
          description="ระบบยังเชื่อมต่อข้อมูลการเข้าร่วมของคุณไม่ได้ในขณะนี้ กรุณาลองอีกครั้ง"
          technical={error}
          retryLabel="ลองอีกครั้ง"
          onRetry={() => {
            setLoading(true);
            void fetchAttendance();
          }}
        />
      )}

      {!loading && !error && filteredRecords.length === 0 && (
        <EmptyState
          icon={CalendarDays}
          title="ไม่พบประวัติการเข้าร่วม"
          description={
            records.length > 0
              ? "ยังไม่มีประวัติที่ตรงกับตัวกรองนี้ ลองดูประวัติทั้งหมดอีกครั้ง"
              : "เมื่อคุณมานมัสการหรือเข้าร่วมพันธกิจ เจ้าหน้าที่จะบันทึกไว้ หรือคุณใช้บัตรคิวอาร์โค้ดเช็กชื่อได้"
          }
          action={
            records.length > 0
              ? {
                  label: "ดูประวัติทั้งหมด",
                  onClick: () => setFilterType("all"),
                }
              : { label: "ดูกิจกรรมที่กำลังจะมาถึง", href: "/app/events" }
          }
        />
      )}

      {!loading && !error && filteredRecords.length > 0 && (
        <ul className="flex flex-col gap-3">
          {filteredRecords.map(r => (
            <li
              key={r.id}
              className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="type-caption-strong text-[var(--color-ink)]">
                    {getServiceTypeLabel(r.serviceType)}
                  </h2>
                  <p className="type-fine mt-0.5 text-[var(--color-body-muted)]">
                    {formatThaiDate(r.date)}
                  </p>
                </div>
                {getStatusBadge(r.status)}
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--color-divider)] pt-2.5">
                <span className="type-fine text-[var(--color-body-muted)]">
                  {r.groupName ? `กลุ่ม: ${r.groupName}` : "คริสตจักรชีวิตสุขสันต์กาฬสินธุ์"}
                </span>
                {getMethodBadge(r.checkInMethod)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </MemberAppLayout>
  );
}
