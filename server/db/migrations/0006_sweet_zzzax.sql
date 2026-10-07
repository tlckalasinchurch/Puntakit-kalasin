CREATE TABLE "mission_submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"raw_text" text,
	"raw_media_urls" text,
	"submitted_by_label" text,
	"review_note" text,
	"published_activity_id" text,
	"reviewed_by_id" text,
	"reviewed_at" timestamp with time zone,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mission_submissions" ADD CONSTRAINT "mission_submissions_published_activity_id_mission_activities_id_fk" FOREIGN KEY ("published_activity_id") REFERENCES "public"."mission_activities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_submissions" ADD CONSTRAINT "mission_submissions_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_submissions" ADD CONSTRAINT "mission_submissions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mission_submissions_status_idx" ON "mission_submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mission_submissions_source_idx" ON "mission_submissions" USING btree ("source");--> statement-breakpoint
CREATE INDEX "mission_submissions_published_activity_id_idx" ON "mission_submissions" USING btree ("published_activity_id");--> statement-breakpoint
CREATE INDEX "mission_submissions_created_at_idx" ON "mission_submissions" USING btree ("created_at");