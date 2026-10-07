CREATE TABLE "attendance_records" (
	"id" text PRIMARY KEY NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"service_type" text DEFAULT 'sunday_service' NOT NULL,
	"group_id" text,
	"event_id" text,
	"member_id" text NOT NULL,
	"status" text DEFAULT 'present' NOT NULL,
	"check_in_method" text DEFAULT 'manual' NOT NULL,
	"checked_in_by" text,
	"checked_in_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_members" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"member_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"leader_id" text,
	"category" text DEFAULT 'cell',
	"meeting_day" text,
	"meeting_time" text,
	"meeting_location" text,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by_id" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_checked_in_by_users_id_fk" FOREIGN KEY ("checked_in_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_leader_id_users_id_fk" FOREIGN KEY ("leader_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attendance_date_idx" ON "attendance_records" USING btree ("date");--> statement-breakpoint
CREATE INDEX "attendance_service_type_idx" ON "attendance_records" USING btree ("service_type");--> statement-breakpoint
CREATE INDEX "attendance_group_id_idx" ON "attendance_records" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "attendance_member_id_idx" ON "attendance_records" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "attendance_status_idx" ON "attendance_records" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "group_members_group_member_uniq" ON "group_members" USING btree ("group_id","member_id");--> statement-breakpoint
CREATE INDEX "group_members_group_id_idx" ON "group_members" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "group_members_member_id_idx" ON "group_members" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "groups_status_idx" ON "groups" USING btree ("status");--> statement-breakpoint
CREATE INDEX "groups_leader_id_idx" ON "groups" USING btree ("leader_id");--> statement-breakpoint
CREATE INDEX "groups_deleted_at_idx" ON "groups" USING btree ("deleted_at");