-- DRY-RUN. NOT APPLIED. This file is outside server/db/migrations on purpose:
-- drizzle-kit and bootstrapDatabase() never read it, and meta/_journal.json
-- has no entry for it.
--
-- Gate (docs/PUNTAKIT_MISSION_DOMAIN_PLAN.md §13 step 0):
--   Run GET /api/import/precheck/group-members as an admin.
--   Apply this file only when data.gate.verdict is "CLEAR".
--
-- Numbering: 0009 is now taken by import_duplicate_decisions, so this migration
-- will be generated under a later number (the next free one). The file name here
-- is kept so the plan and the test still find it.
--
-- To promote: copy this file to server/db/migrations/ under the next free number,
-- replace "group_members_group_member_uniq" in shared/schema.ts with the partial
-- index below, then run `pnpm db:generate` to create the journal entry. Run
-- `pnpm check` and `pnpm test` first.
--
-- Effect: one CURRENT membership per (group_id, member_id), unlimited history.
-- Join -> leave -> rejoin becomes possible.

-- Guard: stop if a current duplicate exists. The full unique index forbids any
-- duplicate today, so this only fires if the gate was skipped or data changed.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "group_members"
    WHERE "left_at" IS NULL
    GROUP BY "group_id", "member_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'group_members has duplicate current memberships; run the pre-check';
  END IF;
END $$;
--> statement-breakpoint
-- Create the new index first so there is no window without a uniqueness guard.
CREATE UNIQUE INDEX "group_members_current_uniq"
  ON "group_members" ("group_id", "member_id")
  WHERE "left_at" IS NULL;
--> statement-breakpoint
DROP INDEX "group_members_group_member_uniq";

-- ROLLBACK (manual; run only while no member has two rows in one group):
--   CREATE UNIQUE INDEX "group_members_group_member_uniq"
--     ON "group_members" ("group_id", "member_id");
--   DROP INDEX "group_members_current_uniq";
-- If rejoin rows already exist, the first statement fails. Resolve those rows by hand.
