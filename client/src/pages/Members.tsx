import { useCallback, useEffect, useState } from "react";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Heart,
  Pencil,
  QrCode,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { AppLayout } from "@/components/layout/AppLayout";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TableSkeleton } from "@/components/LoadingStates";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError, type ApiMeta } from "@/lib/api";
import type { Gender, MembershipStatus } from "@shared/schema";
import { MEMBERSHIP_STATUS_LABELS } from "@shared/labels";
import {
  ADMIN_ROLES,
  MEMBER_CREATE_ROLES,
  MEMBER_UPDATE_ROLES,
  hasRole,
} from "@shared/roles";
// Thai labels live in shared/labels.ts (same map the Member PWA renders),
// so admin and member surfaces can never show different words for a status.
const MEMBERSHIP_STATUS_TONES: Record<MembershipStatus, string> = {
  active: "green",
  visitor: "blue",
  candidate: "orange",
  transferred: "purple",
  inactive: "pink",
};

interface Member {
  id: string;
  name: string;
  nickname: string | null;
  avatarUrl: string | null;
  gender: Gender | null;
  birthDate: string | null;
  phone: string | null;
  email: string | null;
  lineId: string | null;
  address: string | null;
  role: string;
  area: string | null;
  group: string | null;
  membershipStatus: MembershipStatus;
  status: "ติดตามแล้ว" | "ต้องติดตาม";
  assignedLeaderId: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  consentGiven: boolean;
  joinedAt: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

const EMPTY_FORM = {
  name: "",
  nickname: "",
  gender: "" as Gender | "",
  birthDate: "",
  phone: "",
  email: "",
  lineId: "",
  address: "",
  role: "สมาชิก",
  area: "",
  group: "",
  membershipStatus: "visitor" as MembershipStatus,
  status: "ต้องติดตาม" as Member["status"],
  emergencyContactName: "",
  emergencyContactPhone: "",
  emergencyContactRelation: "",
  consentGiven: false,
  notes: "",
};

const tones = ["blue", "pink", "orange", "purple", "green"] as const;
function toneFor(name: string) {
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return tones[sum % tones.length];
}

function formatDate(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

export default function Members() {
  const { user } = useAuth();
  // Gates mirror the server route gates exactly, from the shared sets in
  // shared/roles.ts: POST /api/members takes MEMBER_CREATE_ROLES, PUT
  // /api/members/:id and the CSV export take MEMBER_UPDATE_ROLES, DELETE and
  // restore take ADMIN_ROLES. (Previously one `canManage` flag covered both
  // create and edit, so a group_leader saw "เพิ่มสมาชิก" and got a 403 on
  // submit.)
  const canCreate = hasRole(user?.role, MEMBER_CREATE_ROLES);
  const canManage = hasRole(user?.role, MEMBER_UPDATE_ROLES);
  const canDelete = hasRole(user?.role, ADMIN_ROLES);

  const [members, setMembers] = useState<Member[]>([]);
  const [meta, setMeta] = useState<ApiMeta>({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [area, setArea] = useState("ทั้งหมด");
  const [status, setStatus] = useState("ทั้งหมด");
  const [membershipStatus, setMembershipStatus] = useState("ทั้งหมด");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (selectedMember) {
      QRCode.toDataURL(`PK-MEM-${selectedMember.id}`, { width: 140, margin: 1, color: { dark: "#272729", light: "#ffffff" } })
        .then(setQrCodeDataUrl)
        .catch(() => setQrCodeDataUrl(""));
    } else {
      setQrCodeDataUrl("");
    }
  }, [selectedMember]);

  const loadMembers = useCallback(
    async (pageToLoad: number = 1) => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("page", String(pageToLoad));
        params.set("limit", "15");
        if (query.trim()) params.set("search", query.trim());
        if (area !== "ทั้งหมด") params.set("area", area);
        if (status !== "ทั้งหมด") params.set("status", status);
        if (membershipStatus !== "ทั้งหมด") params.set("membershipStatus", membershipStatus);

        const res = await api.getWithMeta<Member[]>(`/api/members?${params.toString()}`);
        setMembers(res.data || []);
        if (res.meta) setMeta(res.meta);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "โหลดข้อมูลสมาชิกไม่สำเร็จ");
      } finally {
        setIsLoading(false);
      }
    },
    [query, area, status, membershipStatus]
  );

  useEffect(() => {
    loadMembers(1);
  }, [loadMembers]);

  // Check duplicate phone or email as user types
  useEffect(() => {
    if (!formOpen) return;
    const checkTimer = setTimeout(async () => {
      const phone = form.phone.trim();
      const email = form.email.trim();
      if (!phone && !email) {
        setDuplicateWarning(null);
        return;
      }
      try {
        const params = new URLSearchParams();
        if (phone) params.set("phone", phone);
        if (email) params.set("email", email);
        if (editing) params.set("excludeId", editing.id);
        const res = await api.get<{
          isDuplicate: boolean;
          conflictField?: string;
          existingMemberName?: string;
        }>(`/api/members/check-duplicate?${params.toString()}`);
        if (res.isDuplicate) {
          const fieldLabel = res.conflictField === "phone" ? "เบอร์โทรศัพท์" : "อีเมล";
          setDuplicateWarning(`คำเตือน: ${fieldLabel}นี้ตรงกับ "${res.existingMemberName}"`);
        } else {
          setDuplicateWarning(null);
        }
      } catch {
        // ignore duplicate check errors
      }
    }, 400);

    return () => clearTimeout(checkTimer);
  }, [form.phone, form.email, formOpen, editing]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDuplicateWarning(null);
    setFormOpen(true);
  };

  const openEdit = (m: Member) => {
    setEditing(m);
    setForm({
      name: m.name,
      nickname: m.nickname ?? "",
      gender: m.gender ?? "",
      birthDate: m.birthDate ? m.birthDate.split("T")[0] : "",
      phone: m.phone ?? "",
      email: m.email ?? "",
      lineId: m.lineId ?? "",
      address: m.address ?? "",
      role: m.role,
      area: m.area ?? "",
      group: m.group ?? "",
      membershipStatus: m.membershipStatus ?? "visitor",
      status: m.status,
      emergencyContactName: m.emergencyContactName ?? "",
      emergencyContactPhone: m.emergencyContactPhone ?? "",
      emergencyContactRelation: m.emergencyContactRelation ?? "",
      consentGiven: m.consentGiven ?? false,
      notes: m.notes ?? "",
    });
    setDuplicateWarning(null);
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        gender: form.gender ? form.gender : null,
        birthDate: form.birthDate ? new Date(form.birthDate).toISOString() : null,
      };

      if (editing) {
        await api.put(`/api/members/${editing.id}`, payload);
        toast.success("บันทึกการแก้ไขสมาชิกแล้ว");
      } else {
        await api.post("/api/members", payload);
        toast.success("เพิ่มสมาชิกใหม่เรียบร้อยแล้ว");
      }
      setFormOpen(false);
      loadMembers(meta.page);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/members/${deleteTarget.id}`);
      toast.success("ลบสมาชิกแล้ว (สามารถกู้คืนได้)");
      setDeleteTarget(null);
      loadMembers(meta.page);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ลบไม่สำเร็จ");
    } finally {
      setDeleting(false);
    }
  };

  const handleExportCsv = () => {
    window.open("/api/members/export/csv", "_blank");
    toast.info("กำลังเริ่มดาวน์โหลดไฟล์ CSV...");
  };

  const followedUpCount = members.filter((m) => m.status === "ติดตามแล้ว").length;
  const needFollowUpCount = members.filter((m) => m.status === "ต้องติดตาม").length;
  const areaOptions = Array.from(new Set(members.map((member) => member.area).filter(Boolean))) as string[];

  return (
    <AppLayout>
      {/* Page Heading */}
      <div className="member-page-hero mb-6 flex flex-col gap-5 rounded-[24px] border border-blue-100 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-700">
            <Users size={13} /> CHURCH MEMBERS
          </span>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-[var(--color-primary)] sm:text-3xl">
            จัดการสมาชิก
          </h1>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-600 sm:text-sm">
            ค้นหา ดูแล และเชื่อมโยงสมาชิกกับกลุ่มย่อยได้จากพื้นที่เดียว
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <button
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
              type="button"
              onClick={handleExportCsv}
            >
              <Download size={ICON_SIZE.sm} /> Export CSV
            </button>
          )}
          {canCreate && (
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors shadow-xs"
              type="button"
              onClick={openCreate}
            >
              <UserPlus size={ICON_SIZE.sm} /> เพิ่มสมาชิก
            </button>
          )}
        </div>
      </div>

      {/* TailAdmin 4-Card Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <div className="tailadmin-card p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              สมาชิกในระบบ
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Users size={ICON_SIZE.md} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-slate-800">
              {meta.total}
            </span>
            <span className="text-xs text-slate-500 font-medium">คน</span>
          </div>
        </div>

        <div className="tailadmin-card p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              ติดตามแล้ว
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Heart size={ICON_SIZE.md} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-slate-800">
              {followedUpCount}
            </span>
            <span className="text-xs text-slate-500 font-medium">คนในหน้านี้</span>
          </div>
        </div>

        <div className="tailadmin-card p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              ต้องติดตาม
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <AlertCircle size={ICON_SIZE.md} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-slate-800">
              {needFollowUpCount}
            </span>
            <span className="text-xs text-slate-500 font-medium">คนในหน้านี้</span>
          </div>
        </div>

        <div className="tailadmin-card p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              หน้าปัจจุบัน
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <CalendarDays size={ICON_SIZE.md} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-slate-800">
              {meta.page}
            </span>
            <span className="text-xs text-slate-500 font-medium">จาก {meta.totalPages} หน้า</span>
          </div>
        </div>
      </div>

      {/* TailAdmin Table Card */}
      <section className="tailadmin-card overflow-hidden border-blue-100 shadow-[0_12px_32px_rgba(36,92,146,0.07)]">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-blue-100 bg-[#f7fbff] p-4 sm:p-5">
          <div className="relative flex-1 min-w-[240px]">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              <Search size={ICON_SIZE.sm} />
            </span>
            <input
              type="text"
              className="w-full rounded-2xl border border-blue-100 bg-white py-3 pl-10 pr-9 text-xs text-slate-800 shadow-[0_6px_18px_rgba(36,92,146,0.05)] placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 sm:text-sm"
              placeholder="ค้นหาชื่อ, ชื่อเล่น, เบอร์โทร หรืออีเมล..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={ICON_SIZE.xs} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">พื้นที่:</span>
            <select
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="rounded-xl border border-blue-100 bg-white px-3 py-2.5 text-xs text-slate-700 focus:border-blue-500 focus:outline-none"
            >
              <option value="ทั้งหมด">ทุกพื้นที่</option>
              {areaOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">สถานะ:</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-700 focus:border-blue-500 focus:outline-none"
            >
              <option value="ทั้งหมด">ทั้งหมด</option>
              <option value="ติดตามแล้ว">ติดตามแล้ว</option>
              <option value="ต้องติดตาม">ต้องติดตาม</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">ประเภทสมาชิก:</span>
            <select
              value={membershipStatus}
              onChange={(e) => setMembershipStatus(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-700 focus:border-blue-500 focus:outline-none"
            >
              <option value="ทั้งหมด">ทั้งหมด</option>
              <option value="active">สมาชิกประจำ</option>
              <option value="visitor">ผู้สนใจ/เยี่ยมเยียน</option>
              <option value="candidate">ผู้เตรียมรับเชื่อ</option>
              <option value="transferred">ย้ายคริสตจักร</option>
              <option value="inactive">ขาดการติดต่อ</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="p-10 text-center text-rose-600">
            <AlertCircle size={ICON_SIZE.xl} className="mx-auto mb-2 text-rose-500" />
            <h3 className="font-bold text-sm">เกิดข้อผิดพลาด</h3>
            <p className="text-xs text-slate-500 mt-1">{error}</p>
            <button
              className="mt-4 rounded-xl bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-100"
              onClick={() => loadMembers(meta.page)}
            >
              ลองใหม่อีกครั้ง
            </button>
          </div>
        )}

        {isLoading && !error && <TableSkeleton rows={6} />}

        {!isLoading && !error && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-3.5 px-4">สมาชิก</th>
                    <th className="py-3.5 px-4">เพศ / วันเกิด</th>
                    <th className="py-3.5 px-4">เบอร์โทร</th>
                    <th className="py-3.5 px-4">สถานะสมาชิก</th>
                    <th className="py-3.5 px-4">พื้นที่ / กลุ่ม</th>
                    <th className="py-3.5 px-4">การติดตาม</th>
                    <th className="py-3.5 px-4">วันที่เริ่ม</th>
                    <th className="py-3.5 px-4 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {members.map((m) => {
                    const tone = toneFor(m.name);
                    const memLabel =
                      MEMBERSHIP_STATUS_LABELS[m.membershipStatus] ?? m.membershipStatus;
                    const memTone = MEMBERSHIP_STATUS_TONES[m.membershipStatus] ?? "blue";
                    return (
                      <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                              {m.name.slice(0, 1)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800 truncate">
                                {m.name} {m.nickname ? `(${m.nickname})` : ""}
                              </p>
                              <p className="text-[11px] text-slate-400 truncate">
                                {m.email || m.role}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          <span>{m.gender === "male" ? "ชาย" : m.gender === "female" ? "หญิง" : "-"}</span>
                          <small className="block text-slate-400 text-[10px]">{formatDate(m.birthDate)}</small>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-700">{m.phone || "-"}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                            memTone === "green"
                              ? "bg-emerald-50 text-emerald-700"
                              : memTone === "orange"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-blue-50 text-blue-700"
                          }`}>
                            {memLabel}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          <div className="font-medium text-slate-800">{m.area || "-"}</div>
                          <small className="text-slate-400 text-[10px]">{m.group || "ยังไม่มีกลุ่ม"}</small>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                              m.status === "ติดตามแล้ว"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {m.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500">{formatDate(m.joinedAt)}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600 transition-colors"
                              onClick={() => setSelectedMember(m)}
                              title="ดูข้อมูลละเอียด"
                              aria-label="ดูข้อมูลละเอียด"
                            >
                              <Eye size={ICON_SIZE.sm} />
                            </button>
                            {canManage && (
                              <button
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                                onClick={() => openEdit(m)}
                                title="แก้ไขข้อมูล"
                                aria-label="แก้ไขข้อมูล"
                              >
                                <Pencil size={ICON_SIZE.sm} />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                                onClick={() => setDeleteTarget(m)}
                                title="ลบสมาชิก"
                                aria-label="ลบสมาชิก"
                              >
                                <Trash2 size={ICON_SIZE.sm} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {members.length === 0 && (
                <div className="p-12 text-center text-slate-400">
                  <Users size={40} className="mx-auto text-slate-300 mb-2" />
                  <h3 className="font-semibold text-slate-700 text-sm">ไม่พบสมาชิก</h3>
                  <p className="text-xs text-slate-400 mt-1">ลองเปลี่ยนคำค้นหาหรือตัวกรองดูอีกครั้ง</p>
                </div>
              )}
            </div>

            {/* Pagination Controls */}
            {meta.totalPages > 1 && (
              <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
                <span>
                  แสดงผล {members.length} รายการ (จากทั้งหมด {meta.total} รายการ)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    disabled={meta.page <= 1}
                    onClick={() => loadMembers(meta.page - 1)}
                  >
                    <ChevronLeft size={ICON_SIZE.xs} /> ก่อนหน้า
                  </button>
                  <span className="px-2 font-medium text-slate-700">
                    หน้า {meta.page} / {meta.totalPages}
                  </span>
                  <button
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    disabled={meta.page >= meta.totalPages}
                    onClick={() => loadMembers(meta.page + 1)}
                  >
                    ถัดไป <ChevronRight size={ICON_SIZE.xs} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* Create / Edit Modal */}
      {formOpen && (
        <div className="modal-backdrop" onClick={() => setFormOpen(false)}>
          <div className="modal-card modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-heading">
              <h2>{editing ? "แก้ไขข้อมูลสมาชิก" : "เพิ่มสมาชิกใหม่"}</h2>
              <button onClick={() => setFormOpen(false)}>
                <X size={ICON_SIZE.sm} />
              </button>
            </div>

            {duplicateWarning && (
              <div
                style={{
                  background: "#fff2d9",
                  color: "#a05b10",
                  padding: "8px 12px",
                  borderRadius: 8,
                  fontSize: 12,
                  marginBottom: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <AlertCircle size={16} />
                <span>{duplicateWarning}</span>
              </div>
            )}

            <form className="form-grid" onSubmit={handleSubmit}>
              {/* Section 1: ข้อมูลพื้นฐาน */}
              <label>
                ชื่อ-นามสกุล *
                <input
                  required
                  placeholder="เช่น สมชาย สุขเกษม"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label>
                ชื่อเล่น
                <input
                  placeholder="เช่น ต้น"
                  value={form.nickname}
                  onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                />
              </label>
              <label>
                เพศ
                <select
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value as Gender })}
                >
                  <option value="">-- ไม่ระบุ --</option>
                  <option value="male">ชาย</option>
                  <option value="female">หญิง</option>
                  <option value="other">อื่นๆ</option>
                </select>
              </label>
              <label>
                วันเกิด
                <input
                  type="date"
                  value={form.birthDate}
                  onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                />
              </label>

              {/* Section 2: การติดต่อ */}
              <label>
                เบอร์โทรศัพท์
                <input
                  placeholder="081-234-5678"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </label>
              <label>
                อีเมล
                <input
                  type="email"
                  placeholder="member@email.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </label>
              <label>
                LINE ID
                <input
                  placeholder="ไอดีไลน์สำหรับติดต่อ"
                  value={form.lineId}
                  onChange={(e) => setForm({ ...form, lineId: e.target.value })}
                />
              </label>
              <label>
                สถานะสมาชิก
                <select
                  value={form.membershipStatus}
                  onChange={(e) =>
                    setForm({ ...form, membershipStatus: e.target.value as MembershipStatus })
                  }
                >
                  <option value="visitor">ผู้สนใจ/เยี่ยมเยียน</option>
                  <option value="active">สมาชิกประจำ</option>
                  <option value="candidate">ผู้เตรียมรับเชื่อ</option>
                  <option value="transferred">ย้ายคริสตจักร</option>
                  <option value="inactive">ขาดการติดต่อ</option>
                </select>
              </label>
              <label className="full-field">
                ที่อยู่ปัจจุบัน
                <input
                  placeholder="บ้านเลขที่ หมู่บ้าน ตำบล อำเภอ จังหวัด"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </label>

              {/* Section 3: พันธกิจ & กลุ่ม */}
              <label>
                พื้นที่ (Area)
                <input
                  placeholder="เช่น อ.เมืองกาฬสินธุ์"
                  value={form.area}
                  onChange={(e) => setForm({ ...form, area: e.target.value })}
                />
              </label>
              <label>
                กลุ่มย่อย (Cell Group)
                <input
                  placeholder="เช่น กลุ่มบ้านสันติสุข"
                  value={form.group}
                  onChange={(e) => setForm({ ...form, group: e.target.value })}
                />
              </label>
              <label>
                สถานะการดูแล
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as Member["status"] })}
                >
                  <option value="ต้องติดตาม">ต้องติดตาม</option>
                  <option value="ติดตามแล้ว">ติดตามแล้ว</option>
                </select>
              </label>
              <label>
                บทบาทในคริสตจักร
                <input
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                />
              </label>

              {/* Section 4: ผู้ติดต่อฉุกเฉิน */}
              <label>
                ผู้ติดต่อฉุกเฉิน
                <input
                  placeholder="ชื่อ-นามสกุล"
                  value={form.emergencyContactName}
                  onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })}
                />
              </label>
              <label>
                เบอร์โทรฉุกเฉิน
                <input
                  placeholder="เบอร์โทรติดต่อฉุกเฉิน"
                  value={form.emergencyContactPhone}
                  onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })}
                />
              </label>

              {/* Section 5: PDPA & หมายเหตุภายใน */}
              <label className="full-field" style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <input
                  type="checkbox"
                  style={{ width: "auto" }}
                  checked={form.consentGiven}
                  onChange={(e) => setForm({ ...form, consentGiven: e.target.checked })}
                />
                <span>ยินยอมให้คริสตจักรเก็บรวบรวมและใช้ข้อมูลส่วนบุคคลตามนโยบายคุ้มครองข้อมูล (PDPA Consent)</span>
              </label>

              <label className="full-field">
                บันทึกฝ่ายอภิบาล (Pastoral Notes - เฉพาะเจ้าหน้าที่)
                <textarea
                  rows={3}
                  placeholder="ข้อมูลคำอธิษฐาน ความต้องการฝ่ายวิญญาณ หรือบันทึกการเยี่ยมเยียน..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </label>

              <div className="modal-actions full-field">
                <button type="button" className="cancel-button" onClick={() => setFormOpen(false)}>
                  ยกเลิก
                </button>
                <button type="submit" className="primary-action" disabled={submitting}>
                  {submitting ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Member Detailed Profile View */}
      {selectedMember && (
        <div className="modal-backdrop" onClick={() => setSelectedMember(null)}>
          <div className="modal-card modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-heading">
              <h2>ข้อมูลสมาชิกโดยละเอียด</h2>
              <button onClick={() => setSelectedMember(null)}>
                <X size={ICON_SIZE.sm} />
              </button>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "16px",
                background: "var(--color-canvas-soft)",
                borderRadius: 14,
                marginBottom: 16,
              }}
            >
              <div
                className={`member-avatar ${toneFor(selectedMember.name)}`}
                style={{ width: 56, height: 56, fontSize: 24, borderRadius: 16 }}
              >
                {selectedMember.name.slice(0, 1)}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: "0 0 4px", fontSize: 18, color: "var(--ink)" }}>
                  {selectedMember.name} {selectedMember.nickname ? `(${selectedMember.nickname})` : ""}
                </h3>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <span className="role-chip blue">{selectedMember.role}</span>
                  <span className="role-chip green">
                    {MEMBERSHIP_STATUS_LABELS[selectedMember.membershipStatus] ?? selectedMember.membershipStatus}
                  </span>
                  <span className={`status-chip ${selectedMember.status === "ติดตามแล้ว" ? "good" : "attention"}`}>
                    {selectedMember.status}
                  </span>
                  {selectedMember.consentGiven && (
                    <span style={{ fontSize: 10, color: "#1e9b68", display: "flex", alignItems: "center", gap: 3 }}>
                      <ShieldCheck size={12} /> ยินยอม PDPA แล้ว
                    </span>
                  )}
                </div>
              </div>

              {qrCodeDataUrl && (
                <div style={{ textAlign: "center", background: "#fff", padding: "8px", borderRadius: "12px", border: "1px solid #d9e6f3", flexShrink: 0 }}>
                  <img src={qrCodeDataUrl} alt="Member QR Code" style={{ width: "80px", height: "80px", display: "block" }} />
                  <div style={{ fontSize: "9px", color: "#6a7e93", marginTop: "3px", fontWeight: 600 }}>Personal QR</div>
                </div>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, fontSize: 12 }}>
              <div style={{ background: "#fff", border: "1px solid #edf2f6", borderRadius: 12, padding: 12 }}>
                <strong style={{ display: "block", color: "var(--ink)", marginBottom: 8 }}>ข้อมูลการติดต่อ</strong>
                <p style={{ margin: "4px 0", color: "#60758c" }}>เบอร์โทร: <b>{selectedMember.phone || "ไม่มีข้อมูล"}</b></p>
                <p style={{ margin: "4px 0", color: "#60758c" }}>อีเมล: <b>{selectedMember.email || "ไม่มีข้อมูล"}</b></p>
                <p style={{ margin: "4px 0", color: "#60758c" }}>LINE ID: <b>{selectedMember.lineId || "ไม่มีข้อมูล"}</b></p>
                <p style={{ margin: "4px 0", color: "#60758c" }}>ที่อยู่: <b>{selectedMember.address || "ไม่มีข้อมูล"}</b></p>
              </div>

              <div style={{ background: "#fff", border: "1px solid #edf2f6", borderRadius: 12, padding: 12 }}>
                <strong style={{ display: "block", color: "var(--ink)", marginBottom: 8 }}>ข้อมูลคริสตจักร & ฉุกเฉิน</strong>
                <p style={{ margin: "4px 0", color: "#60758c" }}>พื้นที่: <b>{selectedMember.area || "-"}</b></p>
                <p style={{ margin: "4px 0", color: "#60758c" }}>กลุ่มย่อย: <b>{selectedMember.group || "ยังไม่มีกลุ่ม"}</b></p>
                <p style={{ margin: "4px 0", color: "#60758c" }}>วันที่เข้าร่วม: <b>{formatDate(selectedMember.joinedAt)}</b></p>
                <p style={{ margin: "4px 0", color: "#60758c" }}>ผู้ติดต่อฉุกเฉิน: <b>{selectedMember.emergencyContactName ? `${selectedMember.emergencyContactName} (${selectedMember.emergencyContactPhone || "-"})` : "ไม่มีข้อมูล"}</b></p>
              </div>
            </div>

            {selectedMember.notes && (
              <div style={{ marginTop: 14, background: "#fdfbf7", border: "1px solid #f0e6d2", borderRadius: 12, padding: 12 }}>
                <strong style={{ display: "block", color: "#9a6a16", marginBottom: 4, fontSize: 11 }}>บันทึกฝ่ายอภิบาล (Pastoral Care Notes)</strong>
                <p style={{ margin: 0, fontSize: 12, color: "#594827", lineHeight: 1.5 }}>{selectedMember.notes}</p>
              </div>
            )}

            <div style={{ marginTop: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <strong style={{ color: "var(--ink)", fontSize: 12 }}>กิจกรรมพันธกิจล่าสุด</strong>
                <button
                  type="button"
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--blue)",
                    background: "none",
                    border: "1px dashed #b9d3ec",
                    borderRadius: 10,
                    padding: "4px 10px",
                    cursor: "pointer",
                  }}
                  onClick={async () => {
                    try {
                      await api.post("/api/follow-ups", {
                        title: `ติดตาม: ${selectedMember.name}`,
                        subjectMemberId: selectedMember.id,
                      });
                      toast.success("สร้างรายการติดตามแล้ว");
                    } catch (err) {
                      toast.error(err instanceof ApiError ? err.message : "สร้างรายการติดตามไม่สำเร็จ");
                    }
                  }}
                >
                  + สร้างรายการติดตาม
                </button>
              </div>
              <ActivityTimeline subjectType="member" subjectId={selectedMember.id} />
            </div>

            <div className="modal-actions" style={{ marginTop: 20 }}>
              <button type="button" className="cancel-button" onClick={() => setSelectedMember(null)}>
                ปิดหน้าต่าง
              </button>
              {canManage && (
                <button
                  type="button"
                  className="primary-action"
                  onClick={() => {
                    const target = selectedMember;
                    setSelectedMember(null);
                    openEdit(target);
                  }}
                >
                  <Pencil size={ICON_SIZE.sm} /> แก้ไขข้อมูลนี้
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm Soft Delete */}
      {deleteTarget && (
        <ConfirmDialog
          title="ยืนยันการลบสมาชิก"
          description={`ต้องการลบ "${deleteTarget.name}" ออกจากรายชื่อสมาชิกใช่หรือไม่? (ข้อมูลจะถูกย้ายไปถังขยะและสามารถกู้คืนได้)`}
          isSubmitting={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </AppLayout>
  );
}
