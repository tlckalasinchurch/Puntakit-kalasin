CREATE TABLE "event_registrations" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"member_id" text,
	"user_id" text,
	"status" text DEFAULT 'registered' NOT NULL,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prayer_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"member_id" text,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"category" text DEFAULT 'spiritual' NOT NULL,
	"is_confidential" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"answered_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prayer_requests" ADD CONSTRAINT "prayer_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prayer_requests" ADD CONSTRAINT "prayer_requests_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_registrations_event_user_uniq" ON "event_registrations" USING btree ("event_id","user_id");--> statement-breakpoint
CREATE INDEX "event_registrations_event_id_idx" ON "event_registrations" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_registrations_user_id_idx" ON "event_registrations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "event_registrations_member_id_idx" ON "event_registrations" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "prayer_requests_user_id_idx" ON "prayer_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "prayer_requests_status_idx" ON "prayer_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "prayer_requests_category_idx" ON "prayer_requests" USING btree ("category");--> statement-breakpoint
CREATE INDEX "prayer_requests_created_at_idx" ON "prayer_requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "members_user_id_idx" ON "members" USING btree ("user_id");