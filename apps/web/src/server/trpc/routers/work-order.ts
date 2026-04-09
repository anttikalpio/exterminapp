import { z } from "zod";
import { eq, and, ilike, or, sql, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, adminProcedure, authedProcedure } from "../trpc";
import { throwFriendlyPgError } from "../pg-errors";
import {
  createWorkOrderSchema,
  updateWorkOrderSchema,
} from "@exterminapp/shared";
import {
  workOrders,
  workOrderAssignments,
  sites,
  customers,
  users,
  traps,
  visits,
} from "../../../../drizzle/schema";

const trapCountSql = sql<number>`(
  SELECT COUNT(*)::int FROM ${traps}
  WHERE ${traps.workOrderId} = ${workOrders.id}
)`;

const visitCountSql = sql<number>`(
  SELECT COUNT(*)::int FROM ${visits}
  WHERE ${visits.workOrderId} = ${workOrders.id}
)`;

export const workOrderRouter = router({
  list: adminProcedure
    .input(
      z.object({
        search: z.string().optional(),
        customerId: z.string().uuid().optional(),
        siteId: z.string().uuid().optional(),
        status: z.enum(["active", "completed", "cancelled"]).optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const { search, customerId, siteId, status, page, pageSize } = input;
      const offset = (page - 1) * pageSize;

      const conditions = [
        eq(workOrders.tenantId, ctx.tenantId),
        eq(workOrders.isActive, true),
      ];

      if (customerId) conditions.push(eq(workOrders.customerId, customerId));
      if (siteId) conditions.push(eq(workOrders.siteId, siteId));
      if (status) conditions.push(eq(workOrders.status, status));
      if (search) {
        const like = `%${search}%`;
        conditions.push(
          // Match on title OR work order number
          // (The `or` operator returns undefined when arguments are empty;
          // both are always provided here so the cast is safe.)
          or(
            ilike(workOrders.title, like),
            ilike(workOrders.workOrderNumber, like)
          )!
        );
      }

      const [items, countResult] = await Promise.all([
        ctx.db
          .select({
            id: workOrders.id,
            workOrderNumber: workOrders.workOrderNumber,
            title: workOrders.title,
            status: workOrders.status,
            startDate: workOrders.startDate,
            endDate: workOrders.endDate,
            customerId: workOrders.customerId,
            customerName: customers.businessName,
            siteId: workOrders.siteId,
            siteName: sites.name,
            trapCount: trapCountSql,
            visitCount: visitCountSql,
            createdAt: workOrders.createdAt,
          })
          .from(workOrders)
          .innerJoin(customers, eq(workOrders.customerId, customers.id))
          .innerJoin(sites, eq(workOrders.siteId, sites.id))
          .where(and(...conditions))
          .orderBy(desc(workOrders.createdAt))
          .limit(pageSize)
          .offset(offset),
        ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(workOrders)
          .where(and(...conditions)),
      ]);

      return { items, total: Number(countResult[0].count), page, pageSize };
    }),

  // Lightweight list scoped to one customer (for the customer detail page).
  listByCustomer: authedProcedure
    .input(z.object({ customerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: workOrders.id,
          workOrderNumber: workOrders.workOrderNumber,
          title: workOrders.title,
          status: workOrders.status,
          startDate: workOrders.startDate,
          endDate: workOrders.endDate,
          siteId: workOrders.siteId,
          siteName: sites.name,
          trapCount: trapCountSql,
          visitCount: visitCountSql,
          createdAt: workOrders.createdAt,
        })
        .from(workOrders)
        .innerJoin(sites, eq(workOrders.siteId, sites.id))
        .where(
          and(
            eq(workOrders.customerId, input.customerId),
            eq(workOrders.tenantId, ctx.tenantId),
            eq(workOrders.isActive, true)
          )
        )
        .orderBy(desc(workOrders.createdAt));
    }),

  // Lightweight list scoped to one site.
  listBySite: authedProcedure
    .input(z.object({ siteId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: workOrders.id,
          workOrderNumber: workOrders.workOrderNumber,
          title: workOrders.title,
          status: workOrders.status,
          customerId: workOrders.customerId,
          customerName: customers.businessName,
          trapCount: trapCountSql,
          visitCount: visitCountSql,
          createdAt: workOrders.createdAt,
        })
        .from(workOrders)
        .innerJoin(customers, eq(workOrders.customerId, customers.id))
        .where(
          and(
            eq(workOrders.siteId, input.siteId),
            eq(workOrders.tenantId, ctx.tenantId),
            eq(workOrders.isActive, true)
          )
        )
        .orderBy(desc(workOrders.createdAt));
    }),

  getById: authedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [wo] = await ctx.db
        .select({
          id: workOrders.id,
          workOrderNumber: workOrders.workOrderNumber,
          title: workOrders.title,
          description: workOrders.description,
          status: workOrders.status,
          startDate: workOrders.startDate,
          endDate: workOrders.endDate,
          notes: workOrders.notes,
          isActive: workOrders.isActive,
          customerId: workOrders.customerId,
          customerName: customers.businessName,
          siteId: workOrders.siteId,
          siteName: sites.name,
          siteAddress: sites.address,
          siteLatitude: sites.latitude,
          siteLongitude: sites.longitude,
          createdAt: workOrders.createdAt,
          updatedAt: workOrders.updatedAt,
        })
        .from(workOrders)
        .innerJoin(customers, eq(workOrders.customerId, customers.id))
        .innerJoin(sites, eq(workOrders.siteId, sites.id))
        .where(
          and(
            eq(workOrders.id, input.id),
            eq(workOrders.tenantId, ctx.tenantId)
          )
        )
        .limit(1);

      return wo ?? null;
    }),

  create: adminProcedure
    .input(createWorkOrderSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify the site belongs to the customer in this tenant.
      const [site] = await ctx.db
        .select({ id: sites.id, customerId: sites.customerId })
        .from(sites)
        .where(
          and(
            eq(sites.id, input.siteId),
            eq(sites.tenantId, ctx.tenantId)
          )
        )
        .limit(1);

      if (!site || site.customerId !== input.customerId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Site does not belong to the selected customer",
        });
      }

      try {
        const [wo] = await ctx.db
          .insert(workOrders)
          .values({
            tenantId: ctx.tenantId,
            customerId: input.customerId,
            siteId: input.siteId,
            workOrderNumber: input.workOrderNumber || null,
            title: input.title,
            description: input.description,
            status: input.status ?? "active",
            startDate: input.startDate
              ? input.startDate.toISOString().slice(0, 10)
              : null,
            endDate: input.endDate
              ? input.endDate.toISOString().slice(0, 10)
              : null,
            notes: input.notes,
          })
          .returning();

        return wo;
      } catch (err) {
        throwFriendlyPgError(err, "work order");
      }
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateWorkOrderSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const data = input.data;

      // If siteId changes, verify the new site is in the same customer.
      if (data.siteId) {
        const [existing] = await ctx.db
          .select({ customerId: workOrders.customerId })
          .from(workOrders)
          .where(
            and(
              eq(workOrders.id, input.id),
              eq(workOrders.tenantId, ctx.tenantId)
            )
          )
          .limit(1);

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Work order not found",
          });
        }

        const [site] = await ctx.db
          .select({ customerId: sites.customerId })
          .from(sites)
          .where(
            and(
              eq(sites.id, data.siteId),
              eq(sites.tenantId, ctx.tenantId)
            )
          )
          .limit(1);

        if (!site || site.customerId !== existing.customerId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Site does not belong to the work order's customer",
          });
        }
      }

      const updatePayload: Record<string, unknown> = {
        updatedAt: new Date(),
      };
      if (data.siteId !== undefined) updatePayload.siteId = data.siteId;
      if (data.workOrderNumber !== undefined)
        updatePayload.workOrderNumber = data.workOrderNumber || null;
      if (data.title !== undefined) updatePayload.title = data.title;
      if (data.description !== undefined)
        updatePayload.description = data.description;
      if (data.status !== undefined) updatePayload.status = data.status;
      if (data.startDate !== undefined)
        updatePayload.startDate = data.startDate
          ? data.startDate.toISOString().slice(0, 10)
          : null;
      if (data.endDate !== undefined)
        updatePayload.endDate = data.endDate
          ? data.endDate.toISOString().slice(0, 10)
          : null;
      if (data.notes !== undefined) updatePayload.notes = data.notes;

      try {
        const [wo] = await ctx.db
          .update(workOrders)
          .set(updatePayload)
          .where(
            and(
              eq(workOrders.id, input.id),
              eq(workOrders.tenantId, ctx.tenantId)
            )
          )
          .returning();

        if (!wo) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Work order not found",
          });
        }

        return wo;
      } catch (err) {
        throwFriendlyPgError(err, "work order");
      }
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [wo] = await ctx.db
        .update(workOrders)
        .set({ isActive: false, updatedAt: new Date() })
        .where(
          and(
            eq(workOrders.id, input.id),
            eq(workOrders.tenantId, ctx.tenantId)
          )
        )
        .returning();

      return wo;
    }),

  // Assignments
  getAssignments: adminProcedure
    .input(z.object({ workOrderId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: workOrderAssignments.id,
          userId: workOrderAssignments.userId,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          assignedAt: workOrderAssignments.assignedAt,
        })
        .from(workOrderAssignments)
        .innerJoin(users, eq(workOrderAssignments.userId, users.id))
        .where(
          and(
            eq(workOrderAssignments.workOrderId, input.workOrderId),
            eq(workOrderAssignments.tenantId, ctx.tenantId)
          )
        );
    }),

  assign: adminProcedure
    .input(
      z.object({
        workOrderId: z.string().uuid(),
        userId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [assignment] = await ctx.db
        .insert(workOrderAssignments)
        .values({
          tenantId: ctx.tenantId,
          workOrderId: input.workOrderId,
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
        .delete(workOrderAssignments)
        .where(
          and(
            eq(workOrderAssignments.id, input.assignmentId),
            eq(workOrderAssignments.tenantId, ctx.tenantId)
          )
        )
        .returning();

      return deleted;
    }),

  // Dropdown helpers
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
