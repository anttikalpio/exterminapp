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

-- Add visit_id as nullable so we can backfill existing rows.
ALTER TABLE "poison_additions" ADD COLUMN "visit_id" uuid;--> statement-breakpoint

-- Backfill: for every site that has pre-existing poison_additions, create an
-- "Initial visit" dated to the earliest addition at that site, and link all
-- of that site's additions to it. Picks any admin user at the tenant as the
-- visit creator; falls back to the performer of the earliest addition if no
-- admin exists.
INSERT INTO "visits" ("id", "tenant_id", "site_id", "name", "visited_at", "created_by", "notes", "created_at", "updated_at")
SELECT
	gen_random_uuid(),
	t."tenant_id",
	t."site_id",
	'Initial visit',
	MIN(pa."performed_at"),
	COALESCE(
		(SELECT u."id" FROM "users" u WHERE u."tenant_id" = t."tenant_id" AND u."role" = 'admin' AND u."is_active" = true LIMIT 1),
		MIN(pa."performed_by")
	),
	'Automatically created during migration to the visits model.',
	now(),
	now()
FROM "poison_additions" pa
JOIN "traps" t ON t."id" = pa."trap_id"
WHERE pa."visit_id" IS NULL
GROUP BY t."tenant_id", t."site_id";--> statement-breakpoint

UPDATE "poison_additions" pa
SET "visit_id" = v."id"
FROM "visits" v, "traps" t
WHERE pa."trap_id" = t."id"
  AND v."site_id" = t."site_id"
  AND v."name" = 'Initial visit'
  AND pa."visit_id" IS NULL;--> statement-breakpoint

-- Now that every row is backfilled, enforce NOT NULL and add the FK + index.
ALTER TABLE "poison_additions" ALTER COLUMN "visit_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "poison_additions" ADD CONSTRAINT "poison_additions_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "poison_additions_visit_idx" ON "poison_additions" USING btree ("visit_id");
