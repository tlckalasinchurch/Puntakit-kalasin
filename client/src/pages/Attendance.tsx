import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Download,
  Flame,
  History,
  Phone,
  QrCode,
  RefreshCw,
  Search,
  TrendingUp,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { AppLayout } from "@/components/layout/AppLayout";
import { TableSkeleton } from "@/components/LoadingStates";
import { Skeleton } from "@/components/ui/skeleton";
import {
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
  StatusChip,
} from "@/components/DesignSystem";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { api, ApiError } from "@/lib/api";
import { fetchAllMembers, fetchAllPages } from "@/lib/fetchAll";
import type { AttendanceStatus, ServiceType } from "@shared/schema";
import { usePageTitle } from "@/hooks/usePageTitle";

interface MemberItem {
  id: string;
  name: string;
  nickname: string | null;
  phone: string | null;
  avatarUrl: string | null;
  group: string | null;
  status: "ติดตามแล้ว" | "ต้องติดตาม";
}

interface AttendanceRecordItem {
  id: string;
  date: string;
  serviceType: ServiceType;
  groupId: string | null;
  memberId: string;
  status: AttendanceStatus;
  checkInMethod: string;
  checkedInAt: string;
  memberName: string;
  memberNickname: string | null;
  memberPhone: string | null;
  groupName: string | null;
  checkerName: string | null;
}

interface AbsenteeItem {
  id: string;
  name: string;
  nickname: string | null;
  phone: string | null;
  area: string | null;
  group: string | null;
  status: "ติดตามแล้ว" | "ต้องติดตาม";
  membershipStatus: string;
  leaderName: string | null;
  consecutiveAbsenceCount: number;
  lastAttendedDate: string | null;
}

interface GroupOption {
  id: string;
  name: string;
}

const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  sunday_service: "นมัสการวันอาทิตย์",
  care_group: "พันธกิจประจำสัปดาห์",
  prayer_meeting: "อธิษฐานวันพุธ",
  youth_service: "นมัสการกลุ่มวัยรุ่น",
  special_event: "กิจกรรมพิเศษ / ค่าย",
};

/** Shared control styling: >= 44px tall, one hairline border, one focus ring. */
const CONTROL_CLASS =
  "min-h-11 w-full rounded-[var(--radius-sm)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-body-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]";

const PRIMARY_BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-on-dark)] transition-colors hover:bg-[var(--color-primary-focus)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50";

const SECONDARY_BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 text-sm font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50";

/** The four tabs. Same tab keys as before: live | qr | absentees | reports. */
const TABS: {
  value: "live" | "qr" | "absentees" | "reports";
  label: string;
  icon: typeof UserCheck;
}[] = [
  { value: "live", label: "เช็คชื่อประจำวัน", icon: UserCheck },
  { value: "qr", label: "สแกน QR", icon: QrCode },
  { value: "absentees", label: "ผู้ขาดต่อเนื่อง", icon: AlertCircle },
  { value: "reports", label: "รายงานและสถิติ", icon: TrendingUp },
];

/**
 * The four attendance statuses a leader can record, in the same order and with
 * the same `AttendanceStatus` values the API has always received. Colour is
 * only reinforcement — every button carries its Thai label and an aria-label
 * that names the member.
 */
const STATUS_OPTIONS: {
  value: AttendanceStatus;
  label: string;
  active: string;
  idle: string;
}[] = [
  {
    value: "present",
    label: "มา",
    active:
      "border-transparent bg-[var(--color-success)] text-[var(--color-on-dark)]",
    idle: "border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-success)] hover:bg-[var(--color-success)]/10",
  },
  {
    value: "online",
    label: "ออนไลน์",
    active:
      "border-transparent bg-[var(--color-info-strong)] text-[var(--color-on-dark)]",
    idle: "border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-info-strong)] hover:bg-[var(--color-info-soft)]",
  },
  {
    value: "leave",
    label: "ลา",
    active:
      "border-transparent bg-[var(--color-warning)] text-[var(--color-on-dark)]",
    idle: "border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-warning)] hover:bg-[var(--color-warning)]/10",
  },
  {
    value: "absent",
    label: "ขาด",
    active:
      "border-transparent bg-[var(--color-error)] text-[var(--color-on-dark)]",
    idle: "border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-error)] hover:bg-[var(--color-error)]/10",
  },
];

const METRIC_TONE = {
  success: "bg-[var(--color-success)]/10 text-[var(--color-success)]",
  info: "bg-[var(--color-info-soft)] text-[var(--color-info-strong)]",
  warning: "bg-[var(--color-warning)]/10 text-[var(--color-warning)]",
  error: "bg-[var(--color-error)]/10 text-[var(--color-error)]",
} as const;

function MetricTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: keyof typeof METRIC_TONE;
}) {
  return (
    <div className={`rounded-[var(--radius-md)] p-3 ${METRIC_TONE[tone]}`}>
      <div className="text-xs font-semibold">{label}</div>
      <div className="mt-1 text-2xl font-semibold">
        {value}
        <span className="ml-1 text-xs font-normal">คน</span>
      </div>
    </div>
  );
}

export default function Attendance() {
  usePageTitle("ระบบเช็คชื่อและการเข้าร่วม");
  // Active Tab: "live" | "qr" | "absentees" | "reports"
  const [activeTab, setActiveTab] = useState<"live" | "qr" | "absentees" | "reports">("live");

  // Selection parameters
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedService, setSelectedService] = useState<ServiceType>("sunday_service");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");

  // Data lists
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [allMembers, setAllMembers] = useState<MemberItem[]>([]);
  // Active members of the chosen care group (by real membership, not by the
  // free-text `group` label, which can repeat across bodies). null = everyone.
  const [groupMemberIds, setGroupMemberIds] = useState<Set<string> | null>(null);
  const [currentAttendance, setCurrentAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [loadingLive, setLoadingLive] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState("");

  // Absentees state
  const [absentees, setAbsentees] = useState<AbsenteeItem[]>([]);
  const [absenteeThreshold, setAbsenteeThreshold] = useState<number>(3);
  const [loadingAbsentees, setLoadingAbsentees] = useState(false);
  const [absenteeError, setAbsenteeError] = useState<string | null>(null);

  // QR Scan / Session state
  const [qrInputToken, setQrInputToken] = useState("");
  const [scanning, setScanning] = useState(false);
  const [lastScannedMember, setLastScannedMember] = useState<any | null>(null);
  const [sessionQrDataUrl, setSessionQrDataUrl] = useState<string>("");

  // Reports summary
  const [summaryStats, setSummaryStats] = useState<any | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Check URL query parameters for initial group
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const grpId = urlParams.get("groupId");
    if (grpId) {
      setSelectedGroupId(grpId);
      setSelectedService("care_group");
    }
  }, []);

  // Fetch groups list
  useEffect(() => {
    api
      .get<GroupOption[]>("/api/groups")
      .then((res) => setGroups(res || []))
      .catch(() => {});
  }, []);

  // Generate Session QR Code
  useEffect(() => {
    const sessionPayload = JSON.stringify({
      church: "Puntakit Kalasin",
      service: selectedService,
      date: selectedDate,
      groupId: selectedGroupId || null,
    });

    QRCode.toDataURL(sessionPayload, { width: 280, margin: 2, color: { dark: "#272729", light: "#ffffff" } })
      .then(setSessionQrDataUrl)
      .catch(() => {});
  }, [selectedService, selectedDate, selectedGroupId]);

  // Load Live Check-in Roster
  const loadLiveRoster = useCallback(async () => {
    setLoadingLive(true);
    setLiveError(null);
    try {
      // 1. Fetch registered members. GET /api/members returns the rows as a
      // bare array in `data` (pagination lives in `meta`) — there is no
      // `{ items }` wrapper, so the result must be typed as an array.
      // Pinned by server/routes/members.test.ts (list contract) and
      // client/src/members-list-contract.test.ts.
      const members = await fetchAllMembers<MemberItem>();
      setAllMembers(members ?? []);

      if (selectedGroupId) {
        const memberships = await api.get<{ memberId: string; status: string }[]>(`/api/groups/${selectedGroupId}/members`);
        setGroupMemberIds(new Set((memberships ?? []).filter((x) => x.status === "active").map((x) => x.memberId)));
      } else {
        setGroupMemberIds(null);
      }

      // 2. Fetch existing attendance records for this date & service
      const attParams = new URLSearchParams({
        startDate: selectedDate,
        endDate: selectedDate,
        serviceType: selectedService,
      });
      if (selectedGroupId) attParams.set("groupId", selectedGroupId);

      const attRes = await fetchAllPages<AttendanceRecordItem>(`/api/attendance?${attParams.toString()}`);
      const map: Record<string, AttendanceStatus> = {};
      (attRes || []).forEach((r) => {
        map[r.memberId] = r.status;
      });
      setCurrentAttendance(map);
    } catch (err) {
      setLiveError(err instanceof ApiError ? err.message : "โหลดข้อมูลไม่สำเร็จ");
      toast.error("โหลดข้อมูลเช็คชื่อไม่สำเร็จ");
    } finally {
      setLoadingLive(false);
    }
  }, [selectedDate, selectedService, selectedGroupId]);

  useEffect(() => {
    if (activeTab === "live") {
      loadLiveRoster();
    }
  }, [activeTab, loadLiveRoster]);

  // Load Absentees
  const loadAbsentees = useCallback(async () => {
    setLoadingAbsentees(true);
    setAbsenteeError(null);
    try {
      const params = new URLSearchParams({
        threshold: String(absenteeThreshold),
        serviceType: selectedService,
      });
      if (selectedGroupId) params.set("groupId", selectedGroupId);

      const res = await api.get<AbsenteeItem[]>(`/api/attendance/absentees?${params.toString()}`);
      setAbsentees(res || []);
    } catch (err) {
      setAbsenteeError(err instanceof ApiError ? err.message : "โหลดข้อมูลไม่สำเร็จ");
      toast.error("โหลดข้อมูลสมาชิกขาดต่อเนื่องไม่สำเร็จ");
    } finally {
      setLoadingAbsentees(false);
    }
  }, [absenteeThreshold, selectedService, selectedGroupId]);

  useEffect(() => {
    if (activeTab === "absentees") {
      loadAbsentees();
    }
  }, [activeTab, loadAbsentees]);

  // Load Summary
  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const res = await api.get("/api/attendance/summary");
      setSummaryStats(res);
    } catch {
      // ignore
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "reports") {
      loadSummary();
    }
  }, [activeTab, loadSummary]);

  // Quick Check-in single member
  const handleSetStatus = async (memberId: string, status: AttendanceStatus) => {
    setCurrentAttendance((prev) => ({ ...prev, [memberId]: status }));
    try {
      await api.post("/api/attendance/check-in", {
        date: selectedDate,
        serviceType: selectedService,
        groupId: selectedGroupId || null,
        memberId,
        status,
        checkInMethod: "manual",
      });
    } catch (err) {
      toast.error("บันทึกการเช็คชื่อไม่สำเร็จ");
    }
  };

  // Submit QR Code
  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrInputToken.trim()) return;

    setScanning(true);
    try {
      const res = await api.post<{ member: any; attendance: any }>("/api/attendance/qr-scan", {
        token: qrInputToken.trim(),
        serviceType: selectedService,
        groupId: selectedGroupId || null,
        date: selectedDate,
      });

      setLastScannedMember(res.member);
      toast.success(`เช็คชื่อสำเร็จ: ${res.member.name}`);
      setQrInputToken("");
      setCurrentAttendance((prev) => ({ ...prev, [res.member.id]: "present" }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "รหัส QR ไม่ถูกต้อง");
    } finally {
      setScanning(false);
    }
  };

  // Mark member as "ต้องติดตาม"
  const handleMarkFollowUp = async (memberId: string) => {
    try {
      await api.put(`/api/members/${memberId}`, { status: "ต้องติดตาม" });
      toast.success("อัปเดตสถานะเป็น 'ต้องติดตาม' เรียบร้อยแล้ว");
      setAbsentees((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, status: "ต้องติดตาม" } : m))
      );
    } catch {
      toast.error("อัปเดตสถานะไม่สำเร็จ");
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    window.open("/api/attendance/export", "_blank");
  };

  // Filter members list for live roster
  const filteredMembers = allMembers.filter((m) => {
    if (groupMemberIds && !groupMemberIds.has(m.id)) return false;
    if (!memberSearch.trim()) return true;
    const q = memberSearch.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      (m.nickname && m.nickname.toLowerCase().includes(q)) ||
      (m.phone && m.phone.includes(q))
    );
  });

  // Calculate live counts
  const presentCount = Object.values(currentAttendance).filter((s) => s === "present").length;
  const onlineCount = Object.values(currentAttendance).filter((s) => s === "online").length;
  const leaveCount = Object.values(currentAttendance).filter((s) => s === "leave").length;
  const absentCount = Object.values(currentAttendance).filter((s) => s === "absent").length;

  const refreshActiveTab = () => {
    if (activeTab === "live") loadLiveRoster();
    else if (activeTab === "absentees") loadAbsentees();
    else if (activeTab === "reports") loadSummary();
  };

  return (
    <AppLayout>
      <PageHeader
        title="เช็คชื่อนมัสการ"
        description="บันทึกการเข้าร่วมนมัสการ พันธกิจ สแกน QR และติดตามสมาชิกที่ขาดต่อเนื่อง"
        secondaryActions={[
          {
            label: "ดาวน์โหลดรายงาน CSV",
            icon: Download,
            onClick: handleExportCsv,
          },
        ]}
      />

      {/* Tabs Navigation — same four tabs, same state keys as before */}
      <div
        role="tablist"
        aria-label="ส่วนงานเช็คชื่อ"
        className="mb-4 flex flex-wrap gap-2"
      >
        {TABS.map(({ value, label, icon: Icon }) => {
          const isActive = activeTab === value;
          return (
            <button
              key={value}
              id={`attendance-tab-${value}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`attendance-panel-${value}`}
              onClick={() => setActiveTab(value)}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-pill)] border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] ${
                isActive
                  ? "border-transparent bg-[var(--color-primary)] text-[var(--color-on-dark)]"
                  : "border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] hover:bg-[var(--color-canvas-soft)]"
              }`}
            >
              <Icon size={ICON_SIZE.sm} aria-hidden="true" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Session Controls: Date & Service Type Selector */}
      <section className="card-surface mb-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[200px] flex-1 sm:max-w-[240px]">
            <Field label="วันที่รอบการนมัสการ">
              {(props) => (
                <input
                  id={props.id}
                  aria-describedby={props["aria-describedby"]}
                  aria-invalid={props["aria-invalid"]}
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className={CONTROL_CLASS}
                />
              )}
            </Field>
          </div>

          <div className="min-w-[220px] flex-1 sm:max-w-[280px]">
            <Field label="ประเภทการนมัสการ/กิจกรรม">
              {(props) => (
                <select
                  id={props.id}
                  aria-describedby={props["aria-describedby"]}
                  aria-invalid={props["aria-invalid"]}
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value as ServiceType)}
                  className={CONTROL_CLASS}
                >
                  <option value="sunday_service">นมัสการวันอาทิตย์</option>
                  <option value="care_group">พันธกิจประจำสัปดาห์</option>
                  <option value="prayer_meeting">อธิษฐานวันพุธ</option>
                  <option value="youth_service">นมัสการวัยรุ่น</option>
                  <option value="special_event">กิจกรรมพิเศษ</option>
                </select>
              )}
            </Field>
          </div>

          {selectedService === "care_group" && (
            <div className="min-w-[200px] flex-1 sm:max-w-[240px]">
              <Field label="เลือกพันธกิจ">
                {(props) => (
                  <select
                    id={props.id}
                    aria-describedby={props["aria-describedby"]}
                    aria-invalid={props["aria-invalid"]}
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    className={CONTROL_CLASS}
                  >
                    <option value="">-- ทุกพันธกิจ --</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
          )}

          <button
            type="button"
            className={`${SECONDARY_BUTTON_CLASS} sm:ml-auto`}
            onClick={refreshActiveTab}
          >
            <RefreshCw size={ICON_SIZE.sm} aria-hidden="true" />
            <span>รีเฟรชข้อมูล</span>
          </button>
        </div>
      </section>

      {/* TAB 1: LIVE CHECK-IN */}
      {activeTab === "live" && (
        <section
          id="attendance-panel-live"
          role="tabpanel"
          aria-labelledby="attendance-tab-live"
          className="card-surface p-4 sm:p-5"
        >
          {/* Live Attendance Metric Bar */}
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricTile label="มา" value={presentCount} tone="success" />
            <MetricTile label="ออนไลน์" value={onlineCount} tone="info" />
            <MetricTile label="ลา" value={leaveCount} tone="warning" />
            <MetricTile label="ขาด" value={absentCount} tone="error" />
          </div>

          {/* Search roster */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search
                size={ICON_SIZE.md}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-body-muted)]"
              />
              <input
                type="text"
                enterKeyHint="search"
                aria-label="ค้นหาสมาชิกเพื่อเช็คชื่อ"
                placeholder="ค้นหาชื่อสมาชิกเพื่อเช็คชื่อ..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className={`${CONTROL_CLASS} rounded-[var(--radius-pill)] pl-10 pr-12`}
              />
              {memberSearch && (
                <button
                  type="button"
                  aria-label="ล้างคำค้นหา"
                  onClick={() => setMemberSearch("")}
                  className="absolute right-0 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-[var(--radius-circle)] text-[var(--color-body-muted)] hover:text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
                >
                  <X size={ICON_SIZE.sm} aria-hidden="true" />
                </button>
              )}
            </div>
            <p role="status" className="type-caption text-[var(--color-body-muted)]">
              แสดงสมาชิก {filteredMembers.length} คน
            </p>
          </div>

          {/* Member Roster List — one responsive list, no horizontal scroll */}
          {loadingLive ? (
            <TableSkeleton rows={8} />
          ) : liveError ? (
            <ErrorState inset technical={liveError} onRetry={loadLiveRoster} />
          ) : filteredMembers.length === 0 ? (
            <EmptyState
              inset
              icon={Users}
              title="ไม่พบสมาชิกที่ตรงกับคำค้นหา"
              description={
                memberSearch
                  ? "ลองล้างคำค้นหา หรือตรวจสอบว่าสมาชิกอยู่ในพันธกิจที่เลือกไว้"
                  : "ยังไม่มีสมาชิกให้เช็คชื่อในรอบนี้"
              }
              action={
                memberSearch
                  ? { label: "ล้างคำค้นหา", onClick: () => setMemberSearch("") }
                  : undefined
              }
            />
          ) : (
            <ul className="divide-y divide-[var(--color-divider)]">
              {filteredMembers.map((m) => {
                const st = currentAttendance[m.id];
                return (
                  <li
                    key={m.id}
                    className="flex flex-col gap-3 py-3 md:flex-row md:items-center md:justify-between md:gap-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="type-caption-strong flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-circle)] bg-[var(--color-accent-soft)] text-[var(--color-primary)]"
                      >
                        {m.name.slice(0, 1)}
                      </span>
                      <div className="min-w-0">
                        <p className="type-caption-strong truncate text-[var(--color-ink)]">
                          {m.name}
                          {m.nickname && (
                            <span className="font-normal text-[var(--color-body-muted)]">
                              {" "}
                              ({m.nickname})
                            </span>
                          )}
                        </p>
                        <p className="type-fine text-[var(--color-body-muted)]">
                          {m.group || "ไม่ระบุพันธกิจ"}
                          {m.phone ? ` • ${m.phone}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 md:flex md:shrink-0 md:flex-nowrap">
                      {STATUS_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          aria-pressed={st === opt.value}
                          aria-label={`${opt.label}: ${m.name}`}
                          onClick={() => handleSetStatus(m.id, opt.value)}
                          className={`inline-flex min-h-11 items-center justify-center rounded-[var(--radius-sm)] border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] ${
                            st === opt.value ? opt.active : opt.idle
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* TAB 2: QR CHECK-IN */}
      {activeTab === "qr" && (
        <div
          id="attendance-panel-qr"
          role="tabpanel"
          aria-labelledby="attendance-tab-qr"
          className="grid grid-cols-1 gap-4 lg:grid-cols-2"
        >
          {/* Scanner Mode */}
          <section className="card-surface p-5 sm:p-6">
            <h2 className="type-body-strong text-[var(--color-ink)]">
              เจ้าหน้าที่สแกน QR Code สมาชิก
            </h2>
            <p className="type-caption mt-1 text-[var(--color-body-muted)]">
              นำเครื่องสแกนบาร์โค้ด หรือกล้องมือถือสแกน Personal QR Code ของสมาชิกเพื่อบันทึกทันที
            </p>

            <form onSubmit={handleScanSubmit} className="mt-4">
              <Field
                label="รหัส QR / รหัสสมาชิก"
                hint="สแกนบาร์โค้ดหรือพิมพ์รหัส แล้วกดยืนยันการเช็คชื่อ"
              >
                {(props) => (
                  <input
                    id={props.id}
                    aria-describedby={props["aria-describedby"]}
                    aria-invalid={props["aria-invalid"]}
                    type="text"
                    autoFocus
                    placeholder="เช่น PK-MEM-123"
                    value={qrInputToken}
                    onChange={(e) => setQrInputToken(e.target.value)}
                    className={`${CONTROL_CLASS} border-2 border-[var(--color-primary)]`}
                  />
                )}
              </Field>

              <button
                type="submit"
                disabled={scanning || !qrInputToken.trim()}
                className={`${PRIMARY_BUTTON_CLASS} mt-4 w-full`}
              >
                <UserCheck size={ICON_SIZE.sm} aria-hidden="true" />
                <span>{scanning ? "กำลังประมวลผล…" : "ยืนยันการเช็คชื่อ"}</span>
              </button>
            </form>

            {/* Recent Scanned confirmation */}
            {lastScannedMember && (
              <div
                role="status"
                className="mt-5 flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-success)]/10 p-4"
              >
                <span
                  aria-hidden="true"
                  className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-circle)] bg-[var(--color-success)] text-[var(--color-on-dark)]"
                >
                  <Check size={ICON_SIZE.lg} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="type-caption-strong text-[var(--color-success)]">
                    เช็คชื่อสำเร็จล่าสุด!
                  </p>
                  <p className="type-body-strong truncate text-[var(--color-ink)]">
                    {lastScannedMember.name}{" "}
                    {lastScannedMember.nickname ? `(${lastScannedMember.nickname})` : ""}
                  </p>
                  <p className="type-fine text-[var(--color-body-muted)]">
                    เบอร์: {lastScannedMember.phone || "-"} • บันทึกแล้วในรอบ:{" "}
                    {SERVICE_TYPE_LABELS[selectedService]}
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* Session QR Display Mode */}
          <section className="card-surface p-5 text-center sm:p-6">
            <h2 className="type-body-strong text-[var(--color-ink)]">
              ป้าย QR Code ประจำรอบนมัสการ
            </h2>
            <p className="type-caption mt-1 text-[var(--color-body-muted)]">
              แสดงหน้าจอนี้ที่ประตูคริสตจักร เพื่อให้สมาชิกสแกน Check-in ด้วยสมาร์ตโฟนของตนเอง
            </p>

            <div className="mt-4 inline-block rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3 shadow-[var(--shadow)]">
              {sessionQrDataUrl ? (
                <img
                  src={sessionQrDataUrl}
                  alt="รหัส QR ประจำรอบนมัสการ"
                  className="h-60 w-60"
                />
              ) : (
                <Skeleton className="h-60 w-60 rounded-[var(--radius-md)]" />
              )}
            </div>

            <div className="type-caption mt-3 text-[var(--color-text-secondary)]">
              <strong>{SERVICE_TYPE_LABELS[selectedService]}</strong>
              <div>วันที่ {new Date(selectedDate).toLocaleDateString("th-TH")}</div>
            </div>
          </section>
        </div>
      )}

      {/* TAB 3: CONSECUTIVE ABSENTEES */}
      {activeTab === "absentees" && (
        <section
          id="attendance-panel-absentees"
          role="tabpanel"
          aria-labelledby="attendance-tab-absentees"
          className="card-surface p-4 sm:p-5"
        >
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h2 className="type-body-strong text-[var(--color-ink)]">
                สมาชิกที่ขาดการเข้าร่วมต่อเนื่อง
              </h2>
              <p className="type-caption mt-1 text-[var(--color-body-muted)]">
                ระบบตรวจจับสมาชิกที่ขาดติดต่อกันเกินเกณฑ์ เพื่อให้ศิษยาภิบาลและผู้นำพันธกิจติดตามเยี่ยมนมัสการ
              </p>
            </div>

            <div className="min-w-[200px] shrink-0">
              <Field label="เกณฑ์การขาด">
                {(props) => (
                  <select
                    id={props.id}
                    aria-describedby={props["aria-describedby"]}
                    aria-invalid={props["aria-invalid"]}
                    value={absenteeThreshold}
                    onChange={(e) => setAbsenteeThreshold(Number(e.target.value))}
                    className={CONTROL_CLASS}
                  >
                    <option value={2}>ขาด 2 สัปดาห์ขึ้นไป</option>
                    <option value={3}>ขาด 3 สัปดาห์ขึ้นไป (แนะนำ)</option>
                    <option value={4}>ขาด 4 สัปดาห์ขึ้นไป (เร่งด่วน)</option>
                  </select>
                )}
              </Field>
            </div>
          </div>

          {loadingAbsentees ? (
            <TableSkeleton rows={5} />
          ) : absenteeError ? (
            <ErrorState inset technical={absenteeError} onRetry={loadAbsentees} />
          ) : absentees.length === 0 ? (
            <EmptyState
              inset
              icon={CheckCircle2}
              title="ยอดเยี่ยมมาก!"
              description={`ไม่มีสมาชิกที่ขาดติดต่อกันเกิน ${absenteeThreshold} สัปดาห์ในรอบนี้`}
            />
          ) : (
            <ul className="divide-y divide-[var(--color-divider)]">
              {absentees.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between md:gap-4"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="type-caption-strong flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-circle)] bg-[var(--color-warning)]/10 text-[var(--color-warning)]"
                    >
                      {m.name.slice(0, 1)}
                    </span>
                    <div className="min-w-0">
                      <p className="type-caption-strong text-[var(--color-ink)]">{m.name}</p>
                      {m.nickname && (
                        <p className="type-fine text-[var(--color-body-muted)]">
                          ชื่อเล่น: {m.nickname}
                        </p>
                      )}
                      <p className="type-fine mt-1 text-[var(--color-body-muted)]">
                        {m.group || m.area || "ไม่ระบุกลุ่ม/พื้นที่"}
                      </p>
                      <p className="type-fine text-[var(--color-body-muted)]">
                        มาล่าสุด:{" "}
                        {m.lastAttendedDate
                          ? new Date(m.lastAttendedDate).toLocaleDateString("th-TH")
                          : "ไม่เคยมีบันทึก"}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 md:shrink-0 md:justify-end">
                    <StatusChip tone="warning">
                      ขาด {m.consecutiveAbsenceCount} สัปดาห์
                    </StatusChip>
                    <StatusChip tone={m.status === "ต้องติดตาม" ? "warning" : "success"}>
                      {m.status}
                    </StatusChip>

                    {m.phone && (
                      <a
                        href={`tel:${m.phone}`}
                        className="type-caption inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-sm)] px-2 text-[var(--color-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
                      >
                        <Phone size={ICON_SIZE.xs} aria-hidden="true" />
                        <span>{m.phone}</span>
                      </a>
                    )}

                    {m.status !== "ต้องติดตาม" ? (
                      <button
                        type="button"
                        className={PRIMARY_BUTTON_CLASS}
                        onClick={() => handleMarkFollowUp(m.id)}
                      >
                        เปลี่ยนเป็น "ต้องติดตาม"
                      </button>
                    ) : (
                      <span className="type-caption text-[var(--color-body-muted)]">
                        อยู่ในสถานะติดตามแล้ว
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* TAB 4: REPORTS & SUMMARY */}
      {activeTab === "reports" && (
        <div
          id="attendance-panel-reports"
          role="tabpanel"
          aria-labelledby="attendance-tab-reports"
          className="flex flex-col gap-4"
        >
          {/* Metric cards */}
          {loadingSummary ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 rounded-[var(--radius-md)]" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-4">
                <span
                  aria-hidden="true"
                  className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-accent-soft)] text-[var(--color-primary)]"
                >
                  <Users size={ICON_SIZE.md} aria-hidden="true" />
                </span>
                <div>
                  <p className="type-fine text-[var(--color-body-muted)]">
                    ยอดเช็คชื่อสัปดาห์นี้
                  </p>
                  <p className="type-body-strong text-[var(--color-ink)]">
                    {summaryStats?.totalThisWeek || 0}
                    <span className="ml-1 type-fine font-normal text-[var(--color-body-muted)]">
                      ครั้ง
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-4">
                <span
                  aria-hidden="true"
                  className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-info-soft)] text-[var(--color-info-strong)]"
                >
                  <History size={ICON_SIZE.md} aria-hidden="true" />
                </span>
                <div>
                  <p className="type-fine text-[var(--color-body-muted)]">
                    ยอดเช็คชื่อสะสมทั้งหมด
                  </p>
                  <p className="type-body-strong text-[var(--color-ink)]">
                    {summaryStats?.totalAllTime || 0}
                    <span className="ml-1 type-fine font-normal text-[var(--color-body-muted)]">
                      ครั้ง
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-4">
                <span
                  aria-hidden="true"
                  className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-warning)]/10 text-[var(--color-warning)]"
                >
                  <Flame size={ICON_SIZE.md} aria-hidden="true" />
                </span>
                <div>
                  <p className="type-fine text-[var(--color-body-muted)]">
                    รอบนมัสการประจำ
                  </p>
                  <p className="type-body-strong text-[var(--color-ink)]">
                    5
                    <span className="ml-1 type-fine font-normal text-[var(--color-body-muted)]">
                      รอบ/สัปดาห์
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-4">
                <span
                  aria-hidden="true"
                  className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-canvas-soft)] text-[var(--color-text-secondary)]"
                >
                  <Download size={ICON_SIZE.md} aria-hidden="true" />
                </span>
                <div>
                  <p className="type-fine text-[var(--color-body-muted)]">
                    ส่งออกข้อมูลล่าสุด
                  </p>
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="type-caption-strong min-h-11 text-[var(--color-primary)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
                  >
                    ดาวน์โหลด CSV
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Recent Trend List */}
          <section className="card-surface p-4 sm:p-5">
            <h2 className="type-body-strong text-[var(--color-ink)]">
              แนวโน้มยอดผู้เข้าร่วม 6 รอบล่าสุด
            </h2>

            {summaryStats?.recentTrends?.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-2">
                {summaryStats.recentTrends.map((tr: any, idx: number) => (
                  <li
                    key={idx}
                    className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--color-hairline)] bg-[var(--color-canvas-soft)] px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="type-caption-strong text-[var(--color-ink)]">
                        {SERVICE_TYPE_LABELS[tr.serviceType as ServiceType] || tr.serviceType}
                      </p>
                      <p className="type-fine text-[var(--color-body-muted)]">
                        วันที่ {new Date(tr.date).toLocaleDateString("th-TH")}
                      </p>
                    </div>
                    <p className="type-body-strong shrink-0 text-[var(--color-primary)]">
                      {tr.count} คน
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-3">
                <EmptyState
                  inset
                  title="ยังไม่มีข้อมูลบันทึกสถิติย้อนหลัง"
                  description="เมื่อมีการบันทึกการเช็คชื่อ ระบบจะแสดงแนวโน้มยอดผู้เข้าร่วมที่นี่"
                />
              </div>
            )}
          </section>
        </div>
      )}
    </AppLayout>
  );
}
