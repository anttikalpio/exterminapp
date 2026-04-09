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
  integer,
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
    customerNumber: varchar("customer_number", { length: 50 }),
    businessName: varchar("business_name", { length: 255 }).notNull(),
    contactName: varchar("contact_name", { length: 255 }),
    contactEmail: varchar("contact_email", { length: 255 }),
    contactPhone: varchar("contact_phone", { length: 30 }),
    orderingParty: text("ordering_party"),
    billingStreetAddress: varchar("billing_street_address", { length: 255 }),
    billingPoBox: varchar("billing_po_box", { length: 50 }),
    billingZipCode: varchar("billing_zip_code", { length: 20 }),
    billingCity: varchar("billing_city", { length: 100 }),
    billingEinvoiceAddress: varchar("billing_einvoice_address", { length: 255 }),
    billingEmail: varchar("billing_email", { length: 255 }),
    // Language used when generating reports for this customer and when
    // auto-naming visits under their work orders. Separate from the
    // admin's UI locale — an English-speaking admin can still serve a
    // Finnish-speaking customer.
    preferredLanguage: varchar("preferred_language", { length: 5 })
      .notNull()
      .default("en"),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("customers_tenant_idx").on(table.tenantId),
    uniqueIndex("customers_tenant_number_idx").on(
      table.tenantId,
      table.customerNumber
    ),
  ]
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
    // Radius in meters that the "add trap" map is zoomed to and that
    // defines the nominal service area for this site. Adjustable per site.
    serviceRadiusMeters: integer("service_radius_meters").notNull().default(200),
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
// WORK ORDERS
// A unit of pest-control work under a customer, performed at a site.
// A customer can have many work orders; one site can host multiple
// concurrent work orders (e.g. a rat program and a cockroach program).
// ============================================================
export const workOrders = pgTable(
  "work_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id),
    workOrderNumber: varchar("work_order_number", { length: 50 }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("work_orders_tenant_idx").on(table.tenantId),
    index("work_orders_customer_idx").on(table.customerId),
    index("work_orders_site_idx").on(table.siteId),
    uniqueIndex("work_orders_tenant_number_idx").on(
      table.tenantId,
      table.workOrderNumber
    ),
  ]
);

// ============================================================
// WORK ORDER ASSIGNMENTS
// ============================================================
export const workOrderAssignments = pgTable(
  "work_order_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    workOrderId: uuid("work_order_id")
      .notNull()
      .references(() => workOrders.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("work_order_assignments_wo_user_idx").on(
      table.workOrderId,
      table.userId
    ),
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
    workOrderId: uuid("work_order_id")
      .notNull()
      .references(() => workOrders.id),
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
    index("traps_work_order_idx").on(table.workOrderId),
  ]
);

// ============================================================
// VISITS (service visits during a work order)
// ============================================================
export const visits = pgTable(
  "visits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    workOrderId: uuid("work_order_id")
      .notNull()
      .references(() => workOrders.id),
    name: varchar("name", { length: 255 }).notNull(),
    visitedAt: timestamp("visited_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("visits_tenant_idx").on(table.tenantId),
    index("visits_work_order_idx").on(table.workOrderId),
    index("visits_visited_at_idx").on(table.visitedAt),
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
    visitId: uuid("visit_id")
      .notNull()
      .references(() => visits.id),
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
    index("poison_additions_visit_idx").on(table.visitId),
    index("poison_additions_trap_idx").on(table.trapId),
    index("poison_additions_performed_at_idx").on(table.performedAt),
  ]
);

// ============================================================
// REPORTS
// Reports are customer-scoped. Most reports focus on a single work
// order (report_type = 'work_order_summary', work_order_id set), but
// future report types aggregate across all of a customer's data
// (work_order_id left null).
// ============================================================
export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    workOrderId: uuid("work_order_id").references(() => workOrders.id),
    reportType: varchar("report_type", { length: 50 })
      .notNull()
      .default("work_order_summary"),
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
    index("reports_customer_idx").on(table.customerId),
    index("reports_work_order_idx").on(table.workOrderId),
  ]
);
