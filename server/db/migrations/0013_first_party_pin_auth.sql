ALTER TABLE "users" ADD COLUMN "pin_hash" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "pin_failed_attempts" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "pin_locked_until" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "pin_updated_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX "users_pin_locked_until_idx" ON "users" USING btree ("pin_locked_until");
