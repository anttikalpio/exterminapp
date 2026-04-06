import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import { router, authedProcedure } from "../trpc";
import { traps, sites, users, poisonAdditions } from "../../../../drizzle/schema";

export const trapRouter = router({
  listBySite: authedProcedure
    .input(z.object({ siteId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: traps.id,
          label: traps.label,
          latitude: traps.latitude,
          longitude: traps.longitude,
          trapType: traps.trapType,
          status: traps.status,
          installedAt: traps.installedAt,
          notes: traps.notes,
        })
        .from(traps)
        .where(
          and(
            eq(traps.siteId, input.siteId),
            eq(traps.tenantId, ctx.tenantId)
          )
        )
        .orderBy(traps.label);
    }),

  getById: authedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [trap] = await ctx.db
        .select({
          id: traps.id,
          siteId: traps.siteId,
          siteName: sites.name,
          label: traps.label,
          latitude: traps.latitude,
          longitude: traps.longitude,
          trapType: traps.trapType,
          status: traps.status,
          installedAt: traps.installedAt,
          installedBy: traps.installedBy,
          notes: traps.notes,
          createdAt: traps.createdAt,
        })
        .from(traps)
        .innerJoin(sites, eq(traps.siteId, sites.id))
        .where(
          and(eq(traps.id, input.id), eq(traps.tenantId, ctx.tenantId))
        )
        .limit(1);

      return trap ?? null;
    }),

  create: authedProcedure
    .input(
      z.object({
        siteId: z.string().uuid(),
        label: z.string().min(1).max(50),
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        trapType: z.string().min(1).max(50).default("bait_station"),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [trap] = await ctx.db
        .insert(traps)
        .values({
          tenantId: ctx.tenantId,
          siteId: input.siteId,
          label: input.label,
          latitude: input.latitude.toString(),
          longitude: input.longitude.toString(),
          trapType: input.trapType,
          installedBy: ctx.user.id,
          notes: input.notes,
        })
        .returning();

      return trap;
    }),

  update: authedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: z.object({
          label: z.string().min(1).max(50).optional(),
          latitude: z.number().min(-90).max(90).optional(),
          longitude: z.number().min(-180).max(180).optional(),
          trapType: z.string().min(1).max(50).optional(),
          status: z.enum(["active", "inactive", "damaged", "removed"]).optional(),
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
        updateData.latitude = input.data.latitude.toString();
      }
      if (input.data.longitude !== undefined) {
        updateData.longitude = input.data.longitude.toString();
      }

      const [trap] = await ctx.db
        .update(traps)
        .set(updateData)
        .where(
          and(eq(traps.id, input.id), eq(traps.tenantId, ctx.tenantId))
        )
        .returning();

      return trap;
    }),

  // Poison addition history for a trap
  poisonHistory: authedProcedure
    .input(
      z.object({
        trapId: z.string().uuid(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const { trapId, page, pageSize } = input;
      const offset = (page - 1) * pageSize;

      const [items, countResult] = await Promise.all([
        ctx.db
          .select({
            id: poisonAdditions.id,
            poisonType: poisonAdditions.poisonType,
            remainingGrams: poisonAdditions.remainingGrams,
            quantityGrams: poisonAdditions.quantityGrams,
            notes: poisonAdditions.notes,
            performedAt: poisonAdditions.performedAt,
            performedByName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
          })
          .from(poisonAdditions)
          .innerJoin(users, eq(poisonAdditions.performedBy, users.id))
          .where(
            and(
              eq(poisonAdditions.trapId, trapId),
              eq(poisonAdditions.tenantId, ctx.tenantId)
            )
          )
          .orderBy(sql`${poisonAdditions.performedAt} DESC`)
          .limit(pageSize)
          .offset(offset),
        ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(poisonAdditions)
          .where(
            and(
              eq(poisonAdditions.trapId, trapId),
              eq(poisonAdditions.tenantId, ctx.tenantId)
            )
          ),
      ]);

      return { items, total: Number(countResult[0].count), page, pageSize };
    }),

  // Get the most recent poison addition for a trap (for default remaining calc)
  lastPoisonAddition: authedProcedure
    .input(z.object({ trapId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [last] = await ctx.db
        .select({
          remainingGrams: poisonAdditions.remainingGrams,
          quantityGrams: poisonAdditions.quantityGrams,
          poisonType: poisonAdditions.poisonType,
          performedAt: poisonAdditions.performedAt,
        })
        .from(poisonAdditions)
        .where(
          and(
            eq(poisonAdditions.trapId, input.trapId),
            eq(poisonAdditions.tenantId, ctx.tenantId)
          )
        )
        .orderBy(sql`${poisonAdditions.performedAt} DESC`)
        .limit(1);

      return last ?? null;
    }),

  addPoison: authedProcedure
    .input(
      z.object({
        trapId: z.string().uuid(),
        poisonType: z.string().min(1).max(100),
        remainingGrams: z.number().min(0),
        quantityGrams: z.number().positive(),
        notes: z.string().optional(),
        recordedLatitude: z.number().min(-90).max(90).optional(),
        recordedLongitude: z.number().min(-180).max(180).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [addition] = await ctx.db
        .insert(poisonAdditions)
        .values({
          tenantId: ctx.tenantId,
          trapId: input.trapId,
          performedBy: ctx.user.id,
          poisonType: input.poisonType,
          remainingGrams: input.remainingGrams.toString(),
          quantityGrams: input.quantityGrams.toString(),
          notes: input.notes,
          recordedLatitude: input.recordedLatitude?.toString(),
          recordedLongitude: input.recordedLongitude?.toString(),
        })
        .returning();

      return addition;
    }),
});
