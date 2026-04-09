import { z } from "zod";
import { eq, and, sql, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, authedProcedure } from "../trpc";
import { throwFriendlyPgError } from "../pg-errors";
import {
  visits,
  workOrders,
  sites,
  customers,
  traps,
  users,
  poisonAdditions,
} from "../../../../drizzle/schema";
import {
  createVisitSchema,
  updateVisitSchema,
  addVisitPoisonSchema,
} from "@exterminapp/shared";

// Localized label used as the prefix for the default visit name.
// Kept inline rather than round-tripping through next-intl since this
// runs on the server during mutations, not inside a React tree.
const VISIT_LABEL: Record<string, string> = {
  en: "Visit",
  fi: "Käynti",
};

export const visitRouter = router({
  // List visits for a given work order, newest first.
  listByWorkOrder: authedProcedure
    .input(z.object({ workOrderId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: visits.id,
          name: visits.name,
          visitedAt: visits.visitedAt,
          notes: visits.notes,
          createdAt: visits.createdAt,
          createdByName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
          poisonCount: sql<number>`(
            SELECT COUNT(*)::int FROM ${poisonAdditions}
            WHERE ${poisonAdditions.visitId} = ${visits.id}
          )`,
        })
        .from(visits)
        .innerJoin(users, eq(visits.createdBy, users.id))
        .where(
          and(
            eq(visits.workOrderId, input.workOrderId),
            eq(visits.tenantId, ctx.tenantId)
          )
        )
        .orderBy(desc(visits.visitedAt));

      return rows;
    }),

  getById: authedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [visit] = await ctx.db
        .select({
          id: visits.id,
          workOrderId: visits.workOrderId,
          workOrderTitle: workOrders.title,
          workOrderNumber: workOrders.workOrderNumber,
          siteId: workOrders.siteId,
          siteName: sites.name,
          name: visits.name,
          visitedAt: visits.visitedAt,
          notes: visits.notes,
          createdAt: visits.createdAt,
          updatedAt: visits.updatedAt,
          createdByName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
        })
        .from(visits)
        .innerJoin(workOrders, eq(visits.workOrderId, workOrders.id))
        .innerJoin(sites, eq(workOrders.siteId, sites.id))
        .innerJoin(users, eq(visits.createdBy, users.id))
        .where(
          and(eq(visits.id, input.id), eq(visits.tenantId, ctx.tenantId))
        )
        .limit(1);

      return visit ?? null;
    }),

  create: authedProcedure
    .input(createVisitSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify the work order belongs to the caller's tenant and pull
      // the owning customer's preferred language in the same round-trip
      // so we can build a localized default visit name.
      const [wo] = await ctx.db
        .select({
          id: workOrders.id,
          customerLanguage: customers.preferredLanguage,
        })
        .from(workOrders)
        .innerJoin(customers, eq(workOrders.customerId, customers.id))
        .where(
          and(
            eq(workOrders.id, input.workOrderId),
            eq(workOrders.tenantId, ctx.tenantId)
          )
        )
        .limit(1);

      if (!wo) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Work order not found",
        });
      }

      // Default name: "{Visit/Käynti} {N}" where N is a running sequence
      // number of visits in this work order. Count-based — deleted visits
      // are not reused, so gaps may appear, which matches user expectations
      // for a display label.
      const [{ existingCount }] = await ctx.db
        .select({
          existingCount: sql<number>`COUNT(*)::int`,
        })
        .from(visits)
        .where(
          and(
            eq(visits.workOrderId, input.workOrderId),
            eq(visits.tenantId, ctx.tenantId)
          )
        );

      const sequence = Number(existingCount) + 1;
      const label = VISIT_LABEL[wo.customerLanguage] ?? VISIT_LABEL.en;
      const defaultName = `${label} ${sequence}`;

      const visitedAt = input.visitedAt ?? new Date();

      try {
        const [visit] = await ctx.db
          .insert(visits)
          .values({
            tenantId: ctx.tenantId,
            workOrderId: input.workOrderId,
            name: input.name?.trim() || defaultName,
            visitedAt,
            createdBy: ctx.user.id,
            notes: input.notes ?? null,
          })
          .returning();

        return visit;
      } catch (err) {
        throwFriendlyPgError(err, "visit");
      }
    }),

  update: authedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateVisitSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updatePayload: Record<string, unknown> = {
        updatedAt: new Date(),
      };
      if (input.data.name !== undefined) updatePayload.name = input.data.name;
      if (input.data.visitedAt !== undefined)
        updatePayload.visitedAt = input.data.visitedAt;
      if (input.data.notes !== undefined) updatePayload.notes = input.data.notes;

      try {
        const [visit] = await ctx.db
          .update(visits)
          .set(updatePayload)
          .where(
            and(eq(visits.id, input.id), eq(visits.tenantId, ctx.tenantId))
          )
          .returning();

        if (!visit) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Visit not found" });
        }

        return visit;
      } catch (err) {
        throwFriendlyPgError(err, "visit");
      }
    }),

  delete: authedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Cascade delete any poison additions tied to this visit so the FK
      // constraint doesn't block removal. This is intentional — deleting a
      // visit wipes its audit trail.
      await ctx.db
        .delete(poisonAdditions)
        .where(
          and(
            eq(poisonAdditions.visitId, input.id),
            eq(poisonAdditions.tenantId, ctx.tenantId)
          )
        );

      const [deleted] = await ctx.db
        .delete(visits)
        .where(
          and(eq(visits.id, input.id), eq(visits.tenantId, ctx.tenantId))
        )
        .returning({ id: visits.id });

      return deleted ?? null;
    }),

  // Poison additions recorded during a visit, grouped/ordered by trap label.
  poisonAdditions: authedProcedure
    .input(z.object({ visitId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: poisonAdditions.id,
          trapId: poisonAdditions.trapId,
          trapLabel: traps.label,
          poisonType: poisonAdditions.poisonType,
          remainingGrams: poisonAdditions.remainingGrams,
          quantityGrams: poisonAdditions.quantityGrams,
          notes: poisonAdditions.notes,
          performedAt: poisonAdditions.performedAt,
          performedByName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
        })
        .from(poisonAdditions)
        .innerJoin(traps, eq(poisonAdditions.trapId, traps.id))
        .innerJoin(users, eq(poisonAdditions.performedBy, users.id))
        .where(
          and(
            eq(poisonAdditions.visitId, input.visitId),
            eq(poisonAdditions.tenantId, ctx.tenantId)
          )
        )
        .orderBy(traps.label, desc(poisonAdditions.performedAt));
    }),

  addPoison: authedProcedure
    .input(addVisitPoisonSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify the visit exists in this tenant and get its work order.
      const [visit] = await ctx.db
        .select({ id: visits.id, workOrderId: visits.workOrderId })
        .from(visits)
        .where(
          and(eq(visits.id, input.visitId), eq(visits.tenantId, ctx.tenantId))
        )
        .limit(1);

      if (!visit) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Visit not found" });
      }

      // Verify the trap belongs to the same work order so you can't smuggle a
      // trap from another work order into this visit's audit log.
      const [trap] = await ctx.db
        .select({ id: traps.id, workOrderId: traps.workOrderId })
        .from(traps)
        .where(
          and(eq(traps.id, input.trapId), eq(traps.tenantId, ctx.tenantId))
        )
        .limit(1);

      if (!trap || trap.workOrderId !== visit.workOrderId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Trap does not belong to this visit's work order",
        });
      }

      try {
        const [addition] = await ctx.db
          .insert(poisonAdditions)
          .values({
            tenantId: ctx.tenantId,
            visitId: input.visitId,
            trapId: input.trapId,
            performedBy: ctx.user.id,
            poisonType: input.poisonType,
            quantityGrams: input.quantityGrams.toString(),
            remainingGrams: input.remainingGrams?.toString(),
            notes: input.notes,
            recordedLatitude: input.recordedLatitude?.toString(),
            recordedLongitude: input.recordedLongitude?.toString(),
          })
          .returning();

        return addition;
      } catch (err) {
        throwFriendlyPgError(err, "poison addition");
      }
    }),

  deletePoison: authedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(poisonAdditions)
        .where(
          and(
            eq(poisonAdditions.id, input.id),
            eq(poisonAdditions.tenantId, ctx.tenantId)
          )
        )
        .returning({ id: poisonAdditions.id });

      return deleted ?? null;
    }),
});
