import { z } from "zod";
import {
  ATTENDANCE_STATUSES,
  CHECKIN_METHODS,
  FOLLOW_UP_STATUSES,
  GENDERS,
  GROUP_CATEGORIES,
  GROUP_ORG_LEVELS,
  GROUP_MEMBER_ROLES,
  GROUP_MEMBER_STATUSES,
  GROUP_PRIVACIES,
  GROUP_STATUSES,
  MEMBERSHIP_STATUSES,
  MISSION_ACTIVITY_STATUSES,
  MISSION_ACTIVITY_TYPES,
  MISSION_MEDIA_KINDS,
  MISSION_SUBMISSION_STATUSES,
  PRAYER_CATEGORIES,
  SERVICE_TYPES,
  USER_ROLES,
} from "./schema.js";
import { MEMBERSHIP_TYPES, isDateOnly } from "./membership.js";

/**
 * Mission-activity media: an absolute http(s) URL, or the app's own private
 * image path (`/api/media/<uuid>`) returned by `POST /api/media`. Nothing
 * else relative is accepted, so this cannot be used to point at other routes.
 */
export const missionMediaUrl = z.union([
  z.string().trim().url("URL สื่อไม่ถูกต้อง").max(1000),
  z.string().trim().regex(/^\/api\/media\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "URL สื่อไม่ถูกต้อง"),
]);

/**
 * A phone number as people type it: digits plus the separators Thai numbers
 * use ("081-234-5678", "+66 81 234 5678", "043 811 800"). Letters are rejected
 * so a typo such as "abc" cannot reach a contact list.
 */
const phoneField = z
  .string()
  .trim()
  .max(50)
  .regex(/^[0-9+\-()\s./,]*$/, "เบอร์โทรใช้ได้เฉพาะตัวเลขและเครื่องหมาย + - ( )")
  .optional()
  .or(z.literal(""));

export const memberInputSchema = z.object({
  /** Care group the person belongs to (a real membership). "" or null = none. */
  careGroupId: z.string().uuid("รหัสพันธกิจไม่ถูกต้อง").optional().or(z.literal("")).nullable(),
  name: z.string().trim().min(1, "กรุณากรอกชื่อ").max(200),
  nickname: z.string().trim().max(100).optional().or(z.literal("")),
  avatarUrl: z.string().trim().max(500).optional().or(z.literal("")),
  gender: z.enum(GENDERS).optional().nullable(),
  birthDate: z.coerce.date().optional().nullable(),
  phone: phoneField,
  email: z.string().trim().email("อีเมลไม่ถูกต้อง").max(200).optional().or(z.literal("")),
  lineId: z.string().trim().max(100).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  role: z.string().trim().min(1).max(100).default("สมาชิก"),
  area: z.string().trim().max(200).optional().or(z.literal("")),
  group: z.string().trim().max(200).optional().or(z.literal("")),
  membershipStatus: z.enum(MEMBERSHIP_STATUSES).default("visitor"),
  status: z.enum(["ติดตามแล้ว", "ต้องติดตาม"]).default("ต้องติดตาม"),
  assignedLeaderId: z.string().uuid().optional().or(z.literal("")).nullable(),
  emergencyContactName: z.string().trim().max(200).optional().or(z.literal("")),
  emergencyContactPhone: z.string().trim().max(50).optional().or(z.literal("")),
  emergencyContactRelation: z.string().trim().max(100).optional().or(z.literal("")),
  consentGiven: z.boolean().default(false),
  joinedAt: z.coerce.date().optional(),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type MemberInput = z.infer<typeof memberInputSchema>;

export const memberQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  area: z.string().trim().optional(),
  group: z.string().trim().optional(),
  careGroupId: z.string().uuid().optional(),
  status: z.enum(["ติดตามแล้ว", "ต้องติดตาม"]).optional(),
  membershipStatus: z.enum(MEMBERSHIP_STATUSES).optional(),
  sortBy: z.enum(["name", "joinedAt", "createdAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  includeDeleted: z
    .string()
    .optional()
    .transform((val) => val === "true"),
});
export type MemberQuery = z.infer<typeof memberQuerySchema>;

export const checkDuplicateMemberSchema = z.object({
  phone: z.string().trim().optional(),
  email: z.string().trim().optional(),
  excludeId: z.string().optional(),
});

export const announcementInputSchema = z.object({
  title: z.string().trim().min(1, "กรุณากรอกหัวข้อ").max(300),
  content: z.string().trim().min(1, "กรุณากรอกเนื้อหา").max(10000),
  publishDate: z.coerce.date().optional(),
  status: z.enum(["draft", "published"]).default("draft"),
});
export type AnnouncementInput = z.infer<typeof announcementInputSchema>;

export const eventInputSchema = z.object({
  title: z.string().trim().min(1, "กรุณากรอกชื่องาน").max(300),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  eventDate: z.coerce.date(),
  location: z.string().trim().max(300).optional().or(z.literal("")),
  category: z.enum(["worship", "activity", "meeting", "other"]).default("worship"),
  status: z.enum(["scheduled", "cancelled", "completed"]).default("scheduled"),
});
export type EventInput = z.infer<typeof eventInputSchema>;

export const ministryInputSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อฝ่ายงาน").max(200),
  description: z.string().trim().max(3000).optional().or(z.literal("")),
  leader: z.string().trim().max(200).optional().or(z.literal("")),
  status: z.enum(["active", "inactive"]).default("active"),
});
export type MinistryInput = z.infer<typeof ministryInputSchema>;

export const churchProfileInputSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อคริสตจักร").max(300),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  phone: phoneField,
  email: z.string().trim().email("อีเมลไม่ถูกต้อง").max(200).optional().or(z.literal("")),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
});
export type ChurchProfileInput = z.infer<typeof churchProfileInputSchema>;

export const registerInputSchema = z.object({
  email: z.string().trim().email("อีเมลไม่ถูกต้อง"),
  password: z.string().min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร").max(200),
  name: z.string().trim().min(1, "กรุณากรอกชื่อ").max(200),
  role: z.enum(USER_ROLES).optional().default("member"),
});
export type RegisterInput = z.infer<typeof registerInputSchema>;

export const loginInputSchema = z.object({
  email: z.string().trim().email("อีเมลไม่ถูกต้อง"),
  password: z.string().min(1, "กรุณากรอกรหัสผ่าน"),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

export const changePasswordInputSchema = z.object({
  currentPassword: z.string().min(1, "กรุณากรอกรหัสผ่านปัจจุบัน"),
  newPassword: z.string().min(8, "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร").max(200),
});
export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>;

/** Optional decimal degrees stored as text: empty, or a number inside [min, max]. */
const coordinateField = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .max(50)
    .refine(
      (v) => v === "" || (/^-?\d+(\.\d+)?$/.test(v) && Number(v) >= min && Number(v) <= max),
      `${label}ต้องเป็นตัวเลขระหว่าง ${min} ถึง ${max}`
    )
    .optional()
    .nullable();

export const groupInputSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อกลุ่ม").max(200),
  leaderId: z.string().uuid().optional().or(z.literal("")).nullable(),
  coLeaderId: z.string().uuid().optional().or(z.literal("")).nullable(),
  orgLevel: z.enum(GROUP_ORG_LEVELS).optional().nullable(),
  parentGroupId: z.string().uuid().optional().or(z.literal("")).nullable(),
  leaderMemberId: z.string().uuid().optional().or(z.literal("")).nullable(),
  category: z.enum(GROUP_CATEGORIES).default("cell"),
  privacy: z.enum(GROUP_PRIVACIES).default("public"),
  status: z.enum(GROUP_STATUSES).default("active"),
  area: z.string().trim().max(100).optional().or(z.literal("")).nullable(),
  meetingDay: z.string().trim().max(100).optional().or(z.literal("")),
  meetingTime: z.string().trim().max(100).optional().or(z.literal("")),
  meetingLocation: z.string().trim().max(300).optional().or(z.literal("")),
  latitude: coordinateField(-90, 90, "ละติจูด"),
  longitude: coordinateField(-180, 180, "ลองจิจูด"),
  maxMembers: z.coerce.number().int().min(1).max(500).optional().nullable(),
  isOpen: z.boolean().default(true),
  avatarUrl: z.string().trim().max(500).optional().or(z.literal("")).nullable(),
  coverUrl: z.string().trim().max(500).optional().or(z.literal("")).nullable(),
  startDate: z.coerce.date().optional().nullable(),
  description: z.string().trim().max(3000).optional().or(z.literal("")),
});
export type GroupInput = z.infer<typeof groupInputSchema>;

export const groupQuerySchema = z.object({
  search: z.string().trim().optional(),
  category: z.enum(GROUP_CATEGORIES).optional(),
  status: z.enum(GROUP_STATUSES).optional(),
  privacy: z.enum(GROUP_PRIVACIES).optional(),
  area: z.string().trim().optional(),
  orgLevel: z.enum(GROUP_ORG_LEVELS).optional(),
  parentGroupId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type GroupQuery = z.infer<typeof groupQuerySchema>;

export const groupMemberInputSchema = z.object({
  memberId: z.string().uuid("รหัสสมาชิกไม่ถูกต้อง"),
  role: z.enum(GROUP_MEMBER_ROLES).default("member"),
  status: z.enum(GROUP_MEMBER_STATUSES).default("active"),
});
export type GroupMemberInput = z.infer<typeof groupMemberInputSchema>;

export const groupMemberUpdateSchema = z.object({
  role: z.enum(GROUP_MEMBER_ROLES).optional(),
  status: z.enum(GROUP_MEMBER_STATUSES).optional(),
});
export type GroupMemberUpdate = z.infer<typeof groupMemberUpdateSchema>;

export const attendanceInputSchema = z.object({
  date: z.coerce.date(),
  serviceType: z.enum(SERVICE_TYPES).default("sunday_service"),
  groupId: z.string().uuid().optional().or(z.literal("")).nullable(),
  eventId: z.string().uuid().optional().or(z.literal("")).nullable(),
  memberId: z.string().uuid("รหัสสมาชิกไม่ถูกต้อง"),
  status: z.enum(ATTENDANCE_STATUSES).default("present"),
  checkInMethod: z.enum(CHECKIN_METHODS).default("manual"),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});
export type AttendanceInput = z.infer<typeof attendanceInputSchema>;

export const bulkAttendanceItemSchema = z.object({
  memberId: z.string().uuid("รหัสสมาชิกไม่ถูกต้อง"),
  status: z.enum(ATTENDANCE_STATUSES).default("present"),
  checkInMethod: z.enum(CHECKIN_METHODS).default("manual"),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export const bulkAttendanceInputSchema = z.object({
  date: z.coerce.date(),
  serviceType: z.enum(SERVICE_TYPES).default("sunday_service"),
  groupId: z.string().uuid().optional().or(z.literal("")).nullable(),
  eventId: z.string().uuid().optional().or(z.literal("")).nullable(),
  records: z.array(bulkAttendanceItemSchema).min(1, "กรุณาระบุข้อมูลการเช็คชื่ออย่างน้อย 1 รายการ"),
});
export type BulkAttendanceInput = z.infer<typeof bulkAttendanceInputSchema>;

export const qrCheckInSchema = z.object({
  token: z.string().trim().min(1, "รหัส QR ไม่ถูกต้อง"),
  serviceType: z.enum(SERVICE_TYPES).default("sunday_service"),
  groupId: z.string().uuid().optional().or(z.literal("")).nullable(),
  eventId: z.string().uuid().optional().or(z.literal("")).nullable(),
  date: z.coerce.date().optional(),
});
export type QrCheckInInput = z.infer<typeof qrCheckInSchema>;

export const attendanceQuerySchema = z.object({
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  serviceType: z.enum(SERVICE_TYPES).optional(),
  groupId: z.string().optional(),
  memberId: z.string().optional(),
  status: z.enum(ATTENDANCE_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type AttendanceQuery = z.infer<typeof attendanceQuerySchema>;

export const consecutiveAbsenceQuerySchema = z.object({
  threshold: z.coerce.number().int().min(1).max(20).default(3),
  serviceType: z.enum(SERVICE_TYPES).default("sunday_service"),
  groupId: z.string().optional(),
});
export type ConsecutiveAbsenceQuery = z.infer<typeof consecutiveAbsenceQuerySchema>;

export const memberProfileUpdateSchema = z.object({
  nickname: z.string().trim().max(100).optional().or(z.literal("")),
  phone: phoneField,
  lineId: z.string().trim().max(100).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  avatarUrl: z.string().trim().max(500).optional().or(z.literal("")),
  emergencyContactName: z.string().trim().max(200).optional().or(z.literal("")),
  emergencyContactPhone: z.string().trim().max(50).optional().or(z.literal("")),
  emergencyContactRelation: z.string().trim().max(100).optional().or(z.literal("")),
  consentGiven: z.boolean().optional(),
});
export type MemberProfileUpdate = z.infer<typeof memberProfileUpdateSchema>;

export const eventRegistrationSchema = z.object({
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});
export type EventRegistrationInput = z.infer<typeof eventRegistrationSchema>;

export const prayerRequestInputSchema = z.object({
  title: z.string().trim().min(1, "กรุณากรอกหัวข้อคำขออธิษฐาน").max(300),
  content: z.string().trim().min(1, "กรุณากรอกรายละเอียด").max(5000),
  category: z.enum(PRAYER_CATEGORIES).default("spiritual"),
  isConfidential: z.boolean().default(false),
});
export type PrayerRequestInput = z.infer<typeof prayerRequestInputSchema>;

export const missionActivityInputSchema = z.object({
  type: z.enum(MISSION_ACTIVITY_TYPES),
  title: z.string().trim().min(1, "กรุณากรอกหัวข้อ").max(300),
  story: z.string().trim().max(5000).optional().or(z.literal("")),
  occurredAt: z.coerce.date(),
  groupId: z.string().uuid().optional().or(z.literal("")).nullable(),
  placeLabel: z.string().trim().max(300).optional().or(z.literal("")),
  latitude: z.string().trim().max(50).optional().or(z.literal("")).nullable(),
  longitude: z.string().trim().max(50).optional().or(z.literal("")).nullable(),
  participantMemberIds: z.array(z.string().uuid()).max(200).optional().default([]),
  media: z
    .array(
      z.object({
        url: missionMediaUrl,
        kind: z.enum(MISSION_MEDIA_KINDS).default("image"),
      })
    )
    .max(30)
    .optional()
    .default([]),
});
export type MissionActivityInput = z.infer<typeof missionActivityInputSchema>;

/**
 * Update shape for `PUT /:id`. Identical to the create shape except the two
 * child lists have **no `.default([])`**: with `.partial()` alone the inner
 * default survives, so an edit that omits them parses to `[]` and
 * `replaceParticipantsAndMedia` deletes the recorded people and photos
 * (D53). With this schema an omitted list stays `undefined`, which the
 * replacer treats as "leave it alone".
 */
const missionActivityUpdateLists = {
  participantMemberIds: z.array(z.string().uuid()).max(200).optional(),
  media: z
    .array(
      z.object({
        url: missionMediaUrl,
        kind: z.enum(MISSION_MEDIA_KINDS).default("image"),
      })
    )
    .max(30)
    .optional(),
};
export const missionActivityUpdateSchema = missionActivityInputSchema
  .partial()
  .extend(missionActivityUpdateLists);
export type MissionActivityUpdate = z.infer<typeof missionActivityUpdateSchema>;

export const missionActivityStatusUpdateSchema = z.object({
  status: z.enum(MISSION_ACTIVITY_STATUSES),
});
export type MissionActivityStatusUpdate = z.infer<typeof missionActivityStatusUpdateSchema>;

export const missionActivityQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum(MISSION_ACTIVITY_TYPES).optional(),
  status: z.enum(MISSION_ACTIVITY_STATUSES).optional(),
  groupId: z.string().optional(),
  memberId: z.string().optional(),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  search: z.string().trim().optional(),
});
export type MissionActivityQuery = z.infer<typeof missionActivityQuerySchema>;

const followUpFieldsSchema = z.object({
  title: z.string().trim().min(1, "กรุณากรอกหัวข้อการติดตาม").max(300),
  note: z.string().trim().max(3000).optional().or(z.literal("")),
  subjectMemberId: z.string().uuid().optional().or(z.literal("")).nullable(),
  subjectGroupId: z.string().uuid().optional().or(z.literal("")).nullable(),
  activityId: z.string().uuid().optional().or(z.literal("")).nullable(),
  ownerId: z.string().uuid().optional().or(z.literal("")).nullable(),
  dueAt: z.coerce.date().optional().nullable(),
});

export const followUpInputSchema = followUpFieldsSchema.refine(
  (data) => Boolean(data.subjectMemberId) || Boolean(data.subjectGroupId),
  {
    message: "การติดตามต้องระบุบุคคลหรือกลุ่มอย่างน้อยหนึ่งอย่าง",
    path: ["subjectMemberId"],
  }
);
export type FollowUpInput = z.infer<typeof followUpInputSchema>;

export const followUpUpdateSchema = followUpFieldsSchema.partial();
export type FollowUpUpdate = z.infer<typeof followUpUpdateSchema>;

export const followUpStatusUpdateSchema = z.object({
  status: z.enum(FOLLOW_UP_STATUSES),
});
export type FollowUpStatusUpdate = z.infer<typeof followUpStatusUpdateSchema>;

export const followUpQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(FOLLOW_UP_STATUSES).optional(),
  ownerId: z.string().optional(),
  subjectMemberId: z.string().optional(),
  subjectGroupId: z.string().optional(),
  overdue: z
    .string()
    .optional()
    .transform((val) => val === "true"),
});
export type FollowUpQuery = z.infer<typeof followUpQuerySchema>;

export const missionSubmissionInputSchema = z
  .object({
    rawText: z.string().trim().max(5000).optional().or(z.literal("")),
    rawMediaUrls: z.array(z.string().trim().url().max(1000)).max(30).optional().default([]),
    submittedByLabel: z.string().trim().max(200).optional().or(z.literal("")),
  })
  // An item with no text and no link has nothing for a reviewer to act on.
  .refine((v) => Boolean(v.rawText) || v.rawMediaUrls.length > 0, {
    message: "กรุณากรอกข้อความหรือแนบลิงก์อย่างน้อยหนึ่งอย่าง",
    path: ["rawText"],
  });
export type MissionSubmissionInput = z.infer<typeof missionSubmissionInputSchema>;

export const missionSubmissionStatusUpdateSchema = z.object({
  status: z.enum(MISSION_SUBMISSION_STATUSES),
  reviewNote: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type MissionSubmissionStatusUpdate = z.infer<typeof missionSubmissionStatusUpdateSchema>;

export const missionSubmissionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(MISSION_SUBMISSION_STATUSES).optional(),
});
export type MissionSubmissionQuery = z.infer<typeof missionSubmissionQuerySchema>;

export const missionSubmissionPublishSchema = z.object({
  type: z.enum(MISSION_ACTIVITY_TYPES),
  title: z.string().trim().min(1, "กรุณากรอกหัวข้อ").max(300),
  story: z.string().trim().max(5000).optional().or(z.literal("")),
  occurredAt: z.coerce.date(),
  groupId: z.string().uuid().optional().or(z.literal("")).nullable(),
  placeLabel: z.string().trim().max(300).optional().or(z.literal("")),
  includeRawMedia: z.boolean().optional().default(true),
});
export type MissionSubmissionPublishInput = z.infer<typeof missionSubmissionPublishSchema>;

export const reportsDateRangeQuerySchema = z.object({
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
});
export type ReportsDateRangeQuery = z.infer<typeof reportsDateRangeQuerySchema>;

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url("Endpoint ไม่ถูกต้อง"),
  p256dh: z.string().min(1, "Missing p256dh key"),
  auth: z.string().min(1, "Missing auth secret"),
  userAgent: z.string().optional(),
});
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;



// ---- Membership lifecycle (shared/membership.ts) -------------------------

const dateOnlyField = z.string().refine(isDateOnly, "วันที่ต้องอยู่ในรูปแบบ YYYY-MM-DD");

/** Open a member's first (or next, after a closed one) term. */
export const membershipStartSchema = z.object({
  type: z.enum(MEMBERSHIP_TYPES),
  startsOn: dateOnlyField.optional(),
});
export type MembershipStartInput = z.infer<typeof membershipStartSchema>;

/**
 * What the care leader (or an office role) decides about an open term.
 * - trial (วิสามัญ): `convert_to_ordinary` | `not_continued`
 * - ordinary (สามัญ): `renew` | `not_continued`
 * Nothing is decided by the system on a date.
 */
export const membershipDecisionSchema = z.object({
  decision: z.enum(["convert_to_ordinary", "renew", "not_continued"]),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});
export type MembershipDecisionInput = z.infer<typeof membershipDecisionSchema>;

/** Records that money was received. Only an authorised person calls this. */
export const membershipPaymentSchema = z.object({
  amountBaht: z.number().int("จำนวนเงินต้องเป็นจำนวนเต็ม").min(1, "จำนวนเงินต้องมากกว่า 0").max(100000),
  paidOn: dateOnlyField.optional(),
  note: z.string().trim().max(300).optional().or(z.literal("")),
});
export type MembershipPaymentInput = z.infer<typeof membershipPaymentSchema>;

export const membershipOverviewQuerySchema = z.object({
  filter: z.enum(["attention", "trial", "ordinary", "all"]).default("attention"),
  careGroupId: z.string().uuid().optional(),
  search: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});
