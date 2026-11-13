import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  HeartHandshake,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  Minus,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  UserMinus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { MemberAppLayout } from "@/components/layout/MemberAppLayout";
import { LambMascot } from "@/components/lamb/LambMascot";
import { api, ApiError } from "@/lib/api";
import { usePageTitle } from "@/hooks/usePageTitle";
import { initialOf } from "@/lib/initials";

interface GroupMemberRoster {
  id: string;
  name: string;
  nickname: string | null;
  avatarUrl: string | null;
  role: string;
}

interface GroupWithRoster {
  id: string;
  name: string;
  category: string;
  meetingDay: string | null;
  meetingTime: string | null;
  meetingLocation: string | null;
  coverUrl: string | null;
  members: GroupMemberRoster[];
}

interface PhotoItem {
  id: string;
  previewUrl: string;
  uploadedUrl?: string;
  uploading: boolean;
  error?: string;
}

type AttendanceStatus = "present" | "absent" | "leave" | "online";

const SERVICE_TYPE_OPTIONS = [
  { value: "care_group", label: "กลุ่มแคร์ / กลุ่มย่อย", icon: Users },
  { value: "worship_practice", label: "ซ้อมทีมนมัสการ", icon: Sparkles },
  { value: "prayer_meeting", label: "รวมอธิษฐาน", icon: HeartHandshake },
  { value: "youth_service", label: "กลุ่มอนุชน / วัยรุ่น", icon: MessageSquare },
  { value: "special_event", label: "กิจกรรมพิเศษ", icon: Calendar },
] as const;

export default function MemberNewReport() {
  usePageTitle("ส่งรายงาน & เช็คชื่อ");
  const [, setLocation] = useLocation();

  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<GroupWithRoster[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [serviceType, setServiceType] = useState<string>("care_group");
  const [meetingDate, setMeetingDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [title, setTitle] = useState<string>("");
  const [story, setStory] = useState<string>("");
  const [prayerRequests, setPrayerRequests] = useState<string>("");
  const [visitorCount, setVisitorCount] = useState<number>(0);

  // Map memberId -> status
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});

  // Photos
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Fetch groups and active rosters
  useEffect(() => {
    let mounted = true;
    const fetchGroups = async () => {
      try {
        const res = await api.get<GroupWithRoster[]>("/api/me/groups");
        if (!mounted) return;
        const list = res ?? [];
        setGroups(list);
        if (list.length > 0) {
          const first = list[0];
          setSelectedGroupId(first.id);
          // Initialise attendance roster
          const initialMap: Record<string, AttendanceStatus> = {};
          first.members.forEach((m) => {
            initialMap[m.id] = "present";
          });
          setAttendance(initialMap);

          // Default title
          const thaiDate = new Date().toLocaleDateString("th-TH", {
            day: "numeric",
            month: "short",
          });
          setTitle(`${first.name} (${thaiDate})`);
        }
      } catch (err) {
        toast.error("ไม่สามารถโหลดรายชื่อกลุ่มได้");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void fetchGroups();
    return () => {
      mounted = false;
    };
  }, []);

  // Update roster when group changes
  const handleGroupChange = (groupId: string) => {
    setSelectedGroupId(groupId);
    const grp = groups.find((g) => g.id === groupId);
    if (grp) {
      const initialMap: Record<string, AttendanceStatus> = {};
      grp.members.forEach((m) => {
        initialMap[m.id] = "present";
      });
      setAttendance(initialMap);

      const thaiDate = new Date(meetingDate).toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short",
      });
      setTitle(`${grp.name} (${thaiDate})`);
    }
  };

  const currentGroup = groups.find((g) => g.id === selectedGroupId);
  const memberRoster = currentGroup?.members ?? [];

  // Toggle status: present -> absent -> leave -> present
  const toggleMemberStatus = (memberId: string) => {
    setAttendance((prev) => {
      const current = prev[memberId] ?? "present";
      let next: AttendanceStatus = "present";
      if (current === "present") next = "absent";
      else if (current === "absent") next = "leave";
      else next = "present";
      return { ...prev, [memberId]: next };
    });
  };

  const setAllStatus = (status: AttendanceStatus) => {
    const updated: Record<string, AttendanceStatus> = {};
    memberRoster.forEach((m) => {
      updated[m.id] = status;
    });
    setAttendance(updated);
  };

  // Stats calculation
  const presentCount = Object.values(attendance).filter((s) => s === "present" || s === "online").length;
  const absentCount = Object.values(attendance).filter((s) => s === "absent").length;
  const leaveCount = Object.values(attendance).filter((s) => s === "leave").length;
  const totalCount = memberRoster.length;

  // Handle Photo Upload
  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const acceptedFiles = Array.from(files).filter((f) =>
      ["image/jpeg", "image/png", "image/webp"].includes(f.type)
    );

    if (acceptedFiles.length === 0) {
      toast.error("กรุณาเลือกไฟล์รูปภาพ JPEG, PNG หรือ WebP เท่านั้น");
      return;
    }

    if (photos.length + acceptedFiles.length > 8) {
      toast.error("สามารถอัปโหลดได้สูงสุด 8 รูป");
      return;
    }

    for (const file of acceptedFiles) {
      if (file.size > 4 * 1024 * 1024) {
        toast.error(`รูป ${file.name} มีขนาดเกิน 4 MB`);
        continue;
      }

      const tempId = Math.random().toString(36).slice(2);
      const previewUrl = URL.createObjectURL(file);

      setPhotos((prev) => [
        ...prev,
        { id: tempId, previewUrl, uploading: true },
      ]);

      try {
        const buffer = await file.arrayBuffer();
        const res = await fetch("/api/me/media", {
          method: "POST",
          headers: {
            "Content-Type": file.type,
          },
          body: buffer,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.error?.message ?? "อัปโหลดรูปไม่สำเร็จ");
        }

        const data = await res.json();
        const uploadedUrl = data?.data?.url;

        setPhotos((prev) =>
          prev.map((p) =>
            p.id === tempId ? { ...p, uploadedUrl, uploading: false } : p
          )
        );
      } catch (err: any) {
        toast.error(err.message || "อัปโหลดรูปภาพล้มเหลว");
        setPhotos((prev) =>
          prev.map((p) =>
            p.id === tempId
              ? { ...p, uploading: false, error: err.message || "ล้มเหลว" }
              : p
          )
        );
      }
    }
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("กรุณาระบุหัวข้อรายงาน");
      return;
    }

    const stillUploading = photos.some((p) => p.uploading);
    if (stillUploading) {
      toast.error("กรุณารอรูปภาพอัปโหลดเสร็จสิ้นก่อนส่งรายงาน");
      return;
    }

    setSubmitting(true);
    try {
      const attendanceList = memberRoster.map((m) => ({
        memberId: m.id,
        status: attendance[m.id] ?? "present",
      }));

      const mediaUrls = photos
        .map((p) => p.uploadedUrl)
        .filter((url): url is string => Boolean(url));

      await api.post("/api/me/reports", {
        groupId: selectedGroupId || null,
        serviceType,
        date: meetingDate,
        title: title.trim(),
        story: story.trim(),
        prayerRequests: prayerRequests.trim(),
        attendance: attendanceList,
        visitorCount: Number(visitorCount) || 0,
        mediaUrls,
      });

      setSubmitted(true);
      toast.success("บันทึกรายงานและเช็คชื่อสำเร็จแล้ว!");
    } catch (err: any) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกรายงานไม่สำเร็จ ลองอีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  };

  // Formatted date string for display
  const formattedDisplayDate = new Date(meetingDate).toLocaleDateString("th-TH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (submitted) {
    return (
      <MemberAppLayout>
        <div className="mx-auto max-w-lg space-y-6 py-6">
          <div className="rounded-3xl border border-emerald-100 bg-white p-6 text-center shadow-lg dark:border-emerald-950/40 dark:bg-zinc-900">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
              <CheckCircle2 size={36} aria-hidden="true" />
            </div>

            <h2 className="mt-4 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              บันทึกรายงานเรียบร้อย!
            </h2>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              ข้อมูลการเช็คชื่อและรูปภาพได้ถูกส่งเข้าสู่ระบบของคริสตจักรแล้ว ขอพระเจ้าอวยพรการรับใช้ครับ
            </p>

            <div className="mt-6 rounded-2xl bg-zinc-50 p-4 text-left dark:bg-zinc-800/50">
              <div className="text-xs font-semibold text-zinc-400">สรุปข้อมูล</div>
              <div className="mt-1 font-semibold text-zinc-800 dark:text-zinc-200">{title}</div>
              <div className="mt-1 text-xs text-zinc-500">{formattedDisplayDate}</div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-100/80 px-2.5 py-1 font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                  <UserCheck size={14} /> มา {presentCount} คน
                </span>
                {absentCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-rose-100/80 px-2.5 py-1 font-medium text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">
                    <UserMinus size={14} /> ขาด {absentCount} คน
                  </span>
                )}
                {visitorCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-blue-100/80 px-2.5 py-1 font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                    <Sparkles size={14} /> ผู้สนใจ {visitorCount} คน
                  </span>
                )}
                {photos.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-purple-100/80 px-2.5 py-1 font-medium text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                    <ImageIcon size={14} /> รูป {photos.length} ภาพ
                  </span>
                )}
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setLocation("/app/reports")}
                className="w-full rounded-2xl bg-emerald-600 px-5 py-3.5 font-semibold text-white shadow-sm transition-all hover:bg-emerald-500 active:scale-[0.98]"
              >
                ดูประวัติรายงานทั้งหมด
              </button>
              <button
                type="button"
                onClick={() => {
                  setSubmitted(false);
                  setStory("");
                  setPrayerRequests("");
                  setPhotos([]);
                }}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
              >
                ส่งรายงานเพิ่มเติม
              </button>
            </div>

            <div className="mt-4 flex justify-center">
              <LambMascot pose="welcome" className="w-24 opacity-80" />
            </div>
          </div>
        </div>
      </MemberAppLayout>
    );
  }

  return (
    <MemberAppLayout>
      <div className="mx-auto max-w-xl space-y-5 pb-16">
        {/* Navigation & Header */}
        <header className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => setLocation("/app/reports")}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 shadow-sm transition hover:bg-zinc-50 active:scale-95 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
            aria-label="ย้อนกลับ"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              เช็คชื่อ & ส่งรายงาน
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              ส่งรายงานกลุ่มแคร์ ทีมนมัสการ หรือกิจกรรมคริสตจักร
            </p>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Card 1: เลือกกลุ่ม & ข้อมูลการรวมกลุ่ม */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
              <Users size={16} className="text-blue-600 dark:text-blue-400" />
              1. ข้อมูลการรวมกลุ่ม
            </h2>

            <div className="mt-4 space-y-4">
              {/* เลือกกลุ่ม */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  กลุ่ม / พันธกิจ
                </label>
                {groups.length > 0 ? (
                  <div className="relative z-30 mt-1.5">
                    <select
                      value={selectedGroupId}
                      onChange={(e) => handleGroupChange(e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm font-medium text-zinc-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-blue-900/30"
                    >
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name} ({g.members.length} สมาชิก)
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="mt-1.5 rounded-xl border border-dashed border-zinc-300 p-3 text-center text-xs text-zinc-500 dark:border-zinc-700">
                    {loading ? "กำลังโหลดข้อมูลกลุ่ม..." : "ไม่พบกลุ่มที่คุณสังกัด"}
                  </div>
                )}
              </div>

              {/* ประเภทกิจกรรม */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  ประเภทกิจกรรม
                </label>
                <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {SERVICE_TYPE_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const isSelected = serviceType === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setServiceType(opt.value)}
                        className={`flex items-center gap-2 rounded-xl border p-2.5 text-left text-xs font-medium transition active:scale-95 ${
                          isSelected
                            ? "border-blue-600 bg-blue-50/70 text-blue-700 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-300"
                            : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-400"
                        }`}
                      >
                        <Icon size={14} className={isSelected ? "text-blue-600 dark:text-blue-400" : "text-zinc-400"} />
                        <span className="truncate">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* วันที่ และ หัวข้อ */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    วันที่จัด
                  </label>
                  <input
                    type="date"
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-sm text-zinc-900 outline-none transition focus:border-blue-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                  <span className="mt-1 block text-[11px] text-zinc-400">{formattedDisplayDate}</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    หัวข้อรายงาน
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="เช่น กลุ่มแคร์ศุกร์ที่ 14 พ.ย."
                    className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-sm text-zinc-900 outline-none transition focus:border-blue-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Card 2: เช็คชื่อสมาชิก & สรุปจำนวนคน */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
                <UserCheck size={16} className="text-emerald-600 dark:text-emerald-400" />
                2. เช็คชื่อสมาชิก ({presentCount}/{totalCount})
              </h2>
              <div className="flex items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setAllStatus("present")}
                  className="rounded-lg bg-emerald-50 px-2 py-1 font-medium text-emerald-700 transition hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
                >
                  มาทุกคน
                </button>
                <button
                  type="button"
                  onClick={() => setAllStatus("absent")}
                  className="rounded-lg bg-zinc-100 px-2 py-1 font-medium text-zinc-600 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
                >
                  เคลียร์
                </button>
              </div>
            </div>

            {/* Live KPI Bar */}
            <div className="mt-3.5 grid grid-cols-3 gap-2 rounded-xl bg-zinc-50 p-2.5 text-center font-mono dark:bg-zinc-800/40">
              <div className="rounded-lg bg-white p-2 shadow-xs dark:bg-zinc-900">
                <span className="text-[11px] font-sans text-emerald-700 dark:text-emerald-400">มา</span>
                <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">{presentCount}</div>
              </div>
              <div className="rounded-lg bg-white p-2 shadow-xs dark:bg-zinc-900">
                <span className="text-[11px] font-sans text-rose-700 dark:text-rose-400">ขาด</span>
                <div className="text-base font-bold text-rose-600 dark:text-rose-400">{absentCount}</div>
              </div>
              <div className="rounded-lg bg-white p-2 shadow-xs dark:bg-zinc-900">
                <span className="text-[11px] font-sans text-amber-700 dark:text-amber-400">ลา</span>
                <div className="text-base font-bold text-amber-600 dark:text-amber-400">{leaveCount}</div>
              </div>
            </div>

            {/* Member Checklist */}
            <div className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
              {memberRoster.length > 0 ? (
                memberRoster.map((m) => {
                  const status = attendance[m.id] ?? "present";
                  return (
                    <div
                      key={m.id}
                      onClick={() => toggleMemberStatus(m.id)}
                      className="flex cursor-pointer items-center justify-between py-2.5 transition-colors hover:bg-zinc-50/80 active:bg-zinc-100 dark:hover:bg-zinc-800/40"
                    >
                      <div className="flex items-center gap-3">
                        {m.avatarUrl ? (
                          <img
                            src={m.avatarUrl}
                            alt=""
                            className="h-9 w-9 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                            {initialOf(m.name)}
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            {m.name}
                            {m.nickname && (
                              <span className="ml-1 text-xs text-zinc-400 font-normal">
                                ({m.nickname})
                              </span>
                            )}
                          </div>
                          {m.role && m.role !== "member" && (
                            <span className="text-[10px] text-zinc-400">
                              {m.role === "leader" ? "ผู้นำกลุ่ม" : m.role}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status Badges */}
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-semibold transition ${
                            status === "present"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                              : status === "absent"
                                ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                          }`}
                        >
                          {status === "present" ? (
                            <>
                              <Check size={13} /> มา
                            </>
                          ) : status === "absent" ? (
                            <>
                              <X size={13} /> ขาด
                            </>
                          ) : (
                            <>
                              <Clock size={13} /> ลา
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-4 text-center text-xs text-zinc-400">
                  ไม่มีรายชื่อสมาชิกในกลุ่มนี้ (สามารถระบุจำนวนผู้เข้าร่วมด้านล่าง)
                </div>
              )}
            </div>

            {/* แขกใหม่ / ผู้สนใจ */}
            <div className="mt-4 flex items-center justify-between rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/40">
              <div>
                <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  ผู้สนใจ / แขกใหม่ / เพื่อนบ้าน
                </div>
                <div className="text-[11px] text-zinc-400">ผู้ที่ยังไม่มีรายชื่อในระบบ</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setVisitorCount((prev) => Math.max(0, prev - 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 transition hover:bg-zinc-100 active:scale-95 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  <Minus size={14} />
                </button>
                <span className="w-8 text-center font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  {visitorCount}
                </span>
                <button
                  type="button"
                  onClick={() => setVisitorCount((prev) => prev + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 transition hover:bg-zinc-100 active:scale-95 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </section>

          {/* Card 3: อัปโหลดรูปภาพบรรยากาศ / กิจกรรม */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
                <Camera size={16} className="text-purple-600 dark:text-purple-400" />
                3. ภาพบรรยากาศ / กลุ่มแคร์
              </h2>
              <span className="text-xs text-zinc-400 font-mono">{photos.length}/8 รูป</span>
            </div>

            {/* Hidden Inputs */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                void handleFiles(e.target.files);
                e.target.value = "";
              }}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                void handleFiles(e.target.files);
                e.target.value = "";
              }}
              className="hidden"
            />

            {/* Photo Preview Grid */}
            {photos.length > 0 && (
              <div className="mt-3.5 grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                {photos.map((p) => (
                  <div
                    key={p.id}
                    className="group relative aspect-square overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800"
                  >
                    <img
                      src={p.previewUrl}
                      alt="รูปภาพกลุ่ม"
                      className="h-full w-full object-cover"
                    />
                    {p.uploading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
                        <Loader2 size={20} className="animate-spin" />
                      </div>
                    )}
                    {p.error && (
                      <div className="absolute inset-0 flex items-center justify-center bg-rose-950/70 p-1 text-center text-[10px] text-white">
                        ล้มเหลว
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removePhoto(p.id)}
                      className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload Buttons */}
            <div className="mt-3.5 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 px-3 py-3.5 text-xs font-semibold text-zinc-700 transition hover:border-purple-400 hover:bg-purple-50/30 active:scale-98 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-300"
              >
                <Camera size={16} className="text-purple-600 dark:text-purple-400" />
                ถ่ายรูปจากกล้อง
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 px-3 py-3.5 text-xs font-semibold text-zinc-700 transition hover:border-blue-400 hover:bg-blue-50/30 active:scale-98 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-300"
              >
                <Upload size={16} className="text-blue-600 dark:text-blue-400" />
                เลือกจากคลังภาพ
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] text-zinc-400">
              รองรับ JPEG, PNG, WebP ขนาดไม่เกิน 4 MB ต่อรูป
            </p>
          </section>

          {/* Card 4: เรื่องราว & หัวข้ออธิษฐาน */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
              <MessageSquare size={16} className="text-amber-600 dark:text-amber-400" />
              4. รายละเอียด & หัวข้ออธิษฐาน
            </h2>

            <div className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  คำพยาน / พระพร / เรื่องราวในกลุ่ม (ถ้ามี)
                </label>
                <textarea
                  rows={3}
                  value={story}
                  onChange={(e) => setStory(e.target.value)}
                  placeholder="เช่น พี่น้องได้แบ่งปันพระพรเรื่องการรักษาโรค บรรยากาศมีความสุขและอบอุ่น..."
                  className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-900 outline-none transition focus:border-blue-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  หัวข้ออธิษฐานเผื่อ (ถ้ามี)
                </label>
                <textarea
                  rows={2}
                  value={prayerRequests}
                  onChange={(e) => setPrayerRequests(e.target.value)}
                  placeholder="เช่น ขอการเสริมกำลังครอบครัวคุณสมศักดิ์ และการสอบของน้องพลอย..."
                  className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-900 outline-none transition focus:border-blue-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
            </div>
          </section>

          {/* Action Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-4 text-base font-bold text-white shadow-md transition-all hover:bg-emerald-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  กำลังบันทึกรายงาน...
                </>
              ) : (
                <>
                  <Send size={18} />
                  ส่งรายงาน & บันทึกเช็คชื่อ
                </>
              )}
            </button>
            <p className="mt-2 text-center text-xs text-zinc-400">
              รายงานจะถูกบันทึกเข้าสู่ระบบ และจัดส่งให้ศิษยาภิบาล/ผู้นำพันธกิจ
            </p>
          </div>
        </form>
      </div>
    </MemberAppLayout>
  );
}
