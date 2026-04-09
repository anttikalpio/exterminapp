-- Work orders refactor: sites become just physical locations; a new
-- work_orders table sits between customers and traps/visits/reports.
--
-- Existing data is preserved by creating one "Legacy work order" per site
-- that currently owns traps, visits, or reports (or has assignments), and
-- reparenting all dependent rows to that work order.

-- ============================================================
-- 1. Create new tables
-- ============================================================
CREATE TABLE "work_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"work_order_number" varchar(50),
	"title" varchar(255) NOT NULL,
	"description" text,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"start_date" date,
	"end_date" date,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_order_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"work_order_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_assignments" ADD CONSTRAINT "work_order_assignments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_assignments" ADD CONSTRAINT "work_order_assignments_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_assignments" ADD CONSTRAINT "work_order_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "work_orders_tenant_idx" ON "work_orders" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "work_orders_customer_idx" ON "work_orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "work_orders_site_idx" ON "work_orders" USING btree ("site_id");--> statement-breakpoint
CREATE UNIQUE INDEX "work_orders_tenant_number_idx" ON "work_orders" USING btree ("tenant_id","work_order_number");--> statement-breakpoint
CREATE UNIQUE INDEX "work_order_assignments_wo_user_idx" ON "work_order_assignments" USING btree ("work_order_id","user_id");--> statement-breakpoint

-- ============================================================
-- 2. Add new FK columns as NULLABLE so we can backfill them
-- ============================================================
ALTER TABLE "traps" ADD COLUMN "work_order_id" uuid;--> statement-breakpoint
ALTER TABLE "visits" ADD COLUMN "work_order_id" uuid;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "customer_id" uuid;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "work_order_id" uuid;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "report_type" varchar(50) DEFAULT 'work_order_summary' NOT NULL;--> statement-breakpoint

-- ============================================================
-- 3. Create one "Legacy work order" per site that has dependent data
--    and reparent everything under it.
-- ============================================================
INSERT INTO "work_orders" (
	"id", "tenant_id", "customer_id", "site_id",
	"title", "description", "status", "is_active", "created_at", "updated_at"
)
SELECT
	gen_random_uuid(),
	s."tenant_id",
	s."customer_id",
	s."id",
	'Legacy work order',
	'Automatically created during the v0.3.0 work orders refactor. Contains traps, visits, and reports that existed at this site before work orders were introduced.',
	'active',
	true,
	now(),
	now()
FROM "sites" s
WHERE EXISTS (SELECT 1 FROM "traps" t WHERE t."site_id" = s."id")
   OR EXISTS (SELECT 1 FROM "visits" v WHERE v."site_id" = s."id")
   OR EXISTS (SELECT 1 FROM "reports" r WHERE r."site_id" = s."id")
   OR EXISTS (SELECT 1 FROM "site_assignments" sa WHERE sa."site_id" = s."id");
--> statement-breakpoint

UPDATE "traps" t
SET "work_order_id" = wo."id"
FROM "work_orders" wo
WHERE wo."site_id" = t."site_id"
  AND wo."title" = 'Legacy work order';
--> statement-breakpoint

UPDATE "visits" v
SET "work_order_id" = wo."id"
FROM "work_orders" wo
WHERE wo."site_id" = v."site_id"
  AND wo."title" = 'Legacy work order';
--> statement-breakpoint

UPDATE "reports" r
SET
	"work_order_id" = wo."id",
	"customer_id" = s."customer_id"
FROM "sites" s
JOIN "work_orders" wo ON wo."site_id" = s."id" AND wo."title" = 'Legacy work order'
WHERE r."site_id" = s."id";
--> statement-breakpoint

INSERT INTO "work_order_assignments" ("tenant_id", "work_order_id", "user_id", "assigned_at")
SELECT sa."tenant_id", wo."id", sa."user_id", sa."assigned_at"
FROM "site_assignments" sa
JOIN "work_orders" wo ON wo."site_id" = sa."site_id" AND wo."title" = 'Legacy work order';
--> statement-breakpoint

-- ============================================================
-- 4. Enforce NOT NULL now that every row has been backfilled
-- ============================================================
ALTER TABLE "traps" ALTER COLUMN "work_order_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "visits" ALTER COLUMN "work_order_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ALTER COLUMN "customer_id" SET NOT NULL;--> statement-breakpoint

-- ============================================================
-- 5. Drop old FKs, indexes, and columns
-- ============================================================
ALTER TABLE "site_assignments" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "site_assignments" CASCADE;--> statement-breakpoint
ALTER TABLE "reports" DROP CONSTRAINT IF EXISTS "reports_site_id_sites_id_fk";--> statement-breakpoint
ALTER TABLE "traps" DROP CONSTRAINT IF EXISTS "traps_site_id_sites_id_fk";--> statement-breakpoint
ALTER TABLE "visits" DROP CONSTRAINT IF EXISTS "visits_site_id_sites_id_fk";--> statement-breakpoint
DROP INDEX IF EXISTS "reports_site_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "traps_site_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "visits_site_idx";--> statement-breakpoint

-- ============================================================
-- 6. Attach new FKs and indexes
-- ============================================================
ALTER TABLE "traps" ADD CONSTRAINT "traps_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "traps_work_order_idx" ON "traps" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "visits_work_order_idx" ON "visits" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "reports_customer_idx" ON "reports" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "reports_work_order_idx" ON "reports" USING btree ("work_order_id");--> statement-breakpoint
ALTER TABLE "reports" DROP COLUMN "site_id";--> statement-breakpoint
ALTER TABLE "traps" DROP COLUMN "site_id";--> statement-breakpoint
ALTER TABLE "visits" DROP COLUMN "site_id";
