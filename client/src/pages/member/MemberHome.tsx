import { useEffect, useState } from "react";
import { Link } from "wouter";
import QRCode from "qrcode";
import {
  Bell,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Megaphone,
  QrCode,
  Sprout,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { MemberAppLayout } from "@/components/layout/MemberAppLayout";
import { LambHero } from "@/components/lamb/LambHero";
import { LambSecondaryCards } from "@/components/lamb/LambSecondaryCards";
import { LambQuickActions } from "@/components/lamb/LambQuickActions";
import { PrayerRequestModal } from "@/components/PrayerRequestModal";
import { ListSkeleton } from "@/components/LoadingStates";
import { EmptyState, ErrorState } from "@/components/DesignSystem";
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

/**
 * Lamb Edition home — warm, friendly member home following the
 * Puntakit Lamb Edition design reference.
 */
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
  const groupName = data?.careGroup?.name ?? "ยังไม่มีกลุ่ม";

  return (
    <MemberAppLayout>
      <div className="lamb-theme space-y-4 bg-[#F8F7F1] sm:space-y-6">
        {/* Lamb header — logo, tagline, greeting */}
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#DDF7F0] text-[#0C7C82]">
              <Sprout size={32} strokeWidth={2.2} />
            </span>
            <div>
              <p className="text-2xl font-extrabold tracking-tight text-[#075B5D] sm:text-3xl">Puntakit</p>
              <p className="text-xs text-slate-500">
                พันธกิจ · กลุ่ม · คน · เติบโตไปด้วยกัน
              </p>
            </div>
          </div>
          <Link
            href="/app/profile"
            className="flex min-h-11 items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0C7C82]"
            aria-label={`โปรไฟล์ของ${greetingName}`}
          >
            <span className="text-right">
              <span className="block text-sm font-semibold text-slate-700">
                สวัสดีครับ
              </span>
              <span className="block max-w-24 truncate text-xs text-slate-500">
                {groupName}
              </span>
            </span>
            <ChevronRight size={16} aria-hidden="true" className="text-slate-400" />
          </Link>
        </header>

        {/* Desktop: reference-style hero + supporting cards. Mobile: stacked, readable flow. */}
        <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(340px,1fr)] xl:gap-5">
          <LambHero />
          <LambSecondaryCards />
        </div>

        {/* Four quick actions — four columns on desktop, two on small screens. */}
        <LambQuickActions notificationCount={announcements.length} />

        {/* Digital member pass */}
        <section
          aria-labelledby="member-pass-heading"
          className="rounded-3xl bg-slate-800 p-5 text-white shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p
                id="member-pass-heading"
                className="text-xs font-semibold tracking-wide text-teal-200"
              >
                บัตรสมาชิกคริสตจักร
              </p>
              <p className="mt-1 truncate font-semibold">
                {member?.name || user?.name}
              </p>
            </div>
            <span className="shrink-0 rounded-md bg-white/15 px-2 py-1 text-xs font-semibold">
              {membershipLabel}
            </span>
          </div>

          <div className="mt-4 flex items-center gap-4">
            <div className="flex size-24 shrink-0 items-center justify-center rounded-xl bg-white p-2">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="คิวอาร์โค้ดสำหรับเช็คชื่อของสมาชิก"
                  className="block size-20"
                />
              ) : (
                <QrCode
                  size={ICON_SIZE["2xl"]}
                  aria-hidden="true"
                  className="text-slate-800"
                />
              )}
            </div>

            <div className="min-w-0">
              <p className="text-xs text-white/70">
                ยื่นคิวอาร์โค้ดนี้ที่จุดลงทะเบียนหน้าประตูโบสถ์
                เพื่อเช็คชื่อเข้าร่วมนมัสการ
              </p>
              <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-teal-200">
                <UserCheck size={ICON_SIZE.sm} aria-hidden="true" />
                <span>เข้าโบสถ์แล้ว {attendanceCount} ครั้ง</span>
              </p>
              <button
                type="button"
                onClick={handleEnablePush}
                disabled={subscribingPush}
                className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-full bg-white/10 px-4 text-xs font-semibold transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-200 disabled:opacity-50"
              >
                <Bell size={14} aria-hidden="true" />
                เปิดรับการแจ้งเตือน
              </button>
            </div>
          </div>
        </section>

        {/* Announcements */}
        <section
          aria-labelledby="member-announcements-heading"
          className="rounded-3xl bg-white p-5 shadow-sm"
        >
          <div className="flex items-center justify-between gap-2">
            <h2
              id="member-announcements-heading"
              className="flex min-w-0 items-center gap-2 font-semibold text-slate-800"
            >
              <Megaphone
                size={ICON_SIZE.sm}
                aria-hidden="true"
                className="shrink-0 text-[#0C7C82]"
              />
              <span className="truncate">ประกาศจากคริสตจักร</span>
            </h2>
            {announcements.length > 0 && (
              <Link
                href="/app/events"
                className="inline-flex min-h-11 shrink-0 items-center rounded-md px-2 text-sm font-semibold text-[#0C7C82] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0C7C82]"
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
                  className="rounded-xl bg-slate-50 p-3"
                >
                  <h3 className="text-sm font-semibold text-slate-800">
                    {ann.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500">
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
          className="rounded-3xl bg-white p-5 shadow-sm"
        >
          <div className="flex items-center justify-between gap-2">
            <h2
              id="member-events-heading"
              className="flex min-w-0 items-center gap-2 font-semibold text-slate-800"
            >
              <Calendar
                size={ICON_SIZE.sm}
                aria-hidden="true"
                className="shrink-0 text-[#0C7C82]"
              />
              <span className="truncate">กิจกรรมที่กำลังจะมาถึง</span>
            </h2>
            {events.length > 0 && (
              <Link
                href="/app/events"
                className="inline-flex min-h-11 shrink-0 items-center rounded-md px-2 text-sm font-semibold text-[#0C7C82] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0C7C82]"
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
                  className="rounded-xl bg-slate-50 p-3"
                >
                  <h3 className="text-sm font-semibold text-slate-800">
                    {evt.title}
                  </h3>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
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
                    className={`mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0C7C82] ${
                      evt.isRegistered
                        ? "border border-slate-200 bg-white text-red-600 hover:bg-slate-50"
                        : "bg-[#0C7C82] text-white hover:bg-[#0a6b70]"
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
      </div>
    </MemberAppLayout>
  );
}
