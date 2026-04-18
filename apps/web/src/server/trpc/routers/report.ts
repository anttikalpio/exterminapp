import { z } from "zod";
import { eq, and, sql, gte, lte, desc, inArray } from "drizzle-orm";
import { router, adminProcedure } from "../trpc";
import {
  reports,
  workOrders,
  workOrderAssignments,
  visits,
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
            siteId: reports.siteId,
            siteName: sites.name,
            createdAt: reports.createdAt,
          })
          .from(reports)
          .innerJoin(customers, eq(reports.customerId, customers.id))
          .leftJoin(workOrders, eq(reports.workOrderId, workOrders.id))
          .leftJoin(sites, eq(reports.siteId, sites.id))
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
      // For work_order_summary: site info comes via workOrders.siteId.
      // For site_progress: site info comes directly from reports.siteId.
      // We left-join sites on both and coalesce.
      const siteFromReport = ctx.db
        .select({
          id: sites.id,
          name: sites.name,
          address: sites.address,
        })
        .from(sites)
        .as("site_report");

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
          siteId: sql<string | null>`coalesce(${reports.siteId}, ${workOrders.siteId})`,
          siteName: sql<string | null>`coalesce(${siteFromReport.name}, ${sites.name})`,
          siteAddress: sql<string | null>`coalesce(${siteFromReport.address}, ${sites.address})`,
          createdAt: reports.createdAt,
        })
        .from(reports)
        .innerJoin(customers, eq(reports.customerId, customers.id))
        .leftJoin(workOrders, eq(reports.workOrderId, workOrders.id))
        .leftJoin(sites, eq(workOrders.siteId, sites.id))
        .leftJoin(siteFromReport, eq(reports.siteId, siteFromReport.id))
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
        siteId: z.string().uuid().optional(),
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

      // If a site is specified, verify it belongs to the customer.
      if (input.siteId) {
        const [s] = await ctx.db
          .select({ customerId: sites.customerId })
          .from(sites)
          .where(
            and(
              eq(sites.id, input.siteId),
              eq(sites.tenantId, ctx.tenantId)
            )
          )
          .limit(1);

        if (!s || s.customerId !== input.customerId) {
          throw new Error("Site does not belong to the selected customer");
        }
      }

      const [report] = await ctx.db
        .insert(reports)
        .values({
          tenantId: ctx.tenantId,
          customerId: input.customerId,
          workOrderId: input.workOrderId ?? null,
          siteId: input.siteId ?? null,
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

  // Sites for a given customer (used by site_progress report flow)
  siteOptions: adminProcedure
    .input(z.object({ customerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: sites.id,
          name: sites.name,
          address: sites.address,
        })
        .from(sites)
        .where(
          and(
            eq(sites.tenantId, ctx.tenantId),
            eq(sites.customerId, input.customerId),
            eq(sites.isActive, true)
          )
        )
        .orderBy(sites.name);
    }),

  // Gather data for a site-progress report: site info, all active work
  // orders at the site, their visits, traps, and poison history.
  getSiteProgressReportData: adminProcedure
    .input(
      z.object({
        siteId: z.string().uuid(),
        periodStart: z.string(),
        periodEnd: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { siteId, periodStart, periodEnd } = input;

      // Site + customer info
      const [siteInfo] = await ctx.db
        .select({
          id: sites.id,
          name: sites.name,
          address: sites.address,
          latitude: sites.latitude,
          longitude: sites.longitude,
          customerId: sites.customerId,
          customerName: customers.businessName,
          customerContact: customers.contactName,
          customerPhone: customers.contactPhone,
          customerEmail: customers.contactEmail,
          customerLanguage: customers.preferredLanguage,
        })
        .from(sites)
        .innerJoin(customers, eq(sites.customerId, customers.id))
        .where(
          and(eq(sites.id, siteId), eq(sites.tenantId, ctx.tenantId))
        )
        .limit(1);

      if (!siteInfo) return null;

      // All active work orders at this site
      const siteWorkOrders = await ctx.db
        .select({
          id: workOrders.id,
          title: workOrders.title,
          workOrderNumber: workOrders.workOrderNumber,
          status: workOrders.status,
          startDate: workOrders.startDate,
          endDate: workOrders.endDate,
        })
        .from(workOrders)
        .where(
          and(
            eq(workOrders.siteId, siteId),
            eq(workOrders.tenantId, ctx.tenantId),
            eq(workOrders.isActive, true)
          )
        )
        .orderBy(workOrders.createdAt);

      if (siteWorkOrders.length === 0) {
        return {
          site: siteInfo,
          earliestStartDate: null,
          workOrders: [],
        };
      }

      const woIds = siteWorkOrders.map((wo) => wo.id);

      // Batch queries for all work orders at once
      const [allAssignments, allVisits, allTraps] = await Promise.all([
        // Assignments
        ctx.db
          .select({
            workOrderId: workOrderAssignments.workOrderId,
            firstName: users.firstName,
            lastName: users.lastName,
          })
          .from(workOrderAssignments)
          .innerJoin(users, eq(workOrderAssignments.userId, users.id))
          .where(inArray(workOrderAssignments.workOrderId, woIds)),

        // Visits within the period
        ctx.db
          .select({
            id: visits.id,
            workOrderId: visits.workOrderId,
            name: visits.name,
            visitedAt: visits.visitedAt,
            createdByName:
              sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
          })
          .from(visits)
          .innerJoin(users, eq(visits.createdBy, users.id))
          .where(
            and(
              eq(visits.tenantId, ctx.tenantId),
              inArray(visits.workOrderId, woIds),
              gte(visits.visitedAt, new Date(periodStart)),
              lte(visits.visitedAt, new Date(periodEnd + "T23:59:59.999Z"))
            )
          )
          .orderBy(visits.visitedAt),

        // Traps (all, regardless of period)
        ctx.db
          .select({
            id: traps.id,
            workOrderId: traps.workOrderId,
            label: traps.label,
            latitude: traps.latitude,
            longitude: traps.longitude,
            trapType: traps.trapType,
            status: traps.status,
          })
          .from(traps)
          .where(
            and(
              eq(traps.tenantId, ctx.tenantId),
              inArray(traps.workOrderId, woIds)
            )
          )
          .orderBy(traps.label),
      ]);

      // Poison additions (need trap IDs first)
      const allTrapIds = allTraps.map((t) => t.id);
      let allPoisonHistory: Array<{
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

      if (allTrapIds.length > 0) {
        allPoisonHistory = await ctx.db
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
              inArray(poisonAdditions.trapId, allTrapIds),
              gte(poisonAdditions.performedAt, new Date(periodStart)),
              lte(
                poisonAdditions.performedAt,
                new Date(periodEnd + "T23:59:59.999Z")
              )
            )
          )
          .orderBy(traps.label, poisonAdditions.performedAt);
      }

      // Group data by work order
      const trapsByWo = new Map<string, typeof allTraps>();
      for (const t of allTraps) {
        const arr = trapsByWo.get(t.workOrderId) ?? [];
        arr.push(t);
        trapsByWo.set(t.workOrderId, arr);
      }

      const trapIdToWo = new Map<string, string>();
      for (const t of allTraps) {
        trapIdToWo.set(t.id, t.workOrderId);
      }

      const enrichedWorkOrders = siteWorkOrders.map((wo) => ({
        ...wo,
        assignedTechnicians: allAssignments
          .filter((a) => a.workOrderId === wo.id)
          .map((a) => ({ firstName: a.firstName, lastName: a.lastName })),
        visits: allVisits.filter((v) => v.workOrderId === wo.id),
        traps: (trapsByWo.get(wo.id) ?? []).map((t) => ({
          id: t.id,
          label: t.label,
          latitude: t.latitude,
          longitude: t.longitude,
          trapType: t.trapType,
          status: t.status,
        })),
        poisonHistory: allPoisonHistory.filter(
          (p) => trapIdToWo.get(p.trapId) === wo.id
        ),
      }));

      // Earliest start date across all work orders for "from beginning"
      const startDates = siteWorkOrders
        .map((wo) => wo.startDate)
        .filter((d): d is string => d !== null);
      const earliestStartDate =
        startDates.length > 0
          ? startDates.sort()[0]
          : null;

      return {
        site: siteInfo,
        earliestStartDate,
        workOrders: enrichedWorkOrders,
      };
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
