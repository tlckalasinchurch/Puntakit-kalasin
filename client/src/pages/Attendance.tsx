import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Download,
  Flame,
  HelpCircle,
  History,
  Info,
  Phone,
  QrCode,
  RefreshCw,
  Search,
  SlidersHorizontal,
  TrendingUp,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  UsersRound,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { AppLayout } from "@/components/layout/AppLayout";
import { TableSkeleton } from "@/components/LoadingStates";
import { Skeleton } from "@/components/ui/skeleton";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { useLocation } from "wouter";
import type { AttendanceStatus, ServiceType } from "@shared/schema";

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
  care_group: "กลุ่มแคร์ประจำสัปดาห์",
  prayer_meeting: "อธิษฐานวันพุธ",
  youth_service: "นมัสการกลุ่มวัยรุ่น",
  special_event: "กิจกรรมพิเศษ / ค่าย",
};

export default function Attendance() {
  const { user } = useAuth();
  const [location] = useLocation();

  // Active Tab: "live" | "qr" | "absentees" | "reports"
  const [activeTab, setActiveTab] = useState<"live" | "qr" | "absentees" | "reports">("live");

  // Selection parameters
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedService, setSelectedService] = useState<ServiceType>("sunday_service");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");

  // Data lists
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [allMembers, setAllMembers] = useState<MemberItem[]>([]);
  const [currentAttendance, setCurrentAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [loadingLive, setLoadingLive] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");

  // Absentees state
  const [absentees, setAbsentees] = useState<AbsenteeItem[]>([]);
  const [absenteeThreshold, setAbsenteeThreshold] = useState<number>(3);
  const [loadingAbsentees, setLoadingAbsentees] = useState(false);

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
    try {
      // 1. Fetch registered members. GET /api/members returns the rows as a
      // bare array in `data` (pagination lives in `meta`) — there is no
      // `{ items }` wrapper, so the result must be typed as an array.
      // Pinned by server/routes/members.test.ts (list contract) and
      // client/src/members-list-contract.test.ts.
      const members = await api.get<MemberItem[]>("/api/members?limit=300");
      setAllMembers(members ?? []);

      // 2. Fetch existing attendance records for this date & service
      const attParams = new URLSearchParams({
        startDate: selectedDate,
        endDate: selectedDate,
        serviceType: selectedService,
        limit: "300",
      });
      if (selectedGroupId) attParams.set("groupId", selectedGroupId);

      const attRes = await api.get<AttendanceRecordItem[]>(`/api/attendance?${attParams.toString()}`);
      const map: Record<string, AttendanceStatus> = {};
      (attRes || []).forEach((r) => {
        map[r.memberId] = r.status;
      });
      setCurrentAttendance(map);
    } catch (err) {
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
    try {
      const params = new URLSearchParams({
        threshold: String(absenteeThreshold),
        serviceType: selectedService,
      });
      if (selectedGroupId) params.set("groupId", selectedGroupId);

      const res = await api.get<AbsenteeItem[]>(`/api/attendance/absentees?${params.toString()}`);
      setAbsentees(res || []);
    } catch {
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
    if (selectedGroupId && m.group) {
      const targetGroup = groups.find((g) => g.id === selectedGroupId);
      if (targetGroup && m.group !== targetGroup.name) return false;
    }
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

  return (
    <AppLayout>
      {/* Page Heading */}
      <div className="page-heading">
        <div>
          <span className="eyebrow">ATTENDANCE & CHECK-IN</span>
          <h1>ระบบเช็คชื่อและการเข้าร่วม</h1>
          <p>บันทึกการเข้าร่วมนมัสการ กลุ่มแคร์ สแกน QR และติดตามสมาชิกที่ขาดต่อเนื่อง</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button className="blue-button" onClick={handleExportCsv}>
            <Download size={ICON_SIZE.sm} />
            <span>ดาวน์โหลดรายงาน (CSV)</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "18px",
          borderBottom: "1px solid #dbe6f0",
          paddingBottom: "8px",
          flexWrap: "wrap",
        }}
      >
        <button
          className={`role-chip ${activeTab === "live" ? "blue" : ""}`}
          style={{ padding: "8px 16px", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
          onClick={() => setActiveTab("live")}
        >
          <UserCheck size={ICON_SIZE.sm} />
          <strong>1. เช็คชื่อประจำวัน (Live)</strong>
        </button>

        <button
          className={`role-chip ${activeTab === "qr" ? "purple" : ""}`}
          style={{ padding: "8px 16px", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
          onClick={() => setActiveTab("qr")}
        >
          <QrCode size={ICON_SIZE.sm} />
          <strong>2. QR Code Check-in</strong>
        </button>

        <button
          className={`role-chip ${activeTab === "absentees" ? "pink" : ""}`}
          style={{ padding: "8px 16px", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
          onClick={() => setActiveTab("absentees")}
        >
          <AlertCircle size={ICON_SIZE.sm} />
          <strong>3. ผู้ขาดต่อเนื่อง (Pastoral Follow-up)</strong>
        </button>

        <button
          className={`role-chip ${activeTab === "reports" ? "green" : ""}`}
          style={{ padding: "8px 16px", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
          onClick={() => setActiveTab("reports")}
        >
          <TrendingUp size={ICON_SIZE.sm} />
          <strong>4. รายงานและสถิติ</strong>
        </button>
      </div>

      {/* Session Controls: Date & Service Type Selector */}
      <div
        className="card-surface"
        style={{
          padding: "16px 20px",
          marginBottom: "18px",
          display: "flex",
          gap: "16px",
          alignItems: "center",
          flexWrap: "wrap",
          background: "#fff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <CalendarDays size={ICON_SIZE.md} style={{ color: "#315c2b" }} />
          <div>
            <label style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "#6e8297" }}>
              วันที่รอบการนมัสการ
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                height: "36px",
                padding: "0 10px",
                borderRadius: "10px",
                border: "1px solid #d5e2ef",
                fontSize: "12px",
                color: "var(--ink)",
              }}
            />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <UsersRound size={ICON_SIZE.md} style={{ color: "#7950d8" }} />
          <div>
            <label style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "#6e8297" }}>
              ประเภทการนมัสการ/กิจกรรม
            </label>
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value as ServiceType)}
              style={{
                height: "36px",
                padding: "0 12px",
                borderRadius: "10px",
                border: "1px solid #d5e2ef",
                fontSize: "12px",
                color: "var(--ink)",
              }}
            >
              <option value="sunday_service">นมัสการวันอาทิตย์</option>
              <option value="care_group">กลุ่มแคร์ประจำสัปดาห์</option>
              <option value="prayer_meeting">อธิษฐานวันพุธ</option>
              <option value="youth_service">นมัสการวัยรุ่น</option>
              <option value="special_event">กิจกรรมพิเศษ</option>
            </select>
          </div>
        </div>

        {selectedService === "care_group" && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Flame size={ICON_SIZE.md} style={{ color: "#e85d78" }} />
            <div>
              <label style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "#6e8297" }}>
                เลือกกลุ่มแคร์
              </label>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                style={{
                  height: "36px",
                  padding: "0 12px",
                  borderRadius: "10px",
                  border: "1px solid #d5e2ef",
                  fontSize: "12px",
                  color: "var(--ink)",
                }}
              >
                <option value="">-- ทุกกลุ่มแคร์ --</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <button
          className="blue-button"
          style={{ marginLeft: "auto", height: "36px", padding: "0 14px" }}
          onClick={() => {
            if (activeTab === "live") loadLiveRoster();
            else if (activeTab === "absentees") loadAbsentees();
            else if (activeTab === "reports") loadSummary();
          }}
        >
          <RefreshCw size={14} />
          <span>รีเฟรชข้อมูล</span>
        </button>
      </div>

      {/* TAB 1: LIVE CHECK-IN */}
      {activeTab === "live" && (
        <div className="card-surface member-panel">
          {/* Live Attendance Metric Bar */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: "10px",
              marginBottom: "16px",
            }}
          >
            <div style={{ background: "#e3f8ee", padding: "12px", borderRadius: "12px", color: "#16865d" }}>
              <div style={{ fontSize: "10px", fontWeight: 700 }}>มา (Present)</div>
              <strong style={{ fontSize: "24px" }}>{presentCount}</strong> คน
            </div>
            <div style={{ background: "#e4f1ff", padding: "12px", borderRadius: "12px", color: "#1e609e" }}>
              <div style={{ fontSize: "10px", fontWeight: 700 }}>ออนไลน์ (Online)</div>
              <strong style={{ fontSize: "24px" }}>{onlineCount}</strong> คน
            </div>
            <div style={{ background: "#fff2d9", padding: "12px", borderRadius: "12px", color: "#c77819" }}>
              <div style={{ fontSize: "10px", fontWeight: 700 }}>ลา (Leave)</div>
              <strong style={{ fontSize: "24px" }}>{leaveCount}</strong> คน
            </div>
            <div style={{ background: "#f8f9fa", padding: "12px", borderRadius: "12px", color: "#6c7a89" }}>
              <div style={{ fontSize: "10px", fontWeight: 700 }}>ขาด (Absent)</div>
              <strong style={{ fontSize: "24px" }}>{absentCount}</strong> คน
            </div>
          </div>

          {/* Search roster */}
          <div className="member-toolbar" style={{ marginBottom: "14px" }}>
            <div className="member-search">
              <Search size={ICON_SIZE.sm} />
              <input
                type="text"
                placeholder="ค้นหาชื่อสมาชิกเพื่อเช็คชื่อ..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
              />
              {memberSearch && (
                <button onClick={() => setMemberSearch("")}>
                  <X size={ICON_SIZE.sm} />
                </button>
              )}
            </div>
            <span style={{ fontSize: "12px", color: "#74889e" }}>
              แสดงสมาชิก {filteredMembers.length} คน
            </span>
          </div>

          {/* Member Roster List */}
          {loadingLive ? (
            <TableSkeleton rows={8} />
          ) : (
            <div className="member-table-wrap">
              <table className="member-table">
                <thead>
                  <tr>
                    <th>ชื่อสมาชิก</th>
                    <th>กลุ่มแคร์</th>
                    <th>เบอร์โทร</th>
                    <th style={{ textAlign: "center" }}>สถานะการเข้าร่วม</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map((m) => {
                    const st = currentAttendance[m.id];
                    return (
                      <tr key={m.id}>
                        <td>
                          <div className="member-name">
                            <div className="member-avatar blue">
                              {m.name.slice(0, 1)}
                            </div>
                            <div>
                              <strong>{m.name}</strong>
                              {m.nickname && <small>({m.nickname})</small>}
                            </div>
                          </div>
                        </td>
                        <td>{m.group || "-"}</td>
                        <td>{m.phone || "-"}</td>
                        <td style={{ textAlign: "center" }}>
                          <div style={{ display: "inline-flex", gap: "6px" }}>
                            <button
                              style={{
                                background: st === "present" ? "#22c55e" : "#f0fdf4",
                                color: st === "present" ? "#fff" : "#166534",
                                border: "1px solid #bbf7d0",
                                borderRadius: "8px",
                                padding: "6px 12px",
                                fontSize: "11px",
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                              onClick={() => handleSetStatus(m.id, "present")}
                            >
                              มา
                            </button>

                            <button
                              style={{
                                background: st === "online" ? "#3b82f6" : "#eff6ff",
                                color: st === "online" ? "#fff" : "#1e40af",
                                border: "1px solid #bfdbfe",
                                borderRadius: "8px",
                                padding: "6px 12px",
                                fontSize: "11px",
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                              onClick={() => handleSetStatus(m.id, "online")}
                            >
                              ออนไลน์
                            </button>

                            <button
                              style={{
                                background: st === "leave" ? "#f59e0b" : "#fffbeb",
                                color: st === "leave" ? "#fff" : "#92400e",
                                border: "1px solid #fde68a",
                                borderRadius: "8px",
                                padding: "6px 12px",
                                fontSize: "11px",
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                              onClick={() => handleSetStatus(m.id, "leave")}
                            >
                              ลา
                            </button>

                            <button
                              style={{
                                background: st === "absent" ? "#ef4444" : "#fef2f2",
                                color: st === "absent" ? "#fff" : "#991b1b",
                                border: "1px solid #fecaca",
                                borderRadius: "8px",
                                padding: "6px 12px",
                                fontSize: "11px",
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                              onClick={() => handleSetStatus(m.id, "absent")}
                            >
                              ขาด
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: QR CHECK-IN */}
      {activeTab === "qr" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px" }}>
          {/* Scanner Mode */}
          <div className="card-surface" style={{ padding: "24px" }}>
            <h2 style={{ fontSize: "18px", color: "var(--ink)", margin: "0 0 8px" }}>
              เจ้าหน้าที่สแกน QR Code สมาชิก
            </h2>
            <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 18px" }}>
              นำเครื่องสแกนบาร์โค้ด หรือกล้องมือถือสแกน Personal QR Code ของสมาชิกเพื่อบันทึกทันที
            </p>

            <form onSubmit={handleScanSubmit}>
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#4f657d", marginBottom: "6px" }}>
                  รหัส QR / รหัสสมาชิก (Scan Barcode/Input)
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="เช่น PK-MEM-123 หรือยิง Barcode Scanner..."
                  value={qrInputToken}
                  onChange={(e) => setQrInputToken(e.target.value)}
                  style={{
                    width: "100%",
                    height: "44px",
                    padding: "0 14px",
                    borderRadius: "12px",
                    border: "2px solid #315c2b",
                    fontSize: "14px",
                    outline: "none",
                  }}
                />
              </div>

              <button
                type="submit"
                className="primary-action"
                disabled={scanning || !qrInputToken.trim()}
                style={{ width: "100%", height: "42px", justifyContent: "center" }}
              >
                <UserCheck size={ICON_SIZE.sm} />
                <span>{scanning ? "กำลังประมวลผล..." : "ยืนยันการเช็คชื่อ"}</span>
              </button>
            </form>

            {/* Recent Scanned confirmation */}
            {lastScannedMember && (
              <div
                style={{
                  marginTop: "20px",
                  padding: "16px",
                  borderRadius: "14px",
                  background: "#eefaf3",
                  border: "1px solid #c2eed5",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "50%",
                    background: "#22c55e",
                    color: "#fff",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <Check size={24} />
                </div>
                <div>
                  <div style={{ fontSize: "10px", fontWeight: 700, color: "#16865d" }}>
                    เช็คชื่อสำเร็จล่าสุด!
                  </div>
                  <strong style={{ fontSize: "16px", color: "var(--ink)" }}>
                    {lastScannedMember.name} {lastScannedMember.nickname ? `(${lastScannedMember.nickname})` : ""}
                  </strong>
                  <div style={{ fontSize: "11px", color: "#617a93" }}>
                    เบอร์: {lastScannedMember.phone || "-"} • บันทึกแล้วในรอบ: {SERVICE_TYPE_LABELS[selectedService]}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Session QR Display Mode */}
          <div className="card-surface" style={{ padding: "24px", textAlign: "center" }}>
            <h2 style={{ fontSize: "18px", color: "var(--ink)", margin: "0 0 6px" }}>
              ป้าย QR Code ประจำรอบนมัสการ
            </h2>
            <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 16px" }}>
              แสดงหน้าจอนี้ที่ประตูคริสตจักร เพื่อให้สมาชิกสแกน Check-in ด้วยสมาร์ตโฟนของตนเอง
            </p>

            <div
              style={{
                display: "inline-block",
                padding: "14px",
                background: "#fff",
                borderRadius: "20px",
                boxShadow: "0 8px 24px rgba(35, 78, 120, 0.08)",
                border: "1px solid #d9e6f3",
              }}
            >
              {sessionQrDataUrl ? (
                <img src={sessionQrDataUrl} alt="Session QR Code" style={{ width: "240px", height: "240px" }} />
              ) : (
                <Skeleton className="h-[240px] w-[240px] rounded-[20px]" />
              )}
            </div>

            <div style={{ marginTop: "14px", fontSize: "12px", color: "#4f6782" }}>
              <strong>{SERVICE_TYPE_LABELS[selectedService]}</strong>
              <div>วันที่ {new Date(selectedDate).toLocaleDateString("th-TH")}</div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CONSECUTIVE ABSENTEES */}
      {activeTab === "absentees" && (
        <div className="card-surface member-panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h2 style={{ fontSize: "18px", color: "var(--ink)", margin: 0 }}>
                สมาชิกที่ขาดการเข้าร่วมต่อเนื่อง
              </h2>
              <p style={{ fontSize: "12px", color: "var(--muted)", margin: "4px 0 0" }}>
                ระบบตรวจจับสมาชิกที่ขาดติดต่อกันเกินเกณฑ์ เพื่อให้ศิษยาภิบาลและผู้นำแคร์ติดตามเยี่ยมนมัสการ
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "#54687e" }}>เกณฑ์การขาด:</span>
              <select
                value={absenteeThreshold}
                onChange={(e) => setAbsenteeThreshold(Number(e.target.value))}
                style={{ height: "36px", borderRadius: "10px", padding: "0 10px", border: "1px solid #d5e2ef" }}
              >
                <option value={2}>ขาด 2 สัปดาห์ขึ้นไป</option>
                <option value={3}>ขาด 3 สัปดาห์ขึ้นไป (แนะนำ)</option>
                <option value={4}>ขาด 4 สัปดาห์ขึ้นไป (เร่งด่วน)</option>
              </select>
            </div>
          </div>

          {loadingAbsentees ? (
            <TableSkeleton rows={5} />
          ) : absentees.length === 0 ? (
            <div className="state-panel">
              <CheckCircle2 size={ICON_SIZE.lg} style={{ color: "#22c55e" }} />
              <h3>ยอดเยี่ยมมาก!</h3>
              <p>ไม่มีสมาชิกที่ขาดติดต่อกันเกิน {absenteeThreshold} สัปดาห์ในรอบนี้</p>
            </div>
          ) : (
            <div className="member-table-wrap">
              <table className="member-table">
                <thead>
                  <tr>
                    <th>ชื่อสมาชิก</th>
                    <th>กลุ่มแคร์ / พื้นที่</th>
                    <th>ขาดติดต่อกัน</th>
                    <th>มาล่าสุดเมื่อ</th>
                    <th>เบอร์ติดต่อ</th>
                    <th>สถานะอภิบาล</th>
                    <th style={{ textAlign: "right" }}>การดำเนินการ</th>
                  </tr>
                </thead>
                <tbody>
                  {absentees.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <div className="member-name">
                          <div className="member-avatar pink">{m.name.slice(0, 1)}</div>
                          <div>
                            <strong>{m.name}</strong>
                            {m.nickname && <small>ชื่อเล่น: {m.nickname}</small>}
                          </div>
                        </div>
                      </td>
                      <td>
                        {m.group || m.area || "-"}
                      </td>
                      <td>
                        <span className="role-chip pink" style={{ fontWeight: 700 }}>
                          {m.consecutiveAbsenceCount} สัปดาห์
                        </span>
                      </td>
                      <td>
                        {m.lastAttendedDate
                          ? new Date(m.lastAttendedDate).toLocaleDateString("th-TH")
                          : "ไม่เคยมีบันทึก"}
                      </td>
                      <td>
                        {m.phone ? (
                          <a
                            href={`tel:${m.phone}`}
                            style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "#315c2b" }}
                          >
                            <Phone size={12} />
                            <span>{m.phone}</span>
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td>
                        <span className={`status-chip ${m.status === "ต้องติดตาม" ? "attention" : "good"}`}>
                          {m.status}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {m.status !== "ต้องติดตาม" ? (
                          <button
                            className="danger-button"
                            style={{ padding: "6px 10px", fontSize: "11px" }}
                            onClick={() => handleMarkFollowUp(m.id)}
                          >
                            เปลี่ยนเป็น "ต้องติดตาม"
                          </button>
                        ) : (
                          <span style={{ fontSize: "11px", color: "#6e8499" }}>อยู่ในสถานะติดตามแล้ว</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: REPORTS & SUMMARY */}
      {activeTab === "reports" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          {/* Metric cards */}
          <div className="member-summary">
            <div className="summary-card blue">
              <div className="summary-icon">
                <Users size={ICON_SIZE.md} />
              </div>
              <div>
                <small>ยอดเช็คชื่อสัปดาห์นี้</small>
                <div>
                  <strong>{summaryStats?.totalThisWeek || 0}</strong>
                  <span>ครั้ง</span>
                </div>
              </div>
            </div>

            <div className="summary-card green">
              <div className="summary-icon">
                <History size={ICON_SIZE.md} />
              </div>
              <div>
                <small>ยอดเช็คชื่อสะสมทั้งหมด</small>
                <div>
                  <strong>{summaryStats?.totalAllTime || 0}</strong>
                  <span>ครั้ง</span>
                </div>
              </div>
            </div>

            <div className="summary-card purple">
              <div className="summary-icon">
                <Flame size={ICON_SIZE.md} />
              </div>
              <div>
                <small>รอบนมัสการประจำ</small>
                <div>
                  <strong>5</strong>
                  <span>รอบ/สัปดาห์</span>
                </div>
              </div>
            </div>

            <div className="summary-card orange">
              <div className="summary-icon">
                <Download size={ICON_SIZE.md} />
              </div>
              <div>
                <small>ส่งออกข้อมูลล่าสุด</small>
                <div>
                  <button
                    onClick={handleExportCsv}
                    style={{ background: "none", border: 0, color: "#315c2b", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}
                  >
                    ดาวน์โหลด CSV
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Trend List */}
          <div className="card-surface" style={{ padding: "20px" }}>
            <h2 style={{ fontSize: "17px", color: "var(--ink)", margin: "0 0 14px" }}>
              แนวโน้มยอดผู้เข้าร่วม 6 รอบล่าสุด
            </h2>

            {summaryStats?.recentTrends?.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {summaryStats.recentTrends.map((tr: any, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 14px",
                      borderRadius: "10px",
                      background: "#f8fafd",
                      border: "1px solid #e7eff7",
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: "13px", color: "var(--ink)" }}>
                        {SERVICE_TYPE_LABELS[tr.serviceType as ServiceType] || tr.serviceType}
                      </strong>
                      <div style={{ fontSize: "11px", color: "#71859c" }}>
                        วันที่ {new Date(tr.date).toLocaleDateString("th-TH")}
                      </div>
                    </div>
                    <div style={{ fontSize: "16px", fontWeight: 700, color: "#315c2b" }}>
                      {tr.count} คน
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: "12px", color: "var(--muted)" }}>ยังไม่มีข้อมูลบันทึกสถิติย้อนหลัง</p>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
