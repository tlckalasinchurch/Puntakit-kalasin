CREATE TABLE "mission_activities" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"title" text NOT NULL,
	"story" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"group_id" text,
	"place_label" text,
	"latitude" text,
	"longitude" text,
	"created_by_id" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mission_activity_media" (
	"id" text PRIMARY KEY NOT NULL,
	"activity_id" text NOT NULL,
	"url" text NOT NULL,
	"kind" text DEFAULT 'image' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mission_activity_participants" (
	"id" text PRIMARY KEY NOT NULL,
	"activity_id" text NOT NULL,
	"member_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mission_activities" ADD CONSTRAINT "mission_activities_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_activities" ADD CONSTRAINT "mission_activities_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_activity_media" ADD CONSTRAINT "mission_activity_media_activity_id_mission_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."mission_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_activity_participants" ADD CONSTRAINT "mission_activity_participants_activity_id_mission_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."mission_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_activity_participants" ADD CONSTRAINT "mission_activity_participants_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mission_activities_type_idx" ON "mission_activities" USING btree ("type");--> statement-breakpoint
CREATE INDEX "mission_activities_status_idx" ON "mission_activities" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mission_activities_group_id_idx" ON "mission_activities" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "mission_activities_occurred_at_idx" ON "mission_activities" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "mission_activities_created_by_id_idx" ON "mission_activities" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "mission_activities_deleted_at_idx" ON "mission_activities" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "mission_activity_media_activity_id_idx" ON "mission_activity_media" USING btree ("activity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mission_activity_participants_activity_member_uniq" ON "mission_activity_participants" USING btree ("activity_id","member_id");--> statement-breakpoint
CREATE INDEX "mission_activity_participants_activity_id_idx" ON "mission_activity_participants" USING btree ("activity_id");--> statement-breakpoint
CREATE INDEX "mission_activity_participants_member_id_idx" ON "mission_activity_participants" USING btree ("member_id");