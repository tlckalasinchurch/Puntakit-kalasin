CREATE TABLE "import_duplicate_decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"nickname" text NOT NULL,
	"group_fingerprint" text NOT NULL,
	"source_row_ids" text[] NOT NULL,
	"decision" text NOT NULL,
	"note" text,
	"decided_by_id" text,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "import_duplicate_decisions" ADD CONSTRAINT "import_duplicate_decisions_decided_by_id_users_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "import_duplicate_decisions_nickname_idx" ON "import_duplicate_decisions" USING btree ("nickname","decided_at");--> statement-breakpoint
CREATE INDEX "import_duplicate_decisions_fingerprint_idx" ON "import_duplicate_decisions" USING btree ("group_fingerprint");