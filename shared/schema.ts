import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { randomUUID } from "node:crypto";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID());

export const USER_ROLES = [
  "super_admin",
  "admin",
  "ministry_leader",
  "group_leader",
  "staff",
  "member",
  "viewer",
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email").notNull().unique(),
    /** Clerk user id (user_...). Set once the account is linked to Clerk. */
    clerkId: text("clerk_id").unique(),
    /**
     * Legacy bcrypt hash kept only so pre-Clerk sessions/imports keep working.
     * Null once the account is Clerk-only. New accounts authenticate via Clerk.
     */
    passwordHash: text("password_hash"),
    name: text("name").notNull(),
    role: text("role", { enum: USER_ROLES })
      .notNull()
      .default("member"),
    status: text("status", { enum: ["active", "suspended"] })
      .notNull()
      .default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("users_clerk_id_idx").on(table.clerkId)]
);

export const userSessions = pgTable(
  "user_sessions",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("user_sessions_user_id_idx").on(table.userId),
    index("user_sessions_token_hash_idx").on(table.tokenHash),
  ]
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    details: text("details"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_logs_user_id_idx").on(table.userId),
    index("audit_logs_action_idx").on(table.action),
    index("audit_logs_created_at_idx").on(table.createdAt),
  ]
);

export const MEMBERSHIP_STATUSES = ["active", "visitor", "candidate", "transferred", "inactive"] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export const GENDERS = ["male", "female", "other"] as const;
export type Gender = (typeof GENDERS)[number];

export const members = pgTable(
  "members",
  {
    id: id(),
    name: text("name").notNull(),
    nickname: text("nickname"),
    avatarUrl: text("avatar_url"),
    gender: text("gender", { enum: GENDERS }),
    birthDate: timestamp("birth_date", { withTimezone: true }),
    phone: text("phone"),
    email: text("email"),
    lineId: text("line_id"),
    address: text("address"),
    role: text("role").notNull().default("สมาชิก"),
    area: text("area"),
    group: text("group"),
    membershipStatus: text("membership_status", { enum: MEMBERSHIP_STATUSES })
      .notNull()
      .default("visitor"),
    status: text("status", { enum: ["ติดตามแล้ว", "ต้องติดตาม"] })
      .notNull()
      .default("ต้องติดตาม"),
    assignedLeaderId: text("assigned_leader_id").references(() => users.id, { onDelete: "set null" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    emergencyContactName: text("emergency_contact_name"),
    emergencyContactPhone: text("emergency_contact_phone"),
    emergencyContactRelation: text("emergency_contact_relation"),
    consentGiven: boolean("consent_given").notNull().default(false),
    consentDate: timestamp("consent_date", { withTimezone: true }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    notes: text("notes"),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    updatedById: text("updated_by_id").references(() => users.id, { onDelete: "set null" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("members_area_idx").on(table.area),
    index("members_status_idx").on(table.status),
    index("members_phone_idx").on(table.phone),
    index("members_email_idx").on(table.email),
    index("members_user_id_idx").on(table.userId),
    index("members_deleted_at_idx").on(table.deletedAt),
  ]
);

export const announcements = pgTable("announcements", {
  id: id(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  publishDate: timestamp("publish_date", { withTimezone: true }).notNull().defaultNow(),
  status: text("status", { enum: ["draft", "published"] })
    .notNull()
    .default("draft"),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const events = pgTable("events", {
  id: id(),
  title: text("title").notNull(),
  description: text("description"),
  eventDate: timestamp("event_date", { withTimezone: true }).notNull(),
  location: text("location"),
  category: text("category", { enum: ["worship", "activity", "meeting", "other"] })
    .notNull()
    .default("worship"),
  status: text("status", { enum: ["scheduled", "cancelled", "completed"] })
    .notNull()
    .default("scheduled"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ministries = pgTable("ministries", {
  id: id(),
  name: text("name").notNull(),
  description: text("description"),
  leader: text("leader"),
  status: text("status", { enum: ["active", "inactive"] })
    .notNull()
    .default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const churchProfile = pgTable("church_profile", {
  id: text("id").primaryKey().default("main"),
  name: text("name").notNull(),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  description: text("description"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const GROUP_CATEGORIES = [
  "cell",
  "bible_study",
  "prayer",
  "youth",
  "kids",
  "family",
  "men",
  "women",
  "volunteer",
  "online",
  "ministry",
  "fellowship",
  "general",
  "other",
] as const;
export type GroupCategory = (typeof GROUP_CATEGORIES)[number];

export const GROUP_STATUSES = ["active", "paused", "closed"] as const;
export type GroupStatus = (typeof GROUP_STATUSES)[number];

export const GROUP_PRIVACIES = ["public", "private", "confidential"] as const;
export type GroupPrivacy = (typeof GROUP_PRIVACIES)[number];

export const GROUP_MEMBER_STATUSES = ["active", "inactive"] as const;
export type GroupMemberStatus = (typeof GROUP_MEMBER_STATUSES)[number];

export const GROUP_MEMBER_ROLES = ["leader", "assistant_leader", "host", "member"] as const;
export type GroupMemberRole = (typeof GROUP_MEMBER_ROLES)[number];

export const SERVICE_TYPES = [
  "sunday_service",
  "care_group",
  "prayer_meeting",
  "youth_service",
  "special_event",
] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export const ATTENDANCE_STATUSES = ["present", "absent", "leave", "online"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const CHECKIN_METHODS = ["manual", "qr_scan", "self_qr", "kiosk"] as const;
export type CheckInMethod = (typeof CHECKIN_METHODS)[number];

export const groups = pgTable(
  "groups",
  {
    id: id(),
    name: text("name").notNull(),
    leaderId: text("leader_id").references(() => users.id, { onDelete: "set null" }),
    coLeaderId: text("co_leader_id").references(() => users.id, { onDelete: "set null" }),
    category: text("category", { enum: GROUP_CATEGORIES }).notNull().default("cell"),
    privacy: text("privacy", { enum: GROUP_PRIVACIES }).notNull().default("public"),
    status: text("status", { enum: GROUP_STATUSES }).notNull().default("active"),
    area: text("area"),
    meetingDay: text("meeting_day"),
    meetingTime: text("meeting_time"),
    meetingLocation: text("meeting_location"),
    latitude: text("latitude"),
    longitude: text("longitude"),
    maxMembers: integer("max_members"),
    isOpen: boolean("is_open").notNull().default(true),
    avatarUrl: text("avatar_url"),
    coverUrl: text("cover_url"),
    startDate: timestamp("start_date", { withTimezone: true }),
    description: text("description"),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("groups_status_idx").on(table.status),
    index("groups_privacy_idx").on(table.privacy),
    index("groups_category_idx").on(table.category),
    index("groups_area_idx").on(table.area),
    index("groups_leader_id_idx").on(table.leaderId),
    index("groups_co_leader_id_idx").on(table.coLeaderId),
    index("groups_deleted_at_idx").on(table.deletedAt),
  ]
);

export const groupMembers = pgTable(
  "group_members",
  {
    id: id(),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    role: text("role", { enum: GROUP_MEMBER_ROLES }).notNull().default("member"),
    status: text("status", { enum: GROUP_MEMBER_STATUSES }).notNull().default("active"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    leftAt: timestamp("left_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("group_members_group_member_uniq").on(table.groupId, table.memberId),
    index("group_members_group_id_idx").on(table.groupId),
    index("group_members_member_id_idx").on(table.memberId),
    index("group_members_group_id_status_idx").on(table.groupId, table.status),
    index("group_members_member_id_status_idx").on(table.memberId, table.status),
  ]
);

export const attendanceRecords = pgTable(
  "attendance_records",
  {
    id: id(),
    date: timestamp("date", { withTimezone: true }).notNull(),
    serviceType: text("service_type", { enum: SERVICE_TYPES }).notNull().default("sunday_service"),
    groupId: text("group_id").references(() => groups.id, { onDelete: "set null" }),
    eventId: text("event_id").references(() => events.id, { onDelete: "set null" }),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    status: text("status", { enum: ATTENDANCE_STATUSES }).notNull().default("present"),
    checkInMethod: text("check_in_method", { enum: CHECKIN_METHODS }).notNull().default("manual"),
    checkedInBy: text("checked_in_by").references(() => users.id, { onDelete: "set null" }),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }).notNull().defaultNow(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("attendance_date_idx").on(table.date),
    index("attendance_service_type_idx").on(table.serviceType),
    index("attendance_group_id_idx").on(table.groupId),
    index("attendance_member_id_idx").on(table.memberId),
    index("attendance_status_idx").on(table.status),
    index("attendance_group_member_date_status_idx").on(table.groupId, table.memberId, table.date, table.status),
    index("attendance_member_date_status_idx").on(table.memberId, table.date, table.status),
  ]
);

export const PRAYER_CATEGORIES = [
  "health",
  "family",
  "work",
  "spiritual",
  "thanksgiving",
  "other",
] as const;
export type PrayerCategory = (typeof PRAYER_CATEGORIES)[number];

export const PRAYER_STATUSES = ["pending", "praying", "answered"] as const;
export type PrayerStatus = (typeof PRAYER_STATUSES)[number];

export const EVENT_REGISTRATION_STATUSES = ["registered", "cancelled", "attended"] as const;
export type EventRegistrationStatus = (typeof EVENT_REGISTRATION_STATUSES)[number];

export const eventRegistrations = pgTable(
  "event_registrations",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    memberId: text("member_id").references(() => members.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    status: text("status", { enum: EVENT_REGISTRATION_STATUSES }).notNull().default("registered"),
    registeredAt: timestamp("registered_at", { withTimezone: true }).notNull().defaultNow(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("event_registrations_event_user_uniq").on(table.eventId, table.userId),
    index("event_registrations_event_id_idx").on(table.eventId),
    index("event_registrations_user_id_idx").on(table.userId),
    index("event_registrations_member_id_idx").on(table.memberId),
  ]
);

export const prayerRequests = pgTable(
  "prayer_requests",
  {
    id: id(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    memberId: text("member_id").references(() => members.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    content: text("content").notNull(),
    category: text("category", { enum: PRAYER_CATEGORIES }).notNull().default("spiritual"),
    isConfidential: boolean("is_confidential").notNull().default(false),
    status: text("status", { enum: PRAYER_STATUSES }).notNull().default("pending"),
    answeredNotes: text("answered_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("prayer_requests_user_id_idx").on(table.userId),
    index("prayer_requests_status_idx").on(table.status),
    index("prayer_requests_category_idx").on(table.category),
    index("prayer_requests_created_at_idx").on(table.createdAt),
  ]
);

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("push_subscriptions_user_id_idx").on(table.userId),
  ]
);

export const MISSION_ACTIVITY_TYPES = [
  "house_mission",
  "mission_visit",
  "bible_study",
  "prayer",
  "worship",
  "fellowship",
  "testimony",
  "evangelism",
  "pastoral_visit",
  "outreach",
  "ministry_update",
  "other",
] as const;
export type MissionActivityType = (typeof MISSION_ACTIVITY_TYPES)[number];

export const MISSION_ACTIVITY_STATUSES = [
  "draft",
  "pending_review",
  "published",
  "archived",
] as const;
export type MissionActivityStatus = (typeof MISSION_ACTIVITY_STATUSES)[number];

export const MISSION_MEDIA_KINDS = ["image", "video"] as const;
export type MissionMediaKind = (typeof MISSION_MEDIA_KINDS)[number];

// Mission Activity is the core Ministry OS object: one record of "something
// happened," reused (never duplicated) by Feed, Person/Group Timeline, Map,
// and Operations. See docs/PUNTAKIT_PRODUCT_ARCHITECTURE.md.
export const missionActivities = pgTable(
  "mission_activities",
  {
    id: id(),
    type: text("type", { enum: MISSION_ACTIVITY_TYPES }).notNull(),
    status: text("status", { enum: MISSION_ACTIVITY_STATUSES })
      .notNull()
      .default("draft"),
    title: text("title").notNull(),
    story: text("story"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    groupId: text("group_id").references(() => groups.id, { onDelete: "set null" }),
    placeLabel: text("place_label"),
    latitude: text("latitude"),
    longitude: text("longitude"),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("mission_activities_type_idx").on(table.type),
    index("mission_activities_status_idx").on(table.status),
    index("mission_activities_group_id_idx").on(table.groupId),
    index("mission_activities_occurred_at_idx").on(table.occurredAt),
    index("mission_activities_created_by_id_idx").on(table.createdById),
    index("mission_activities_deleted_at_idx").on(table.deletedAt),
  ]
);

export const missionActivityParticipants = pgTable(
  "mission_activity_participants",
  {
    id: id(),
    activityId: text("activity_id")
      .notNull()
      .references(() => missionActivities.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("mission_activity_participants_activity_member_uniq").on(
      table.activityId,
      table.memberId
    ),
    index("mission_activity_participants_activity_id_idx").on(table.activityId),
    index("mission_activity_participants_member_id_idx").on(table.memberId),
  ]
);

export const missionActivityMedia = pgTable(
  "mission_activity_media",
  {
    id: id(),
    activityId: text("activity_id")
      .notNull()
      .references(() => missionActivities.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    kind: text("kind", { enum: MISSION_MEDIA_KINDS }).notNull().default("image"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("mission_activity_media_activity_id_idx").on(table.activityId)]
);

export const FOLLOW_UP_STATUSES = ["open", "in_progress", "completed", "cancelled"] as const;
export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];

// Follow-up: "what needs to happen next," attached to a person and/or a
// group, optionally traced back to the activity that raised it. Deliberately
// separate from members.status (a two-state pastoral flag on the person) —
// see docs/PUNTAKIT_PRODUCT_ARCHITECTURE.md for why they are not merged.
export const followUps = pgTable(
  "follow_ups",
  {
    id: id(),
    status: text("status", { enum: FOLLOW_UP_STATUSES }).notNull().default("open"),
    title: text("title").notNull(),
    note: text("note"),
    subjectMemberId: text("subject_member_id").references(() => members.id, { onDelete: "cascade" }),
    subjectGroupId: text("subject_group_id").references(() => groups.id, { onDelete: "cascade" }),
    activityId: text("activity_id").references(() => missionActivities.id, { onDelete: "set null" }),
    ownerId: text("owner_id").references(() => users.id, { onDelete: "set null" }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("follow_ups_status_idx").on(table.status),
    index("follow_ups_subject_member_id_idx").on(table.subjectMemberId),
    index("follow_ups_subject_group_id_idx").on(table.subjectGroupId),
    index("follow_ups_activity_id_idx").on(table.activityId),
    index("follow_ups_owner_id_idx").on(table.ownerId),
    index("follow_ups_due_at_idx").on(table.dueAt),
  ]
);

export const MISSION_SUBMISSION_STATUSES = [
  "new",
  "reviewing",
  "needs_info",
  "approved",
  "rejected",
] as const;
export type MissionSubmissionStatus = (typeof MISSION_SUBMISSION_STATUSES)[number];

export const MISSION_SUBMISSION_SOURCES = ["manual", "line", "import", "system"] as const;
export type MissionSubmissionSource = (typeof MISSION_SUBMISSION_SOURCES)[number];

// Mission Inbox: raw field input that is NOT yet official ministry data.
// A submission is promoted into a mission_activities row (always as
// "draft") only once a human sets it to "approved" and explicitly
// publishes it — it is never auto-published. No LINE adapter exists yet;
// `source` reserves room for one without committing to it now. See
// docs/PUNTAKIT_PRODUCT_ARCHITECTURE.md.
export const missionSubmissions = pgTable(
  "mission_submissions",
  {
    id: id(),
    status: text("status", { enum: MISSION_SUBMISSION_STATUSES }).notNull().default("new"),
    source: text("source", { enum: MISSION_SUBMISSION_SOURCES }).notNull().default("manual"),
    rawText: text("raw_text"),
    rawMediaUrls: text("raw_media_urls"),
    submittedByLabel: text("submitted_by_label"),
    reviewNote: text("review_note"),
    publishedActivityId: text("published_activity_id").references(() => missionActivities.id, {
      onDelete: "set null",
    }),
    reviewedById: text("reviewed_by_id").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("mission_submissions_status_idx").on(table.status),
    index("mission_submissions_source_idx").on(table.source),
    index("mission_submissions_published_activity_id_idx").on(table.publishedActivityId),
    index("mission_submissions_created_at_idx").on(table.createdAt),
  ]
);

export type User = typeof users.$inferSelect;
export type UserSession = typeof userSessions.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type Member = typeof members.$inferSelect;
export type Announcement = typeof announcements.$inferSelect;
export type Event = typeof events.$inferSelect;
export type Ministry = typeof ministries.$inferSelect;
export type ChurchProfile = typeof churchProfile.$inferSelect;
export type Group = typeof groups.$inferSelect;
export type GroupMember = typeof groupMembers.$inferSelect;
export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
export type EventRegistration = typeof eventRegistrations.$inferSelect;
export type PrayerRequest = typeof prayerRequests.$inferSelect;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type MissionActivity = typeof missionActivities.$inferSelect;
export type MissionActivityParticipant = typeof missionActivityParticipants.$inferSelect;
export type MissionActivityMedia = typeof missionActivityMedia.$inferSelect;
export type FollowUp = typeof followUps.$inferSelect;
export type MissionSubmission = typeof missionSubmissions.$inferSelect;
