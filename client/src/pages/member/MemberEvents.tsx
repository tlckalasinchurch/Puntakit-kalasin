import { useEffect, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  MapPin,
  Megaphone,
} from "lucide-react";
import { toast } from "sonner";
import { MemberAppLayout } from "@/components/layout/MemberAppLayout";
import { EmptyState, ErrorState, StatusChip } from "@/components/DesignSystem";
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

type MemberTab = "events" | "announcements";

/** The API may omit `status`; the list contract is unchanged. */
type AnnouncementWithStatus = AnnouncementItem & { status?: string | null };

const TABS: { id: MemberTab; label: string; icon: typeof CalendarDays }[] = [
  { id: "events", label: "ปฏิทินกิจกรรม", icon: CalendarDays },
  { id: "announcements", label: "ประกาศข่าวสาร", icon: Megaphone },
];

export default function MemberEvents() {
  const [tab, setTab] = useState<MemberTab>("events");
  const [eventsList, setEventsList] = useState<EventItem[]>([]);
  const [announcementsList, setAnnouncementsList] = useState<
    AnnouncementItem[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [eventsRes, annRes, myRegRes] = await Promise.all([
        api.get<EventItem[]>("/api/events"),
        api.get<AnnouncementItem[]>("/api/announcements"),
        api.get<{ eventId: string }[]>("/api/me/events/my").catch(() => []),
      ]);

      const registeredIds = (myRegRes || []).map(r => r.eventId);

      setEventsList(
        (eventsRes || []).map(e => ({
          ...e,
          isRegistered: registeredIds.includes(e.id),
        }))
      );

      setAnnouncementsList(
        ((annRes as AnnouncementWithStatus[] | undefined) ?? []).filter(
          a => a.status === "published" || !a.status
        )
      );
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "โหลดข้อมูลกิจกรรมและประกาศไม่สำเร็จ"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleRegistration = async (
    eventId: string,
    isRegistered: boolean
  ) => {
    try {
      if (isRegistered) {
        await api.delete(`/api/me/events/${eventId}/register`);
        toast.success("ยกเลิกการลงทะเบียนแล้ว");
        setEventsList(prev =>
          prev.map(e => (e.id === eventId ? { ...e, isRegistered: false } : e))
        );
      } else {
        await api.post(`/api/me/events/${eventId}/register`, {});
        toast.success("ลงทะเบียนเข้าร่วมกิจกรรมเรียบร้อยแล้ว");
        setEventsList(prev =>
          prev.map(e => (e.id === eventId ? { ...e, isRegistered: true } : e))
        );
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "เกิดข้อผิดพลาด");
    }
  };

  const categoryLabel = (category: string) => {
    switch (category) {
      case "worship":
        return "การนมัสการ";
      case "activity":
        return "กิจกรรมพิเศษ";
      case "meeting":
        return "การประชุม";
      default:
        return "กิจกรรม";
    }
  };

  return (
    <MemberAppLayout title="ข่าวสารและกิจกรรม">
      <header>
        <h1 className="type-lead font-semibold text-[var(--color-ink)]">
          ข่าวสารและกิจกรรม
        </h1>
        <p className="type-caption mt-1 text-[var(--color-body-muted)]">
          ติดตามกำหนดการนมัสการ ประกาศสำคัญ และลงทะเบียนเข้าร่วมกิจกรรม
        </p>
      </header>

      {/* Tab switcher */}
      <div
        role="tablist"
        aria-label="เลือกดูปฏิทินกิจกรรมหรือประกาศข่าวสาร"
        className="flex gap-1 rounded-[var(--radius-md)] bg-[var(--color-canvas-soft)] p-1"
      >
        {TABS.map(item => {
          const Icon = item.icon;
          const isActive = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`member-tab-${item.id}`}
              aria-selected={isActive}
              aria-controls={`member-panel-${item.id}`}
              onClick={() => setTab(item.id)}
              className={`type-caption-strong inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border px-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] motion-reduce:transition-none ${
                isActive
                  ? "border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]"
                  : "border-transparent text-[var(--color-body-muted)] hover:text-[var(--color-ink)]"
              }`}
            >
              <Icon size={ICON_SIZE.sm} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {loading && <ListSkeleton count={3} />}

      {!loading && error && (
        <ErrorState
          title="โหลดข้อมูลกิจกรรมและประกาศไม่สำเร็จ"
          description="ระบบยังเชื่อมต่อข้อมูลไม่ได้ในขณะนี้ กรุณาลองอีกครั้ง"
          technical={error}
          retryLabel="ลองอีกครั้ง"
          onRetry={() => void fetchData()}
        />
      )}

      {!loading && !error && (
        <div
          role="tabpanel"
          id={`member-panel-${tab}`}
          aria-labelledby={`member-tab-${tab}`}
          className="flex flex-col gap-3"
        >
          {tab === "events" &&
            (eventsList.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="ยังไม่มีกิจกรรมที่เปิดรับลงทะเบียน"
                description="เมื่อคริสตจักรเปิดรับลงทะเบียนกิจกรรม จะแสดงไว้ที่นี่"
                action={{
                  label: "ดูประกาศข่าวสาร",
                  onClick: () => setTab("announcements"),
                }}
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {eventsList.map(evt => (
                  <li
                    key={evt.id}
                    className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="type-fine inline-flex items-center rounded-[var(--radius-xs)] bg-[var(--color-canvas-soft)] px-2 py-1 font-semibold text-[var(--color-text-secondary)]">
                        {categoryLabel(evt.category)}
                      </span>
                      {evt.isRegistered && (
                        <StatusChip tone="success" className="gap-1.5">
                          <CheckCircle2
                            size={ICON_SIZE.xs}
                            aria-hidden="true"
                          />
                          ลงทะเบียนแล้ว
                        </StatusChip>
                      )}
                    </div>

                    <h2 className="type-body-strong mt-2 text-[var(--color-ink)]">
                      {evt.title}
                    </h2>

                    {evt.description && (
                      <p className="type-caption mt-2 text-[var(--color-body-muted)]">
                        {evt.description}
                      </p>
                    )}

                    <div className="type-fine mt-3 flex flex-col gap-1.5 text-[var(--color-body-muted)]">
                      <span className="flex items-center gap-1.5">
                        <Clock
                          size={ICON_SIZE.xs}
                          aria-hidden="true"
                          className="shrink-0 text-[var(--color-primary)]"
                        />
                        <span>
                          {new Date(evt.eventDate).toLocaleString("th-TH", {
                            dateStyle: "long",
                            timeStyle: "short",
                          })}
                        </span>
                      </span>
                      {evt.location && (
                        <span className="flex items-center gap-1.5">
                          <MapPin
                            size={ICON_SIZE.xs}
                            aria-hidden="true"
                            className="shrink-0 text-[var(--color-primary)]"
                          />
                          <span>{evt.location}</span>
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        handleToggleRegistration(
                          evt.id,
                          Boolean(evt.isRegistered)
                        )
                      }
                      className={`type-caption-strong mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] motion-reduce:transition-none ${
                        evt.isRegistered
                          ? "border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-error)] hover:bg-[var(--color-canvas-soft)]"
                          : "bg-[var(--color-primary)] text-[var(--color-on-dark)] hover:bg-[var(--color-primary-focus)]"
                      }`}
                    >
                      {evt.isRegistered ? (
                        <>
                          <CheckCircle2
                            size={ICON_SIZE.sm}
                            aria-hidden="true"
                          />
                          <span>ยกเลิกการลงทะเบียน</span>
                        </>
                      ) : (
                        <span>ลงทะเบียนเข้าร่วมกิจกรรมนี้</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            ))}

          {tab === "announcements" &&
            (announcementsList.length === 0 ? (
              <EmptyState
                icon={Megaphone}
                title="ยังไม่มีประกาศใหม่ในขณะนี้"
                description="ประกาศจากคริสตจักรจะแสดงไว้ที่นี่เมื่อมีการเผยแพร่"
                action={{
                  label: "ดูปฏิทินกิจกรรม",
                  onClick: () => setTab("events"),
                }}
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {announcementsList.map(ann => (
                  <li
                    key={ann.id}
                    className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-4"
                  >
                    <p className="type-fine text-[var(--color-body-muted)]">
                      {new Date(ann.publishDate).toLocaleDateString("th-TH", {
                        dateStyle: "long",
                      })}
                    </p>
                    <h2 className="type-body-strong mt-1 text-[var(--color-ink)]">
                      {ann.title}
                    </h2>
                    <p className="type-caption mt-2 whitespace-pre-wrap text-[var(--color-text-secondary)]">
                      {ann.content}
                    </p>
                  </li>
                ))}
              </ul>
            ))}
        </div>
      )}
    </MemberAppLayout>
  );
}
