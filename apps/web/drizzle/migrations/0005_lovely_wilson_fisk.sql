ALTER TABLE "customers" ADD COLUMN "ordering_party" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "billing_street_address" varchar(255);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "billing_po_box" varchar(50);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "billing_zip_code" varchar(20);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "billing_city" varchar(100);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "billing_einvoice_address" varchar(255);--> statement-breakpoint
UPDATE "customers" SET "billing_street_address" = substring("billing_address" for 255) WHERE "billing_address" IS NOT NULL AND "billing_address" <> '';--> statement-breakpoint
ALTER TABLE "customers" DROP COLUMN "billing_address";