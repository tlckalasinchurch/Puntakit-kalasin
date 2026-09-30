import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Archive,
  Camera,
  CheckCircle2,
  Image as ImageIcon,
  ListTodo,
  MapPin,
  Plus,
  RotateCcw,
  Send,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { CardGridSkeleton } from "@/components/LoadingStates";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import type { MissionActivityStatus, MissionActivityType } from "@shared/schema";

interface FeedActivity {
  id: string;
  type: MissionActivityType;
  status: MissionActivityStatus;
  title: string;
  story: string | null;
  occurredAt: string;
  groupId: string | null;
  groupName: string | null;
  placeLabel: string | null;
  createdById: string | null;
  createdByName: string | null;
  createdAt: string;
  thumbnailUrl: string | null;
}

interface GroupOption {
  id: string;
  name: string;
}

interface MemberOption {
  id: string;
  name: string;
  nickname: string | null;
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

const STATUS_LABELS: Record<MissionActivityStatus, string> = {
  draft: "ฉบับร่าง",
  pending_review: "รอตรวจสอบ",
  published: "เผยแพร่แล้ว",
  archived: "เก็บถาวร",
};

const STATUS_BADGE_CLASS: Record<MissionActivityStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  pending_review: "bg-amber-50 text-amber-700",
  published: "bg-emerald-50 text-emerald-700",
  archived: "bg-slate-100 text-slate-400",
};

const EMPTY_FORM = {
  type: "house_mission" as MissionActivityType,
  title: "",
  story: "",
  occurredAt: new Date().toISOString().slice(0, 16),
  groupId: "",
  placeLabel: "",
  participantMemberIds: [] as string[],
  media: [] as { url: string }[],
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

export default function Feed() {
  const { user } = useAuth();

  const [items, setItems] = useState<FeedActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [transitioningId, setTransitioningId] = useState<string | null>(null);

  const canCreate = user && ["super_admin", "admin", "staff", "ministry_leader", "group_leader"].includes(user.role);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.set("type", typeFilter);
      if (statusFilter) params.set("status", statusFilter);
      params.set("limit", "30");
      const data = await api.get<FeedActivity[]>(`/api/activities?${params.toString()}`);
      setItems(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "โหลดฟีดไม่สำเร็จ");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, statusFilter]);

  useEffect(() => {
    if (!canCreate) return;
    api.get<GroupOption[]>("/api/groups").then(setGroups).catch(() => setGroups([]));
    api
      .get<MemberOption[]>("/api/members?limit=200")
      .then(setMembers)
      .catch(() => setMembers([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canCreate]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("กรุณากรอกหัวข้อ");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/api/activities", {
        type: form.type,
        title: form.title,
        story: form.story || undefined,
        occurredAt: new Date(form.occurredAt).toISOString(),
        groupId: form.groupId || null,
        placeLabel: form.placeLabel || undefined,
        participantMemberIds: form.participantMemberIds,
        media: form.media.filter((m) => m.url.trim()).map((m) => ({ url: m.url.trim(), kind: "image" as const })),
      });
      toast.success("บันทึกกิจกรรมพันธกิจแล้ว (ฉบับร่าง)");
      setFormOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  };

  const transition = async (activity: FeedActivity, status: MissionActivityStatus) => {
    setTransitioningId(activity.id);
    try {
      await api.put(`/api/activities/${activity.id}/status`, { status });
      toast.success(`เปลี่ยนสถานะเป็น "${STATUS_LABELS[status]}" แล้ว`);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "เปลี่ยนสถานะไม่สำเร็จ");
    } finally {
      setTransitioningId(null);
    }
  };

  const createFollowUp = async (activity: FeedActivity) => {
    try {
      await api.post("/api/follow-ups", {
        title: `ติดตามหลัง: ${activity.title}`,
        activityId: activity.id,
        subjectGroupId: activity.groupId || undefined,
      });
      toast.success("สร้างรายการติดตามแล้ว");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "สร้างรายการติดตามไม่สำเร็จ");
    }
  };

  const toggleParticipant = (memberId: string) => {
    setForm((f) => ({
      ...f,
      participantMemberIds: f.participantMemberIds.includes(memberId)
        ? f.participantMemberIds.filter((id) => id !== memberId)
        : [...f.participantMemberIds, memberId],
    }));
  };

  const typeOptions = useMemo(() => Object.entries(TYPE_LABELS), []);
  const statusOptions = useMemo(() => Object.entries(STATUS_LABELS), []);

  return (
    <AppLayout>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">
            FEED • กิจกรรมพันธกิจ
          </span>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">ฟีดกิจกรรมพันธกิจ</h1>
          <p className="text-xs text-slate-500">อะไรเกิดขึ้น ที่ไหน กับใคร — บันทึกและติดตามกิจกรรมพันธกิจทั้งหมด</p>
        </div>
        {canCreate && (
          <button
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors shadow-xs"
            onClick={openCreate}
          >
            <Camera size={ICON_SIZE.sm} /> บันทึกกิจกรรม
          </button>
        )}
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <select
          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">ทุกประเภทกิจกรรม</option>
          {typeOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">ทุกสถานะ</option>
          {statusOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <CardGridSkeleton count={6} />
      ) : error ? (
        <div className="tailadmin-card p-10 text-center text-rose-600">
          <AlertCircle size={ICON_SIZE.xl} className="mx-auto mb-2 text-rose-500" />
          <h3 className="font-bold text-sm">โหลดฟีดไม่สำเร็จ</h3>
          <p className="text-xs text-slate-500 mt-1">{error}</p>
          <button className="mt-4 rounded-xl bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-100" onClick={load}>
            ลองใหม่
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="tailadmin-card p-12 text-center text-slate-400">
          <Camera size={40} className="mx-auto text-slate-300 mb-2" />
          <h3 className="font-semibold text-slate-700 text-sm">ยังไม่มีกิจกรรมในฟีด</h3>
          <p className="text-xs text-slate-400 mt-1">{canCreate ? "เริ่มบันทึกกิจกรรมพันธกิจแรกของคุณ" : "รอทีมงานบันทึกกิจกรรม"}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((activity) => {
            const isMine = user?.id === activity.createdById;
            const canAdvance = isMine || (user && ["super_admin", "admin", "staff", "ministry_leader", "group_leader"].includes(user.role));
            return (
              <article
                key={activity.id}
                className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-xs hover:shadow-md transition-all duration-200 flex flex-col"
              >
                {activity.thumbnailUrl ? (
                  <img src={activity.thumbnailUrl} alt="" className="h-40 w-full object-cover" />
                ) : (
                  <div className="h-24 w-full bg-slate-50 flex items-center justify-center">
                    <ImageIcon size={28} className="text-slate-300" />
                  </div>
                )}
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                      {TYPE_LABELS[activity.type]}
                    </span>
                    <span className={`flex-shrink-0 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE_CLASS[activity.status]}`}>
                      {STATUS_LABELS[activity.status]}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm leading-snug mb-1">{activity.title}</h3>
                  {activity.story && (
                    <p className="text-xs text-slate-600 mb-3 line-clamp-2 leading-relaxed">{activity.story}</p>
                  )}
                  <div className="mt-auto space-y-1 text-[11px] text-slate-400">
                    <div>{formatDateTime(activity.occurredAt)}</div>
                    {(activity.groupName || activity.placeLabel) && (
                      <div className="flex items-center gap-1">
                        <MapPin size={11} />
                        {activity.groupName ?? activity.placeLabel}
                      </div>
                    )}
                    {activity.createdByName && (
                      <div className="flex items-center gap-1">
                        <Users size={11} />
                        {activity.createdByName}
                      </div>
                    )}
                  </div>

                  {canAdvance && activity.status !== "archived" && (
                    <div className="flex items-center gap-2 pt-3 mt-3 border-t border-slate-100">
                      {activity.status === "draft" && (
                        <button
                          className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 px-2 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                          disabled={transitioningId === activity.id}
                          onClick={() => transition(activity, "pending_review")}
                        >
                          <Send size={12} /> ส่งตรวจสอบ
                        </button>
                      )}
                      {(activity.status === "draft" || activity.status === "pending_review") && (
                        <button
                          className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl bg-emerald-50 px-2 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
                          disabled={transitioningId === activity.id}
                          onClick={() => transition(activity, "published")}
                        >
                          <CheckCircle2 size={12} /> เผยแพร่
                        </button>
                      )}
                      {activity.status === "published" && (
                        <button
                          className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 px-2 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                          disabled={transitioningId === activity.id}
                          onClick={() => transition(activity, "archived")}
                        >
                          <Archive size={12} /> เก็บถาวร
                        </button>
                      )}
                    </div>
                  )}
                  {activity.status === "archived" && canAdvance && (
                    <div className="pt-3 mt-3 border-t border-slate-100">
                      <button
                        className="w-full inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 px-2 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                        disabled={transitioningId === activity.id}
                        onClick={() => transition(activity, "draft")}
                      >
                        <RotateCcw size={12} /> กู้คืนเป็นฉบับร่าง
                      </button>
                    </div>
                  )}
                  {canAdvance && activity.groupId && (
                    <button
                      className="w-full mt-2 inline-flex items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 px-2 py-1.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-50"
                      onClick={() => createFollowUp(activity)}
                    >
                      <ListTodo size={12} /> สร้างรายการติดตามจากกิจกรรมนี้
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent side="right" className="w-full bg-white sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>บันทึกกิจกรรมพันธกิจ</SheetTitle>
          </SheetHeader>
          <form className="flex flex-col gap-4 px-4 pb-24" onSubmit={handleSubmit}>
            <label className="text-xs font-semibold text-slate-600 flex flex-col gap-1.5">
              ประเภทกิจกรรม
              <select
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as MissionActivityType })}
              >
                {typeOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs font-semibold text-slate-600 flex flex-col gap-1.5">
              หัวข้อ
              <input
                required
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="เช่น เยี่ยมบ้านครอบครัวคุณสมชาย"
              />
            </label>

            <label className="text-xs font-semibold text-slate-600 flex flex-col gap-1.5">
              เรื่องราว
              <textarea
                rows={4}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={form.story}
                onChange={(e) => setForm({ ...form, story: e.target.value })}
                placeholder="เกิดอะไรขึ้นบ้าง..."
              />
            </label>

            <label className="text-xs font-semibold text-slate-600 flex flex-col gap-1.5">
              วันเวลาที่เกิดขึ้น
              <input
                type="datetime-local"
                required
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={form.occurredAt}
                onChange={(e) => setForm({ ...form, occurredAt: e.target.value })}
              />
            </label>

            <label className="text-xs font-semibold text-slate-600 flex flex-col gap-1.5">
              กลุ่ม (ถ้ามี)
              <select
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={form.groupId}
                onChange={(e) => setForm({ ...form, groupId: e.target.value })}
              >
                <option value="">ไม่ระบุกลุ่ม</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs font-semibold text-slate-600 flex flex-col gap-1.5">
              สถานที่ (ถ้ามี)
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={form.placeLabel}
                onChange={(e) => setForm({ ...form, placeLabel: e.target.value })}
                placeholder="เช่น บ้านเลขที่ 12 หมู่ 3"
              />
            </label>

            <div className="text-xs font-semibold text-slate-600 flex flex-col gap-1.5">
              ผู้เกี่ยวข้อง ({form.participantMemberIds.length} คน)
              <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 p-2 space-y-1">
                {members.length === 0 && <p className="text-slate-400 text-xs p-2">ไม่มีข้อมูลสมาชิก</p>}
                {members.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 text-xs font-normal text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.participantMemberIds.includes(m.id)}
                      onChange={() => toggleParticipant(m.id)}
                    />
                    {m.nickname ? `${m.name} (${m.nickname})` : m.name}
                  </label>
                ))}
              </div>
            </div>

            <div className="text-xs font-semibold text-slate-600 flex flex-col gap-1.5">
              รูปภาพ (ลิงก์ URL)
              {form.media.map((m, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal"
                    value={m.url}
                    onChange={(e) => {
                      const media = [...form.media];
                      media[i] = { url: e.target.value };
                      setForm({ ...form, media });
                    }}
                    placeholder="https://..."
                  />
                  <button
                    type="button"
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                    onClick={() => setForm({ ...form, media: form.media.filter((_, idx) => idx !== i) })}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="inline-flex items-center gap-1 self-start rounded-xl border border-dashed border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                onClick={() => setForm({ ...form, media: [...form.media, { url: "" }] })}
              >
                <Plus size={12} /> เพิ่มรูปภาพ
              </button>
            </div>

            <SheetFooter className="px-0">
              <button type="submit" className="primary-action" disabled={submitting}>
                {submitting ? "กำลังบันทึก..." : "บันทึกเป็นฉบับร่าง"}
              </button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
