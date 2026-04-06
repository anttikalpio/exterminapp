ALTER TABLE "tenants" ADD COLUMN "company_name" varchar(255);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "vat_number" varchar(50);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "contact_email" varchar(255);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "contact_phone" varchar(30);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "logo_path" varchar(500);