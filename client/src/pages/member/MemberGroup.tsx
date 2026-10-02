import { useEffect, useState } from "react";
import {
  UsersRound,
  Calendar,
  Clock,
  MapPin,
  UserCheck,
  ShieldCheck,
  RefreshCw,
  Mail,
  HeartHandshake,
} from "lucide-react";
import { toast } from "sonner";
import { MemberAppLayout } from "@/components/layout/MemberAppLayout";
import { EmptyState, ErrorState } from "@/components/DesignSystem";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { api, ApiError } from "@/lib/api";
import { ListSkeleton } from "@/components/LoadingStates";

interface GroupMember {
  id: string;
  memberName: string;
  memberNickname: string | null;
  avatarUrl: string | null;
  role: string;
}

interface CareGroupInfo {
  groupId: string;
  groupName: string;
  category: string;
  meetingDay: string | null;
  meetingTime: string | null;
  meetingLocation: string | null;
  description: string | null;
  leaderName: string | null;
  leaderEmail: string | null;
  members: GroupMember[];
}

export default function MemberGroup() {
  const [group, setGroup] = useState<CareGroupInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGroup = async (notify = false) => {
    setError(null);
    try {
      const res = await api.get<CareGroupInfo | null>("/api/me/group");
      setGroup(res);
      if (notify) {
        toast.success("อัปเดตข้อมูลกลุ่มแคร์เรียบร้อยแล้ว");
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "โหลดข้อมูลกลุ่มแคร์ไม่สำเร็จ"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchGroup();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    void fetchGroup(true);
  };

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  const roleLabel = (role: string) =>
    role === "leader"
      ? "ผู้นำกลุ่ม"
      : role === "assistant"
        ? "ผู้ช่วยผู้นำ"
        : "สมาชิก";

  return (
    <MemberAppLayout title="กลุ่มแคร์ของฉัน">
      <header>
        <h1 className="type-lead font-semibold text-[var(--color-ink)]">
          กลุ่มแคร์ของฉัน
        </h1>
        <p className="type-caption mt-1 text-[var(--color-body-muted)]">
          กลุ่มชีวิตที่คุณสังกัด วันนัดหมาย ผู้นำ และสมาชิกในกลุ่ม
        </p>
      </header>

      {/* Hero banner — graphite chrome, one interactive colour. */}
      <section className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] bg-gradient-to-br from-[var(--color-dark-surface-2)] to-[var(--color-dark-surface)] p-4 text-[var(--color-on-dark)]">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-on-dark)]/10">
            <UsersRound
              size={ICON_SIZE.lg}
              aria-hidden="true"
              className="text-[var(--color-primary-on-dark)]"
            />
          </span>
          <div className="min-w-0">
            <p className="type-body-strong">กลุ่มชีวิตและการสามัคคีธรรม</p>
            <p className="type-fine text-[var(--color-on-dark-muted)]">
              ผูกพัน เติบโต และดูแลกันในพระคริสต์
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          aria-label="รีเฟรชข้อมูลกลุ่มแคร์"
          aria-busy={refreshing}
          title="รีเฟรชข้อมูล"
          className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-on-dark)]/10 text-[var(--color-on-dark)] transition-colors hover:bg-[var(--color-on-dark)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-on-dark)] disabled:opacity-50 motion-reduce:transition-none"
        >
          <RefreshCw
            size={ICON_SIZE.md}
            aria-hidden="true"
            className={refreshing ? "animate-spin motion-reduce:animate-none" : ""}
          />
        </button>
      </section>

      {loading && <ListSkeleton count={2} />}

      {!loading && error && (
        <ErrorState
          title="โหลดข้อมูลกลุ่มแคร์ไม่สำเร็จ"
          description="ระบบยังเชื่อมต่อข้อมูลกลุ่มของคุณไม่ได้ในขณะนี้ กรุณาลองอีกครั้ง"
          technical={error}
          retryLabel="ลองอีกครั้ง"
          onRetry={() => {
            setLoading(true);
            void fetchGroup();
          }}
        />
      )}

      {!loading && !error && !group && (
        <EmptyState
          icon={HeartHandshake}
          title="คุณยังไม่ได้สังกัดกลุ่มแคร์"
          description="การมีกลุ่มแคร์ช่วยให้คุณมีพี่น้องร่วมอธิษฐานและดูแลกัน หากต้องการเข้าร่วมกลุ่มแคร์ กรุณาติดต่อฝ่ายต้อนรับของคริสตจักร"
          action={{
            label: "ติดต่อฝ่ายต้อนรับคริสตจักร",
            href: "tel:043811800",
          }}
        />
      )}

      {!loading && !error && group && (
        <>
          <section className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5">
            <span className="type-fine inline-flex items-center rounded-[var(--radius-xs)] bg-[var(--color-accent-soft)] px-2 py-1 font-semibold text-[var(--color-primary)]">
              {group.category || "กลุ่มแคร์"}
            </span>
            <h2 className="type-body-strong mt-2 text-[var(--color-ink)]">
              {group.groupName}
            </h2>

            {group.description && (
              <p className="type-caption mt-2 text-[var(--color-body-muted)]">
                {group.description}
              </p>
            )}

            <div className="mt-3 flex flex-col gap-2.5 border-t border-[var(--color-divider)] pt-3">
              <p className="flex items-center gap-3">
                <Calendar
                  size={ICON_SIZE.sm}
                  aria-hidden="true"
                  className="shrink-0 text-[var(--color-primary)]"
                />
                <span className="type-caption text-[var(--color-body-muted)]">
                  วันนัดหมาย
                </span>
                <strong className="type-caption font-semibold text-[var(--color-ink)]">
                  {group.meetingDay || "ตามที่นัดหมาย"}
                </strong>
              </p>
              <p className="flex items-center gap-3">
                <Clock
                  size={ICON_SIZE.sm}
                  aria-hidden="true"
                  className="shrink-0 text-[var(--color-primary)]"
                />
                <span className="type-caption text-[var(--color-body-muted)]">
                  เวลา
                </span>
                <strong className="type-caption font-semibold text-[var(--color-ink)]">
                  {group.meetingTime ? `${group.meetingTime} น.` : "ตามที่นัดหมาย"}
                </strong>
              </p>
              <p className="flex items-center gap-3">
                <MapPin
                  size={ICON_SIZE.sm}
                  aria-hidden="true"
                  className="shrink-0 text-[var(--color-primary)]"
                />
                <span className="type-caption text-[var(--color-body-muted)]">
                  สถานที่
                </span>
                <strong className="type-caption font-semibold text-[var(--color-ink)]">
                  {group.meetingLocation || "คริสตจักร / ออนไลน์"}
                </strong>
              </p>
            </div>

            {group.leaderName && (
              <div className="mt-3 flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-divider)] bg-[var(--color-canvas-soft)] p-3.5">
                <span
                  aria-hidden="true"
                  className="type-caption-strong flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-circle)] bg-[var(--color-dark-surface)] text-[var(--color-on-dark)]"
                >
                  {getInitials(group.leaderName)}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="type-caption-strong text-[var(--color-ink)]">
                      {group.leaderName}
                    </span>
                    <span className="type-fine rounded-[var(--radius-xs)] bg-[var(--color-accent-soft)] px-1.5 py-0.5 font-semibold text-[var(--color-primary)]">
                      หัวหน้ากลุ่ม
                    </span>
                  </div>
                  {group.leaderEmail && (
                    <p className="type-fine mt-0.5 flex items-center gap-1 text-[var(--color-body-muted)]">
                      <Mail size={ICON_SIZE.xs} aria-hidden="true" />
                      <span className="truncate">{group.leaderEmail}</span>
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>

          <section className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="type-body-strong flex items-center gap-2 text-[var(--color-ink)]">
                <UserCheck
                  size={ICON_SIZE.sm}
                  aria-hidden="true"
                  className="text-[var(--color-primary)]"
                />
                สมาชิกในกลุ่ม
              </h2>
              <span className="type-fine rounded-[var(--radius-pill)] bg-[var(--color-canvas-soft)] px-2 py-0.5 font-semibold text-[var(--color-text-secondary)]">
                {group.members.length} คน
              </span>
            </div>

            <ul className="mt-2 divide-y divide-[var(--color-divider)]">
              {group.members.map(m => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {m.avatarUrl ? (
                      <img
                        src={m.avatarUrl}
                        alt={`รูปโปรไฟล์ของ ${m.memberName}`}
                        className="size-10 shrink-0 rounded-[var(--radius-circle)] border border-[var(--color-hairline)] object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="type-caption-strong flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-circle)] bg-[var(--color-accent-soft)] text-[var(--color-primary)]"
                      >
                        {getInitials(m.memberName)}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="type-caption-strong truncate text-[var(--color-ink)]">
                        {m.memberName}
                        {m.memberNickname ? ` (${m.memberNickname})` : ""}
                      </p>
                      <p className="type-fine text-[var(--color-body-muted)]">
                        {roleLabel(m.role)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-3 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--color-divider)] bg-[var(--color-canvas-soft)] p-3">
              <ShieldCheck
                size={ICON_SIZE.sm}
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-[var(--color-primary)]"
              />
              <p className="type-fine text-[var(--color-body-muted)]">
                เพื่อความปลอดภัยและปฏิบัติตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล
                (PDPA) ระบบจะแสดงเฉพาะชื่อและชื่อเล่นของสมาชิกในกลุ่ม
                โดยไม่เปิดเผยเบอร์โทรศัพท์หรือที่อยู่แก่ผู้อื่น
              </p>
            </div>
          </section>
        </>
      )}
    </MemberAppLayout>
  );
}
