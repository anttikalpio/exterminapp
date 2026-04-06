import { relations } from "drizzle-orm";
import {
  tenants,
  users,
  customers,
  sites,
  siteAssignments,
  traps,
  poisonAdditions,
  reports,
} from "./schema";

export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  customers: many(customers),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, { fields: [users.tenantId], references: [tenants.id] }),
  siteAssignments: many(siteAssignments),
  poisonAdditions: many(poisonAdditions),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [customers.tenantId],
    references: [tenants.id],
  }),
  sites: many(sites),
}));

export const sitesRelations = relations(sites, ({ one, many }) => ({
  tenant: one(tenants, { fields: [sites.tenantId], references: [tenants.id] }),
  customer: one(customers, {
    fields: [sites.customerId],
    references: [customers.id],
  }),
  assignments: many(siteAssignments),
  traps: many(traps),
  reports: many(reports),
}));

export const siteAssignmentsRelations = relations(
  siteAssignments,
  ({ one }) => ({
    site: one(sites, {
      fields: [siteAssignments.siteId],
      references: [sites.id],
    }),
    user: one(users, {
      fields: [siteAssignments.userId],
      references: [users.id],
    }),
  })
);

export const trapsRelations = relations(traps, ({ one, many }) => ({
  site: one(sites, { fields: [traps.siteId], references: [sites.id] }),
  installedByUser: one(users, {
    fields: [traps.installedBy],
    references: [users.id],
  }),
  poisonAdditions: many(poisonAdditions),
}));

export const poisonAdditionsRelations = relations(
  poisonAdditions,
  ({ one }) => ({
    trap: one(traps, {
      fields: [poisonAdditions.trapId],
      references: [traps.id],
    }),
    performedByUser: one(users, {
      fields: [poisonAdditions.performedBy],
      references: [users.id],
    }),
  })
);

export const reportsRelations = relations(reports, ({ one }) => ({
  site: one(sites, { fields: [reports.siteId], references: [sites.id] }),
  generatedByUser: one(users, {
    fields: [reports.generatedBy],
    references: [users.id],
  }),
}));
