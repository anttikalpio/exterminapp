-- Create the new visits table.
CREATE TABLE "visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"visited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "visits_tenant_idx" ON "visits" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "visits_site_idx" ON "visits" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "visits_visited_at_idx" ON "visits" USING btree ("visited_at");--> statement-breakpoint

-- Add visit_id as nullable so we can backfill any pre-existing rows.
ALTER TABLE "poison_additions" ADD COLUMN "visit_id" uuid;--> statement-breakpoint

-- Backfill: for every site that has pre-existing poison_additions, create an
-- "Initial visit" dated to the earliest addition at that site, and link all
-- of that site's additions to it. Wrapped in a PL/pgSQL DO block with an
-- explicit per-row loop so that on a fresh install (empty poison_additions
-- table) the loop iterates 0 times and the block is a pure no-op — no
-- complex INSERT...SELECT planner path is exercised at all.
DO $migration$
DECLARE
	r RECORD;
	v_creator uuid;
	v_visit_id uuid;
BEGIN
	FOR r IN
		SELECT
			t."tenant_id" AS tenant_id,
			t."site_id" AS site_id,
			MIN(pa."performed_at") AS earliest_performed_at,
			MIN(pa."performed_by") AS fallback_user_id
		FROM "poison_additions" pa
		JOIN "traps" t ON t."id" = pa."trap_id"
		WHERE pa."visit_id" IS NULL
		GROUP BY t."tenant_id", t."site_id"
	LOOP
		-- Prefer any active admin at the tenant; fall back to whoever
		-- performed the earliest addition.
		SELECT u."id" INTO v_creator
		FROM "users" u
		WHERE u."tenant_id" = r.tenant_id
		  AND u."role" = 'admin'
		  AND u."is_active" = true
		LIMIT 1;

		IF v_creator IS NULL THEN
			v_creator := r.fallback_user_id;
		END IF;

		INSERT INTO "visits" (
			"tenant_id",
			"site_id",
			"name",
			"visited_at",
			"created_by",
			"notes"
		) VALUES (
			r.tenant_id,
			r.site_id,
			'Initial visit',
			r.earliest_performed_at,
			v_creator,
			'Automatically created during migration to the visits model.'
		)
		RETURNING "id" INTO v_visit_id;

		UPDATE "poison_additions" pa
		SET "visit_id" = v_visit_id
		FROM "traps" t
		WHERE pa."trap_id" = t."id"
		  AND t."tenant_id" = r.tenant_id
		  AND t."site_id" = r.site_id
		  AND pa."visit_id" IS NULL;
	END LOOP;
END
$migration$;--> statement-breakpoint

-- Now that every row is backfilled, enforce NOT NULL and add the FK + index.
ALTER TABLE "poison_additions" ALTER COLUMN "visit_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "poison_additions" ADD CONSTRAINT "poison_additions_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "poison_additions_visit_idx" ON "poison_additions" USING btree ("visit_id");
