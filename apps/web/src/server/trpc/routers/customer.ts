import { z } from "zod";
import { eq, and, ilike, sql } from "drizzle-orm";
import { router, adminProcedure } from "../trpc";
import { throwFriendlyPgError } from "../pg-errors";
import { customers } from "../../../../drizzle/schema";
import {
  createCustomerSchema,
  updateCustomerSchema,
} from "@exterminapp/shared";

export const customerRouter = router({
  list: adminProcedure
    .input(
      z.object({
        search: z.string().optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const { search, page, pageSize } = input;
      const offset = (page - 1) * pageSize;

      const conditions = [
        eq(customers.tenantId, ctx.tenantId),
        eq(customers.isActive, true),
      ];

      if (search) {
        conditions.push(ilike(customers.businessName, `%${search}%`));
      }

      const [items, countResult] = await Promise.all([
        ctx.db
          .select()
          .from(customers)
          .where(and(...conditions))
          .orderBy(customers.businessName)
          .limit(pageSize)
          .offset(offset),
        ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(customers)
          .where(and(...conditions)),
      ]);

      return {
        items,
        total: Number(countResult[0].count),
        page,
        pageSize,
      };
    }),

  getById: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [customer] = await ctx.db
        .select()
        .from(customers)
        .where(
          and(
            eq(customers.id, input.id),
            eq(customers.tenantId, ctx.tenantId)
          )
        )
        .limit(1);

      return customer ?? null;
    }),

  create: adminProcedure
    .input(createCustomerSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const [customer] = await ctx.db
          .insert(customers)
          .values({
            tenantId: ctx.tenantId,
            businessName: input.businessName,
            contactName: input.contactName,
            contactEmail: input.contactEmail || null,
            contactPhone: input.contactPhone,
            billingAddress: input.billingAddress,
            billingEmail: input.billingEmail || null,
            notes: input.notes,
          })
          .returning();

        return customer;
      } catch (err) {
        throwFriendlyPgError(err, "customer");
      }
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateCustomerSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const [customer] = await ctx.db
          .update(customers)
          .set({
            ...input.data,
            contactEmail: input.data.contactEmail || null,
            billingEmail: input.data.billingEmail || null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(customers.id, input.id),
              eq(customers.tenantId, ctx.tenantId)
            )
          )
          .returning();

        return customer;
      } catch (err) {
        throwFriendlyPgError(err, "customer");
      }
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [customer] = await ctx.db
        .update(customers)
        .set({ isActive: false, updatedAt: new Date() })
        .where(
          and(
            eq(customers.id, input.id),
            eq(customers.tenantId, ctx.tenantId)
          )
        )
        .returning();

      return customer;
    }),
});
