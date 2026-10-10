import { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  Bell,
  CheckCircle2,
  HeartHandshake,
  QrCode,
  UserCheck,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { MemberAppLayout } from "@/components/layout/MemberAppLayout";
import { PrayerRequestModal } from "@/components/PrayerRequestModal";
import { ListSkeleton } from "@/components/LoadingStates";
import { ErrorState } from "@/components/DesignSystem";
import {
  MemberListEmpty,
  MemberListItem,
  MemberListRow,
  MemberListSection,
} from "@/components/MemberList";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { api, ApiError } from "@/lib/api";
import { subscribeToPushNotifications } from "@/lib/pwa";
import { MEMBERSHIP_STATUS_LABELS } from "@shared/labels";
import type { MembershipStatus } from "@shared/schema";
import { usePageTitle } from "@/hooks/usePageTitle";

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
  usePageTitle("หน้าแรก");
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
  // The API returns events soonest-first, so this is the next one the member can
  // still register for. It alone gets the filled button; the rest are outlined.
  const nextRegistrableId = events.find(evt => !evt.isRegistered)?.id;
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
        <h1 className="type-lead min-w-0 font-semibold text-[var(--color-ink)]">
          สวัสดี, {greetingName}
        </h1>
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

      {/* Digital member pass — the one focal element of the page. */}
      <section
        aria-labelledby="member-pass-heading"
        className="rounded-[var(--radius-lg)] bg-[var(--color-dark-surface)] p-4 text-[var(--color-on-dark)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p
              id="member-pass-heading"
              className="type-caption-strong text-[var(--color-primary-on-dark)]"
            >
              บัตรสมาชิกคริสตจักร
            </p>
            <p className="type-body-strong mt-1 truncate">
              {member?.name || user?.name}
            </p>
          </div>
          <span className="type-caption-strong shrink-0 rounded-[var(--radius-sm)] bg-[var(--color-on-dark)]/15 px-2 py-1">
            {membershipLabel}
          </span>
        </div>

        <div className="mt-3 flex flex-col items-center gap-2 text-center">
          <div className="flex size-[140px] shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-canvas)] p-3">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="คิวอาร์โค้ดสำหรับเช็คชื่อของสมาชิก"
                className="block size-[116px]"
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
            <p className="type-caption text-[var(--color-on-dark-muted)]">
              ยื่นคิวอาร์โค้ดนี้ที่จุดลงทะเบียนหน้าประตูโบสถ์
              เพื่อเช็คชื่อเข้าร่วมนมัสการ
            </p>
            <p className="type-caption-strong mt-2 flex items-center justify-center gap-2 text-[var(--color-primary-on-dark)]">
              <UserCheck size={ICON_SIZE.sm} aria-hidden="true" />
              <span>เข้าโบสถ์แล้ว {attendanceCount} ครั้ง</span>
            </p>
          </div>
        </div>
      </section>

      {/* Upcoming events — time-bound and actionable, so they sit directly
          under the pass: on a 360×740 screen the first event is then visible
          without scrolling. */}
      <MemberListSection
        id="member-events-heading"
        title="กิจกรรมที่กำลังจะมาถึง"
        action={
          events.length > 0
            ? { label: "ดูทั้งหมด", href: "/app/events" }
            : undefined
        }
      >
        {events.length > 0 ? (
          events.map(evt => (
            <MemberListItem key={evt.id}>
              <h3 className="type-body text-[var(--color-ink)]">
                {evt.title}
              </h3>
              <p className="type-caption mt-1 text-[var(--color-body-muted)]">
                {new Date(evt.eventDate).toLocaleDateString("th-TH", {
                  dateStyle: "long",
                })}
                {evt.location ? ` • ${evt.location}` : ""}
              </p>
              <button
                type="button"
                onClick={() =>
                  handleRegisterEvent(evt.id, Boolean(evt.isRegistered))
                }
                className={`type-caption-strong mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] motion-reduce:transition-none ${
                  evt.isRegistered
                    ? "border border-[var(--color-error)] bg-[var(--color-canvas)] text-[var(--color-error)] hover:bg-[var(--color-canvas-soft)]"
                    : evt.id === nextRegistrableId
                      ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-focus)]"
                      : "border border-[var(--color-primary)] bg-[var(--color-canvas)] text-[var(--color-primary)] hover:bg-[var(--color-accent-soft)]"
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
            </MemberListItem>
          ))
        ) : (
          <MemberListEmpty>ยังไม่มีกิจกรรมที่เปิดรับลงทะเบียน</MemberListEmpty>
        )}
      </MemberListSection>

      {/* Mine: care group + prayer request */}
      <MemberListSection id="member-mine-heading" title="ของฉัน">
        {data?.careGroup ? (
          <MemberListRow
            icon={UsersRound}
            eyebrow="พันธกิจของฉัน"
            title={data.careGroup.name}
            subtitle={careGroupSchedule || "ยังไม่ระบุวันนัดหมาย"}
            href="/app/group"
          />
        ) : (
          <MemberListRow
            icon={UsersRound}
            title="ยังไม่ได้เข้าร่วมพันธกิจ"
            subtitle="ติดต่อฝ่ายต้อนรับคริสตจักร"
            href="tel:043811800"
          />
        )}
        <MemberListRow
          icon={HeartHandshake}
          title="ขอคำอธิษฐาน"
          subtitle="บันทึกคำขออธิษฐานของคุณ"
          onClick={() => setPrayerModalOpen(true)}
        />
      </MemberListSection>

      {/* Announcements */}
      <MemberListSection
        id="member-announcements-heading"
        title="ประกาศจากคริสตจักร"
        action={
          announcements.length > 0
            ? { label: "ดูทั้งหมด", href: "/app/events" }
            : undefined
        }
      >
        {announcements.length > 0 ? (
          announcements.map(ann => (
            <MemberListItem key={ann.id}>
              <h3 className="type-body text-[var(--color-ink)]">
                {ann.title}
              </h3>
              <p className="type-caption mt-1 line-clamp-2 text-[var(--color-body-muted)]">
                {ann.content}
              </p>
            </MemberListItem>
          ))
        ) : (
          <MemberListEmpty>ยังไม่มีประกาศใหม่</MemberListEmpty>
        )}
      </MemberListSection>

      {/* Prayer request modal */}
      <PrayerRequestModal
        open={prayerModalOpen}
        onClose={() => setPrayerModalOpen(false)}
        onSuccess={() => {}}
      />
    </MemberAppLayout>
  );
}
