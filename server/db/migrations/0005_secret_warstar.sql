CREATE TABLE "follow_ups" (
	"id" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"title" text NOT NULL,
	"note" text,
	"subject_member_id" text,
	"subject_group_id" text,
	"activity_id" text,
	"owner_id" text,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_subject_member_id_members_id_fk" FOREIGN KEY ("subject_member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_subject_group_id_groups_id_fk" FOREIGN KEY ("subject_group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_activity_id_mission_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."mission_activities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "follow_ups_status_idx" ON "follow_ups" USING btree ("status");--> statement-breakpoint
CREATE INDEX "follow_ups_subject_member_id_idx" ON "follow_ups" USING btree ("subject_member_id");--> statement-breakpoint
CREATE INDEX "follow_ups_subject_group_id_idx" ON "follow_ups" USING btree ("subject_group_id");--> statement-breakpoint
CREATE INDEX "follow_ups_activity_id_idx" ON "follow_ups" USING btree ("activity_id");--> statement-breakpoint
CREATE INDEX "follow_ups_owner_id_idx" ON "follow_ups" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "follow_ups_due_at_idx" ON "follow_ups" USING btree ("due_at");