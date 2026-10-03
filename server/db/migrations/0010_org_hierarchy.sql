ALTER TABLE "groups" ADD COLUMN "org_level" text;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "parent_group_id" text;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "leader_member_id" text;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_parent_group_id_groups_id_fk" FOREIGN KEY ("parent_group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_leader_member_id_members_id_fk" FOREIGN KEY ("leader_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "groups_parent_group_id_idx" ON "groups" USING btree ("parent_group_id");--> statement-breakpoint
CREATE INDEX "groups_org_level_idx" ON "groups" USING btree ("org_level");--> statement-breakpoint
CREATE INDEX "groups_leader_member_id_idx" ON "groups" USING btree ("leader_member_id");