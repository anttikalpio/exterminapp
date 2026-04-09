import { z } from "zod";
import { eq, and, ilike, sql } from "drizzle-orm";
import { router, adminProcedure, authedProcedure } from "../trpc";
import { sites, customers, workOrders } from "../../../../drizzle/schema";

export const siteRouter = router({
  list: adminProcedure
    .input(
      z.object({
        search: z.string().optional(),
        customerId: z.string().uuid().optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const { search, customerId, page, pageSize } = input;
      const offset = (page - 1) * pageSize;

      const conditions = [
        eq(sites.tenantId, ctx.tenantId),
        eq(sites.isActive, true),
      ];

      if (customerId) {
        conditions.push(eq(sites.customerId, customerId));
      }
      if (search) {
        conditions.push(ilike(sites.name, `%${search}%`));
      }

      const workOrderCountSql = sql<number>`(
        SELECT COUNT(*)::int FROM ${workOrders}
        WHERE ${workOrders.siteId} = ${sites.id}
          AND ${workOrders.isActive} = true
      )`;

      const [items, countResult] = await Promise.all([
        ctx.db
          .select({
            id: sites.id,
            name: sites.name,
            address: sites.address,
            latitude: sites.latitude,
            longitude: sites.longitude,
            customerId: sites.customerId,
            customerName: customers.businessName,
            workOrderCount: workOrderCountSql,
            isActive: sites.isActive,
            createdAt: sites.createdAt,
          })
          .from(sites)
          .innerJoin(customers, eq(sites.customerId, customers.id))
          .where(and(...conditions))
          .orderBy(sites.name)
          .limit(pageSize)
          .offset(offset),
        ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(sites)
          .where(and(...conditions)),
      ]);

      return { items, total: Number(countResult[0].count), page, pageSize };
    }),

  listByCustomer: authedProcedure
    .input(z.object({ customerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: sites.id,
          name: sites.name,
          address: sites.address,
          latitude: sites.latitude,
          longitude: sites.longitude,
          serviceRadiusMeters: sites.serviceRadiusMeters,
        })
        .from(sites)
        .where(
          and(
            eq(sites.customerId, input.customerId),
            eq(sites.tenantId, ctx.tenantId),
            eq(sites.isActive, true)
          )
        )
        .orderBy(sites.name);
    }),

  getById: authedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [site] = await ctx.db
        .select({
          id: sites.id,
          name: sites.name,
          address: sites.address,
          latitude: sites.latitude,
          longitude: sites.longitude,
          serviceRadiusMeters: sites.serviceRadiusMeters,
          notes: sites.notes,
          customerId: sites.customerId,
          customerName: customers.businessName,
          isActive: sites.isActive,
          createdAt: sites.createdAt,
        })
        .from(sites)
        .innerJoin(customers, eq(sites.customerId, customers.id))
        .where(
          and(eq(sites.id, input.id), eq(sites.tenantId, ctx.tenantId))
        )
        .limit(1);

      return site ?? null;
    }),

  create: adminProcedure
    .input(
      z.object({
        customerId: z.string().uuid(),
        name: z.string().min(1).max(255),
        address: z.string().optional(),
        latitude: z.number().min(-90).max(90).optional(),
        longitude: z.number().min(-180).max(180).optional(),
        serviceRadiusMeters: z.number().int().min(10).max(10000).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [site] = await ctx.db
        .insert(sites)
        .values({
          tenantId: ctx.tenantId,
          customerId: input.customerId,
          name: input.name,
          address: input.address,
          latitude: input.latitude?.toString(),
          longitude: input.longitude?.toString(),
          serviceRadiusMeters: input.serviceRadiusMeters,
          notes: input.notes,
        })
        .returning();

      return site;
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: z.object({
          name: z.string().min(1).max(255).optional(),
          address: z.string().optional(),
          latitude: z.number().min(-90).max(90).optional().nullable(),
          longitude: z.number().min(-180).max(180).optional().nullable(),
          serviceRadiusMeters: z.number().int().min(10).max(10000).optional(),
          notes: z.string().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updateData: Record<string, unknown> = {
        ...input.data,
        updatedAt: new Date(),
      };
      if (input.data.latitude !== undefined) {
        updateData.latitude = input.data.latitude?.toString() ?? null;
      }
      if (input.data.longitude !== undefined) {
        updateData.longitude = input.data.longitude?.toString() ?? null;
      }

      const [site] = await ctx.db
        .update(sites)
        .set(updateData)
        .where(
          and(eq(sites.id, input.id), eq(sites.tenantId, ctx.tenantId))
        )
        .returning();

      return site;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [site] = await ctx.db
        .update(sites)
        .set({ isActive: false, updatedAt: new Date() })
        .where(
          and(eq(sites.id, input.id), eq(sites.tenantId, ctx.tenantId))
        )
        .returning();

      return site;
    }),

  // For customer dropdown when creating a site.
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
});
