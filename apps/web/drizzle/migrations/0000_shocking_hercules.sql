CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"business_name" varchar(255) NOT NULL,
	"contact_name" varchar(255),
	"contact_email" varchar(255),
	"contact_phone" varchar(30),
	"billing_address" text,
	"billing_email" varchar(255),
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poison_additions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"trap_id" uuid NOT NULL,
	"performed_by" uuid NOT NULL,
	"poison_type" varchar(100) NOT NULL,
	"quantity_grams" numeric(8, 2) NOT NULL,
	"recorded_latitude" numeric(10, 7),
	"recorded_longitude" numeric(10, 7),
	"notes" text,
	"performed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"client_timestamp" timestamp with time zone,
	"synced_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"generated_by" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"pdf_storage_key" varchar(500),
	"summary" jsonb DEFAULT '{}'::jsonb,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"address" text,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "traps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"label" varchar(50) NOT NULL,
	"latitude" numeric(10, 7) NOT NULL,
	"longitude" numeric(10, 7) NOT NULL,
	"trap_type" varchar(50) DEFAULT 'bait_station' NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"installed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"installed_by" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"role" varchar(20) NOT NULL,
	"phone" varchar(30),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poison_additions" ADD CONSTRAINT "poison_additions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poison_additions" ADD CONSTRAINT "poison_additions_trap_id_traps_id_fk" FOREIGN KEY ("trap_id") REFERENCES "public"."traps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poison_additions" ADD CONSTRAINT "poison_additions_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_assignments" ADD CONSTRAINT "site_assignments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_assignments" ADD CONSTRAINT "site_assignments_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_assignments" ADD CONSTRAINT "site_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traps" ADD CONSTRAINT "traps_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traps" ADD CONSTRAINT "traps_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traps" ADD CONSTRAINT "traps_installed_by_users_id_fk" FOREIGN KEY ("installed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customers_tenant_idx" ON "customers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "poison_additions_tenant_idx" ON "poison_additions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "poison_additions_trap_idx" ON "poison_additions" USING btree ("trap_id");--> statement-breakpoint
CREATE INDEX "poison_additions_performed_at_idx" ON "poison_additions" USING btree ("performed_at");--> statement-breakpoint
CREATE INDEX "reports_tenant_idx" ON "reports" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "reports_site_idx" ON "reports" USING btree ("site_id");--> statement-breakpoint
CREATE UNIQUE INDEX "site_assignments_site_user_idx" ON "site_assignments" USING btree ("site_id","user_id");--> statement-breakpoint
CREATE INDEX "sites_tenant_idx" ON "sites" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "sites_customer_idx" ON "sites" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "traps_tenant_idx" ON "traps" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "traps_site_idx" ON "traps" USING btree ("site_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_tenant_email_idx" ON "users" USING btree ("tenant_id","email");