ALTER TABLE "groups" ALTER COLUMN "category" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "group_members" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "group_members" ADD COLUMN "left_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "co_leader_id" text;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "privacy" text DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "area" text;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "latitude" text;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "longitude" text;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "max_members" integer;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "is_open" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "cover_url" text;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "start_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_co_leader_id_users_id_fk" FOREIGN KEY ("co_leader_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attendance_group_member_date_status_idx" ON "attendance_records" USING btree ("group_id","member_id","date","status");--> statement-breakpoint
CREATE INDEX "attendance_member_date_status_idx" ON "attendance_records" USING btree ("member_id","date","status");--> statement-breakpoint
CREATE INDEX "group_members_group_id_status_idx" ON "group_members" USING btree ("group_id","status");--> statement-breakpoint
CREATE INDEX "group_members_member_id_status_idx" ON "group_members" USING btree ("member_id","status");--> statement-breakpoint
CREATE INDEX "groups_privacy_idx" ON "groups" USING btree ("privacy");--> statement-breakpoint
CREATE INDEX "groups_category_idx" ON "groups" USING btree ("category");--> statement-breakpoint
CREATE INDEX "groups_area_idx" ON "groups" USING btree ("area");--> statement-breakpoint
CREATE INDEX "groups_co_leader_id_idx" ON "groups" USING btree ("co_leader_id");