import { z } from "zod";
import { eq, and, sql, gte, lte, desc, inArray } from "drizzle-orm";
import { router, adminProcedure } from "../trpc";
import {
  reports,
  workOrders,
  sites,
  customers,
  traps,
  poisonAdditions,
  users,
  tenants,
} from "../../../../drizzle/schema";

export const reportRouter = router({
  list: adminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const { page, pageSize } = input;
      const offset = (page - 1) * pageSize;

      const [items, countResult] = await Promise.all([
        ctx.db
          .select({
            id: reports.id,
            title: reports.title,
            reportType: reports.reportType,
            periodStart: reports.periodStart,
            periodEnd: reports.periodEnd,
            status: reports.status,
            customerId: reports.customerId,
            customerName: customers.businessName,
            workOrderId: reports.workOrderId,
            workOrderTitle: workOrders.title,
            createdAt: reports.createdAt,
          })
          .from(reports)
          .innerJoin(customers, eq(reports.customerId, customers.id))
          .leftJoin(workOrders, eq(reports.workOrderId, workOrders.id))
          .where(eq(reports.tenantId, ctx.tenantId))
          .orderBy(desc(reports.createdAt))
          .limit(pageSize)
          .offset(offset),
        ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(reports)
          .where(eq(reports.tenantId, ctx.tenantId)),
      ]);

      return { items, total: Number(countResult[0].count), page, pageSize };
    }),

  getById: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [report] = await ctx.db
        .select({
          id: reports.id,
          title: reports.title,
          reportType: reports.reportType,
          periodStart: reports.periodStart,
          periodEnd: reports.periodEnd,
          status: reports.status,
          summary: reports.summary,
          customerId: reports.customerId,
          customerName: customers.businessName,
          customerContact: customers.contactName,
          customerPhone: customers.contactPhone,
          customerEmail: customers.contactEmail,
          workOrderId: reports.workOrderId,
          workOrderTitle: workOrders.title,
          workOrderNumber: workOrders.workOrderNumber,
          siteId: workOrders.siteId,
          siteName: sites.name,
          siteAddress: sites.address,
          createdAt: reports.createdAt,
        })
        .from(reports)
        .innerJoin(customers, eq(reports.customerId, customers.id))
        .leftJoin(workOrders, eq(reports.workOrderId, workOrders.id))
        .leftJoin(sites, eq(workOrders.siteId, sites.id))
        .where(
          and(eq(reports.id, input.id), eq(reports.tenantId, ctx.tenantId))
        )
        .limit(1);

      return report ?? null;
    }),

  // Gather preview data for a work-order-scoped report: site info, traps,
  // and poison history within the timeframe.
  getWorkOrderReportData: adminProcedure
    .input(
      z.object({
        workOrderId: z.string().uuid(),
        periodStart: z.string(), // ISO date string YYYY-MM-DD
        periodEnd: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { workOrderId, periodStart, periodEnd } = input;

      // Work order + site + customer info
      const [workOrderInfo] = await ctx.db
        .select({
          id: workOrders.id,
          title: workOrders.title,
          workOrderNumber: workOrders.workOrderNumber,
          description: workOrders.description,
          status: workOrders.status,
          startDate: workOrders.startDate,
          endDate: workOrders.endDate,
          siteId: workOrders.siteId,
          siteName: sites.name,
          siteAddress: sites.address,
          customerId: workOrders.customerId,
          customerName: customers.businessName,
          customerContact: customers.contactName,
          customerPhone: customers.contactPhone,
          customerEmail: customers.contactEmail,
        })
        .from(workOrders)
        .innerJoin(sites, eq(workOrders.siteId, sites.id))
        .innerJoin(customers, eq(workOrders.customerId, customers.id))
        .where(
          and(
            eq(workOrders.id, workOrderId),
            eq(workOrders.tenantId, ctx.tenantId)
          )
        )
        .limit(1);

      if (!workOrderInfo) return null;

      // Get all traps for this work order
      const workOrderTraps = await ctx.db
        .select({
          id: traps.id,
          label: traps.label,
          trapType: traps.trapType,
          status: traps.status,
          installedAt: traps.installedAt,
          notes: traps.notes,
        })
        .from(traps)
        .where(
          and(
            eq(traps.workOrderId, workOrderId),
            eq(traps.tenantId, ctx.tenantId)
          )
        )
        .orderBy(traps.label);

      // Get poison additions within timeframe for all traps in this work order
      const trapIds = workOrderTraps.map((t) => t.id);
      let poisonHistory: Array<{
        id: string;
        trapId: string;
        trapLabel: string;
        poisonType: string;
        remainingGrams: string | null;
        quantityGrams: string;
        notes: string | null;
        performedAt: Date;
        performedByName: string;
      }> = [];

      if (trapIds.length > 0) {
        poisonHistory = await ctx.db
          .select({
            id: poisonAdditions.id,
            trapId: poisonAdditions.trapId,
            trapLabel: traps.label,
            poisonType: poisonAdditions.poisonType,
            remainingGrams: poisonAdditions.remainingGrams,
            quantityGrams: poisonAdditions.quantityGrams,
            notes: poisonAdditions.notes,
            performedAt: poisonAdditions.performedAt,
            performedByName:
              sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
          })
          .from(poisonAdditions)
          .innerJoin(traps, eq(poisonAdditions.trapId, traps.id))
          .innerJoin(users, eq(poisonAdditions.performedBy, users.id))
          .where(
            and(
              eq(poisonAdditions.tenantId, ctx.tenantId),
              inArray(poisonAdditions.trapId, trapIds),
              gte(poisonAdditions.performedAt, new Date(periodStart)),
              lte(
                poisonAdditions.performedAt,
                new Date(periodEnd + "T23:59:59.999Z")
              )
            )
          )
          .orderBy(traps.label, poisonAdditions.performedAt);
      }

      return {
        workOrder: workOrderInfo,
        traps: workOrderTraps,
        poisonHistory,
      };
    }),

  // Get company info for PDF header
  getCompanyInfo: adminProcedure.query(async ({ ctx }) => {
    const [tenant] = await ctx.db
      .select({
        companyName: tenants.companyName,
        address: tenants.address,
        vatNumber: tenants.vatNumber,
        contactEmail: tenants.contactEmail,
        contactPhone: tenants.contactPhone,
        logoPath: tenants.logoPath,
      })
      .from(tenants)
      .where(eq(tenants.id, ctx.tenantId))
      .limit(1);

    return tenant ?? null;
  }),

  create: adminProcedure
    .input(
      z.object({
        customerId: z.string().uuid(),
        workOrderId: z.string().uuid().optional(),
        reportType: z.string().min(1).max(50).default("work_order_summary"),
        title: z.string().min(1).max(255),
        periodStart: z.string(),
        periodEnd: z.string(),
        comments: z.string().optional(),
        status: z.enum(["draft", "final"]).default("draft"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // If a work order is specified, verify it belongs to the customer.
      if (input.workOrderId) {
        const [wo] = await ctx.db
          .select({ customerId: workOrders.customerId })
          .from(workOrders)
          .where(
            and(
              eq(workOrders.id, input.workOrderId),
              eq(workOrders.tenantId, ctx.tenantId)
            )
          )
          .limit(1);

        if (!wo || wo.customerId !== input.customerId) {
          throw new Error("Work order does not belong to the selected customer");
        }
      }

      const [report] = await ctx.db
        .insert(reports)
        .values({
          tenantId: ctx.tenantId,
          customerId: input.customerId,
          workOrderId: input.workOrderId ?? null,
          reportType: input.reportType,
          generatedBy: ctx.user.id,
          title: input.title,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          summary: { comments: input.comments || "" },
          status: input.status,
        })
        .returning();

      return report;
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(255).optional(),
        comments: z.string().optional(),
        status: z.enum(["draft", "final"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const updateData: Record<string, unknown> = {};

      if (data.title) updateData.title = data.title;
      if (data.status) updateData.status = data.status;
      if (data.comments !== undefined) {
        updateData.summary = { comments: data.comments };
      }

      const [report] = await ctx.db
        .update(reports)
        .set(updateData)
        .where(and(eq(reports.id, id), eq(reports.tenantId, ctx.tenantId)))
        .returning();

      return report;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(reports)
        .where(
          and(eq(reports.id, input.id), eq(reports.tenantId, ctx.tenantId))
        )
        .returning();

      return deleted;
    }),

  // Customer options for report creation
  customerOptions: adminProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({ id: customers.id, businessName: customers.businessName })
      .from(customers)
      .where(
        and(
          eq(customers.tenantId, ctx.tenantId),
          eq(customers.isActive, true)
        )
      )
      .orderBy(customers.businessName);
  }),

  // Work orders for a given customer
  workOrderOptions: adminProcedure
    .input(z.object({ customerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: workOrders.id,
          title: workOrders.title,
          workOrderNumber: workOrders.workOrderNumber,
          status: workOrders.status,
          siteName: sites.name,
        })
        .from(workOrders)
        .innerJoin(sites, eq(workOrders.siteId, sites.id))
        .where(
          and(
            eq(workOrders.tenantId, ctx.tenantId),
            eq(workOrders.customerId, input.customerId),
            eq(workOrders.isActive, true)
          )
        )
        .orderBy(desc(workOrders.createdAt));
    }),
});
