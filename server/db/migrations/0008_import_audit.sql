CREATE TABLE "import_batches" (
	"id" text PRIMARY KEY NOT NULL,
	"source_file_name" text NOT NULL,
	"file_checksum" text NOT NULL,
	"layout_variants" text[] NOT NULL,
	"checkbox_conventions" text[] NOT NULL,
	"worksheet_count" integer NOT NULL,
	"row_count" integer NOT NULL,
	"member_count" integer NOT NULL,
	"quarantined_count" integer DEFAULT 0 NOT NULL,
	"normalization_version" integer NOT NULL,
	"imported_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "import_batches_file_checksum_unique" UNIQUE("file_checksum")
);
--> statement-breakpoint
CREATE TABLE "import_row_norm" (
	"id" text PRIMARY KEY NOT NULL,
	"source_row_id" text NOT NULL,
	"full_name" text,
	"nickname" text,
	"age" integer,
	"occupation" text,
	"workplace" text,
	"belief_year" integer,
	"marital_code" text,
	"response_code" text,
	"participation_code" text,
	"goal_code" text,
	"normalized_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_source_rows" (
	"id" text PRIMARY KEY NOT NULL,
	"batch_id" text NOT NULL,
	"sheet_name" text NOT NULL,
	"team" text,
	"excel_row" integer NOT NULL,
	"raw_sequence" text,
	"raw_full_name" text,
	"raw_nickname" text,
	"raw_age" text,
	"raw_occupation" text,
	"raw_workplace" text,
	"raw_marital" text,
	"raw_belief_year" text,
	"raw_response" text,
	"raw_participation" text,
	"raw_goal" text,
	"raw_marital_checkbox" jsonb,
	"raw_response_checkbox" jsonb,
	"raw_participation_checkbox" jsonb,
	"raw_goal_checkbox" jsonb,
	"norm_status" text NOT NULL,
	"norm_issue" text,
	"norm_version" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "normalization_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"field_key" text NOT NULL,
	"layout_variant" text DEFAULT '*' NOT NULL,
	"rule_kind" text NOT NULL,
	"from_pattern" text,
	"to_code" text,
	"confidence" real DEFAULT 1 NOT NULL,
	"confirmed_by_id" text,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_imported_by_id_users_id_fk" FOREIGN KEY ("imported_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_row_norm" ADD CONSTRAINT "import_row_norm_source_row_id_import_source_rows_id_fk" FOREIGN KEY ("source_row_id") REFERENCES "public"."import_source_rows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_source_rows" ADD CONSTRAINT "import_source_rows_batch_id_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."import_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "normalization_rules" ADD CONSTRAINT "normalization_rules_confirmed_by_id_users_id_fk" FOREIGN KEY ("confirmed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "import_batches_created_at_idx" ON "import_batches" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "import_row_norm_source_row_uniq" ON "import_row_norm" USING btree ("source_row_id");--> statement-breakpoint
CREATE INDEX "import_source_rows_batch_id_idx" ON "import_source_rows" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "import_source_rows_batch_sheet_idx" ON "import_source_rows" USING btree ("batch_id","sheet_name");--> statement-breakpoint
CREATE UNIQUE INDEX "normalization_rules_natural_uniq" ON "normalization_rules" USING btree ("version","field_key","rule_kind","layout_variant","from_pattern");--> statement-breakpoint
CREATE INDEX "normalization_rules_version_idx" ON "normalization_rules" USING btree ("version");