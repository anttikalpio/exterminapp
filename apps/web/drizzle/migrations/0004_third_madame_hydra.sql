ALTER TABLE "customers" ADD COLUMN "customer_number" varchar(50);--> statement-breakpoint
CREATE UNIQUE INDEX "customers_tenant_number_idx" ON "customers" USING btree ("tenant_id","customer_number");