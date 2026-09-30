import { useEffect, useState } from "react";
import { Camera } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { ListSkeleton } from "@/components/LoadingStates";
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

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    const param = subjectType === "member" ? "memberId" : "groupId";
    api
      .get<TimelineActivity[]>(`/api/activities?${param}=${subjectId}&limit=20`)
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "โหลดไทม์ไลน์ไม่สำเร็จ");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [subjectType, subjectId]);

  if (isLoading) return <ListSkeleton count={3} />;

  if (error) {
    return <p className="text-xs text-rose-500 p-3">{error}</p>;
  }

  if (items.length === 0) {
    return (
      <div className="p-6 text-center text-slate-400">
        <Camera size={28} className="mx-auto text-slate-300 mb-1.5" />
        <p className="text-xs">ยังไม่มีกิจกรรมพันธกิจที่บันทึกไว้</p>
      </div>
    );
  }

  return (
    <ol className="space-y-3">
      {items.map((activity) => (
        <li key={activity.id} className="flex gap-3 rounded-xl border border-slate-100 bg-white p-3">
          {activity.thumbnailUrl ? (
            <img src={activity.thumbnailUrl} alt="" className="h-12 w-12 flex-shrink-0 rounded-lg object-cover" />
          ) : (
            <div className="h-12 w-12 flex-shrink-0 rounded-lg bg-slate-50 flex items-center justify-center">
              <Camera size={16} className="text-slate-300" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                {TYPE_LABELS[activity.type]}
              </span>
              <span className="text-[11px] text-slate-400">{formatDateTime(activity.occurredAt)}</span>
            </div>
            <p className="text-sm font-semibold text-slate-800 mt-0.5 truncate">{activity.title}</p>
            {activity.story && <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{activity.story}</p>}
            {(activity.groupName || activity.placeLabel) && (
              <p className="text-[11px] text-slate-400 mt-0.5">{activity.groupName ?? activity.placeLabel}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
