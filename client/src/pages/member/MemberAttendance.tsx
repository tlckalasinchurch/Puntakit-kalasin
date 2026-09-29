import { useEffect, useState, useMemo } from "react";
import {
  CalendarCheck2,
  QrCode,
  Globe,
  Clock,
  Award,
  RefreshCw,
  CheckCircle2,
  CalendarDays,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { MemberAppLayout } from "@/components/layout/MemberAppLayout";
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

export default function MemberAttendance() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");

  const fetchAttendance = async () => {
    try {
      const res = await api.get<AttendanceRecord[]>("/api/me/attendance");
      setRecords(res);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "โหลดประวัติการเข้าร่วมไม่สำเร็จ");
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
    fetchAttendance();
  };

  const attendedCount = useMemo(() => {
    return records.filter((r) => r.status === "present" || r.status === "online").length;
  }, [records]);

  const filteredRecords = useMemo(() => {
    if (filterType === "all") return records;
    if (filterType === "sunday") return records.filter((r) => r.serviceType === "sunday_service");
    if (filterType === "care") return records.filter((r) => r.serviceType === "cell_group" || r.groupName !== null);
    return records.filter((r) => r.serviceType !== "sunday_service" && r.serviceType !== "cell_group");
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
        return "กลุ่มแคร์";
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
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300">
            <CheckCircle2 size={12} />
            <span>เข้าร่วมแล้ว</span>
          </span>
        );
      case "online":
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            <Globe size={12} />
            <span>ออนไลน์</span>
          </span>
        );
      case "leave":
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            <Clock size={12} />
            <span>ลากิจ/ป่วย</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            <span>ขาด</span>
          </span>
        );
    }
  };

  const getMethodBadge = (method: string) => {
    switch (method) {
      case "qr_self":
        return (
          <span className="inline-flex items-center space-x-1 text-[11px] text-gray-500 dark:text-gray-400">
            <QrCode size={11} />
            <span>สแกน QR Code</span>
          </span>
        );
      case "officer_scan":
        return (
          <span className="inline-flex items-center space-x-1 text-[11px] text-gray-500 dark:text-gray-400">
            <CheckCircle2 size={11} />
            <span>เจ้าหน้าที่เช็กชื่อ</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <MemberAppLayout title="ประวัติการเข้าร่วม">
      <div className="space-y-4">
        {/* Attendance Banner & Stats */}
        <div className="bg-gradient-to-r from-[var(--color-dark-surface-2)] to-[var(--color-dark-surface)] rounded-2xl p-5 text-white shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-xs">
                <CalendarCheck2 size={ICON_SIZE.md} className="text-amber-300" />
              </div>
              <div>
                <h2 className="text-lg font-bold">บันทึกการนมัสการ</h2>
                <p className="text-xs text-blue-100">ความสัตย์ซื่อในการร่วมสามัคคีธรรม</p>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw
                size={ICON_SIZE.sm}
                className={refreshing ? "animate-spin" : ""}
              />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/10">
            <div className="bg-white/10 rounded-xl p-3 backdrop-blur-xs">
              <p className="text-xs text-blue-200">เข้าร่วมทั้งหมด</p>
              <div className="flex items-baseline space-x-1 mt-1">
                <span className="text-2xl font-black">{attendedCount}</span>
                <span className="text-xs text-blue-200">ครั้ง</span>
              </div>
            </div>
            <div className="bg-white/10 rounded-xl p-3 backdrop-blur-xs">
              <p className="text-xs text-blue-200">สถานะความสม่ำเสมอ</p>
              <div className="flex items-center space-x-1 mt-1">
                <Sparkles size={14} className="text-amber-300" />
                <span className="text-sm font-semibold">
                  {attendedCount >= 8 ? "สัตย์ซื่อสม่ำเสมอ" : attendedCount > 0 ? "เข้าร่วมต่อเนื่อง" : "เริ่มต้นนมัสการ"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex space-x-2 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setFilterType("all")}
            className={`px-3 py-2 rounded-xl font-medium transition-colors shrink-0 ${
              filterType === "all"
                ? "bg-[var(--color-dark-surface)] text-white"
                : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
            }`}
          >
            ทั้งหมด ({records.length})
          </button>
          <button
            onClick={() => setFilterType("sunday")}
            className={`px-3 py-2 rounded-xl font-medium transition-colors shrink-0 ${
              filterType === "sunday"
                ? "bg-[var(--color-dark-surface)] text-white"
                : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
            }`}
          >
            นมัสการวันอาทิตย์
          </button>
          <button
            onClick={() => setFilterType("care")}
            className={`px-3 py-2 rounded-xl font-medium transition-colors shrink-0 ${
              filterType === "care"
                ? "bg-[var(--color-dark-surface)] text-white"
                : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
            }`}
          >
            กลุ่มแคร์
          </button>
        </div>

        {/* Loading state */}
        {loading && <ListSkeleton count={3} />}

        {/* Empty state */}
        {!loading && filteredRecords.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center border border-gray-100 dark:border-gray-700 shadow-xs space-y-3">
            <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mx-auto text-[var(--color-primary)] dark:text-blue-400">
              <CalendarDays size={ICON_SIZE.lg} />
            </div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              ไม่พบประวัติการเข้าร่วม
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
              เมื่อคุณมานมัสการหรือเข้าร่วมกลุ่มแคร์ เจ้าหน้าที่จะบันทึกหรือคุณสามารถใช้บัตร QR Code เช็กชื่อได้
            </p>
          </div>
        )}

        {/* Timeline List */}
        {!loading && filteredRecords.length > 0 && (
          <div className="space-y-3">
            {filteredRecords.map((r) => (
              <div
                key={r.id}
                className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-xs space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      {getServiceTypeLabel(r.serviceType)}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {formatThaiDate(r.date)}
                    </p>
                  </div>
                  {getStatusBadge(r.status)}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-50 dark:border-gray-700/50 text-xs">
                  {r.groupName ? (
                    <span className="text-gray-500 dark:text-gray-400">
                      กลุ่ม: {r.groupName}
                    </span>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500">
                      คริสตจักรพันธกิจกาฬสินธุ์
                    </span>
                  )}
                  {getMethodBadge(r.checkInMethod)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MemberAppLayout>
  );
}
