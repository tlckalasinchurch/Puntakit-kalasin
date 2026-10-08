import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Pencil,
  Plus,
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
import { DateField } from "@/components/DateField";
import { TableSkeleton } from "@/components/LoadingStates";
import {
  EmptyState,
  ErrorState,
  Field,
  FormError,
  InitialsAvatar,
  Modal,
  PageHeader,
  StatusChip,
  type StatusTone,
  FilterDisclosure,
} from "@/components/DesignSystem";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { useAuth } from "@/contexts/AuthContext";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { api, ApiError, type ApiMeta, withRecheckHint } from "@/lib/api";
import type { Gender, MembershipStatus } from "@shared/schema";
import { MEMBERSHIP_STATUS_LABELS } from "@shared/labels";
import {
  ADMIN_ROLES,
  MEMBER_CREATE_ROLES,
  MEMBER_UPDATE_ROLES,
  hasRole,
} from "@shared/roles";
import { useLocation, useSearch, useSearchParams } from "wouter";
import { usePageTitle } from "@/hooks/usePageTitle";

// Thai labels live in shared/labels.ts (same map the Member PWA renders), so
// admin and member surfaces can never show different words for a status.
// Tones come from the fixed semantic palette in design.md §2 — a membership
// status is never expressed as an arbitrary colour choice.
const MEMBERSHIP_STATUS_TONES: Record<MembershipStatus, StatusTone> = {
  active: "success",
  visitor: "info",
  candidate: "warning",
  transferred: "neutral",
  inactive: "error",
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
  /** Current care group (a real membership), with its body. */
  careGroup: { id: string; name: string; bodyName: string | null } | null;
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
  careGroupId: "",
  membershipStatus: "visitor" as MembershipStatus,
  status: "ต้องติดตาม" as Member["status"],
  emergencyContactName: "",
  emergencyContactPhone: "",
  emergencyContactRelation: "",
  consentGiven: false,
  notes: "",
};

function formatDate(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const INPUT_CLASS =
  "min-h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 text-base text-[var(--color-ink)] placeholder:text-[var(--color-text-quaternary)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-focus)]/30";
const SELECT_CLASS = `${INPUT_CLASS} pr-8`;

/** One person, as a card. The mobile-primary presentation of a member row. */
function MemberCard({
  member,
  onOpen,
}: {
  member: Member;
  onOpen: () => void;
}) {
  const membershipLabel =
    MEMBERSHIP_STATUS_LABELS[member.membershipStatus] ?? member.membershipStatus;

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full min-h-11 items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-4 text-left transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
      >
        <InitialsAvatar name={member.name} />
        <span className="min-w-0 flex-1">
          <span className="type-body-strong block truncate text-[var(--color-ink)]">
            {member.name}
            {member.nickname ? ` (${member.nickname})` : ""}
          </span>
          <span className="type-caption mt-0.5 block truncate text-[var(--color-body-muted)]">
            {member.phone || member.email || "ยังไม่มีข้อมูลติดต่อ"}
          </span>
          <span className="mt-2 flex flex-wrap items-center gap-1.5">
            <StatusChip tone={MEMBERSHIP_STATUS_TONES[member.membershipStatus]}>
              {membershipLabel}
            </StatusChip>
            <StatusChip
              tone={member.status === "ติดตามแล้ว" ? "success" : "warning"}
            >
              {member.status}
            </StatusChip>
          </span>
          <span className="type-fine mt-2 block text-[var(--color-text-tertiary)]">
            {member.area ? `${member.area} · ` : ""}
            {member.careGroup?.name ?? member.group ?? "ยังไม่มีกลุ่ม"} · เข้าร่วม{" "}
            {formatDate(member.joinedAt)}
          </span>
        </span>
      </button>
    </li>
  );
}

export default function Members() {
  usePageTitle("สมาชิก");
  const { user } = useAuth();
  const [, navigate] = useLocation();
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
  const [errorTechnical, setErrorTechnical] = useState<string | null>(null);

  // Filters, page and the open member detail live in the URL, so a view of the
  // list survives refresh, can be shared as a link, and Back/Forward steps
  // through filter/page/detail changes. `?search=…` is the incoming format the
  // home and top-bar search produce; once the user edits the box it is
  // normalised to `q`.
  const [searchParams, setSearchParams] = useSearchParams();
  const query =
    searchParams.get("q") ?? searchParams.get("search") ?? "";
  const area = searchParams.get("area") ?? "ทั้งหมด";
  const status = searchParams.get("status") ?? "ทั้งหมด";
  const membershipStatus = searchParams.get("membershipStatus") ?? "ทั้งหมด";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const selectedMemberId = searchParams.get("member");
  // Still read raw for the org-chart deep links below: they are deliberately
  // transient (?care=… / ?new=1 are consumed once and then stripped).
  const urlSearch = useSearch();

  const updateParams = useCallback(
    (
      mutate: (params: URLSearchParams) => void,
      options?: { replace?: boolean }
    ) => {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        mutate(next);
        return next.toString();
      }, options);
    },
    [setSearchParams]
  );

  const setQuery = (value: string) =>
    updateParams(
      p => {
        if (value) p.set("q", value);
        else p.delete("q");
        p.delete("search"); // never keep both spellings of the same filter
        p.delete("page"); // a new search restarts at page 1
      },
      { replace: true }
    );
  const setArea = (value: string) =>
    updateParams(p => {
      if (value && value !== "ทั้งหมด") p.set("area", value);
      else p.delete("area");
      p.delete("page");
    });
  const setStatus = (value: string) =>
    updateParams(p => {
      if (value && value !== "ทั้งหมด") p.set("status", value);
      else p.delete("status");
      p.delete("page");
    });
  const setMembershipStatus = (value: string) =>
    updateParams(p => {
      if (value && value !== "ทั้งหมด") p.set("membershipStatus", value);
      else p.delete("membershipStatus");
      p.delete("page");
    });
  const goToPage = (value: number) =>
    updateParams(p => {
      if (value > 1) p.set("page", String(value));
      else p.delete("page");
    });
  const openMember = (m: Member) => updateParams(p => p.set("member", m.id));
  const closeMember = () =>
    updateParams(p => p.delete("member"), { replace: true });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Care groups grouped by body, for the form picker and the list filter. The
  // org overview is limited to staff roles; without it the picker simply hides.
  const [careOptions, setCareOptions] = useState<{ body: string; cares: { id: string; name: string }[] }[]>([]);
  const [careFilter, setCareFilter] = useState("");
  useEffect(() => {
    api
      .get<{ bodies: { name: string; careGroups: { id: string; name: string }[] }[] }>("/api/org/overview")
      .then((o) => setCareOptions(o.bodies.map((b) => ({ body: b.name, cares: b.careGroups }))))
      .catch(() => setCareOptions([]));
  }, []);

  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [creatingFollowUp, setCreatingFollowUp] = useState(false);

  useEffect(() => {
    if (selectedMember) {
      QRCode.toDataURL(`PK-MEM-${selectedMember.id}`, { width: 140, margin: 1, color: { dark: "#272729", light: "#ffffff" } })
        .then(setQrCodeDataUrl)
        .catch(() => setQrCodeDataUrl(""));
    } else {
      setQrCodeDataUrl("");
    }
  }, [selectedMember]);

  // Deep-link support: `?member=<id>` fetches the member directly so a
  // shared link opens the detail dialog even when the member is on another
  // page of the list. A dead or inaccessible id cleans itself from the URL.
  useEffect(() => {
    if (!selectedMemberId) {
      setSelectedMember(null);
      return;
    }
    if (selectedMember?.id === selectedMemberId) return;
    let cancelled = false;
    api
      .get<Member>(`/api/members/${selectedMemberId}`)
      .then(m => {
        if (!cancelled) setSelectedMember(m);
      })
      .catch(() => {
        if (!cancelled) closeMember();
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMemberId]);

  // Typing fires a query change per keystroke; only the settled value hits the API,
  // and a slower earlier response never overwrites a newer one.
  const debouncedQuery = useDebouncedValue(query, 300);
  const loadSeq = useRef(0);
  const loadMembers = useCallback(
    async (pageToLoad: number = 1) => {
      const seq = ++loadSeq.current;
      setIsLoading(true);
      setError(null);
      setErrorTechnical(null);
      try {
        const params = new URLSearchParams();
        params.set("page", String(pageToLoad));
        params.set("limit", "15");
        if (debouncedQuery.trim()) params.set("search", debouncedQuery.trim());
        if (area !== "ทั้งหมด") params.set("area", area);
        if (careFilter) params.set("careGroupId", careFilter);
        if (status !== "ทั้งหมด") params.set("status", status);
        if (membershipStatus !== "ทั้งหมด") params.set("membershipStatus", membershipStatus);

        const res = await api.getWithMeta<Member[]>(`/api/members?${params.toString()}`);
        if (seq !== loadSeq.current) return;
        setMembers(res.data || []);
        if (res.meta) setMeta(res.meta);
      } catch (err) {
        if (seq !== loadSeq.current) return;
        setError(
          err instanceof ApiError
            ? err.message
            : "โหลดข้อมูลสมาชิกไม่สำเร็จ"
        );
        setErrorTechnical(
          err instanceof ApiError ? (err.serverMessage ?? err.message) : String(err)
        );
      } finally {
        if (seq === loadSeq.current) setIsLoading(false);
      }
    },
    [debouncedQuery, area, status, membershipStatus, careFilter]
  );

  useEffect(() => {
    loadMembers(page);
  }, [loadMembers, page]);

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
    setFormError(null);
    setNameError(null);
    setFormOpen(true);
  };

  // Deep links from the org chart: ?care=<id> filters the list, and
  // ?new=1&care=<id> opens the create form with that care group chosen.
  useEffect(() => {
    const p = new URLSearchParams(urlSearch);
    const care = p.get("care") ?? "";
    if (!p.has("care") && !p.has("new")) return;
    if (care) setCareFilter(care);
    if (p.get("new") === "1" && canManage) {
      setEditing(null);
      setForm({ ...EMPTY_FORM, careGroupId: care });
      setDuplicateWarning(null);
      setFormError(null);
      setNameError(null);
      setFormOpen(true);
    }
    navigate("/members", { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSearch]);

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
      careGroupId: m.careGroup?.id ?? "",
      membershipStatus: m.membershipStatus ?? "visitor",
      status: m.status,
      emergencyContactName: m.emergencyContactName ?? "",
      emergencyContactPhone: m.emergencyContactPhone ?? "",
      emergencyContactRelation: m.emergencyContactRelation ?? "",
      consentGiven: m.consentGiven ?? false,
      notes: m.notes ?? "",
    });
    setDuplicateWarning(null);
    setFormError(null);
    setNameError(null);
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setNameError(null);

    // Inline validation, close to the field it belongs to (prompt §11).
    if (!form.name.trim()) {
      setNameError("กรุณากรอกชื่อ-นามสกุลของสมาชิก");
      return;
    }

    setSubmitting(true);
    try {
      const { careGroupId, ...rest } = form;
      const payload = {
        ...rest,
        gender: form.gender ? form.gender : null,
        birthDate: form.birthDate ? new Date(form.birthDate).toISOString() : null,
        // Only send the care group when the person changed it, so editing
        // another field never ends a membership by accident.
        ...(!editing || (editing.careGroup?.id ?? "") !== careGroupId ? { careGroupId } : {}),
      };

      if (editing) {
        await api.put(`/api/members/${editing.id}`, payload);
        toast.success("บันทึกการแก้ไขข้อมูลสมาชิกแล้ว");
      } else {
        await api.post("/api/members", payload);
        toast.success(`เพิ่ม ${form.name} เข้าเป็นสมาชิกเรียบร้อยแล้ว`);
      }
      setFormOpen(false);
      loadMembers(meta.page);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "บันทึกข้อมูลไม่สำเร็จ";
      setFormError(withRecheckHint(message, err));
      toast.error(message);
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
    toast.info("กำลังเริ่มดาวน์โหลดไฟล์ CSV…");
  };

  const handleCreateFollowUp = async () => {
    if (!selectedMember || creatingFollowUp) return;
    setCreatingFollowUp(true);
    try {
      await api.post("/api/follow-ups", {
        title: `ติดตาม: ${selectedMember.name}`,
        subjectMemberId: selectedMember.id,
      });
      toast.success("สร้างรายการติดตามแล้ว");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "สร้างรายการติดตามไม่สำเร็จ"
      );
    } finally {
      setCreatingFollowUp(false);
    }
  };

  const areaOptions = Array.from(
    new Set(members.map((member) => member.area).filter(Boolean))
  ) as string[];

  const hasFilters =
    query.trim() !== "" ||
    area !== "ทั้งหมด" ||
    status !== "ทั้งหมด" ||
    membershipStatus !== "ทั้งหมด" ||
    careFilter !== "";

  const resetFilters = () => {
    setQuery("");
    setArea("ทั้งหมด");
    setStatus("ทั้งหมด");
    setMembershipStatus("ทั้งหมด");
    setCareFilter("");
  };

  return (
    <AppLayout>
      <PageHeader
        title="สมาชิก"
        description="ค้นหา ดูแล และเชื่อมโยงสมาชิกกับพันธกิจได้จากที่เดียว"
        primaryAction={
          canCreate
            ? { label: "เพิ่มสมาชิก", icon: UserPlus, onClick: openCreate }
            : undefined
        }
        secondaryActions={
          canManage
            ? [
                {
                  label: "ดาวน์โหลด CSV",
                  icon: Download,
                  onClick: handleExportCsv,
                },
              ]
            : undefined
        }
      />

      {/* Filters. The three selects are real labelled controls rather than
          text labels sitting next to unlabelled selects (audit §3.1). */}
      <div className="mb-4 flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-0 flex-1 sm:min-w-60">
          <label
            htmlFor="members-search"
            className="type-caption-strong block text-[var(--color-ink)]"
          >
            ค้นหาสมาชิก
          </label>
          <div className="relative mt-1.5">
            <Search
              size={ICON_SIZE.sm}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-quaternary)]"
            />
            <input
              id="members-search"
              type="search"
              inputMode="search"
              autoComplete="off"
              spellCheck={false}
              className={`${INPUT_CLASS} pl-9 pr-9`}
              placeholder="ชื่อ ชื่อเล่น เบอร์โทร หรืออีเมล…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="ล้างคำค้นหา"
                className="absolute right-1.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-canvas-soft)] hover:text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
              >
                <X size={ICON_SIZE.xs} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        <FilterDisclosure activeCount={[area, status, membershipStatus].filter((v) => v !== "ทั้งหมด").length + (careFilter ? 1 : 0)}>
        <div className="w-full sm:w-auto">
          <label
            htmlFor="members-area"
            className="type-caption-strong block text-[var(--color-ink)]"
          >
            พื้นที่
          </label>
          <select
            id="members-area"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className={`${SELECT_CLASS} mt-1.5 sm:w-40`}
          >
            <option value="ทั้งหมด">ทุกพื้นที่</option>
            {areaOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        {careOptions.length > 0 && (
          <div className="w-full sm:w-auto">
            <label htmlFor="members-care" className="type-caption-strong block text-[var(--color-ink)]">
              พันธกิจ
            </label>
            <select
              id="members-care"
              value={careFilter}
              onChange={(e) => setCareFilter(e.target.value)}
              className={`${SELECT_CLASS} mt-1.5 sm:w-48`}
            >
              <option value="">ทุกพันธกิจ</option>
              {careOptions.map((b) => (
                <optgroup key={b.body} label={b.body}>
                  {b.cares.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name.trim()}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        )}

        <div className="w-full sm:w-auto">
          <label
            htmlFor="members-status"
            className="type-caption-strong block text-[var(--color-ink)]"
          >
            การติดตาม
          </label>
          <select
            id="members-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={`${SELECT_CLASS} mt-1.5 sm:w-40`}
          >
            <option value="ทั้งหมด">ทุกสถานะ</option>
            <option value="ติดตามแล้ว">ติดตามแล้ว</option>
            <option value="ต้องติดตาม">ต้องติดตาม</option>
          </select>
        </div>

        <div className="w-full sm:w-auto">
          <label
            htmlFor="members-membership"
            className="type-caption-strong block text-[var(--color-ink)]"
          >
            ประเภทสมาชิก
          </label>
          <select
            id="members-membership"
            value={membershipStatus}
            onChange={(e) => setMembershipStatus(e.target.value)}
            className={`${SELECT_CLASS} mt-1.5 sm:w-44`}
          >
            <option value="ทั้งหมด">ทุกประเภท</option>
            <option value="active">สมาชิกประจำ</option>
            <option value="visitor">ผู้สนใจ/เยี่ยมเยียน</option>
            <option value="candidate">ผู้เตรียมรับเชื่อ</option>
            <option value="transferred">ย้ายคริสตจักร</option>
            <option value="inactive">ขาดการติดต่อ</option>
          </select>
        </div>
        </FilterDisclosure>
      </div>

      {/* Result summary: one useful sentence instead of four KPI cards. */}
      {!isLoading && !error && (
        <p className="type-caption mb-3 text-[var(--color-body-muted)]" role="status">
          พบสมาชิก {meta.total.toLocaleString("th-TH")} คน
          {meta.totalPages > 1
            ? ` · หน้า ${meta.page} จาก ${meta.totalPages}`
            : ""}
        </p>
      )}

      {error ? (
        <ErrorState
          title="โหลดรายชื่อสมาชิกไม่สำเร็จ"
          description="ระบบเชื่อมต่อไม่สำเร็จในขณะนี้ กรุณาลองอีกครั้ง"
          technical={errorTechnical ?? undefined}
          onRetry={() => loadMembers(meta.page)}
        />
      ) : isLoading ? (
        <div role="status" aria-label="กำลังโหลดรายชื่อสมาชิก">
          <TableSkeleton rows={6} />
        </div>
      ) : members.length === 0 ? (
        hasFilters ? (
          <EmptyState
            icon={Search}
            title="ไม่พบสมาชิกที่ตรงกับเงื่อนไข"
            description="ลองเปลี่ยนคำค้นหา หรือล้างตัวกรองเพื่อดูรายชื่อทั้งหมด"
            action={{ label: "ล้างตัวกรอง", onClick: resetFilters }}
          />
        ) : (
          <EmptyState
            icon={Users}
            title="ยังไม่มีสมาชิกในระบบ"
            description="เพิ่มสมาชิกคนแรกเพื่อเริ่มบันทึกการดูแลและติดตาม"
            action={
              canCreate
                ? { label: "เพิ่มสมาชิก", icon: UserPlus, onClick: openCreate }
                : undefined
            }
          />
        )
      ) : (
        <>
          {/* Mobile (< md): one card per person — no horizontal scrolling. */}
          <ul className="flex flex-col gap-3 md:hidden">
            {members.map((member) => (
              <MemberCard
                key={member.id}
                member={member}
                onOpen={() => openMember(member)}
              />
            ))}
          </ul>

          {/* Desktop (>= md): the full comparison table. */}
          <div className="hidden overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] md:block">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">
                รายชื่อสมาชิก พร้อมประเภทสมาชิก กลุ่ม และการติดตาม
              </caption>
              <thead>
                <tr className="border-b border-[var(--color-hairline)] bg-[var(--color-canvas-soft)]">
                  <th scope="col" className="type-fine px-4 py-3 font-semibold text-[var(--color-text-tertiary)]">
                    สมาชิก
                  </th>
                  <th scope="col" className="type-fine px-4 py-3 font-semibold text-[var(--color-text-tertiary)]">
                    ประเภทสมาชิก
                  </th>
                  <th scope="col" className="type-fine px-4 py-3 font-semibold text-[var(--color-text-tertiary)]">
                    พื้นที่ / กลุ่ม
                  </th>
                  <th scope="col" className="type-fine px-4 py-3 font-semibold text-[var(--color-text-tertiary)]">
                    การติดตาม
                  </th>
                  <th scope="col" className="type-fine px-4 py-3 text-right font-semibold text-[var(--color-text-tertiary)]">
                    จัดการ
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-divider)]">
                {members.map((m) => (
                  <tr
                    key={m.id}
                    className="transition-colors hover:bg-[var(--color-canvas-soft)]"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <InitialsAvatar name={m.name} size={36} />
                        <div className="min-w-0">
                          <p className="type-caption-strong truncate text-[var(--color-ink)]">
                            {m.name} {m.nickname ? `(${m.nickname})` : ""}
                          </p>
                          {(() => {
                            const detail = [
                              m.phone || m.email || m.lineId,
                              m.gender === "male" ? "ชาย" : m.gender === "female" ? "หญิง" : null,
                              m.birthDate ? `เกิด ${formatDate(m.birthDate)}` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ");
                            return detail ? (
                              <p className="type-fine truncate text-[var(--color-text-tertiary)]">{detail}</p>
                            ) : null;
                          })()}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusChip
                        tone={MEMBERSHIP_STATUS_TONES[m.membershipStatus]}
                      >
                        {MEMBERSHIP_STATUS_LABELS[m.membershipStatus] ??
                          m.membershipStatus}
                      </StatusChip>
                    </td>
                    <td className="px-4 py-3">
                      <p className="type-caption whitespace-nowrap text-[var(--color-text-secondary)]">
                        {m.careGroup?.name ?? m.group ?? "ยังไม่มีกลุ่ม"}
                      </p>
                      {m.area && (
                        <p className="type-fine whitespace-nowrap text-[var(--color-text-tertiary)]">
                          อ.{m.area}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusChip
                        tone={m.status === "ติดตามแล้ว" ? "success" : "warning"}
                      >
                        {m.status}
                      </StatusChip>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          className="flex size-11 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-canvas-soft)] hover:text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
                          onClick={() => openMember(m)}
                          aria-label={`ดูข้อมูลของ ${m.name}`}
                        >
                          <Search size={ICON_SIZE.sm} aria-hidden="true" />
                        </button>
                        {canManage && (
                          <button
                            type="button"
                            className="flex size-11 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-canvas-soft)] hover:text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
                            onClick={() => openEdit(m)}
                            aria-label={`แก้ไขข้อมูลของ ${m.name}`}
                          >
                            <Pencil size={ICON_SIZE.sm} aria-hidden="true" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            className="flex size-11 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-error-soft)] hover:text-[var(--color-error)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
                            onClick={() => setDeleteTarget(m)}
                            aria-label={`ลบ ${m.name}`}
                          >
                            <Trash2 size={ICON_SIZE.sm} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {meta.totalPages > 1 && (
            <nav
              aria-label="การแบ่งหน้า"
              className="mt-4 flex flex-col items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-4 sm:flex-row"
            >
              <span className="type-caption text-[var(--color-body-muted)]">
                หน้า {meta.page} จาก {meta.totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="type-caption-strong inline-flex min-h-11 items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-hairline)] px-4 transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50"
                  disabled={meta.page <= 1}
                  onClick={() => goToPage(meta.page - 1)}
                >
                  <ChevronLeft size={ICON_SIZE.xs} aria-hidden="true" /> ก่อนหน้า
                </button>
                <button
                  type="button"
                  className="type-caption-strong inline-flex min-h-11 items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-hairline)] px-4 transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50"
                  disabled={meta.page >= meta.totalPages}
                  onClick={() => goToPage(meta.page + 1)}
                >
                  ถัดไป <ChevronRight size={ICON_SIZE.xs} aria-hidden="true" />
                </button>
              </div>
            </nav>
          )}
        </>
      )}

      {/* Create / Edit — a real dialog with Escape, focus handling and a
          scrollable body, so the 12-field form is usable on a phone. */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `แก้ไขข้อมูล ${editing.name}` : "เพิ่มสมาชิกใหม่"}
        description={
          editing
            ? "ปรับข้อมูลให้เป็นปัจจุบัน แล้วกดบันทึก"
            : "กรอกเท่าที่ทราบ ไม่มีข้อมูลช่องใดบังคับนอกจากชื่อ"
        }
        size="wide"
        footer={
          <>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] px-5 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              form="member-form"
              disabled={submitting}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-focus)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50"
            >
              {submitting
                ? "กำลังบันทึก…"
                : editing
                  ? "บันทึกการแก้ไข"
                  : "เพิ่มสมาชิก"}
            </button>
          </>
        }
      >
        <form id="member-form" onSubmit={handleSubmit} className="space-y-6">
          {formError && <FormError>{formError}</FormError>}

          {duplicateWarning && (
            <p
              role="status"
              className="type-caption flex items-start gap-2 rounded-[var(--radius-sm)] bg-[var(--color-warning-soft)] p-3 text-[var(--color-warning)]"
            >
              <ShieldCheck size={ICON_SIZE.sm} aria-hidden="true" className="mt-0.5" />
              <span>{duplicateWarning}</span>
            </p>
          )}

          <fieldset className="space-y-4">
            <legend className="type-caption-strong mb-2 text-[var(--color-ink)]">
              ข้อมูลพื้นฐาน
            </legend>
            <Field label="ชื่อ-นามสกุล" required error={nameError ?? undefined}>
              {fieldProps => (
                <input
                  {...fieldProps}
                  className={INPUT_CLASS}
                  autoComplete="name"
                  placeholder="เช่น สมชาย สุขเกษม"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              )}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="ชื่อเล่น" hint="ใช้เรียกในพันธกิจ">
                {fieldProps => (
                  <input
                    {...fieldProps}
                    className={INPUT_CLASS}
                    autoComplete="nickname"
                    placeholder="เช่น ต้น"
                    value={form.nickname}
                    onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                  />
                )}
              </Field>
              <DateField
                label="วันเกิด"
                value={form.birthDate}
                onChange={(birthDate) => setForm({ ...form, birthDate })}
                clearable
              />
              <Field label="เพศ">
                {fieldProps => (
                  <select
                    {...fieldProps}
                    className={SELECT_CLASS}
                    value={form.gender}
                    onChange={(e) =>
                      setForm({ ...form, gender: e.target.value as Gender })
                    }
                  >
                    <option value="">ไม่ระบุ</option>
                    <option value="male">ชาย</option>
                    <option value="female">หญิง</option>
                    <option value="other">อื่นๆ</option>
                  </select>
                )}
              </Field>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="type-caption-strong mb-2 text-[var(--color-ink)]">
              ช่องทางติดต่อ
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="เบอร์โทรศัพท์">
                {fieldProps => (
                  <input
                    {...fieldProps}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    className={INPUT_CLASS}
                    placeholder="081-234-5678"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                )}
              </Field>
              <Field label="อีเมล">
                {fieldProps => (
                  <input
                    {...fieldProps}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    spellCheck={false}
                    className={INPUT_CLASS}
                    placeholder="member@email.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                )}
              </Field>
              <Field label="LINE ID" hint="ถ้ามี ใช้ติดต่อได้เร็วที่สุด">
                {fieldProps => (
                  <input
                    {...fieldProps}
                    autoComplete="off"
                    spellCheck={false}
                    className={INPUT_CLASS}
                    placeholder="ไอดีไลน์"
                    value={form.lineId}
                    onChange={(e) => setForm({ ...form, lineId: e.target.value })}
                  />
                )}
              </Field>
            </div>
            <Field label="ที่อยู่ปัจจุบัน">
              {fieldProps => (
                <input
                  {...fieldProps}
                  autoComplete="street-address"
                  className={INPUT_CLASS}
                  placeholder="บ้านเลขที่ หมู่บ้าน ตำบล อำเภอ จังหวัด"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              )}
            </Field>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="type-caption-strong mb-2 text-[var(--color-ink)]">
              การดูแลในคริสตจักร
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="ประเภทสมาชิก">
                {fieldProps => (
                  <select
                    {...fieldProps}
                    className={SELECT_CLASS}
                    value={form.membershipStatus}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        membershipStatus: e.target.value as MembershipStatus,
                      })
                    }
                  >
                    <option value="visitor">ผู้สนใจ/เยี่ยมเยียน</option>
                    <option value="active">สมาชิกประจำ</option>
                    <option value="candidate">ผู้เตรียมรับเชื่อ</option>
                    <option value="transferred">ย้ายคริสตจักร</option>
                    <option value="inactive">ขาดการติดต่อ</option>
                  </select>
                )}
              </Field>
              <Field label="สถานะการติดตาม">
                {fieldProps => (
                  <select
                    {...fieldProps}
                    className={SELECT_CLASS}
                    value={form.status}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        status: e.target.value as Member["status"],
                      })
                    }
                  >
                    <option value="ต้องติดตาม">ต้องติดตาม</option>
                    <option value="ติดตามแล้ว">ติดตามแล้ว</option>
                  </select>
                )}
              </Field>
              <Field label="พื้นที่ / ย่าน" hint="ใช้จัดกลุ่มการเยี่ยมเยียน">
                {fieldProps => (
                  <input
                    {...fieldProps}
                    className={INPUT_CLASS}
                    placeholder="เช่น อ.เมืองกาฬสินธุ์"
                    value={form.area}
                    onChange={(e) => setForm({ ...form, area: e.target.value })}
                  />
                )}
              </Field>
              {careOptions.length > 0 && (
                <Field label="พันธกิจ" hint="เลือกพันธกิจที่สมาชิกเข้าร่วม ย้ายพันธกิจได้ภายหลัง">
                  {fieldProps => (
                    <select
                      {...fieldProps}
                      className={SELECT_CLASS}
                      value={form.careGroupId}
                      onChange={(e) => setForm({ ...form, careGroupId: e.target.value })}
                    >
                      <option value="">ยังไม่ระบุพันธกิจ</option>
                      {careOptions.map((b) => (
                        <optgroup key={b.body} label={b.body}>
                          {b.cares.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name.trim()}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  )}
                </Field>
              )}
              <Field label="บทบาทในคริสตจักร">
                {fieldProps => (
                  <input
                    {...fieldProps}
                    className={INPUT_CLASS}
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                  />
                )}
              </Field>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="type-caption-strong mb-2 text-[var(--color-ink)]">
              ผู้ติดต่อฉุกเฉิน
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="ชื่อผู้ติดต่อ">
                {fieldProps => (
                  <input
                    {...fieldProps}
                    autoComplete="off"
                    className={INPUT_CLASS}
                    placeholder="ชื่อ-นามสกุล"
                    value={form.emergencyContactName}
                    onChange={(e) =>
                      setForm({ ...form, emergencyContactName: e.target.value })
                    }
                  />
                )}
              </Field>
              <Field label="เบอร์โทรผู้ติดต่อ">
                {fieldProps => (
                  <input
                    {...fieldProps}
                    type="tel"
                    inputMode="tel"
                    autoComplete="off"
                    className={INPUT_CLASS}
                    placeholder="เบอร์โทรติดต่อฉุกเฉิน"
                    value={form.emergencyContactPhone}
                    onChange={(e) =>
                      setForm({ ...form, emergencyContactPhone: e.target.value })
                    }
                  />
                )}
              </Field>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="type-caption-strong mb-2 text-[var(--color-ink)]">
              ความยินยอมและบันทึกภายใน
            </legend>
            <label className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-hairline)] p-3">
              <input
                type="checkbox"
                checked={form.consentGiven}
                onChange={(e) =>
                  setForm({ ...form, consentGiven: e.target.checked })
                }
                className="mt-0.5 size-6 shrink-0 rounded-[var(--radius-xs)] accent-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
              />
              <span className="type-caption text-[var(--color-ink)]">
                สมาชิกยินยอมให้คริสตจักรเก็บและใช้ข้อมูลส่วนบุคคล
                ตามนโยบายคุ้มครองข้อมูลส่วนบุคคล (PDPA)
              </span>
            </label>
            <Field
              label="บันทึกฝ่ายอภิบาล"
              hint="เห็นเฉพาะเจ้าหน้าที่ เช่น คำอธิษฐานหรือบันทึกการเยี่ยมเยียน"
            >
              {fieldProps => (
                <textarea
                  {...fieldProps}
                  rows={3}
                  className={`${INPUT_CLASS} py-2`}
                  placeholder="รายละเอียดเพิ่มเติม…"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              )}
            </Field>
          </fieldset>
        </form>
      </Modal>

      {/* Member detail — the same dialog, sized wide for the two-column body */}
      <Modal
        open={selectedMember !== null}
        onClose={closeMember}
        title="ข้อมูลสมาชิก"
        description={selectedMember?.name}
        size="wide"
        footer={
          <>
            <button
              type="button"
              onClick={closeMember}
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] px-5 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
            >
              ปิด
            </button>
            <button
              type="button"
              onClick={handleCreateFollowUp}
              disabled={creatingFollowUp}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-pill)] border border-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50"
            >
              <Plus size={ICON_SIZE.sm} aria-hidden="true" />
              {creatingFollowUp ? "กำลังสร้าง…" : "สร้างรายการติดตาม"}
            </button>
            {canManage && (
              <button
                type="button"
                onClick={() => {
                  const target = selectedMember;
                  closeMember();
                  if (target) openEdit(target);
                }}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-focus)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
              >
                <Pencil size={ICON_SIZE.sm} aria-hidden="true" />
                แก้ไขข้อมูล
              </button>
            )}
          </>
        }
      >
        {selectedMember && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-4 rounded-[var(--radius-lg)] bg-[var(--color-canvas-soft)] p-4">
              <InitialsAvatar name={selectedMember.name} size={56} />
              <div className="min-w-0 flex-1">
                <p className="type-body-strong text-[var(--color-ink)]">
                  {selectedMember.name}
                  {selectedMember.nickname ? ` (${selectedMember.nickname})` : ""}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <StatusChip tone="neutral">{selectedMember.role}</StatusChip>
                  <StatusChip
                    tone={MEMBERSHIP_STATUS_TONES[selectedMember.membershipStatus]}
                  >
                    {MEMBERSHIP_STATUS_LABELS[selectedMember.membershipStatus] ??
                      selectedMember.membershipStatus}
                  </StatusChip>
                  <StatusChip
                    tone={
                      selectedMember.status === "ติดตามแล้ว"
                        ? "success"
                        : "warning"
                    }
                  >
                    {selectedMember.status}
                  </StatusChip>
                  {selectedMember.consentGiven && (
                    <StatusChip tone="success">
                      <ShieldCheck
                        size={12}
                        aria-hidden="true"
                        className="mr-1"
                      />
                      ยินยอม PDPA แล้ว
                    </StatusChip>
                  )}
                </div>
              </div>
              {qrCodeDataUrl && (
                <div className="shrink-0 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-2 text-center">
                  <img
                    src={qrCodeDataUrl}
                    alt={`รหัส QR สำหรับเช็คชื่อของ ${selectedMember.name}`}
                    width={80}
                    height={80}
                    className="block size-20"
                  />
                  <p className="type-fine mt-1 text-[var(--color-body-muted)]">
                    รหัสเช็คชื่อ
                  </p>
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <section className="rounded-[var(--radius-md)] border border-[var(--color-hairline)] p-4">
                <h3 className="type-caption-strong mb-2 text-[var(--color-ink)]">
                  ช่องทางติดต่อ
                </h3>
                <dl className="type-caption space-y-1.5 text-[var(--color-text-secondary)]">
                  <div className="flex gap-2">
                    <dt className="shrink-0">เบอร์โทร:</dt>
                    <dd className="font-semibold text-[var(--color-ink)]">
                      {selectedMember.phone || "ไม่มีข้อมูล"}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="shrink-0">อีเมล:</dt>
                    <dd className="min-w-0 break-words font-semibold text-[var(--color-ink)]">
                      {selectedMember.email || "ไม่มีข้อมูล"}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="shrink-0">LINE:</dt>
                    <dd className="font-semibold text-[var(--color-ink)]">
                      {selectedMember.lineId || "ไม่มีข้อมูล"}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="shrink-0">ที่อยู่:</dt>
                    <dd className="font-semibold text-[var(--color-ink)]">
                      {selectedMember.address || "ไม่มีข้อมูล"}
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="rounded-[var(--radius-md)] border border-[var(--color-hairline)] p-4">
                <h3 className="type-caption-strong mb-2 text-[var(--color-ink)]">
                  คริสตจักรและผู้ติดต่อฉุกเฉิน
                </h3>
                <dl className="type-caption space-y-1.5 text-[var(--color-text-secondary)]">
                  <div className="flex gap-2">
                    <dt className="shrink-0">พื้นที่:</dt>
                    <dd className="font-semibold text-[var(--color-ink)]">
                      {selectedMember.area || "-"}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="shrink-0">พันธกิจ:</dt>
                    <dd className="font-semibold text-[var(--color-ink)]">
                      {selectedMember.careGroup ? `${selectedMember.careGroup.name}${selectedMember.careGroup.bodyName ? ` · ${selectedMember.careGroup.bodyName}` : ""}` : selectedMember.group || "ยังไม่มีกลุ่ม"}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="shrink-0">เข้าร่วมเมื่อ:</dt>
                    <dd className="font-semibold tabular-nums text-[var(--color-ink)]">
                      {formatDate(selectedMember.joinedAt)}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="shrink-0">ผู้ติดต่อฉุกเฉิน:</dt>
                    <dd className="font-semibold text-[var(--color-ink)]">
                      {selectedMember.emergencyContactName
                        ? `${selectedMember.emergencyContactName} (${selectedMember.emergencyContactPhone || "-"})`
                        : "ไม่มีข้อมูล"}
                    </dd>
                  </div>
                </dl>
              </section>
            </div>

            {selectedMember.notes && (
              <section className="rounded-[var(--radius-md)] bg-[var(--color-warning-soft)] p-4">
                <h3 className="type-caption-strong mb-1 text-[var(--color-warning)]">
                  บันทึกฝ่ายอภิบาล (เห็นเฉพาะเจ้าหน้าที่)
                </h3>
                <p className="type-caption whitespace-pre-line text-[var(--color-ink)]">
                  {selectedMember.notes}
                </p>
              </section>
            )}

            <section>
              <h3 className="type-caption-strong mb-2 text-[var(--color-ink)]">
                กิจกรรมพันธกิจล่าสุด
              </h3>
              <ActivityTimeline
                subjectType="member"
                subjectId={selectedMember.id}
              />
            </section>
          </div>
        )}
      </Modal>

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
