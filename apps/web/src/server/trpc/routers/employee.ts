import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import { hash } from "bcryptjs";
import { router, adminProcedure } from "../trpc";
import { users } from "../../../../drizzle/schema";
import {
  createEmployeeSchema,
  updateEmployeeSchema,
} from "@exterminapp/shared";

export const employeeRouter = router({
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

      const conditions = [eq(users.tenantId, ctx.tenantId)];

      const [items, countResult] = await Promise.all([
        ctx.db
          .select({
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
            role: users.role,
            phone: users.phone,
            isActive: users.isActive,
            createdAt: users.createdAt,
          })
          .from(users)
          .where(and(...conditions))
          .orderBy(users.lastName, users.firstName)
          .limit(pageSize)
          .offset(offset),
        ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(users)
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
      const [employee] = await ctx.db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
          phone: users.phone,
          isActive: users.isActive,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(
          and(eq(users.id, input.id), eq(users.tenantId, ctx.tenantId))
        )
        .limit(1);

      return employee ?? null;
    }),

  create: adminProcedure
    .input(createEmployeeSchema)
    .mutation(async ({ ctx, input }) => {
      const passwordHash = await hash(input.password, 12);

      const [employee] = await ctx.db
        .insert(users)
        .values({
          tenantId: ctx.tenantId,
          email: input.email,
          passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
          role: input.role,
          phone: input.phone,
        })
        .returning({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
          phone: users.phone,
          isActive: users.isActive,
        });

      return employee;
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateEmployeeSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [employee] = await ctx.db
        .update(users)
        .set({
          ...input.data,
          updatedAt: new Date(),
        })
        .where(
          and(eq(users.id, input.id), eq(users.tenantId, ctx.tenantId))
        )
        .returning({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
          phone: users.phone,
          isActive: users.isActive,
        });

      return employee;
    }),

  deactivate: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [employee] = await ctx.db
        .update(users)
        .set({ isActive: false, updatedAt: new Date() })
        .where(
          and(eq(users.id, input.id), eq(users.tenantId, ctx.tenantId))
        )
        .returning({
          id: users.id,
          isActive: users.isActive,
        });

      return employee;
    }),
});
