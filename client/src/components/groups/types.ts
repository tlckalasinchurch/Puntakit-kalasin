import type {
  GroupCategory,
  GroupMemberRole,
  GroupMemberStatus,
  GroupPrivacy,
  GroupStatus,
} from "@shared/schema";
import type { StatusTone } from "@/components/DesignSystem";

export type OrgLevel = "body" | "care";

/**
 * Shared types and labels for the Groups feature (Phase 5B).
 * Extracted from Groups.tsx — no changes to values or semantics.
 */

export interface GroupItem {
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
  leaderMemberName?: string | null;
  memberCount: number;
}

export interface GroupMemberItem {
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

export interface SimpleMember {
  id: string;
  name: string;
  nickname: string | null;
  phone: string | null;
}

export const ORG_LEVEL_LABELS: Record<OrgLevel, string> = {
  body: "บอดี้",
  care: "พันธกิจ",
};

export const CATEGORY_LABELS: Record<GroupCategory, string> = {
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
export const CATEGORY_TONES: Record<GroupCategory, StatusTone> = {
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

export const ROLE_LABELS: Record<GroupMemberRole, string> = {
  leader: "หัวหน้ากลุ่ม",
  assistant_leader: "ผู้ช่วยหัวหน้า",
  host: "เจ้าบ้าน",
  member: "สมาชิก",
};

export const PRIVACY_LABELS: Record<GroupPrivacy, { label: string; tone: StatusTone }> = {
  public: { label: "สาธารณะ", tone: "neutral" },
  private: { label: "กลุ่มปิด (สมาชิก)", tone: "info" },
  confidential: { label: "กลุ่มลับเฉพาะ", tone: "warning" },
};

export const STATUS_LABELS: Record<GroupStatus, { label: string; tone: StatusTone }> = {
  active: { label: "เปิดดำเนินการ", tone: "success" },
  paused: { label: "พักชั่วคราว", tone: "warning" },
  closed: { label: "ปิดกลุ่ม", tone: "neutral" },
};
