import { z } from "zod";
import { eq, and, sql, gte, lte, desc } from "drizzle-orm";
import { router, adminProcedure } from "../trpc";
import {
  reports,
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
            periodStart: reports.periodStart,
            periodEnd: reports.periodEnd,
            status: reports.status,
            siteName: sites.name,
            customerName: customers.businessName,
            createdAt: reports.createdAt,
          })
          .from(reports)
          .innerJoin(sites, eq(reports.siteId, sites.id))
          .innerJoin(customers, eq(sites.customerId, customers.id))
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
          periodStart: reports.periodStart,
          periodEnd: reports.periodEnd,
          status: reports.status,
          summary: reports.summary,
          siteId: reports.siteId,
          siteName: sites.name,
          siteAddress: sites.address,
          customerName: customers.businessName,
          customerContact: customers.contactName,
          customerPhone: customers.contactPhone,
          customerEmail: customers.contactEmail,
          createdAt: reports.createdAt,
        })
        .from(reports)
        .innerJoin(sites, eq(reports.siteId, sites.id))
        .innerJoin(customers, eq(sites.customerId, customers.id))
        .where(
          and(eq(reports.id, input.id), eq(reports.tenantId, ctx.tenantId))
        )
        .limit(1);

      return report ?? null;
    }),

  // Get site data for report preview: traps + poison history within timeframe
  getSiteReportData: adminProcedure
    .input(
      z.object({
        siteId: z.string().uuid(),
        periodStart: z.string(), // ISO date string YYYY-MM-DD
        periodEnd: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { siteId, periodStart, periodEnd } = input;

      // Get site + customer info
      const [siteInfo] = await ctx.db
        .select({
          id: sites.id,
          name: sites.name,
          address: sites.address,
          customerName: customers.businessName,
          customerContact: customers.contactName,
          customerPhone: customers.contactPhone,
          customerEmail: customers.contactEmail,
          customerAddress: customers.billingAddress,
        })
        .from(sites)
        .innerJoin(customers, eq(sites.customerId, customers.id))
        .where(
          and(eq(sites.id, siteId), eq(sites.tenantId, ctx.tenantId))
        )
        .limit(1);

      if (!siteInfo) return null;

      // Get all traps for the site
      const siteTraps = await ctx.db
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
          and(eq(traps.siteId, siteId), eq(traps.tenantId, ctx.tenantId))
        )
        .orderBy(traps.label);

      // Get poison additions within timeframe for all traps at this site
      const trapIds = siteTraps.map((t) => t.id);
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
              sql`${poisonAdditions.trapId} = ANY(${trapIds})`,
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
        site: siteInfo,
        traps: siteTraps,
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
        siteId: z.string().uuid(),
        title: z.string().min(1).max(255),
        periodStart: z.string(),
        periodEnd: z.string(),
        comments: z.string().optional(),
        status: z.enum(["draft", "final"]).default("draft"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [report] = await ctx.db
        .insert(reports)
        .values({
          tenantId: ctx.tenantId,
          siteId: input.siteId,
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

  // Sites for a given customer
  siteOptions: adminProcedure
    .input(z.object({ customerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({ id: sites.id, name: sites.name, address: sites.address })
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
});
