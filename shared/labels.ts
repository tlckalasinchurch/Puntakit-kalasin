import type { MembershipStatus, UserRole } from "./schema.js";

/**
 * Thai display labels for `members.membership_status` (shared/schema.ts:
 * active | visitor | candidate | transferred | inactive).
 *
 * Single source for every surface that renders a membership status — the
 * admin Members page and the Member PWA (home pass card, profile). The
 * Member PWA once checked pre-schema values ("regular"/"baptized") here, so
 * every member rendered as "ผู้สนใจ"; one shared map keeps that class of
 * drift from recurring.
 */
export const MEMBERSHIP_STATUS_LABELS: Record<MembershipStatus, string> = {
  active: "สมาชิกประจำ",
  visitor: "ผู้สนใจ/เยี่ยมเยียน",
  candidate: "ผู้เตรียมรับเชื่อ",
  transferred: "ย้ายคริสตจักร",
  inactive: "ขาดการติดต่อ",
};

/**
 * Thai display labels for `USER_ROLES` (shared/schema.ts).
 *
 * Single source for every surface that renders a role name — the admin
 * Profile page and the Member PWA profile. The PWA once hardcoded a ternary
 * that dropped `admin`/`viewer` entirely and drifted on wording
 * ("ผู้นำกลุ่มแคร์" vs "หัวหน้ากลุ่มแคร์"); one shared map keeps role
 * wording consistent everywhere.
 */
export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "ผู้ดูแลระบบสูงสุด",
  admin: "ผู้ดูแลระบบ",
  ministry_leader: "ผู้นำพันธกิจ",
  group_leader: "ผู้นำกลุ่มแคร์",
  staff: "เจ้าหน้าที่",
  member: "สมาชิก",
  viewer: "ผู้ชมข้อมูล",
};
