import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Lock,
  MapPin,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CardGridSkeleton, TableSkeleton } from "@/components/LoadingStates";
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
import { api, ApiError } from "@/lib/api";
import { fetchAllMembers } from "@/lib/fetchAll";
import { parseCareGroupDescription } from "@shared/orgView";
import { MemberPicker } from "@/components/MemberPicker";
import { useLocation, useSearch } from "wouter";
import type {
  GroupCategory,
  GroupMemberRole,
  GroupMemberStatus,
  GroupPrivacy,
  GroupStatus,
} from "@shared/schema";
import { ADMIN_ROLES, GROUP_MANAGE_ANY_ROLES, hasRole } from "@shared/roles";

type OrgLevel = "body" | "care";

const ORG_LEVEL_LABELS: Record<OrgLevel, string> = { body: "บอดี้", care: "พันธกิจ" };

interface GroupItem {
  id: string;
  name: string;
  leaderId: string | null;
  coLeaderId: string | null;
  orgLevel: OrgLevel | null;
  parentGroupId: string | null;
  leaderMemberId: string | null;
  category: GroupCategory;
  privacy: GroupPrivacy;
  status: GroupStatus;
  area: string | null;
  meetingDay: string | null;
  meetingTime: string | null;
  meetingLocation: string | null;
  latitude: string | null;
  longitude: string | null;
  maxMembers: number | null;
  isOpen: boolean;
  avatarUrl: string | null;
  coverUrl: string | null;
  description: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  leaderName: string | null;
  leaderEmail: string | null;
  memberCount: number;
}

interface GroupMemberItem {
  id: string;
  groupId: string;
  memberId: string;
  role: GroupMemberRole;
  status: GroupMemberStatus;
  joinedAt: string;
  leftAt: string | null;
  memberName: string;
  memberNickname: string | null;
  memberAvatarUrl: string | null;
  memberPhone: string | null;
  membershipStatus: string;
  pastoralStatus: string;
  lastAttendedAt: string | null;
}

interface SimpleMember {
  id: string;
  name: string;
  nickname: string | null;
  phone: string | null;
}

const CATEGORY_LABELS: Record<GroupCategory, string> = {
  cell: "กลุ่มเซลล์ทั่วไป",
  bible_study: "กลุ่มศึกษาพระคัมภีร์",
  prayer: "กลุ่มอธิษฐาน",
  youth: "กลุ่มเยาวชน/นักศึกษา",
  kids: "กลุ่มเด็ก",
  family: "กลุ่มครอบครัว",
  men: "กลุ่มผู้ชาย",
  women: "กลุ่มผู้หญิง",
  volunteer: "กลุ่มอาสาสมัคร",
  online: "กลุ่มออนไลน์",
  ministry: "ฝ่ายงาน",
  fellowship: "กลุ่มสามัคคีธรรม",
  general: "กลุ่มทั่วไป",
  other: "อื่น ๆ",
};

/**
 * Category colour is a recognition aid, not a meaning: every category also
 * prints its own Thai name next to the chip, and the palette is limited to the
 * three activity accents plus neutral so no page drifts into a rainbow
 * (design.md §2 — max 3 accent tones per page).
 */
const CATEGORY_TONES: Record<GroupCategory, StatusTone> = {
  cell: "info",
  bible_study: "info",
  prayer: "neutral",
  youth: "neutral",
  kids: "success",
  family: "success",
  men: "info",
  women: "warning",
  volunteer: "warning",
  online: "info",
  ministry: "neutral",
  fellowship: "warning",
  general: "info",
  other: "neutral",
};

const ROLE_LABELS: Record<GroupMemberRole, string> = {
  leader: "หัวหน้ากลุ่ม",
  assistant_leader: "ผู้ช่วยหัวหน้า",
  host: "เจ้าบ้าน",
  member: "สมาชิก",
};

const PRIVACY_LABELS: Record<GroupPrivacy, { label: string; tone: StatusTone }> = {
  public: { label: "สาธารณะ", tone: "neutral" },
  private: { label: "กลุ่มปิด (สมาชิก)", tone: "info" },
  confidential: { label: "กลุ่มลับเฉพาะ", tone: "warning" },
};

const STATUS_LABELS: Record<GroupStatus, { label: string; tone: StatusTone }> = {
  active: { label: "เปิดดำเนินการ", tone: "success" },
  paused: { label: "พักชั่วคราว", tone: "warning" },
  closed: { label: "ปิดกลุ่ม", tone: "neutral" },
};

const MEMBERS_PER_PAGE = 12;

const EMPTY_FORM = {
  name: "",
  leaderId: "",
  coLeaderId: "",
  orgLevel: "" as OrgLevel | "",
  parentGroupId: "",
  leaderMemberId: "",
  leaderMemberName: "",
  category: "cell" as GroupCategory,
  privacy: "public" as GroupPrivacy,
  status: "active" as GroupStatus,
  area: "",
  meetingDay: "",
  meetingTime: "",
  meetingLocation: "",
  description: "",
  maxMembers: "",
  isOpen: true,
};

const INPUT_CLASS =
  "min-h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 text-base text-[var(--color-ink)] placeholder:text-[var(--color-text-quaternary)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-focus)]/30";
const SELECT_CLASS = `${INPUT_CLASS} pr-8`;

const iconButtonClass =
  "flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-canvas-soft)] hover:text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]";

/**
 * Overflow menu for the secondary per-group actions.
 *
 * A group card used to end in four same-weight buttons (สมาชิก / เช็คชื่อ /
 * แก้ไข / ลบ). One primary action plus an overflow menu keeps the card
 * readable and gives every action a 44px target.
 */
function RowMenu({
  label,
  children,
}: {
  label: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        className={iconButtonClass}
      >
        <MoreVertical size={ICON_SIZE.md} aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 w-52 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] py-1 shadow-[var(--shadow)]"
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onSelect,
  tone = "default",
}: {
  icon: React.ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
  label: string;
  onSelect: () => void;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className={`type-caption flex min-h-11 w-full items-center gap-3 px-3 text-left transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary-focus)] ${
        tone === "danger" ? "text-[var(--color-error)]" : "text-[var(--color-ink)]"
      }`}
    >
      <Icon size={ICON_SIZE.sm} aria-hidden={true} />
      {label}
    </button>
  );
}

export default function Groups() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  // Create/delete are admin-gated (POST/DELETE /api/groups). Editing a group
  // or its membership follows the server's `verifyGroupManagementAccess`:
  // GROUP_MANAGE_ANY_ROLES may edit any group; a group_leader only the
  // groups they lead (ownership check in canEditGroup below).
  const isAdmin = hasRole(user?.role, ADMIN_ROLES);
  const canManageAnyGroup = hasRole(user?.role, GROUP_MANAGE_ANY_ROLES);

  const [groupsList, setGroupsList] = useState<GroupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorTechnical, setErrorTechnical] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [privacyFilter, setPrivacyFilter] = useState<string>("");
  const [levelFilter, setLevelFilter] = useState<string>("");
  const [bodies, setBodies] = useState<GroupItem[]>([]);

  // Create / Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupItem | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<GroupItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Group Members modal
  const [activeGroup, setActiveGroup] = useState<GroupItem | null>(null);
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [groupMembersList, setGroupMembersList] = useState<GroupMemberItem[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Add member to group form
  const [availableMembers, setAvailableMembers] = useState<SimpleMember[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [selectedRole, setSelectedRole] = useState<GroupMemberRole>("member");
  const [addingMember, setAddingMember] = useState(false);

  const [searchPage, setSearchPage] = useState(1);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorTechnical(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (categoryFilter) params.set("category", categoryFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (privacyFilter) params.set("privacy", privacyFilter);

      const res = await api.get<GroupItem[]>(`/api/groups?${params.toString()}`);
      setGroupsList(res);
    } catch (err) {
      setError("โหลดข้อมูลกลุ่มไม่สำเร็จ");
      setErrorTechnical(
        err instanceof ApiError ? (err.serverMessage ?? err.message) : String(err)
      );
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, statusFilter, privacyFilter]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // Bodies are needed for the care-group parent picker and the body label on
  // each card, independent of the active list filters.
  const fetchBodies = useCallback(async () => {
    try {
      setBodies(await api.get<GroupItem[]>("/api/groups?orgLevel=body"));
    } catch {
      setBodies([]);
    }
  }, []);

  useEffect(() => {
    fetchBodies();
  }, [fetchBodies]);

  const bodyNameById = new Map(bodies.map((b) => [b.id, b.name]));
  const visibleGroups = levelFilter
    ? groupsList.filter((g) => (levelFilter === "none" ? !g.orgLevel : g.orgLevel === levelFilter))
    : groupsList;

  // Load available members for adding. GET /api/members returns the rows as
  // a bare array in `data` — no `{ items }` wrapper (see
  // client/src/members-list-contract.test.ts).
  const fetchAvailableMembers = async () => {
    try {
      setAvailableMembers(await fetchAllMembers<SimpleMember>());
    } catch {
      toast.error("โหลดรายชื่อสมาชิกไม่สำเร็จ เพิ่มสมาชิกเข้ากลุ่มไม่ได้ในตอนนี้");
    }
  };

  const openCreateModal = () => {
    setEditingGroup(null);
    setForm(EMPTY_FORM);
    setNameError(null);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (grp: GroupItem) => {
    setEditingGroup(grp);
    setForm({
      name: grp.name,
      leaderId: grp.leaderId || "",
      coLeaderId: grp.coLeaderId || "",
      orgLevel: grp.orgLevel ?? "",
      parentGroupId: grp.parentGroupId ?? "",
      leaderMemberId: grp.leaderMemberId ?? "",
      leaderMemberName: "",
      category: grp.category,
      privacy: grp.privacy || "public",
      status: grp.status || "active",
      area: grp.area || "",
      meetingDay: grp.meetingDay || "",
      meetingTime: grp.meetingTime || "",
      meetingLocation: grp.meetingLocation || "",
      description: grp.description || "",
      maxMembers: grp.maxMembers ? String(grp.maxMembers) : "",
      isOpen: grp.isOpen ?? true,
    });
    setNameError(null);
    setFormError(null);
    setModalOpen(true);
    if (grp.leaderMemberId) {
      // The list only carries the id; fetch the name once so the picker can show it.
      api
        .get<{ name: string; nickname: string | null }>(`/api/members/${grp.leaderMemberId}`)
        .then((m) => setForm((f) => (f.leaderMemberId === grp.leaderMemberId ? { ...f, leaderMemberName: m.nickname ? `${m.name} (${m.nickname})` : m.name } : f)))
        .catch(() => {});
    }
  };

  // Deep links from the org chart: /groups?new=body, /groups?new=care&parent=<bodyId>
  // open the create form prefilled; /groups?edit=<groupId> opens that group's edit form.
  const urlSearch = useSearch();
  useEffect(() => {
    const params = new URLSearchParams(urlSearch);
    const wantNew = params.get("new");
    const wantEdit = params.get("edit");
    if (wantNew === "body" || wantNew === "care") {
      setEditingGroup(null);
      setForm({
        ...EMPTY_FORM,
        orgLevel: wantNew,
        category: wantNew === "body" ? "general" : "cell",
        parentGroupId: wantNew === "care" ? (params.get("parent") ?? "") : "",
      });
      setNameError(null);
      setFormError(null);
      setModalOpen(true);
      navigate("/groups", { replace: true });
    } else if (wantEdit) {
      const target = groupsList.find((g) => g.id === wantEdit) ?? bodies.find((g) => g.id === wantEdit);
      if (target) {
        openEditModal(target);
        navigate("/groups", { replace: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSearch, groupsList, bodies]);

  const canEditGroup = (grp: GroupItem) => {
    if (canManageAnyGroup) return true;
    if (user?.role === "group_leader" && (grp.leaderId === user?.id || grp.coLeaderId === user?.id)) return true;
    return false;
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameError(null);
    setFormError(null);
    if (!form.name.trim()) {
      setNameError("กรุณากรอกชื่อกลุ่ม");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        leaderId: form.leaderId ? form.leaderId : null,
        coLeaderId: form.coLeaderId ? form.coLeaderId : null,
        orgLevel: form.orgLevel || null,
        parentGroupId: form.orgLevel === "care" && form.parentGroupId ? form.parentGroupId : null,
        leaderMemberId: form.orgLevel && form.leaderMemberId ? form.leaderMemberId : null,
        category: form.category,
        privacy: form.privacy,
        status: form.status,
        area: form.area.trim() || null,
        meetingDay: form.meetingDay.trim(),
        meetingTime: form.meetingTime.trim(),
        meetingLocation: form.meetingLocation.trim(),
        description: form.description.trim(),
        maxMembers: form.maxMembers ? parseInt(form.maxMembers, 10) : null,
        isOpen: form.isOpen,
      };

      if (editingGroup) {
        await api.put(`/api/groups/${editingGroup.id}`, payload);
        toast.success("อัปเดตข้อมูลกลุ่มเรียบร้อยแล้ว");
      } else {
        await api.post("/api/groups", payload);
        toast.success(`สร้างกลุ่ม "${payload.name}" เรียบร้อยแล้ว`);
      }
      setModalOpen(false);
      fetchGroups();
      fetchBodies();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "บันทึกข้อมูลไม่สำเร็จ";
      setFormError(`${message} กรุณาตรวจสอบข้อมูลแล้วลองอีกครั้ง`);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/groups/${deleteTarget.id}`);
      toast.success("ลบกลุ่มเรียบร้อยแล้ว (เปลี่ยนสถานะเป็นปิดกลุ่ม)");
      setDeleteTarget(null);
      fetchGroups();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ลบกลุ่มไม่สำเร็จ");
    } finally {
      setDeleting(false);
    }
  };

  const openMembersModal = async (grp: GroupItem) => {
    setActiveGroup(grp);
    setMembersModalOpen(true);
    setLoadingMembers(true);
    setSelectedMemberId("");
    setSelectedRole("member");
    setSearchPage(1);

    try {
      fetchAvailableMembers();
      const res = await api.get<{ members: GroupMemberItem[] }>(`/api/groups/${grp.id}`);
      setGroupMembersList(res.members || []);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "โหลดรายชื่อสมาชิกไม่สำเร็จ");
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleAddMemberToGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGroup || !selectedMemberId) {
      toast.error("กรุณาเลือกสมาชิกที่ต้องการเพิ่ม");
      return;
    }

    setAddingMember(true);
    try {
      await api.post(`/api/groups/${activeGroup.id}/members`, {
        memberId: selectedMemberId,
        role: selectedRole,
        status: "active",
      });
      toast.success("เพิ่มสมาชิกเข้ากลุ่มเรียบร้อยแล้ว");
      setSelectedMemberId("");

      // Reload group members & group list
      const res = await api.get<{ members: GroupMemberItem[] }>(`/api/groups/${activeGroup.id}`);
      setGroupMembersList(res.members || []);
      fetchGroups();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "เพิ่มสมาชิกไม่สำเร็จ");
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMemberFromGroup = async (memberId: string) => {
    if (!activeGroup) return;
    try {
      await api.delete(`/api/groups/${activeGroup.id}/members/${memberId}`);
      toast.success("นำสมาชิกออกจากกลุ่มเรียบร้อยแล้ว (สถานะเป็น inactive)");
      // Reload members list to show updated status
      const res = await api.get<{ members: GroupMemberItem[] }>(`/api/groups/${activeGroup.id}`);
      setGroupMembersList(res.members || []);
      fetchGroups();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ไม่สามารถนำสมาชิกออกได้");
    }
  };

  const handleReactivateMember = async (memberId: string) => {
    if (!activeGroup) return;
    try {
      await api.put(`/api/groups/${activeGroup.id}/members/${memberId}`, {
        status: "active",
      });
      toast.success("เปิดใช้งานสถานะสมาชิกในกลุ่มเรียบร้อยแล้ว");
      const res = await api.get<{ members: GroupMemberItem[] }>(`/api/groups/${activeGroup.id}`);
      setGroupMembersList(res.members || []);
      fetchGroups();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ไม่สามารถเปิดสถานะได้");
    }
  };

  const formatThaiDate = (dateStr: string | null) => {
    if (!dateStr) return "ยังไม่มีประวัติ";
    const d = new Date(dateStr);
    return d.toLocaleDateString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const totalGroups = groupsList.length;
  const activeGroupsCount = groupsList.filter((g) => g.status === "active").length;
  const totalMembersInGroups = groupsList.reduce((acc, g) => acc + (g.memberCount || 0), 0);

  const activeFilterCount = [categoryFilter, statusFilter, privacyFilter, levelFilter].filter(Boolean).length;
  const hasFilters = Boolean(search || categoryFilter || statusFilter || privacyFilter || levelFilter);
  const resetFilters = () => {
    setSearch("");
    setCategoryFilter("");
    setStatusFilter("");
    setPrivacyFilter("");
  };

  const activeMembers = groupMembersList.filter((m) => m.status === "active");
  const formerMembers = groupMembersList.filter((m) => m.status !== "active");
  const searchableMembers = availableMembers.filter(
    (m) => !activeMembers.some((gm) => gm.memberId === m.id)
  );
  const searchTotalPages = Math.max(
    1,
    Math.ceil(searchableMembers.length / MEMBERS_PER_PAGE)
  );
  const searchPageSafe = Math.min(searchPage, searchTotalPages);
  const pagedSearchableMembers = searchableMembers.slice(
    (searchPageSafe - 1) * MEMBERS_PER_PAGE,
    searchPageSafe * MEMBERS_PER_PAGE
  );

  return (
    <AppLayout>
      <PageHeader
        title="พันธกิจ"
        description="กลุ่มย่อยของคริสตจักร ผู้รับผิดชอบ และรายชื่อสมาชิกในแต่ละกลุ่ม"
        primaryAction={
          isAdmin
            ? { label: "เพิ่มกลุ่ม", icon: Plus, onClick: openCreateModal }
            : undefined
        }
      />

      {/* One summary sentence replaces three KPI cards. */}
      {!loading && !error && (
        <p className="type-caption mb-4 text-[var(--color-body-muted)]" role="status">
          ทั้งหมด {totalGroups.toLocaleString("th-TH")} กลุ่ม ·
          เปิดดำเนินการ {activeGroupsCount.toLocaleString("th-TH")} กลุ่ม ·
          สมาชิกที่สังกัดกลุ่ม {totalMembersInGroups.toLocaleString("th-TH")} คน
        </p>
      )}

      <div className="mb-4 flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-0 flex-1 sm:min-w-60">
          <label
            htmlFor="groups-search"
            className="type-caption-strong block text-[var(--color-ink)]"
          >
            ค้นหากลุ่ม
          </label>
          <div className="relative mt-1.5">
            <Search
              size={ICON_SIZE.sm}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-quaternary)]"
            />
            <input
              id="groups-search"
              type="search"
              inputMode="search"
              autoComplete="off"
              spellCheck={false}
              className={`${INPUT_CLASS} pl-9 pr-9`}
              placeholder="ชื่อกลุ่ม ย่าน สถานที่…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="ล้างคำค้นหา"
                className="absolute right-1.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-canvas-soft)] hover:text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
              >
                <X size={ICON_SIZE.xs} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        <FilterDisclosure activeCount={activeFilterCount}>
        <div className="w-full sm:w-auto">
          <label
            htmlFor="groups-category"
            className="type-caption-strong block text-[var(--color-ink)]"
          >
            ประเภทกลุ่ม
          </label>
          <select
            id="groups-category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className={`${SELECT_CLASS} mt-1.5 sm:w-48`}
          >
            <option value="">ทุกประเภท</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div className="w-full sm:w-auto">
          <label
            htmlFor="groups-level"
            className="type-caption-strong block text-[var(--color-ink)]"
          >
            ระดับในผังองค์กร
          </label>
          <select
            id="groups-level"
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className={`${SELECT_CLASS} mt-1.5 sm:w-40`}
          >
            <option value="">ทุกระดับ</option>
            <option value="body">บอดี้</option>
            <option value="care">พันธกิจ</option>
            <option value="none">กลุ่มทั่วไป</option>
          </select>
        </div>

        <div className="w-full sm:w-auto">
          <label
            htmlFor="groups-status"
            className="type-caption-strong block text-[var(--color-ink)]"
          >
            สถานะกลุ่ม
          </label>
          <select
            id="groups-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`${SELECT_CLASS} mt-1.5 sm:w-40`}
          >
            <option value="">ทุกสถานะ</option>
            <option value="active">เปิดดำเนินการ</option>
            <option value="paused">พักชั่วคราว</option>
            <option value="closed">ปิดกลุ่ม</option>
          </select>
        </div>

        <div className="w-full sm:w-auto">
          <label
            htmlFor="groups-privacy"
            className="type-caption-strong block text-[var(--color-ink)]"
          >
            การเปิดเผยข้อมูล
          </label>
          <select
            id="groups-privacy"
            value={privacyFilter}
            onChange={(e) => setPrivacyFilter(e.target.value)}
            className={`${SELECT_CLASS} mt-1.5 sm:w-44`}
          >
            <option value="">ทุกระดับ</option>
            <option value="public">สาธารณะ</option>
            <option value="private">กลุ่มปิด (สมาชิก)</option>
            <option value="confidential">กลุ่มลับเฉพาะ</option>
          </select>
        </div>
        </FilterDisclosure>
      </div>

      {error ? (
        <ErrorState
          title="โหลดข้อมูลกลุ่มไม่สำเร็จ"
          description="ระบบเชื่อมต่อไม่สำเร็จในขณะนี้ กรุณาลองอีกครั้ง"
          technical={errorTechnical ?? undefined}
          onRetry={fetchGroups}
        />
      ) : loading ? (
        <div role="status" aria-label="กำลังโหลดข้อมูลกลุ่ม">
          <CardGridSkeleton count={6} />
        </div>
      ) : visibleGroups.length === 0 ? (
        hasFilters ? (
          <EmptyState
            icon={Search}
            title="ไม่พบกลุ่มที่ตรงกับเงื่อนไข"
            description="ลองเปลี่ยนคำค้นหา หรือล้างตัวกรองเพื่อดูกลุ่มทั้งหมด"
            action={{ label: "ล้างตัวกรอง", onClick: resetFilters }}
          />
        ) : (
          <EmptyState
            icon={UsersRound}
            title="ยังไม่มีพันธกิจในระบบ"
            description="สร้างกลุ่มแรกเพื่อเริ่มดูแลสมาชิกเป็นกลุ่มย่อย"
            action={
              isAdmin
                ? { label: "เพิ่มกลุ่ม", icon: Plus, onClick: openCreateModal }
                : undefined
            }
          />
        )
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleGroups.map((grp) => {
            const statusCfg = STATUS_LABELS[grp.status] ?? STATUS_LABELS.active;
            const privacyCfg = PRIVACY_LABELS[grp.privacy] ?? PRIVACY_LABELS.public;
            const canEditThis = canEditGroup(grp);
            const schedule = [grp.meetingDay, grp.meetingTime]
              .filter(Boolean)
              .join(" · ");

            return (
              <li
                key={grp.id}
                className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {grp.orgLevel && (
                      <StatusChip tone={grp.orgLevel === "body" ? "success" : "info"}>
                        {ORG_LEVEL_LABELS[grp.orgLevel]}
                      </StatusChip>
                    )}
                    <StatusChip tone={CATEGORY_TONES[grp.category] ?? "neutral"}>
                      {CATEGORY_LABELS[grp.category] ?? grp.category}
                    </StatusChip>
                  </div>
                  <StatusChip tone={statusCfg.tone}>{statusCfg.label}</StatusChip>
                </div>

                <div className="min-w-0">
                  <h2 className="type-body-strong text-[var(--color-ink)]">
                    {grp.name}
                  </h2>
                  {grp.parentGroupId && bodyNameById.get(grp.parentGroupId) && (
                    <p className="type-caption mt-1 text-[var(--color-body-muted)]">
                      {bodyNameById.get(grp.parentGroupId)}
                    </p>
                  )}
                  {grp.area && (
                    <p className="type-caption mt-1 flex items-center gap-1.5 text-[var(--color-body-muted)]">
                      <MapPin size={ICON_SIZE.xs} aria-hidden="true" />
                      {grp.area}
                    </p>
                  )}
                  {grp.orgLevel === "care" ? (
                    parseCareGroupDescription(grp.description).careLeaderName && (
                      <p className="type-caption mt-2 text-[var(--color-text-secondary)]">
                        หนค. {parseCareGroupDescription(grp.description).careLeaderName}
                      </p>
                    )
                  ) : (
                    !grp.orgLevel &&
                    grp.description && (
                      <p className="type-caption mt-2 line-clamp-3 text-[var(--color-text-secondary)]">
                        {grp.description}
                      </p>
                    )
                  )}
                </div>

                <dl className="type-caption space-y-1.5 text-[var(--color-text-secondary)]">
                  {schedule && (
                    <div className="flex items-start gap-2">
                      <dt className="sr-only">เวลานัดพบ</dt>
                      <Clock
                        size={ICON_SIZE.sm}
                        aria-hidden="true"
                        className="mt-0.5 shrink-0 text-[var(--color-text-quaternary)]"
                      />
                      <dd>{schedule}</dd>
                    </div>
                  )}
                  {grp.meetingLocation && (
                    <div className="flex items-start gap-2">
                      <dt className="sr-only">สถานที่นัดพบ</dt>
                      <MapPin
                        size={ICON_SIZE.sm}
                        aria-hidden="true"
                        className="mt-0.5 shrink-0 text-[var(--color-text-quaternary)]"
                      />
                      <dd className="min-w-0 break-words">
                        {grp.meetingLocation}
                        {grp.privacy !== "public" && (
                          <Lock
                            size={ICON_SIZE.xs}
                            aria-hidden="true"
                            className="ml-1.5 inline text-[var(--color-text-quaternary)]"
                          />
                        )}
                      </dd>
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    <dt className="sr-only">ผู้รับผิดชอบ</dt>
                    <Users
                      size={ICON_SIZE.sm}
                      aria-hidden="true"
                      className="mt-0.5 shrink-0 text-[var(--color-text-quaternary)]"
                    />
                    <dd>
                      ผู้นำ: {grp.leaderName || "ยังไม่กำหนด"}
                    </dd>
                  </div>
                  <div className="flex items-start gap-2">
                    <dt className="sr-only">การเปิดเผยข้อมูล</dt>
                    <CheckCircle2
                      size={ICON_SIZE.sm}
                      aria-hidden="true"
                      className="mt-0.5 shrink-0 text-[var(--color-text-quaternary)]"
                    />
                    <dd>{privacyCfg.label}</dd>
                  </div>
                </dl>

                {/* One primary action, then one overflow menu. */}
                <div className="mt-auto flex items-center gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => openMembersModal(grp)}
                    className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-on-dark)] transition-colors hover:bg-[var(--color-primary-focus)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
                  >
                    <Users size={ICON_SIZE.sm} aria-hidden="true" />
                    สมาชิก {grp.memberCount} คน
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/attendance?groupId=${grp.id}`)}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-pill)] border border-[var(--color-hairline)] px-4 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
                  >
                    <UserCheck size={ICON_SIZE.sm} aria-hidden="true" />
                    เช็คชื่อ
                  </button>
                  {(canEditThis || isAdmin) && (
                    <RowMenu label={`ตัวเลือกเพิ่มเติมของกลุ่ม ${grp.name}`}>
                      {close => (
                        <>
                          {canEditThis && (
                            <MenuItem
                              icon={Pencil}
                              label="แก้ไขข้อมูลกลุ่ม"
                              onSelect={() => {
                                close();
                                openEditModal(grp);
                              }}
                            />
                          )}
                          {isAdmin && (
                            <MenuItem
                              icon={Trash2}
                              label="ลบกลุ่ม"
                              tone="danger"
                              onSelect={() => {
                                close();
                                setDeleteTarget(grp);
                              }}
                            />
                          )}
                        </>
                      )}
                    </RowMenu>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Create / Edit */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingGroup ? `แก้ไขกลุ่ม ${editingGroup.name}` : "เพิ่มกลุ่มใหม่"}
        description="ตั้งชื่อกลุ่มและรายละเอียดการนัดพบเท่าที่ทราบ"
        size="wide"
        footer={
          <>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] px-5 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              form="group-form"
              disabled={saving}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-on-dark)] transition-colors hover:bg-[var(--color-primary-focus)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50"
            >
              {saving
                ? "กำลังบันทึก…"
                : editingGroup
                  ? "บันทึกการแก้ไข"
                  : "เพิ่มกลุ่ม"}
            </button>
          </>
        }
      >
        <form id="group-form" onSubmit={handleSaveGroup} className="space-y-6">
          {formError && <FormError>{formError}</FormError>}

          <fieldset className="space-y-4">
            <legend className="type-caption-strong mb-2 text-[var(--color-ink)]">
              ข้อมูลกลุ่ม
            </legend>
            <Field label="ชื่อกลุ่ม" required error={nameError ?? undefined}>
              {fieldProps => (
                <input
                  {...fieldProps}
                  className={INPUT_CLASS}
                  placeholder="เช่น พันธกิจเมืองกาฬสินธุ์ 1"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              )}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="ระดับในผังองค์กร">
                {fieldProps => (
                  <select
                    {...fieldProps}
                    className={SELECT_CLASS}
                    value={form.orgLevel}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        orgLevel: e.target.value as OrgLevel | "",
                        parentGroupId: e.target.value === "care" ? form.parentGroupId : "",
                      })
                    }
                  >
                    <option value="">กลุ่มทั่วไป (ไม่อยู่ในผัง)</option>
                    <option value="body">บอดี้</option>
                    <option value="care">พันธกิจ</option>
                  </select>
                )}
              </Field>
              {form.orgLevel === "care" && (
                <Field label="อยู่ใต้บอดี้">
                  {fieldProps => (
                    <select
                      {...fieldProps}
                      className={SELECT_CLASS}
                      value={form.parentGroupId}
                      onChange={(e) => setForm({ ...form, parentGroupId: e.target.value })}
                    >
                      <option value="">— ยังไม่ระบุบอดี้ —</option>
                      {bodies.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
              )}
              {form.orgLevel && (
                <div className="sm:col-span-2">
                  <p className="type-caption-strong text-[var(--color-ink)]">
                    {form.orgLevel === "body" ? "หัวหน้าบอดี้ (หนบ.)" : "หัวหน้าพันธกิจ (หนค.)"}
                  </p>
                  <div className="mt-1.5">
                    <MemberPicker
                      value={form.leaderMemberId}
                      valueName={form.leaderMemberName}
                      onChange={(id, name) => setForm({ ...form, leaderMemberId: id, leaderMemberName: name })}
                    />
                  </div>
                </div>
              )}
              <Field label="ประเภทกลุ่ม">
                {fieldProps => (
                  <select
                    {...fieldProps}
                    className={SELECT_CLASS}
                    value={form.category}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value as GroupCategory })
                    }
                  >
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label="สถานะกลุ่ม">
                {fieldProps => (
                  <select
                    {...fieldProps}
                    className={SELECT_CLASS}
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value as GroupStatus })
                    }
                  >
                    <option value="active">เปิดดำเนินการ</option>
                    <option value="paused">พักชั่วคราว</option>
                    <option value="closed">ปิดกลุ่ม</option>
                  </select>
                )}
              </Field>
            </div>
            <Field
              label="การเปิดเผยข้อมูล"
              hint="กำหนดว่าสมาชิกทั่วไปเห็นสถานที่ของกลุ่มได้แค่ไหน"
            >
              {fieldProps => (
                <select
                  {...fieldProps}
                  className={SELECT_CLASS}
                  value={form.privacy}
                  onChange={(e) =>
                    setForm({ ...form, privacy: e.target.value as GroupPrivacy })
                  }
                >
                  <option value="public">สาธารณะ — แสดงพิกัด</option>
                  <option value="private">กลุ่มปิด — แสดงเฉพาะย่าน/เขต</option>
                  <option value="confidential">
                    กลุ่มลับ — ซ่อนสถานที่จากสมาชิก
                  </option>
                </select>
              )}
            </Field>
            <Field label="คำอธิบายหรือเป้าหมายของกลุ่ม">
              {fieldProps => (
                <textarea
                  {...fieldProps}
                  rows={3}
                  className={`${INPUT_CLASS} py-2`}
                  placeholder="รายละเอียดเพิ่มเติมของกลุ่ม…"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              )}
            </Field>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="type-caption-strong mb-2 text-[var(--color-ink)]">
              การนัดพบ
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="ย่าน / พื้นที่">
                {fieldProps => (
                  <input
                    {...fieldProps}
                    className={INPUT_CLASS}
                    placeholder="เช่น อ.เมืองกาฬสินธุ์, ยางตลาด"
                    value={form.area}
                    onChange={(e) => setForm({ ...form, area: e.target.value })}
                  />
                )}
              </Field>
              <Field label="วันนัดพบ">
                {fieldProps => (
                  <input
                    {...fieldProps}
                    className={INPUT_CLASS}
                    placeholder="เช่น ทุกวันศุกร์"
                    value={form.meetingDay}
                    onChange={(e) =>
                      setForm({ ...form, meetingDay: e.target.value })
                    }
                  />
                )}
              </Field>
              <Field label="เวลานัดพบ">
                {fieldProps => (
                  <input
                    {...fieldProps}
                    className={INPUT_CLASS}
                    placeholder="เช่น 19:00 - 20:30 น."
                    value={form.meetingTime}
                    onChange={(e) =>
                      setForm({ ...form, meetingTime: e.target.value })
                    }
                  />
                )}
              </Field>
              <Field label="จำนวนสมาชิกสูงสุด" hint="เว้นว่างได้ถ้าไม่จำกัด">
                {fieldProps => (
                  <input
                    {...fieldProps}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    className={INPUT_CLASS}
                    placeholder="เช่น 20"
                    value={form.maxMembers}
                    onChange={(e) =>
                      setForm({ ...form, maxMembers: e.target.value })
                    }
                  />
                )}
              </Field>
            </div>
            <Field label="สถานที่นัดพบ">
              {fieldProps => (
                <input
                  {...fieldProps}
                  className={INPUT_CLASS}
                  placeholder="เช่น บ้านพี่สมชาย, ห้องนมัสการชั้น 2"
                  value={form.meetingLocation}
                  onChange={(e) =>
                    setForm({ ...form, meetingLocation: e.target.value })
                  }
                />
              )}
            </Field>
            <label className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-hairline)] p-3">
              <input
                type="checkbox"
                checked={form.isOpen}
                onChange={(e) => setForm({ ...form, isOpen: e.target.checked })}
                className="mt-0.5 size-6 shrink-0 rounded-[var(--radius-xs)] accent-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
              />
              <span className="type-caption text-[var(--color-ink)]">
                เปิดรับสมาชิกใหม่เข้ากลุ่มนี้
              </span>
            </label>
          </fieldset>
        </form>
      </Modal>

      {/* Group members */}
      <Modal
        open={membersModalOpen && activeGroup !== null}
        onClose={() => setMembersModalOpen(false)}
        title={activeGroup ? `สมาชิกในกลุ่ม ${activeGroup.name}` : "สมาชิกในกลุ่ม"}
        description={
          activeGroup
            ? `${CATEGORY_LABELS[activeGroup.category]} · ปัจจุบัน ${activeMembers.length} คน`
            : undefined
        }
        size="wide"
        footer={
          <button
            type="button"
            onClick={() => setMembersModalOpen(false)}
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] px-5 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
          >
            ปิด
          </button>
        }
      >
        {activeGroup && (
          <div className="space-y-5">
            {canEditGroup(activeGroup) && (
              <form
                onSubmit={handleAddMemberToGroup}
                className="space-y-4 rounded-[var(--radius-md)] bg-[var(--color-canvas-soft)] p-4"
              >
                <Field label="เพิ่มสมาชิกเข้ากลุ่ม">
                  {fieldProps => (
                    <select
                      {...fieldProps}
                      className={SELECT_CLASS}
                      value={selectedMemberId}
                      onChange={(e) => {
                        setSelectedMemberId(e.target.value);
                        setSearchPage(1);
                      }}
                    >
                      <option value="">เลือกสมาชิกจากทะเบียนคริสตจักร…</option>
                      {pagedSearchableMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                          {m.nickname ? ` (${m.nickname})` : ""}
                          {m.phone ? ` — ${m.phone}` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>

                {searchableMembers.length > MEMBERS_PER_PAGE && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="type-fine text-[var(--color-body-muted)]">
                      หน้า {searchPageSafe} จาก {searchTotalPages} ·{" "}
                      {searchableMembers.length} คนที่ยังไม่อยู่ในกลุ่ม
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSearchPage((p) => Math.max(1, p - 1))}
                        disabled={searchPageSafe <= 1}
                        aria-label="รายชื่อก่อนหน้า"
                        className={`${iconButtonClass} border border-[var(--color-hairline)] disabled:opacity-40`}
                      >
                        <ChevronLeft size={ICON_SIZE.sm} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSearchPage((p) => Math.min(searchTotalPages, p + 1))
                        }
                        disabled={searchPageSafe >= searchTotalPages}
                        aria-label="รายชื่อถัดไป"
                        className={`${iconButtonClass} border border-[var(--color-hairline)] disabled:opacity-40`}
                      >
                        <ChevronRight size={ICON_SIZE.sm} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                )}

                <Field label="บทบาทในกลุ่ม">
                  {fieldProps => (
                    <select
                      {...fieldProps}
                      className={SELECT_CLASS}
                      value={selectedRole}
                      onChange={(e) =>
                        setSelectedRole(e.target.value as GroupMemberRole)
                      }
                    >
                      <option value="member">สมาชิก</option>
                      <option value="leader">หัวหน้ากลุ่ม</option>
                      <option value="assistant_leader">ผู้ช่วยหัวหน้า</option>
                      <option value="host">เจ้าบ้าน</option>
                    </select>
                  )}
                </Field>

                <button
                  type="submit"
                  disabled={addingMember || !selectedMemberId}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-on-dark)] transition-colors hover:bg-[var(--color-primary-focus)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50 sm:w-auto"
                >
                  <UserPlus size={ICON_SIZE.sm} aria-hidden="true" />
                  {addingMember ? "กำลังเพิ่ม…" : "เพิ่มเข้ากลุ่ม"}
                </button>
              </form>
            )}

            {loadingMembers ? (
              <div role="status" aria-label="กำลังโหลดรายชื่อสมาชิกในกลุ่ม">
                <TableSkeleton rows={5} />
              </div>
            ) : groupMembersList.length === 0 ? (
              <EmptyState
                inset
                icon={Users}
                title="ยังไม่มีสมาชิกในกลุ่มนี้"
                description={
                  canEditGroup(activeGroup)
                    ? "เลือกสมาชิกจากทะเบียนด้านบนเพื่อเริ่มต้นกลุ่ม"
                    : "เมื่อผู้ดูแลเพิ่มสมาชิก รายชื่อจะแสดงที่นี่"
                }
              />
            ) : (
              <ul className="divide-y divide-[var(--color-divider)]">
                {[...activeMembers, ...formerMembers].map((gm) => (
                  <li
                    key={gm.id}
                    className="flex flex-wrap items-center gap-3 py-3"
                  >
                    <InitialsAvatar name={gm.memberName} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="type-caption-strong truncate text-[var(--color-ink)]">
                        {gm.memberName}
                        {gm.memberNickname ? (
                          <span className="type-fine ml-1.5 font-normal text-[var(--color-text-tertiary)]">
                            ({gm.memberNickname})
                          </span>
                        ) : null}
                      </p>
                      <p className="type-fine text-[var(--color-text-tertiary)]">
                        เข้ากลุ่ม {formatThaiDate(gm.joinedAt)} · เข้าร่วมล่าสุด{" "}
                        {formatThaiDate(gm.lastAttendedAt)}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <StatusChip
                          tone={gm.role === "member" ? "neutral" : "info"}
                        >
                          {ROLE_LABELS[gm.role] ?? gm.role}
                        </StatusChip>
                        <StatusChip
                          tone={gm.status === "active" ? "success" : "neutral"}
                        >
                          {gm.status === "active" ? "ปกติ" : "พ้นสภาพ"}
                        </StatusChip>
                      </div>
                    </div>
                    {canEditGroup(activeGroup) && (
                      <button
                        type="button"
                        onClick={() =>
                          gm.status === "active"
                            ? handleRemoveMemberFromGroup(gm.memberId)
                            : handleReactivateMember(gm.memberId)
                        }
                        className="type-caption-strong inline-flex min-h-11 items-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] px-4 transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
                      >
                        {gm.status === "active" ? "นำออกจากกลุ่ม" : "รับกลับเข้ากลุ่ม"}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <section>
              <h3 className="type-caption-strong mb-2 text-[var(--color-ink)]">
                กิจกรรมพันธกิจล่าสุดของกลุ่ม
              </h3>
              <ActivityTimeline subjectType="group" subjectId={activeGroup.id} />
            </section>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <ConfirmDialog
          title="ยืนยันการลบกลุ่ม"
          description={`คุณแน่ใจหรือไม่ว่าต้องการลบกลุ่ม "${deleteTarget.name}"? ระบบจะเปลี่ยนสถานะเป็นปิดกลุ่ม (Closed) โดยข้อมูลสมาชิกและประวัติการเข้าร่วมเดิมจะไม่สูญหาย`}
          confirmLabel={deleting ? "กำลังลบ…" : "ลบกลุ่ม"}
          isSubmitting={deleting}
          onConfirm={handleDeleteGroup}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </AppLayout>
  );
}
