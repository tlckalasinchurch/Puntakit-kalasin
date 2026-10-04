import { useEffect, useState } from "react";
import { Link } from "wouter";
import QRCode from "qrcode";
import {
  Bell,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  HeartHandshake,
  Megaphone,
  QrCode,
  UserCheck,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { MemberAppLayout } from "@/components/layout/MemberAppLayout";
import { PrayerRequestModal } from "@/components/PrayerRequestModal";
import { ListSkeleton } from "@/components/LoadingStates";
import { EmptyState, ErrorState } from "@/components/DesignSystem";
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
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [prayerModalOpen, setPrayerModalOpen] = useState(false);
  const [subscribingPush, setSubscribingPush] = useState(false);

  const fetchPortalData = async () => {
    setError(null);
    try {
      const res = await api.get<PortalData>("/api/me/portal");
      setData(res);

      if (res.member?.qrToken) {
        // The QR canvas needs a literal colour; this is --color-dark-surface.
        QRCode.toDataURL(res.member.qrToken, {
          width: 180,
          margin: 1,
          color: { dark: "#272729", light: "#ffffff" },
        }).then(setQrDataUrl);
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "โหลดข้อมูลสมาชิกไม่สำเร็จ"
      );
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
        toast.success("เปิดรับการแจ้งเตือนของคริสตจักรเรียบร้อยแล้ว");
      } else {
        toast.error(
          "ไม่สามารถเปิดการแจ้งเตือนได้ กรุณาอนุญาตการแจ้งเตือนในเบราว์เซอร์"
        );
      }
    } catch {
      toast.error("เกิดข้อผิดพลาดในการเปิดการแจ้งเตือน");
    } finally {
      setSubscribingPush(false);
    }
  };

  if (loading) {
    return (
      <MemberAppLayout>
        <ListSkeleton count={3} />
      </MemberAppLayout>
    );
  }

  if (error) {
    return (
      <MemberAppLayout>
        <ErrorState
          title="โหลดข้อมูลสมาชิกไม่สำเร็จ"
          description="ระบบยังเชื่อมต่อข้อมูลของคุณไม่ได้ในขณะนี้ กรุณาลองอีกครั้ง"
          technical={error}
          retryLabel="ลองอีกครั้ง"
          onRetry={() => {
            setLoading(true);
            void fetchPortalData();
          }}
        />
      </MemberAppLayout>
    );
  }

  const member = data?.member;
  const user = data?.user;
  const announcements = data?.recentAnnouncements ?? [];
  const events = data?.upcomingEvents ?? [];
  const attendanceCount = data?.attendanceStats?.totalAttended ?? 0;
  const greetingName = member?.nickname
    ? `คุณ${member.nickname}`
    : user?.name || "สมาชิก";
  const membershipLabel = member
    ? MEMBERSHIP_STATUS_LABELS[
        member.membershipStatus as MembershipStatus
      ] ?? member.membershipStatus
    : "สมาชิก";
  const careGroupSchedule = [
    data?.careGroup?.meetingDay,
    data?.careGroup?.meetingTime,
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <MemberAppLayout>
      {/* Greeting */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="type-lead font-semibold text-[var(--color-ink)]">
            สวัสดี, {greetingName}
          </h1>
          <p className="type-caption mt-1 text-[var(--color-body-muted)]">
            ขอบคุณที่ร่วมนมัสการกับคริสตจักรชีวิตสุขสันต์กาฬสินธุ์
          </p>
        </div>
        <button
          type="button"
          onClick={handleEnablePush}
          disabled={subscribingPush}
          aria-label="เปิดรับการแจ้งเตือนบนเครื่องนี้"
          title="เปิดรับการแจ้งเตือน"
          className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-primary)] transition-colors hover:bg-[var(--color-accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50 motion-reduce:transition-none"
        >
          <Bell size={ICON_SIZE.md} aria-hidden="true" />
        </button>
      </header>

      {/* Digital member pass */}
      <section
        aria-labelledby="member-pass-heading"
        className="rounded-[var(--radius-lg)] bg-gradient-to-br from-[var(--color-dark-surface-2)] to-[var(--color-dark-surface)] p-4 text-[var(--color-on-dark)] shadow-[var(--shadow)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p
              id="member-pass-heading"
              className="type-fine font-semibold tracking-wide text-[var(--color-primary-on-dark)]"
            >
              บัตรสมาชิกคริสตจักร
            </p>
            <p className="type-body-strong mt-1 truncate">
              {member?.name || user?.name}
            </p>
          </div>
          <span className="type-fine shrink-0 rounded-[var(--radius-sm)] bg-[var(--color-on-dark)]/15 px-2 py-1 font-semibold">
            {membershipLabel}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="flex size-[108px] shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-canvas)] p-2">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="คิวอาร์โค้ดสำหรับเช็คชื่อของสมาชิก"
                className="block size-[92px]"
              />
            ) : (
              <QrCode
                size={ICON_SIZE["2xl"]}
                aria-hidden="true"
                className="text-[var(--color-dark-surface)]"
              />
            )}
          </div>

          <div className="min-w-0">
            <p className="type-fine text-[var(--color-on-dark-muted)]">
              ยื่นคิวอาร์โค้ดนี้ที่จุดลงทะเบียนหน้าประตูโบสถ์
              เพื่อเช็คชื่อเข้าร่วมนมัสการ
            </p>
            <p className="type-fine mt-2 flex items-center gap-1.5 font-semibold text-[var(--color-primary-on-dark)]">
              <UserCheck size={ICON_SIZE.sm} aria-hidden="true" />
              <span>เข้าโบสถ์แล้ว {attendanceCount} ครั้ง</span>
            </p>
          </div>
        </div>
      </section>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => setPrayerModalOpen(true)}
          className="flex min-h-[44px] items-center gap-2.5 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3 text-left transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] motion-reduce:transition-none"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent-soft)] text-[var(--color-primary)]">
            <HeartHandshake size={ICON_SIZE.lg} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="type-caption-strong block text-[var(--color-ink)]">
              ขอคำอธิษฐาน
            </span>
            <span className="type-fine block text-[var(--color-body-muted)]">
              ส่งถึงทีมศิษยาภิบาล
            </span>
          </span>
        </button>

        <Link
          href="/app/group"
          className="flex min-h-[44px] items-center gap-2.5 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3 transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] motion-reduce:transition-none"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent-soft)] text-[var(--color-primary)]">
            <UsersRound size={ICON_SIZE.lg} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="type-caption-strong block text-[var(--color-ink)]">
              กลุ่มแคร์ของฉัน
            </span>
            <span className="type-fine block text-[var(--color-body-muted)]">
              นัดพบและเพื่อนในกลุ่ม
            </span>
          </span>
        </Link>
      </div>

      {/* My care group, or an actionable empty state */}
      {data?.careGroup ? (
        <Link
          href="/app/group"
          className="flex min-h-[44px] items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-4 transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] motion-reduce:transition-none"
        >
          <span className="min-w-0">
            <span className="type-fine block font-semibold text-[var(--color-primary)]">
              กลุ่มแคร์ประจำตัว
            </span>
            <span className="type-body-strong block truncate text-[var(--color-ink)]">
              {data.careGroup.name}
            </span>
            <span className="type-fine block text-[var(--color-body-muted)]">
              {careGroupSchedule || "ยังไม่ระบุวันนัดหมาย"}
            </span>
          </span>
          <ChevronRight
            size={ICON_SIZE.md}
            aria-hidden="true"
            className="shrink-0 text-[var(--color-body-muted)]"
          />
        </Link>
      ) : (
        <EmptyState
          icon={UsersRound}
          title="คุณยังไม่มีกลุ่มแคร์"
          description="เมื่อคุณเข้าร่วมกลุ่มแคร์ วันนัดหมายและผู้นำกลุ่มจะแสดงไว้ที่นี่"
          action={{
            label: "ติดต่อฝ่ายต้อนรับคริสตจักร",
            href: "tel:043811800",
          }}
        />
      )}

      {/* Announcements */}
      <section
        aria-labelledby="member-announcements-heading"
        className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-4"
      >
        <div className="flex items-center justify-between gap-2">
          <h2
            id="member-announcements-heading"
            className="type-body-strong flex min-w-0 items-center gap-2 text-[var(--color-ink)]"
          >
            <Megaphone
              size={ICON_SIZE.sm}
              aria-hidden="true"
              className="shrink-0 text-[var(--color-primary)]"
            />
            <span className="truncate">ประกาศจากคริสตจักร</span>
          </h2>
          {announcements.length > 0 && (
            <Link
              href="/app/events"
              className="type-caption-strong inline-flex min-h-11 shrink-0 items-center rounded-[var(--radius-sm)] px-2 text-[var(--color-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
            >
              ดูทั้งหมด
            </Link>
          )}
        </div>

        {announcements.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-2">
            {announcements.map(ann => (
              <li
                key={ann.id}
                className="rounded-[var(--radius-md)] border border-[var(--color-divider)] bg-[var(--color-canvas-soft)] p-3"
              >
                <h3 className="type-caption-strong text-[var(--color-ink)]">
                  {ann.title}
                </h3>
                <p className="type-fine mt-1 line-clamp-2 text-[var(--color-body-muted)]">
                  {ann.content}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-2">
            <EmptyState
              inset
              icon={Megaphone}
              title="ยังไม่มีประกาศใหม่"
              description="เมื่อคริสตจักรมีประกาศข่าวสาร จะแสดงไว้ที่นี่"
              action={{
                label: "ดูกิจกรรมและประกาศทั้งหมด",
                href: "/app/events",
              }}
            />
          </div>
        )}
      </section>

      {/* Upcoming events */}
      <section
        aria-labelledby="member-events-heading"
        className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-4"
      >
        <div className="flex items-center justify-between gap-2">
          <h2
            id="member-events-heading"
            className="type-body-strong flex min-w-0 items-center gap-2 text-[var(--color-ink)]"
          >
            <Calendar
              size={ICON_SIZE.sm}
              aria-hidden="true"
              className="shrink-0 text-[var(--color-primary)]"
            />
            <span className="truncate">กิจกรรมที่กำลังจะมาถึง</span>
          </h2>
          {events.length > 0 && (
            <Link
              href="/app/events"
              className="type-caption-strong inline-flex min-h-11 shrink-0 items-center rounded-[var(--radius-sm)] px-2 text-[var(--color-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
            >
              ดูทั้งหมด
            </Link>
          )}
        </div>

        {events.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-2.5">
            {events.map(evt => (
              <li
                key={evt.id}
                className="rounded-[var(--radius-md)] border border-[var(--color-divider)] bg-[var(--color-canvas-soft)] p-3"
              >
                <h3 className="type-caption-strong text-[var(--color-ink)]">
                  {evt.title}
                </h3>
                <p className="type-fine mt-1 flex items-center gap-1.5 text-[var(--color-body-muted)]">
                  <CalendarDays
                    size={ICON_SIZE.xs}
                    aria-hidden="true"
                    className="shrink-0"
                  />
                  <span>
                    {new Date(evt.eventDate).toLocaleDateString("th-TH", {
                      dateStyle: "long",
                    })}
                    {evt.location ? ` • ${evt.location}` : ""}
                  </span>
                </p>
                <button
                  type="button"
                  onClick={() =>
                    handleRegisterEvent(evt.id, Boolean(evt.isRegistered))
                  }
                  className={`type-caption-strong mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] motion-reduce:transition-none ${
                    evt.isRegistered
                      ? "border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-error)] hover:bg-[var(--color-canvas-soft)]"
                      : "bg-[var(--color-primary)] text-[var(--color-on-dark)] hover:bg-[var(--color-primary-focus)]"
                  }`}
                >
                  {evt.isRegistered && (
                    <CheckCircle2 size={ICON_SIZE.sm} aria-hidden="true" />
                  )}
                  <span>
                    {evt.isRegistered
                      ? "ลงทะเบียนแล้ว • ยกเลิก"
                      : "ลงทะเบียนเข้าร่วม"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-2">
            <EmptyState
              inset
              icon={CalendarDays}
              title="ยังไม่มีกิจกรรมที่เปิดรับลงทะเบียน"
              description="เมื่อคริสตจักรเปิดรับลงทะเบียนกิจกรรม จะแสดงไว้ที่นี่"
              action={{
                label: "ดูประกาศและกิจกรรมทั้งหมด",
                href: "/app/events",
              }}
            />
          </div>
        )}
      </section>

      {/* Prayer request modal */}
      <PrayerRequestModal
        open={prayerModalOpen}
        onClose={() => setPrayerModalOpen(false)}
        onSuccess={() => {}}
      />
    </MemberAppLayout>
  );
}
