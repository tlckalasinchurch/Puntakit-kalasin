import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CalendarDays, Download, FileBarChart, RotateCw, Users } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

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

const REPORT_ROLES = ["super_admin", "admin", "staff", "ministry_leader"];

const EXPORTS: { key: string; label: string }[] = [
  { key: "members", label: "สมาชิก" },
  { key: "attendance", label: "การเข้าร่วม" },
  { key: "groups", label: "กลุ่มแคร์" },
  { key: "events", label: "กิจกรรม" },
];

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
        <div className="page-heading">
          <div>
            <span className="eyebrow blue-eyebrow">REPORTS</span>
            <h1>รายงาน</h1>
          </div>
        </div>
        <div className="state-panel error-panel">
          <AlertCircle size={ICON_SIZE["2xl"]} />
          <h3>ไม่มีสิทธิ์เข้าถึง</h3>
          <p>หน้านี้จำกัดเฉพาะผู้ดูแลระบบ เจ้าหน้าที่ และผู้นำพันธกิจ</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="page-heading">
        <div>
          <span className="eyebrow blue-eyebrow">REPORTS</span>
          <h1>รายงาน</h1>
          <p>ภาพรวมสมาชิก การเข้าร่วม กลุ่มแคร์ และกิจกรรม พร้อมส่งออกเป็น CSV</p>
        </div>
        <button className="cancel-button" onClick={loadSummary} disabled={isLoading}>
          <RotateCw size={ICON_SIZE.sm} /> รีเฟรช
        </button>
      </div>

      <section className="member-panel card-surface" style={{ padding: 16 }}>
        <div className="form-grid">
          <label>
            วันที่เริ่มต้น
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label>
            วันที่สิ้นสุด
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
        </div>
      </section>

      {isLoading ? (
        <div className="state-panel">
          <RotateCw size={ICON_SIZE["2xl"]} />
          <p>กำลังโหลดรายงาน...</p>
        </div>
      ) : error ? (
        <div className="state-panel error-panel">
          <AlertCircle size={ICON_SIZE["2xl"]} />
          <h3>โหลดรายงานไม่สำเร็จ</h3>
          <p>{error}</p>
          <button className="retry-button" onClick={loadSummary}>
            ลองใหม่
          </button>
        </div>
      ) : summary ? (
        <div className="ministry-grid" style={{ padding: "16px 0" }}>
          <div className="entity-card">
            <h3><Users size={ICON_SIZE.sm} /> สมาชิก</h3>
            <p>ทั้งหมด {summary.members.total} คน</p>
            <p>เข้าร่วมใหม่ในช่วงนี้ {summary.members.newInRange} คน</p>
          </div>
          <div className="entity-card">
            <h3><FileBarChart size={ICON_SIZE.sm} /> กลุ่มแคร์</h3>
            <p>ทั้งหมด {summary.groups.total} กลุ่ม</p>
          </div>
          <div className="entity-card">
            <h3><CalendarDays size={ICON_SIZE.sm} /> การเข้าร่วม</h3>
            <p>บันทึกทั้งหมด {summary.attendance.total} รายการ</p>
            <p>อัตราการมา {summary.attendance.attendanceRate}%</p>
          </div>
          <div className="entity-card">
            <h3><CalendarDays size={ICON_SIZE.sm} /> กิจกรรม</h3>
            <p>ทั้งหมด {summary.events.total} รายการ</p>
          </div>
        </div>
      ) : null}

      <section className="member-panel card-surface" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>ส่งออกข้อมูล (CSV)</h3>
        <div className="entity-actions">
          {EXPORTS.map((item) => (
            <button key={item.key} className="cancel-button" onClick={() => handleExport(item.key)}>
              <Download size={ICON_SIZE.sm} /> {item.label}
            </button>
          ))}
        </div>
      </section>
    </AppLayout>
  );
}
