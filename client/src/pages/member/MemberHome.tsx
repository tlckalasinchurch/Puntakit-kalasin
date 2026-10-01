import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import QRCode from "qrcode";
import {
  Bell,
  Calendar,
  ChevronRight,
  HeartHandshake,
  MapPin,
  Megaphone,
  QrCode,
  Sparkles,
  UserCheck,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { MemberAppLayout } from "@/components/layout/MemberAppLayout";
import { PrayerRequestModal } from "@/components/PrayerRequestModal";
import { ListSkeleton } from "@/components/LoadingStates";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { api, ApiError } from "@/lib/api";
import { subscribeToPushNotifications } from "@/lib/pwa";
import { MEMBERSHIP_STATUS_LABELS } from "@shared/labels";
import type { MembershipStatus } from "@shared/schema";

interface PortalData {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  member: {
    id: string;
    name: string;
    nickname: string | null;
    avatarUrl: string | null;
    phone: string | null;
    email: string | null;
    membershipStatus: string;
    qrToken: string;
  } | null;
  careGroup: {
    groupId?: string;
    id?: string;
    name: string;
    category: string;
    meetingDay: string | null;
    meetingTime: string | null;
    meetingLocation: string | null;
    leaderName: string | null;
  } | null;
  recentAnnouncements: {
    id: string;
    title: string;
    content: string;
    publishDate: string;
  }[];
  upcomingEvents: {
    id: string;
    title: string;
    description: string | null;
    eventDate: string;
    location: string | null;
    category: string;
    isRegistered: boolean;
  }[];
  attendanceStats: {
    totalAttended: number;
    lastAttended: string | null;
  };
}

export default function MemberHome() {
  const [, navigate] = useLocation();
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [prayerModalOpen, setPrayerModalOpen] = useState(false);
  const [subscribingPush, setSubscribingPush] = useState(false);

  const fetchPortalData = async () => {
    try {
      const res = await api.get<PortalData>("/api/me/portal");
      setData(res);

      if (res.member?.qrToken) {
        QRCode.toDataURL(res.member.qrToken, {
          width: 180,
          margin: 1,
          color: { dark: "#272729", light: "#ffffff" },
        }).then(setQrDataUrl);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "โหลดข้อมูลสมาชิกไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortalData();
  }, []);

  const handleRegisterEvent = async (eventId: string, isRegistered: boolean) => {
    try {
      if (isRegistered) {
        await api.delete(`/api/me/events/${eventId}/register`);
        toast.success("ยกเลิกการลงทะเบียนกิจกรรมแล้ว");
      } else {
        await api.post(`/api/me/events/${eventId}/register`, {});
        toast.success("ลงทะเบียนเข้าร่วมกิจกรรมเรียบร้อยแล้ว");
      }
      fetchPortalData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ดำเนินการไม่สำเร็จ");
    }
  };

  const handleEnablePush = async () => {
    setSubscribingPush(true);
    try {
      const ok = await subscribeToPushNotifications();
      if (ok) {
        toast.success("เปิดรับการแจ้งเตือน Push Notification เรียบร้อยแล้ว!");
      } else {
        toast.error("ไม่สามารถเปิดการแจ้งเตือนได้ กรุณาอนุญาตการแจ้งเตือนในเบราว์เซอร์");
      }
    } catch {
      toast.error("เกิดข้อผิดพลาดในการเปิดแจ้งเตือน");
    } finally {
      setSubscribingPush(false);
    }
  };

  if (loading) {
    return (
      <MemberAppLayout>
        <div className="space-y-4">
          <ListSkeleton count={3} />
        </div>
      </MemberAppLayout>
    );
  }

  const member = data?.member;
  const user = data?.user;

  return (
    <MemberAppLayout>
      {/* Greeting Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#f1a73b", letterSpacing: "1px" }}>
            PUNTAKIT MEMBER
          </span>
          <h1 style={{ fontSize: "21px", margin: "2px 0 0", color: "var(--ink)", fontWeight: 800 }}>
            สวัสดี, {member?.nickname ? `คุณ${member.nickname}` : user?.name || "สมาชิก"}
          </h1>
        </div>
        <button
          onClick={handleEnablePush}
          disabled={subscribingPush}
          title="เปิดรับการแจ้งเตือน"
          style={{
            width: "38px",
            height: "38px",
            borderRadius: "12px",
            background: "#fff",
            border: "1px solid #dbe6f0",
            display: "grid",
            placeItems: "center",
            color: "#315c2b",
            boxShadow: "0 2px 8px rgba(35, 78, 120, 0.05)",
            cursor: "pointer",
          }}
        >
          <Bell size={18} />
        </button>
      </div>

      {/* Personal Member QR Code Card (Digital ID) */}
      <div
        style={{
          background: "linear-gradient(145deg, #2a2a2c 0%, #272729 100%)",
          borderRadius: "20px",
          padding: "20px",
          color: "white",
          boxShadow: "0 10px 25px rgba(23, 59, 112, 0.22)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <div>
            <div style={{ fontSize: "10px", color: "#dbe8fc", letterSpacing: "2px", fontWeight: 700 }}>
              CHURCH MEMBER PASS
            </div>
            <strong style={{ fontSize: "17px", display: "block", marginTop: "2px" }}>
              {member?.name || user?.name}
            </strong>
          </div>
          <span
            style={{
              fontSize: "10px",
              padding: "4px 8px",
              borderRadius: "8px",
              background: "rgba(255, 255, 255, 0.15)",
              color: "#eef5ff",
              fontWeight: 600,
            }}
          >
            {member ?
              MEMBERSHIP_STATUS_LABELS[member.membershipStatus as MembershipStatus] ??
              member.membershipStatus
              : "-"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              background: "white",
              padding: "8px",
              borderRadius: "14px",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Member QR Code" style={{ width: "100px", height: "100px", display: "block" }} />
            ) : (
              <div style={{ width: "100px", height: "100px", display: "grid", placeItems: "center" }}>
                <QrCode size={40} style={{ color: "#272729" }} />
              </div>
            )}
          </div>

          <div style={{ fontSize: "11px", color: "#d4e4f7", lineHeight: 1.6 }}>
            <p style={{ margin: 0 }}>
              ยื่น QR Code นี้ที่จุดลงทะเบียนหน้าประตูโบสถ์ เพื่อเช็คชื่อเข้าร่วมนมัสการอย่างรวดเร็ว
            </p>
            <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "5px", color: "#ffe66d", fontWeight: 700 }}>
              <UserCheck size={14} />
              <span>เข้าโบสถ์แล้ว {data?.attendanceStats?.totalAttended || 0} ครั้ง</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        <button
          onClick={() => setPrayerModalOpen(true)}
          style={{
            background: "#fff",
            border: "1px solid #e1ebf5",
            borderRadius: "16px",
            padding: "14px",
            textAlign: "left",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            boxShadow: "0 4px 12px rgba(35, 78, 120, 0.04)",
            cursor: "pointer",
          }}
        >
          <div
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "12px",
              background: "#f1eaff",
              color: "#7950d8",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            <HeartHandshake size={20} />
          </div>
          <div>
            <strong style={{ display: "block", fontSize: "12px", color: "var(--ink)" }}>ขอคำอธิษฐาน</strong>
            <small style={{ fontSize: "10px", color: "var(--muted)" }}>ส่งเรื่องให้ทีมศิษยาภิบาล</small>
          </div>
        </button>

        <button
          onClick={() => navigate("/app/group")}
          style={{
            background: "#fff",
            border: "1px solid #e1ebf5",
            borderRadius: "16px",
            padding: "14px",
            textAlign: "left",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            boxShadow: "0 4px 12px rgba(35, 78, 120, 0.04)",
            cursor: "pointer",
          }}
        >
          <div
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "12px",
              background: "#e5f8ee",
              color: "#18855b",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            <UsersRound size={20} />
          </div>
          <div>
            <strong style={{ display: "block", fontSize: "12px", color: "var(--ink)" }}>กลุ่มแคร์ของฉัน</strong>
            <small style={{ fontSize: "10px", color: "var(--muted)" }}>นัดพบ & เพื่อนในกลุ่ม</small>
          </div>
        </button>
      </div>

      {/* My Care Group Banner */}
      {data?.careGroup && (
        <div
          onClick={() => navigate("/app/group")}
          style={{
            background: "#fff",
            border: "1px solid #e1ebf5",
            borderRadius: "16px",
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 4px 12px rgba(35, 78, 120, 0.04)",
            cursor: "pointer",
          }}
        >
          <div>
            <div style={{ fontSize: "10px", fontWeight: 700, color: "#315c2b" }}>กลุ่มแคร์ประจำตัว</div>
            <strong style={{ fontSize: "14px", color: "var(--ink)" }}>{data.careGroup.name}</strong>
            <div style={{ fontSize: "11px", color: "#61778e", marginTop: "2px" }}>
              {data.careGroup.meetingDay} {data.careGroup.meetingTime || ""}
            </div>
          </div>
          <ChevronRight size={18} style={{ color: "#8a9cb0" }} />
        </div>
      )}

      {/* Recent Announcements */}
      {data?.recentAnnouncements && data.recentAnnouncements.length > 0 && (
        <div style={{ background: "#fff", borderRadius: "18px", padding: "16px", border: "1px solid #e1ebf5" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Megaphone size={16} style={{ color: "#e35b78" }} />
              <strong style={{ fontSize: "14px", color: "var(--ink)" }}>ประกาศจากคริสตจักร</strong>
            </div>
            <button
              onClick={() => navigate("/app/events")}
              style={{ background: "none", border: 0, color: "#315c2b", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}
            >
              ดูทั้งหมด
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {data.recentAnnouncements.map((ann) => (
              <div
                key={ann.id}
                style={{
                  padding: "10px 12px",
                  borderRadius: "12px",
                  background: "#f9fbfe",
                  border: "1px solid #edf3f8",
                }}
              >
                <strong style={{ display: "block", fontSize: "12px", color: "var(--ink)" }}>
                  {ann.title}
                </strong>
                <p style={{ margin: "3px 0 0", fontSize: "11px", color: "#6b7d92", lineHeight: 1.4 }}>
                  {ann.content.slice(0, 85)}...
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Events */}
      {data?.upcomingEvents && data.upcomingEvents.length > 0 && (
        <div style={{ background: "#fff", borderRadius: "18px", padding: "16px", border: "1px solid #e1ebf5" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Calendar size={16} style={{ color: "#315c2b" }} />
              <strong style={{ fontSize: "14px", color: "var(--ink)" }}>กิจกรรมที่กำลังจะมาถึง</strong>
            </div>
            <button
              onClick={() => navigate("/app/events")}
              style={{ background: "none", border: 0, color: "#315c2b", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}
            >
              ดูทั้งหมด
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {data.upcomingEvents.map((evt) => (
              <div
                key={evt.id}
                style={{
                  padding: "12px",
                  borderRadius: "14px",
                  background: "#f8fafd",
                  border: "1px solid #e5edf5",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <div>
                  <strong style={{ display: "block", fontSize: "13px", color: "var(--ink)" }}>
                    {evt.title}
                  </strong>
                  <div style={{ fontSize: "11px", color: "#6c8095", marginTop: "2px" }}>
                    📅 {new Date(evt.eventDate).toLocaleDateString("th-TH")}
                    {evt.location ? ` • ${evt.location}` : ""}
                  </div>
                </div>

                <button
                  onClick={() => handleRegisterEvent(evt.id, evt.isRegistered)}
                  style={{
                    background: evt.isRegistered ? "#e3f8ee" : "#315c2b",
                    color: evt.isRegistered ? "#16865d" : "#fff",
                    border: 0,
                    borderRadius: "10px",
                    padding: "7px 12px",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  {evt.isRegistered ? "ลงชื่อแล้ว ✓" : "ลงทะเบียน"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prayer Modal */}
      <PrayerRequestModal
        open={prayerModalOpen}
        onClose={() => setPrayerModalOpen(false)}
        onSuccess={() => {}}
      />
    </MemberAppLayout>
  );
}
