CREATE TABLE "media_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"storage" text NOT NULL,
	"pathname" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"member_id" text,
	"group_id" text,
	"uploaded_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "membership_terms" (
	"id" text PRIMARY KEY NOT NULL,
	"member_id" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"closed_reason" text,
	"closed_at" timestamp with time zone,
	"decided_by_id" text,
	"decision_note" text,
	"fee_baht" integer DEFAULT 0 NOT NULL,
	"payment_status" text DEFAULT 'not_required' NOT NULL,
	"paid_amount_baht" integer,
	"paid_at" timestamp with time zone,
	"payment_recorded_by_id" text,
	"payment_note" text,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "member_no" integer;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_terms" ADD CONSTRAINT "membership_terms_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_terms" ADD CONSTRAINT "membership_terms_decided_by_id_users_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_terms" ADD CONSTRAINT "membership_terms_payment_recorded_by_id_users_id_fk" FOREIGN KEY ("payment_recorded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_terms" ADD CONSTRAINT "membership_terms_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_assets_member_id_idx" ON "media_assets" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "media_assets_group_id_idx" ON "media_assets" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "membership_terms_member_id_idx" ON "membership_terms" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "membership_terms_status_ends_idx" ON "membership_terms" USING btree ("status","ends_on");--> statement-breakpoint
CREATE UNIQUE INDEX "membership_terms_one_open_per_member" ON "membership_terms" USING btree ("member_id") WHERE "membership_terms"."status" = 'open';--> statement-breakpoint
CREATE UNIQUE INDEX "members_member_no_uniq" ON "members" USING btree ("member_no");