import {
  ADMIN_SHELL_ROLES,
  CREATE_ROLES,
  MEMBERSHIP_VIEW_ROLES,
  PRIVILEGED_ROLES,
  hasRole,
} from "@shared/roles";
import type { UserRole } from "@shared/schema";
import type { HomeLink } from "./homeLinks";

export type HomeTileId = "care" | "photo" | "membership" | "followUp";

/** Where a tile goes. `null` means it opens the photo sheet instead of navigating. */
export const HOME_TILE_HREF: Record<HomeTileId, string | null> = {
  care: "/care",
  photo: null,
  membership: "/memberships",
  followUp: "/follow-up",
};

export interface HomeTiles {
  /** The large quick-action tiles, in display order. */
  primary: HomeTileId[];
}

export const BASE_SECONDARY_LINKS: readonly HomeLink[] = [
  { href: "/members", label: "สมาชิก" },
  { href: "/groups", label: "พันธกิจ" },
  { href: "/attendance", label: "เช็คชื่อวันนมัสการ" },
  { href: "/events", label: "กิจกรรม" },
  { href: "/feed", label: "ฟีดกิจกรรม" },
  { href: "/announcements", label: "การประกาศ" },
  { href: "/map", label: "แผนที่พันธกิจ" },
];

// Each role is told apart by the shared sets (the ones the routes and API
// enforce), never by a role name written here:
//   group_leader    = CREATE_ROLES minus PRIVILEGED_ROLES
//   ministry_leader = PRIVILEGED_ROLES minus MEMBERSHIP_VIEW_ROLES
//   office roles    = PRIVILEGED_ROLES and MEMBERSHIP_VIEW_ROLES (super_admin/admin/staff)
// A role outside ADMIN_SHELL_ROLES (member, or still loading) gets nothing.
const isGroupLeader = (role: UserRole) => hasRole(role, CREATE_ROLES) && !hasRole(role, PRIVILEGED_ROLES);
const isMinistryLeader = (role: UserRole) => hasRole(role, PRIVILEGED_ROLES) && !hasRole(role, MEMBERSHIP_VIEW_ROLES);
const isOfficeRole = (role: UserRole) => hasRole(role, PRIVILEGED_ROLES) && hasRole(role, MEMBERSHIP_VIEW_ROLES);

/**
 * Which quick-action tiles the home page shows for a role. A group leader's
 * weekly work is three things, so follow-ups move into "ดูทั้งหมด"; a viewer has no
 * follow-ups to show, so gets no tile; every other role keeps the tiles it had.
 */
export function homeTilesFor(role: UserRole | undefined): HomeTiles {
  if (role === undefined || !hasRole(role, ADMIN_SHELL_ROLES)) return { primary: [] };

  const primary: HomeTileId[] = [];
  if (hasRole(role, CREATE_ROLES)) primary.push("care", "photo");
  if (hasRole(role, MEMBERSHIP_VIEW_ROLES)) primary.push("membership");
  // A viewer cannot create follow-ups and only ever sees its own (none), so the tile
  // would open an empty list. A group leader has it under "ดูทั้งหมด".
  if (hasRole(role, PRIVILEGED_ROLES)) primary.push("followUp");
  return { primary };
}

/**
 * Role-scoped secondary links under "ดูทั้งหมด" (Home quick actions). Mirrors
 * the RBP-01 table in TICKETS.md:
 *
 * - super_admin / admin / staff (8): base 7 + /reports
 * - ministry_leader (8): base 7 + /ministries
 * - group_leader (3): /follow-up, /groups, /members
 * - viewer (7): base 7
 * - member / undefined (0): none
 */
export function homeMoreLinksFor(role: UserRole | undefined): HomeLink[] {
  if (role === undefined || !hasRole(role, ADMIN_SHELL_ROLES)) return [];

  if (isGroupLeader(role)) {
    return [
      { href: "/follow-up", label: "การติดตาม" },
      { href: "/groups", label: "กลุ่มของฉัน" },
      { href: "/members", label: "สมาชิกของฉัน" },
    ];
  }
  if (isMinistryLeader(role)) return [...BASE_SECONDARY_LINKS, { href: "/ministries", label: "ฝ่ายงาน" }];
  if (isOfficeRole(role)) return [...BASE_SECONDARY_LINKS, { href: "/reports", label: "รายงาน" }];
  return [...BASE_SECONDARY_LINKS]; // viewer: the only shell role left
}
