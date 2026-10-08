import type { Gender, MembershipStatus } from "@shared/schema";

/**
 * Shared Member type for the members feature (Phase 6B).
 * Extracted from Members.tsx — no changes to shape or semantics.
 */
export interface Member {
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
