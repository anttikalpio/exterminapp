import { z } from "zod";
import { eq, and, sql, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, authedProcedure } from "../trpc";
import { throwFriendlyPgError } from "../pg-errors";
import {
  visits,
  sites,
  traps,
  users,
  poisonAdditions,
} from "../../../../drizzle/schema";
import {
  createVisitSchema,
  updateVisitSchema,
  addVisitPoisonSchema,
} from "@exterminapp/shared";

/**
 * ISO 8601 week number. Matches `date-fns/getISOWeek` semantics: weeks run
 * Monday to Sunday and week 1 is the week containing the first Thursday of
 * the year. Implemented inline to avoid pulling in a new dependency.
 */
function getIsoWeek(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  // Thursday of the current week determines the ISO week year.
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export const visitRouter = router({
  // List visits for a given site, newest first.
  listBySite: authedProcedure
    .input(z.object({ siteId: z.string().uuid() }))
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
            eq(visits.siteId, input.siteId),
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
          siteId: visits.siteId,
          siteName: sites.name,
          name: visits.name,
          visitedAt: visits.visitedAt,
          notes: visits.notes,
          createdAt: visits.createdAt,
          updatedAt: visits.updatedAt,
          createdByName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
        })
        .from(visits)
        .innerJoin(sites, eq(visits.siteId, sites.id))
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
      // Verify the site belongs to the caller's tenant.
      const [site] = await ctx.db
        .select({ id: sites.id })
        .from(sites)
        .where(
          and(eq(sites.id, input.siteId), eq(sites.tenantId, ctx.tenantId))
        )
        .limit(1);

      if (!site) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Site not found" });
      }

      const visitedAt = input.visitedAt ?? new Date();
      const defaultName = `Visit ${getIsoWeek(visitedAt)}`;

      try {
        const [visit] = await ctx.db
          .insert(visits)
          .values({
            tenantId: ctx.tenantId,
            siteId: input.siteId,
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
      // Verify the visit exists in this tenant and get its site.
      const [visit] = await ctx.db
        .select({ id: visits.id, siteId: visits.siteId })
        .from(visits)
        .where(
          and(eq(visits.id, input.visitId), eq(visits.tenantId, ctx.tenantId))
        )
        .limit(1);

      if (!visit) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Visit not found" });
      }

      // Verify the trap is at the same site so you can't smuggle a trap from
      // another site into this visit's audit log.
      const [trap] = await ctx.db
        .select({ id: traps.id, siteId: traps.siteId })
        .from(traps)
        .where(
          and(eq(traps.id, input.trapId), eq(traps.tenantId, ctx.tenantId))
        )
        .limit(1);

      if (!trap || trap.siteId !== visit.siteId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Trap does not belong to this visit's site",
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

  // Expose the ISO week number helper so the client can display the default
  // name for a given date without duplicating the calculation.
  defaultNameFor: authedProcedure
    .input(z.object({ visitedAt: z.coerce.date() }))
    .query(({ input }) => {
      return { name: `Visit ${getIsoWeek(input.visitedAt)}` };
    }),
});
