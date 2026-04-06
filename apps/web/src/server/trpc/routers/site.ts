import { z } from "zod";
import { eq, and, ilike, sql } from "drizzle-orm";
import { router, adminProcedure, authedProcedure } from "../trpc";
import {
  sites,
  customers,
  siteAssignments,
  users,
  traps,
} from "../../../../drizzle/schema";

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

  // Assignments
  getAssignments: adminProcedure
    .input(z.object({ siteId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: siteAssignments.id,
          userId: siteAssignments.userId,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          assignedAt: siteAssignments.assignedAt,
        })
        .from(siteAssignments)
        .innerJoin(users, eq(siteAssignments.userId, users.id))
        .where(
          and(
            eq(siteAssignments.siteId, input.siteId),
            eq(siteAssignments.tenantId, ctx.tenantId)
          )
        );
    }),

  assign: adminProcedure
    .input(
      z.object({
        siteId: z.string().uuid(),
        userId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [assignment] = await ctx.db
        .insert(siteAssignments)
        .values({
          tenantId: ctx.tenantId,
          siteId: input.siteId,
          userId: input.userId,
        })
        .onConflictDoNothing()
        .returning();

      return assignment;
    }),

  unassign: adminProcedure
    .input(z.object({ assignmentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(siteAssignments)
        .where(
          and(
            eq(siteAssignments.id, input.assignmentId),
            eq(siteAssignments.tenantId, ctx.tenantId)
          )
        )
        .returning();

      return deleted;
    }),

  // For customer dropdown
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

  // Field tech employees for assignment
  technicianOptions: adminProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(users)
      .where(
        and(
          eq(users.tenantId, ctx.tenantId),
          eq(users.isActive, true),
          eq(users.role, "field_technician")
        )
      )
      .orderBy(users.lastName);
  }),
});
