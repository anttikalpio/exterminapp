import { relations } from "drizzle-orm";
import {
  tenants,
  users,
  customers,
  sites,
  workOrders,
  workOrderAssignments,
  traps,
  visits,
  poisonAdditions,
  reports,
} from "./schema";

export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  customers: many(customers),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, { fields: [users.tenantId], references: [tenants.id] }),
  workOrderAssignments: many(workOrderAssignments),
  poisonAdditions: many(poisonAdditions),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [customers.tenantId],
    references: [tenants.id],
  }),
  sites: many(sites),
  workOrders: many(workOrders),
  reports: many(reports),
}));

export const sitesRelations = relations(sites, ({ one, many }) => ({
  tenant: one(tenants, { fields: [sites.tenantId], references: [tenants.id] }),
  customer: one(customers, {
    fields: [sites.customerId],
    references: [customers.id],
  }),
  workOrders: many(workOrders),
  reports: many(reports),
}));

export const workOrdersRelations = relations(workOrders, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [workOrders.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [workOrders.customerId],
    references: [customers.id],
  }),
  site: one(sites, {
    fields: [workOrders.siteId],
    references: [sites.id],
  }),
  assignments: many(workOrderAssignments),
  traps: many(traps),
  visits: many(visits),
  reports: many(reports),
}));

export const workOrderAssignmentsRelations = relations(
  workOrderAssignments,
  ({ one }) => ({
    workOrder: one(workOrders, {
      fields: [workOrderAssignments.workOrderId],
      references: [workOrders.id],
    }),
    user: one(users, {
      fields: [workOrderAssignments.userId],
      references: [users.id],
    }),
  })
);

export const trapsRelations = relations(traps, ({ one, many }) => ({
  workOrder: one(workOrders, {
    fields: [traps.workOrderId],
    references: [workOrders.id],
  }),
  installedByUser: one(users, {
    fields: [traps.installedBy],
    references: [users.id],
  }),
  poisonAdditions: many(poisonAdditions),
}));

export const visitsRelations = relations(visits, ({ one, many }) => ({
  workOrder: one(workOrders, {
    fields: [visits.workOrderId],
    references: [workOrders.id],
  }),
  createdByUser: one(users, {
    fields: [visits.createdBy],
    references: [users.id],
  }),
  poisonAdditions: many(poisonAdditions),
}));

export const poisonAdditionsRelations = relations(
  poisonAdditions,
  ({ one }) => ({
    visit: one(visits, {
      fields: [poisonAdditions.visitId],
      references: [visits.id],
    }),
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
  customer: one(customers, {
    fields: [reports.customerId],
    references: [customers.id],
  }),
  workOrder: one(workOrders, {
    fields: [reports.workOrderId],
    references: [workOrders.id],
  }),
  site: one(sites, {
    fields: [reports.siteId],
    references: [sites.id],
  }),
  generatedByUser: one(users, {
    fields: [reports.generatedBy],
    references: [users.id],
  }),
}));
