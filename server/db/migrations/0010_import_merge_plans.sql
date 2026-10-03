CREATE TABLE "import_merge_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"nickname" text NOT NULL,
	"group_fingerprint" text NOT NULL,
	"source_row_ids" text[] NOT NULL,
	"decision_id" text NOT NULL,
	"primary_source_row_id" text NOT NULL,
	"field_choices" jsonb NOT NULL,
	"note" text,
	"status" text DEFAULT 'proposed' NOT NULL,
	"proposed_by_id" text,
	"proposed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_by_id" text,
	"reviewed_at" timestamp with time zone,
	"review_note" text
);
--> statement-breakpoint
ALTER TABLE "import_merge_plans" ADD CONSTRAINT "import_merge_plans_decision_id_import_duplicate_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."import_duplicate_decisions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_merge_plans" ADD CONSTRAINT "import_merge_plans_proposed_by_id_users_id_fk" FOREIGN KEY ("proposed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_merge_plans" ADD CONSTRAINT "import_merge_plans_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "import_merge_plans_one_open_per_group" ON "import_merge_plans" USING btree ("group_fingerprint") WHERE "import_merge_plans"."status" = 'proposed';--> statement-breakpoint
CREATE INDEX "import_merge_plans_fingerprint_idx" ON "import_merge_plans" USING btree ("group_fingerprint","proposed_at");--> statement-breakpoint
CREATE INDEX "import_merge_plans_status_idx" ON "import_merge_plans" USING btree ("status","proposed_at");