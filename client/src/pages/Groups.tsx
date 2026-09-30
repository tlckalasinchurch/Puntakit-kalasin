import { useCallback, useEffect, useState } from "react";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Heart,
  Lock,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Shield,
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
import { ICON_SIZE } from "@/lib/icon-sizes";
import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { useLocation } from "wouter";
import type {
  GroupCategory,
  GroupMemberRole,
  GroupMemberStatus,
  GroupPrivacy,
  GroupStatus,
} from "@shared/schema";

interface GroupItem {
  id: string;
  name: string;
  leaderId: string | null;
  coLeaderId: string | null;
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
  ministry: "พันธกิจ",
  fellowship: "กลุ่มสามัคคีธรรม",
  general: "กลุ่มทั่วไป",
  other: "อื่น ๆ",
};

const CATEGORY_COLORS: Record<GroupCategory, string> = {
  cell: "blue",
  bible_study: "blue",
  prayer: "purple",
  youth: "purple",
  kids: "green",
  family: "green",
  men: "blue",
  women: "orange",
  volunteer: "orange",
  online: "blue",
  ministry: "purple",
  fellowship: "orange",
  general: "blue",
  other: "gray",
};

const ROLE_LABELS: Record<GroupMemberRole, string> = {
  leader: "หัวหน้ากลุ่ม",
  assistant_leader: "ผู้ช่วยหัวหน้า",
  host: "เจ้าบ้าน",
  member: "สมาชิก",
};

const PRIVACY_LABELS: Record<GroupPrivacy, { label: string; tone: string }> = {
  public: { label: "สาธารณะ", tone: "good" },
  private: { label: "กลุ่มปิด (สมาชิก)", tone: "attention" },
  confidential: { label: "กลุ่มลับเฉพาะ", tone: "urgent" },
};

const STATUS_LABELS: Record<GroupStatus, { label: string; tone: string }> = {
  active: { label: "เปิดดำเนินการ", tone: "good" },
  paused: { label: "พักชั่วคราว", tone: "attention" },
  closed: { label: "ปิดกลุ่ม", tone: "muted" },
};

const EMPTY_FORM = {
  name: "",
  leaderId: "",
  coLeaderId: "",
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

export default function Groups() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const isSuperAdmin = user?.role === "super_admin";
  const isAdmin = isSuperAdmin || user?.role === "admin";
  const isMinistryLeader = user?.role === "ministry_leader";

  const [groupsList, setGroupsList] = useState<GroupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [privacyFilter, setPrivacyFilter] = useState<string>("");

  // Create / Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupItem | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

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

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (categoryFilter) params.set("category", categoryFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (privacyFilter) params.set("privacy", privacyFilter);

      const res = await api.get<GroupItem[]>(`/api/groups?${params.toString()}`);
      setGroupsList(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "โหลดข้อมูลกลุ่มไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, statusFilter, privacyFilter]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // Load available members for adding
  const fetchAvailableMembers = async () => {
    try {
      const res = await api.get<{ items: SimpleMember[] }>("/api/members?limit=200");
      setAvailableMembers(res.items || []);
    } catch {
      // ignore
    }
  };

  const openCreateModal = () => {
    setEditingGroup(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEditModal = (grp: GroupItem) => {
    setEditingGroup(grp);
    setForm({
      name: grp.name,
      leaderId: grp.leaderId || "",
      coLeaderId: grp.coLeaderId || "",
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
    setModalOpen(true);
  };

  const canEditGroup = (grp: GroupItem) => {
    if (isAdmin || isMinistryLeader) return true;
    if (user?.role === "group_leader" && (grp.leaderId === user?.id || grp.coLeaderId === user?.id)) return true;
    return false;
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("กรุณากรอกชื่อกลุ่ม");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        leaderId: form.leaderId ? form.leaderId : null,
        coLeaderId: form.coLeaderId ? form.coLeaderId : null,
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
        toast.success("สร้างกลุ่มใหม่เรียบร้อยแล้ว");
      }
      setModalOpen(false);
      fetchGroups();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกข้อมูลไม่สำเร็จ");
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

  // Metrics
  const totalGroups = groupsList.length;
  const activeGroupsCount = groupsList.filter((g) => g.status === "active").length;
  const totalMembersInGroups = groupsList.reduce((acc, g) => acc + (g.memberCount || 0), 0);

  const formatThaiDate = (dateStr: string | null) => {
    if (!dateStr) return "ยังไม่มีประวัติ";
    const d = new Date(dateStr);
    return d.toLocaleDateString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="page-heading">
        <div>
          <span className="eyebrow">PUNTAKIT CHURCH GROUPS</span>
          <h1>กลุ่มแคร์และพันธกิจ</h1>
          <p>ระบบบริหารจัดการกลุ่มย่อย ชุมชนความเชื่อ การนัดพบ และรายชื่อสมาชิกในแต่ละกลุ่ม</p>
        </div>
        {isAdmin && (
          <button className="primary-action" onClick={openCreateModal}>
            <Plus size={ICON_SIZE.sm} />
            <span>สร้างกลุ่มใหม่</span>
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="member-summary">
        <div className="summary-card blue">
          <div className="summary-icon">
            <UsersRound size={ICON_SIZE.md} />
          </div>
          <div>
            <small>กลุ่มทั้งหมด</small>
            <div>
              <strong>{totalGroups}</strong>
              <span>กลุ่ม</span>
            </div>
          </div>
        </div>

        <div className="summary-card green">
          <div className="summary-icon">
            <CheckCircle2 size={ICON_SIZE.md} />
          </div>
          <div>
            <small>กลุ่มที่เปิดดำเนินการ</small>
            <div>
              <strong>{activeGroupsCount}</strong>
              <span>กลุ่ม ({totalGroups ? Math.round((activeGroupsCount / totalGroups) * 100) : 0}%)</span>
            </div>
          </div>
        </div>

        <div className="summary-card orange">
          <div className="summary-icon">
            <Users size={ICON_SIZE.md} />
          </div>
          <div>
            <small>สมาชิกที่สังกัดกลุ่ม</small>
            <div>
              <strong>{totalMembersInGroups}</strong>
              <span>คน</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="member-toolbar" style={{ flexWrap: "wrap", gap: "10px" }}>
        <div className="search-box" style={{ minWidth: "240px", flex: 1 }}>
          <Search size={ICON_SIZE.sm} />
          <input
            type="text"
            placeholder="ค้นหาชื่อกลุ่ม, ย่าน, สถานที่ หรือคำอธิบาย..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="clear-search" onClick={() => setSearch("")}>
              <X size={ICON_SIZE.xs} />
            </button>
          )}
        </div>

        <div className="toolbar-filters" style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="filter-select"
          >
            <option value="">หมวดหมู่ทั้งหมด</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
          >
            <option value="">สถานะทั้งหมด</option>
            <option value="active">เปิดดำเนินการ</option>
            <option value="paused">พักชั่วคราว</option>
            <option value="closed">ปิดกลุ่ม</option>
          </select>

          {/* Privacy Filter */}
          <select
            value={privacyFilter}
            onChange={(e) => setPrivacyFilter(e.target.value)}
            className="filter-select"
          >
            <option value="">ความเป็นส่วนตัวทั้งหมด</option>
            <option value="public">สาธารณะ</option>
            <option value="private">กลุ่มปิด (สมาชิก)</option>
            <option value="confidential">กลุ่มลับเฉพาะ</option>
          </select>
        </div>
      </div>

      {/* Groups Grid */}
      {loading ? (
        <CardGridSkeleton count={6} />
      ) : error ? (
        <div className="state-panel error">
          <AlertCircle size={ICON_SIZE.xl} />
          <h3>เกิดข้อผิดพลาด</h3>
          <p>{error}</p>
          <button className="primary-action" onClick={fetchGroups} style={{ marginTop: 12 }}>
            <RefreshCw size={ICON_SIZE.sm} />
            <span>ลองใหม่</span>
          </button>
        </div>
      ) : groupsList.length === 0 ? (
        <div className="state-panel">
          <UsersRound size={ICON_SIZE.xl} />
          <h3>ไม่พบกลุ่มที่ตรงกับเงื่อนไข</h3>
          <p>ลองปรับคำค้นหาหรือตัวกรองหมวดหมู่</p>
        </div>
      ) : (
        <div className="groups-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
          {groupsList.map((grp) => {
            const catColor = CATEGORY_COLORS[grp.category] || "blue";
            const canEditThis = canEditGroup(grp);
            const privacyCfg = PRIVACY_LABELS[grp.privacy] || PRIVACY_LABELS.public;
            const statusCfg = STATUS_LABELS[grp.status] || STATUS_LABELS.active;

            return (
              <div
                key={grp.id}
                className="group-card"
                style={{
                  background: "#fff",
                  borderRadius: "16px",
                  padding: "18px",
                  border: "1px solid #e5edf5",
                  boxShadow: "0 2px 8px rgba(15, 34, 58, 0.04)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  {/* Top Row: Category & Status Badges */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "6px" }}>
                    <span className={`role-chip ${catColor}`}>
                      {CATEGORY_LABELS[grp.category] || grp.category}
                    </span>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <span className={`status-chip ${privacyCfg.tone}`}>
                        {grp.privacy !== "public" && <Lock size={10} style={{ marginRight: 3, display: "inline" }} />}
                        {privacyCfg.label}
                      </span>
                      <span className={`status-chip ${statusCfg.tone}`}>
                        {statusCfg.label}
                      </span>
                    </div>
                  </div>

                  {/* Group Name & Area */}
                  <h3 style={{ margin: "0 0 4px", fontSize: "17px", color: "var(--ink)", fontWeight: 700 }}>
                    {grp.name}
                  </h3>
                  {grp.area && (
                    <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "8px", display: "flex", alignItems: "center", gap: "4px" }}>
                      <MapPin size={12} className="text-blue-500" />
                      <span>ย่าน/พื้นที่: <strong>{grp.area}</strong></span>
                    </div>
                  )}

                  {grp.description && (
                    <p style={{ margin: "0 0 12px", fontSize: "12px", color: "var(--muted)", lineHeight: 1.5 }}>
                      {grp.description}
                    </p>
                  )}

                  {/* Meeting Schedule & Location */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "#4f657d", marginBottom: "14px" }}>
                    {(grp.meetingDay || grp.meetingTime) && (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Clock size={ICON_SIZE.sm} style={{ color: "#397bc4", flexShrink: 0 }} />
                        <span>
                          {grp.meetingDay} {grp.meetingTime ? `(${grp.meetingTime})` : ""}
                        </span>
                      </div>
                    )}
                    {grp.meetingLocation && (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <MapPin size={ICON_SIZE.sm} style={{ color: "#e35b78", flexShrink: 0 }} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {grp.meetingLocation}
                        </span>
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Users size={ICON_SIZE.sm} style={{ color: "#259a60", flexShrink: 0 }} />
                      <strong>สมาชิกในกลุ่ม {grp.memberCount} คน</strong>
                    </div>
                  </div>
                </div>

                {/* Card Bottom: Leader info & Actions */}
                <div style={{ borderTop: "1px solid #eef3f8", paddingTop: "12px", marginTop: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", fontSize: "11px", color: "#74889e" }}>
                    <div>
                      ผู้นำ: <strong style={{ color: "var(--ink)" }}>{grp.leaderName || "ยังไม่กำหนด"}</strong>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button
                      className="blue-button"
                      style={{ flex: 1, justifyContent: "center", padding: "8px" }}
                      onClick={() => openMembersModal(grp)}
                    >
                      <Users size={ICON_SIZE.sm} />
                      <span>สมาชิก ({grp.memberCount})</span>
                    </button>

                    <button
                      className="primary-action"
                      style={{ flex: 1, justifyContent: "center", padding: "8px", background: "#228b5a" }}
                      onClick={() => navigate(`/attendance?groupId=${grp.id}`)}
                    >
                      <UserCheck size={ICON_SIZE.sm} />
                      <span>เช็คชื่อ</span>
                    </button>

                    {canEditThis && (
                      <button
                        style={{
                          background: "#f1f5f9",
                          color: "#546b82",
                          borderRadius: "10px",
                          padding: "8px 10px",
                          display: "grid",
                          placeItems: "center",
                        }}
                        onClick={() => openEditModal(grp)}
                        title="แก้ไขข้อมูลกลุ่ม"
                      >
                        <Pencil size={ICON_SIZE.sm} />
                      </button>
                    )}

                    {isAdmin && (
                      <button
                        style={{
                          background: "#fff0f2",
                          color: "#d44359",
                          borderRadius: "10px",
                          padding: "8px 10px",
                          display: "grid",
                          placeItems: "center",
                        }}
                        onClick={() => setDeleteTarget(grp)}
                        title="ลบกลุ่ม"
                      >
                        <Trash2 size={ICON_SIZE.sm} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "560px" }}>
            <div className="modal-heading">
              <div>
                <h2>{editingGroup ? "แก้ไขข้อมูลกลุ่ม" : "สร้างกลุ่มใหม่"}</h2>
                <p>{editingGroup ? `กำลังแก้ไขกลุ่ม: ${editingGroup.name}` : "กรอกข้อมูลรายละเอียดเพื่อตั้งกลุ่มใหม่ในคริสตจักร"}</p>
              </div>
              <button onClick={() => setModalOpen(false)}>
                <X size={ICON_SIZE.sm} />
              </button>
            </div>

            <form onSubmit={handleSaveGroup}>
              <div className="form-grid">
                <label className="full-field">
                  <span>ชื่อกลุ่ม *</span>
                  <input
                    type="text"
                    required
                    placeholder="เช่น แคร์เมืองกาฬสินธุ์ 1, แคร์เยาวชน"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </label>

                <label>
                  <span>ประเภทกลุ่ม</span>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value as GroupCategory })}
                  >
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>ระดับความเป็นส่วนตัว (PDPA)</span>
                  <select
                    value={form.privacy}
                    onChange={(e) => setForm({ ...form, privacy: e.target.value as GroupPrivacy })}
                  >
                    <option value="public">สาธารณะ (แสดงพิกัด)</option>
                    <option value="private">กลุ่มปิด (แสดงเฉพาะย่าน/เขต)</option>
                    <option value="confidential">กลุ่มลับ (ซ่อนสถานที่สำหรับสมาชิก)</option>
                  </select>
                </label>

                <label>
                  <span>สถานะกลุ่ม</span>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as GroupStatus })}
                  >
                    <option value="active">เปิดดำเนินการ (Active)</option>
                    <option value="paused">พักชั่วคราว (Paused)</option>
                    <option value="closed">ปิดกลุ่ม (Closed)</option>
                  </select>
                </label>

                <label>
                  <span>ย่าน / พื้นที่ / อำเภอ</span>
                  <input
                    type="text"
                    placeholder="เช่น อ.เมืองกาฬสินธุ์, ยางตลาด"
                    value={form.area}
                    onChange={(e) => setForm({ ...form, area: e.target.value })}
                  />
                </label>

                <label>
                  <span>วันนัดพบ</span>
                  <input
                    type="text"
                    placeholder="เช่น ทุกวันศุกร์, วันพุธเว้นพุธ"
                    value={form.meetingDay}
                    onChange={(e) => setForm({ ...form, meetingDay: e.target.value })}
                  />
                </label>

                <label>
                  <span>เวลานัดพบ</span>
                  <input
                    type="text"
                    placeholder="เช่น 19:00 - 20:30 น."
                    value={form.meetingTime}
                    onChange={(e) => setForm({ ...form, meetingTime: e.target.value })}
                  />
                </label>

                <label className="full-field">
                  <span>สถานที่นัดพบ</span>
                  <input
                    type="text"
                    placeholder="เช่น บ้านพี่สมชาย, ห้องนมัสการชั้น 2"
                    value={form.meetingLocation}
                    onChange={(e) => setForm({ ...form, meetingLocation: e.target.value })}
                  />
                </label>

                <label className="full-field">
                  <span>คำอธิบาย / เป้าหมายกลุ่ม</span>
                  <textarea
                    rows={3}
                    placeholder="รายละเอียดเพิ่มเติมของกลุ่ม..."
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </label>
              </div>

              <div className="modal-actions">
                <button type="button" className="cancel-button" onClick={() => setModalOpen(false)}>
                  ยกเลิก
                </button>
                <button type="submit" className="primary-action" disabled={saving}>
                  {saving ? "กำลังบันทึก..." : editingGroup ? "บันทึกการแก้ไข" : "สร้างกลุ่ม"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Group Members Modal */}
      {membersModalOpen && activeGroup && (
        <div className="modal-backdrop" onClick={() => setMembersModalOpen(false)}>
          <div className="modal-card modal-wide" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "780px" }}>
            <div className="modal-heading">
              <div>
                <h2>สมาชิกในกลุ่ม: {activeGroup.name}</h2>
                <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--muted)" }}>
                  {CATEGORY_LABELS[activeGroup.category]} • สมาชิกทั้งหมด {groupMembersList.length} คน (ปกติ {groupMembersList.filter(m => m.status === 'active').length} คน)
                </p>
              </div>
              <button onClick={() => setMembersModalOpen(false)}>
                <X size={ICON_SIZE.sm} />
              </button>
            </div>

            {/* Add member section (Only if user has permission to edit group) */}
            {canEditGroup(activeGroup) && (
              <div
                style={{
                  background: "#f7fafd",
                  padding: "14px",
                  borderRadius: "14px",
                  border: "1px solid #e2edf6",
                  marginBottom: "18px",
                }}
              >
                <form onSubmit={handleAddMemberToGroup} style={{ display: "flex", gap: "10px", alignItems: "end", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: "220px" }}>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#54687e", marginBottom: "4px" }}>
                      เลือกสมาชิกจากทะเบียนคริสตจักร
                    </label>
                    <select
                      value={selectedMemberId}
                      onChange={(e) => setSelectedMemberId(e.target.value)}
                      style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "10px", border: "1px solid #d7e4f0" }}
                    >
                      <option value="">-- เลือกสมาชิกเพื่อเพิ่มเข้ากลุ่ม --</option>
                      {availableMembers
                        .filter((m) => !groupMembersList.some((gm) => gm.memberId === m.id && gm.status === "active"))
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} {m.nickname ? `(${m.nickname})` : ""} {m.phone ? `- ${m.phone}` : ""}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div style={{ width: "140px" }}>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#54687e", marginBottom: "4px" }}>
                      บทบาทในกลุ่ม
                    </label>
                    <select
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value as GroupMemberRole)}
                      style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "10px", border: "1px solid #d7e4f0" }}
                    >
                      <option value="member">สมาชิก</option>
                      <option value="leader">หัวหน้ากลุ่ม</option>
                      <option value="assistant_leader">ผู้ช่วยหัวหน้า</option>
                      <option value="host">เจ้าบ้าน</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="primary-action"
                    disabled={addingMember || !selectedMemberId}
                    style={{ height: "38px", padding: "0 16px" }}
                  >
                    <UserPlus size={ICON_SIZE.sm} />
                    <span>{addingMember ? "กำลังเพิ่ม..." : "เพิ่มเข้ากลุ่ม"}</span>
                  </button>
                </form>
              </div>
            )}

            {/* Members List Table */}
            {loadingMembers ? (
              <TableSkeleton rows={5} />
            ) : groupMembersList.length === 0 ? (
              <div className="state-panel">
                <Users size={ICON_SIZE.lg} />
                <h3>ยังไม่มีสมาชิกในกลุ่มนี้</h3>
                <p>เลือกเพิ่มสมาชิกเข้ากลุ่มจากฟอร์มด้านบน</p>
              </div>
            ) : (
              <div style={{ maxHeight: "380px", overflowY: "auto" }}>
                <table className="member-table" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th>ชื่อ-นามสกุล</th>
                      <th>บทบาท</th>
                      <th>สถานะ</th>
                      <th>เข้าร่วมล่าสุด</th>
                      <th>วันที่เข้ากลุ่ม</th>
                      {canEditGroup(activeGroup) && <th style={{ textAlign: "right" }}>จัดการ</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {groupMembersList.map((gm) => (
                      <tr key={gm.id} style={{ opacity: gm.status === "inactive" ? 0.6 : 1 }}>
                        <td>
                          <div className="member-name">
                            <div className="member-avatar blue">
                              {gm.memberName.slice(0, 1)}
                            </div>
                            <div>
                              <strong>{gm.memberName}</strong>
                              {gm.memberNickname && <small>ชื่อเล่น: {gm.memberNickname}</small>}
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`role-chip ${gm.role === "leader" ? "purple" : gm.role === "assistant_leader" ? "blue" : gm.role === "host" ? "orange" : ""}`}>
                            {ROLE_LABELS[gm.role] || gm.role}
                          </span>
                        </td>
                        <td>
                          <span className={`status-chip ${gm.status === "active" ? "good" : "muted"}`}>
                            {gm.status === "active" ? "ปกติ" : "พ้นสภาพ"}
                          </span>
                        </td>
                        <td style={{ fontSize: "11px", color: "#64748b" }}>
                          {formatThaiDate(gm.lastAttendedAt)}
                        </td>
                        <td style={{ fontSize: "11px" }}>
                          {new Date(gm.joinedAt).toLocaleDateString("th-TH")}
                        </td>
                        {canEditGroup(activeGroup) && (
                          <td style={{ textAlign: "right" }}>
                            {gm.status === "active" ? (
                              <button
                                className="danger-button"
                                style={{ padding: "5px 9px", fontSize: "10px" }}
                                onClick={() => handleRemoveMemberFromGroup(gm.memberId)}
                                title="นำออกจากกลุ่ม (เปลี่ยนสถานะเป็น inactive)"
                              >
                                <span>นำออก</span>
                              </button>
                            ) : (
                              <button
                                className="blue-button"
                                style={{ padding: "5px 9px", fontSize: "10px" }}
                                onClick={() => handleReactivateMember(gm.memberId)}
                                title="เปิดรับกลับเข้ากลุ่ม"
                              >
                                <span>รับกลับเข้ากลุ่ม</span>
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ marginTop: "16px" }}>
              <strong style={{ display: "block", color: "var(--ink)", marginBottom: 8, fontSize: 12 }}>
                กิจกรรมพันธกิจล่าสุดของกลุ่ม
              </strong>
              <ActivityTimeline subjectType="group" subjectId={activeGroup.id} />
            </div>

            <div className="modal-actions" style={{ marginTop: "16px" }}>
              <button className="cancel-button" onClick={() => setMembersModalOpen(false)}>
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <ConfirmDialog
          title="ยืนยันการลบกลุ่ม"
          description={`คุณแน่ใจหรือไม่ว่าต้องการลบกลุ่ม "${deleteTarget.name}"? ระบบจะเปลี่ยนสถานะเป็นปิดกลุ่ม (Closed) โดยข้อมูลสมาชิกและประวัติการเข้าร่วมเดิมจะไม่สูญหาย`}
          confirmLabel={deleting ? "กำลังลบ..." : "ลบกลุ่ม"}
          isSubmitting={deleting}
          onConfirm={handleDeleteGroup}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </AppLayout>
  );
}
