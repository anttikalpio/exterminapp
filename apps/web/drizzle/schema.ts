import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
  decimal,
  date,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ============================================================
// TENANTS (future multi-tenancy)
// ============================================================
export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  companyName: varchar("company_name", { length: 255 }),
  address: text("address"),
  vatNumber: varchar("vat_number", { length: 50 }),
  contactEmail: varchar("contact_email", { length: 255 }),
  contactPhone: varchar("contact_phone", { length: 30 }),
  logoPath: varchar("logo_path", { length: 500 }),
  settings: jsonb("settings").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// USERS / EMPLOYEES
// ============================================================
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    role: varchar("role", { length: 20 }).notNull(),
    phone: varchar("phone", { length: 30 }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("users_tenant_email_idx").on(table.tenantId, table.email),
  ]
);

// ============================================================
// CUSTOMERS
// ============================================================
export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    businessName: varchar("business_name", { length: 255 }).notNull(),
    contactName: varchar("contact_name", { length: 255 }),
    contactEmail: varchar("contact_email", { length: 255 }),
    contactPhone: varchar("contact_phone", { length: 30 }),
    billingAddress: text("billing_address"),
    billingEmail: varchar("billing_email", { length: 255 }),
    preferredLanguage: varchar("preferred_language", { length: 5 })
      .notNull()
      .default("en"),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("customers_tenant_idx").on(table.tenantId)]
);

// ============================================================
// SITES
// ============================================================
export const sites = pgTable(
  "sites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    name: varchar("name", { length: 255 }).notNull(),
    address: text("address"),
    latitude: decimal("latitude", { precision: 10, scale: 7 }),
    longitude: decimal("longitude", { precision: 10, scale: 7 }),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("sites_tenant_idx").on(table.tenantId),
    index("sites_customer_idx").on(table.customerId),
  ]
);

// ============================================================
// SITE ASSIGNMENTS
// ============================================================
export const siteAssignments = pgTable(
  "site_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("site_assignments_site_user_idx").on(table.siteId, table.userId),
  ]
);

// ============================================================
// TRAPS
// ============================================================
export const traps = pgTable(
  "traps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id),
    label: varchar("label", { length: 50 }).notNull(),
    latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
    longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),
    trapType: varchar("trap_type", { length: 50 }).notNull().default("bait_station"),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    installedAt: timestamp("installed_at", { withTimezone: true }).notNull().defaultNow(),
    installedBy: uuid("installed_by").references(() => users.id),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("traps_tenant_idx").on(table.tenantId),
    index("traps_site_idx").on(table.siteId),
  ]
);

// ============================================================
// POISON ADDITIONS (immutable audit log)
// ============================================================
export const poisonAdditions = pgTable(
  "poison_additions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    trapId: uuid("trap_id")
      .notNull()
      .references(() => traps.id),
    performedBy: uuid("performed_by")
      .notNull()
      .references(() => users.id),
    poisonType: varchar("poison_type", { length: 100 }).notNull(),
    remainingGrams: decimal("remaining_grams", { precision: 8, scale: 2 }),
    quantityGrams: decimal("quantity_grams", { precision: 8, scale: 2 }).notNull(),
    recordedLatitude: decimal("recorded_latitude", { precision: 10, scale: 7 }),
    recordedLongitude: decimal("recorded_longitude", { precision: 10, scale: 7 }),
    notes: text("notes"),
    performedAt: timestamp("performed_at", { withTimezone: true }).notNull().defaultNow(),
    clientTimestamp: timestamp("client_timestamp", { withTimezone: true }),
    syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("poison_additions_tenant_idx").on(table.tenantId),
    index("poison_additions_trap_idx").on(table.trapId),
    index("poison_additions_performed_at_idx").on(table.performedAt),
  ]
);

// ============================================================
// REPORTS
// ============================================================
export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id),
    generatedBy: uuid("generated_by")
      .notNull()
      .references(() => users.id),
    title: varchar("title", { length: 255 }).notNull(),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    pdfStorageKey: varchar("pdf_storage_key", { length: 500 }),
    summary: jsonb("summary").default({}),
    status: varchar("status", { length: 20 }).notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("reports_tenant_idx").on(table.tenantId),
    index("reports_site_idx").on(table.siteId),
  ]
);
