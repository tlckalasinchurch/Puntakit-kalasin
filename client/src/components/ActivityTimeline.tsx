import { useEffect, useState } from "react";
import { Camera } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { EmptyState, ErrorState, StatusChip } from "@/components/DesignSystem";
import { ListSkeleton } from "@/components/LoadingStates";
import { ICON_SIZE } from "@/lib/icon-sizes";
import type { MissionActivityStatus, MissionActivityType } from "@shared/schema";

interface TimelineActivity {
  id: string;
  type: MissionActivityType;
  status: MissionActivityStatus;
  title: string;
  story: string | null;
  occurredAt: string;
  groupName: string | null;
  placeLabel: string | null;
  thumbnailUrl: string | null;
}

const TYPE_LABELS: Record<MissionActivityType, string> = {
  house_mission: "เยี่ยมบ้าน",
  mission_visit: "ออกเยี่ยมพันธกิจ",
  bible_study: "ศึกษาพระคัมภีร์",
  prayer: "อธิษฐาน",
  worship: "นมัสการ",
  fellowship: "สามัคคีธรรม",
  testimony: "คำพยาน",
  evangelism: "ประกาศข่าวประเสริฐ",
  pastoral_visit: "เยี่ยมเยียนอภิบาล",
  outreach: "กิจกรรมชุมชน",
  ministry_update: "อัปเดตพันธกิจ",
  other: "อื่นๆ",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Reusable Ministry Activity timeline — a lens over the same
 * missionActivities data Feed reads, filtered to one person or one group.
 * Not a separate page/nav item: rendered inline wherever a Person or Group
 * detail view wants an "Activity" section. See
 * docs/PUNTAKIT_PRODUCT_ARCHITECTURE.md — Timeline has no source of truth
 * of its own.
 */
export function ActivityTimeline({
  subjectType,
  subjectId,
}: {
  subjectType: "member" | "group";
  subjectId: string;
}) {
  const [items, setItems] = useState<TimelineActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorTechnical, setErrorTechnical] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setErrorTechnical(null);
    const param = subjectType === "member" ? "memberId" : "groupId";
    api
      .get<TimelineActivity[]>(`/api/activities?${param}=${subjectId}&limit=20`)
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "โหลดไทม์ไลน์ไม่สำเร็จ");
          setErrorTechnical(err instanceof ApiError ? (err.serverMessage ?? err.message) : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [subjectType, subjectId, attempt]);

  if (isLoading) return <ListSkeleton count={3} />;

  if (error) {
    return (
      <ErrorState
        inset
        title="โหลดไทม์ไลน์ไม่สำเร็จ"
        description="ระบบเชื่อมต่อไม่สำเร็จในขณะนี้ กรุณาลองอีกครั้ง"
        technical={errorTechnical ?? undefined}
        onRetry={() => setAttempt((n) => n + 1)}
      />
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        inset
        icon={Camera}
        title="ยังไม่มีกิจกรรมพันธกิจ"
        description="กิจกรรมที่บันทึกไว้กับบุคคลหรือกลุ่มนี้จะแสดงที่นี่"
        action={{ href: "/feed", label: "ไปที่ฟีดกิจกรรม" }}
      />
    );
  }

  return (
    <ol className="space-y-3">
      {items.map((activity) => (
        <li
          key={activity.id}
          className="flex gap-3 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3"
        >
          {activity.thumbnailUrl ? (
            <img
              src={activity.thumbnailUrl}
              alt=""
              className="size-12 shrink-0 rounded-[var(--radius-sm)] object-cover"
            />
          ) : (
            <div className="flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-canvas-soft)]">
              <Camera size={ICON_SIZE.sm} aria-hidden="true" className="text-[var(--color-body-muted)]" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip tone="neutral">{TYPE_LABELS[activity.type]}</StatusChip>
              <span className="type-fine text-[var(--color-body-muted)]">
                {formatDateTime(activity.occurredAt)}
              </span>
            </div>
            <p className="type-caption-strong mt-1 truncate text-[var(--color-ink)]">{activity.title}</p>
            {activity.story && (
              <p className="type-fine mt-0.5 line-clamp-2 text-[var(--color-text-secondary)]">
                {activity.story}
              </p>
            )}
            {(activity.groupName || activity.placeLabel) && (
              <p className="type-fine mt-0.5 text-[var(--color-body-muted)]">
                {activity.groupName ?? activity.placeLabel}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
