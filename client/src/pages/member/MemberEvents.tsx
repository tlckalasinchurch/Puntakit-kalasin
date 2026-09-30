import { useEffect, useState } from "react";
import {
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  MapPin,
  Megaphone,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { MemberAppLayout } from "@/components/layout/MemberAppLayout";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { api, ApiError } from "@/lib/api";
import { ListSkeleton } from "@/components/LoadingStates";

interface EventItem {
  id: string;
  title: string;
  description: string | null;
  eventDate: string;
  location: string | null;
  category: string;
  status: string;
  isRegistered?: boolean;
}

interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  publishDate: string;
}

export default function MemberEvents() {
  const [tab, setTab] = useState<"events" | "announcements">("events");
  const [eventsList, setEventsList] = useState<EventItem[]>([]);
  const [announcementsList, setAnnouncementsList] = useState<AnnouncementItem[]>([]);
  const [myRegistrations, setMyRegistrations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [eventsRes, annRes, myRegRes] = await Promise.all([
        api.get<EventItem[]>("/api/events"),
        api.get<AnnouncementItem[]>("/api/announcements"),
        api.get<any[]>("/api/me/events/my").catch(() => []),
      ]);

      const registeredIds = (myRegRes || []).map((r: any) => r.eventId);
      setMyRegistrations(registeredIds);

      setEventsList(
        (eventsRes || []).map((e) => ({
          ...e,
          isRegistered: registeredIds.includes(e.id),
        }))
      );

      setAnnouncementsList(
        (annRes || []).filter((a: any) => a.status === "published" || !a.status)
      );
    } catch {
      toast.error("โหลดข้อมูลกิจกรรมและประกาศไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleRegistration = async (eventId: string, isRegistered: boolean) => {
    try {
      if (isRegistered) {
        await api.delete(`/api/me/events/${eventId}/register`);
        toast.success("ยกเลิกการลงทะเบียนแล้ว");
        setEventsList((prev) =>
          prev.map((e) => (e.id === eventId ? { ...e, isRegistered: false } : e))
        );
      } else {
        await api.post(`/api/me/events/${eventId}/register`, {});
        toast.success("ลงทะเบียนเข้าร่วมกิจกรรมเรียบร้อยแล้ว");
        setEventsList((prev) =>
          prev.map((e) => (e.id === eventId ? { ...e, isRegistered: true } : e))
        );
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "เกิดข้อผิดพลาด");
    }
  };

  return (
    <MemberAppLayout>
      <div>
        <h1 style={{ fontSize: "20px", color: "var(--ink)", margin: "0 0 4px", fontWeight: 800 }}>
          ข่าวสารและกิจกรรม
        </h1>
        <p style={{ fontSize: "12px", color: "var(--muted)", margin: 0 }}>
          ติดตามกิจกรรมการนมัสการ ประกาศสำคัญ และลงทะเบียนเข้าร่วม
        </p>
      </div>

      {/* Tab Switcher */}
      <div style={{ display: "flex", gap: "8px", background: "#eaf0f7", padding: "4px", borderRadius: "12px" }}>
        <button
          onClick={() => setTab("events")}
          style={{
            flex: 1,
            padding: "8px 12px",
            borderRadius: "10px",
            border: 0,
            background: tab === "events" ? "#fff" : "transparent",
            color: tab === "events" ? "var(--ink)" : "#657c94",
            fontWeight: tab === "events" ? 700 : 500,
            fontSize: "12px",
            boxShadow: tab === "events" ? "0 2px 6px rgba(35, 78, 120, 0.08)" : "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
          }}
        >
          <CalendarDays size={14} />
          <span>ปฏิทินกิจกรรม</span>
        </button>

        <button
          onClick={() => setTab("announcements")}
          style={{
            flex: 1,
            padding: "8px 12px",
            borderRadius: "10px",
            border: 0,
            background: tab === "announcements" ? "#fff" : "transparent",
            color: tab === "announcements" ? "var(--ink)" : "#657c94",
            fontWeight: tab === "announcements" ? 700 : 500,
            fontSize: "12px",
            boxShadow: tab === "announcements" ? "0 2px 6px rgba(35, 78, 120, 0.08)" : "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
          }}
        >
          <Megaphone size={14} />
          <span>ประกาศข่าวสาร</span>
        </button>
      </div>

      {loading ? (
        <ListSkeleton count={3} />
      ) : tab === "events" ? (
        /* Events List */
        eventsList.length === 0 ? (
          <div className="state-panel">
            <Calendar size={ICON_SIZE.lg} />
            <h3>ยังไม่มีกิจกรรมที่เปิดรับลงทะเบียน</h3>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {eventsList.map((evt) => (
              <div
                key={evt.id}
                className="card-surface"
                style={{
                  padding: "16px",
                  borderRadius: "18px",
                  border: "1px solid #e2edf6",
                  boxShadow: "0 4px 14px rgba(25, 62, 110, 0.05)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                  <span className="role-chip blue" style={{ fontSize: "10px" }}>
                    {evt.category === "worship"
                      ? "การนมัสการ"
                      : evt.category === "activity"
                      ? "กิจกรรมพิเศษ"
                      : evt.category === "meeting"
                      ? "การประชุม"
                      : "กิจกรรม"}
                  </span>
                  {evt.isRegistered && (
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        fontSize: "11px",
                        color: "#16865d",
                        background: "#e3f8ee",
                        padding: "3px 8px",
                        borderRadius: "8px",
                        fontWeight: 700,
                      }}
                    >
                      <CheckCircle2 size={12} /> ลงทะเบียนแล้ว
                    </span>
                  )}
                </div>

                <h3 style={{ margin: "0 0 6px", fontSize: "16px", color: "var(--ink)", fontWeight: 700 }}>
                  {evt.title}
                </h3>

                {evt.description && (
                  <p style={{ margin: "0 0 12px", fontSize: "12px", color: "var(--muted)", lineHeight: 1.5 }}>
                    {evt.description}
                  </p>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", color: "#546b82", marginBottom: "14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Clock size={13} style={{ color: "#315c2b" }} />
                    <span>{new Date(evt.eventDate).toLocaleString("th-TH", { dateStyle: "long", timeStyle: "short" })}</span>
                  </div>
                  {evt.location && (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <MapPin size={13} style={{ color: "#e35b78" }} />
                      <span>{evt.location}</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleToggleRegistration(evt.id, Boolean(evt.isRegistered))}
                  style={{
                    width: "100%",
                    height: "38px",
                    borderRadius: "12px",
                    border: evt.isRegistered ? "1px solid #d4e8dd" : 0,
                    background: evt.isRegistered ? "#f4fcf7" : "#315c2b",
                    color: evt.isRegistered ? "#c23b4d" : "#fff",
                    fontWeight: 700,
                    fontSize: "12px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                  }}
                >
                  {evt.isRegistered ? "ยกเลิกการลงทะเบียน" : "ลงทะเบียนเข้าร่วมกิจกรรมนี้"}
                </button>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Announcements List */
        announcementsList.length === 0 ? (
          <div className="state-panel">
            <Megaphone size={ICON_SIZE.lg} />
            <h3>ไม่มีประกาศใหม่ในขณะนี้</h3>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {announcementsList.map((ann) => (
              <div
                key={ann.id}
                className="card-surface"
                style={{
                  padding: "16px",
                  borderRadius: "18px",
                  border: "1px solid #e2edf6",
                  boxShadow: "0 4px 14px rgba(25, 62, 110, 0.05)",
                }}
              >
                <div style={{ fontSize: "10px", color: "#8a9cb0", marginBottom: "4px" }}>
                  {new Date(ann.publishDate).toLocaleDateString("th-TH", { dateStyle: "long" })}
                </div>
                <h3 style={{ margin: "0 0 8px", fontSize: "15px", color: "var(--ink)", fontWeight: 700 }}>
                  {ann.title}
                </h3>
                <p style={{ margin: 0, fontSize: "12px", color: "#4f657d", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                  {ann.content}
                </p>
              </div>
            ))}
          </div>
        )
      )}
    </MemberAppLayout>
  );
}
