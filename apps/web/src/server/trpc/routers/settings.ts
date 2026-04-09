import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, adminProcedure } from "../trpc";
import { throwFriendlyPgError } from "../pg-errors";
import { tenants, users } from "../../../../drizzle/schema";

export const settingsRouter = router({
  getCompany: adminProcedure.query(async ({ ctx }) => {
    const [tenant] = await ctx.db
      .select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
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

  // List every tenant in the system. Used by the settings page so an admin
  // can see what their session's tenantId points at and switch to a different
  // tenant if their session has gone stale (e.g. after a DB reset).
  listTenants: adminProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
      })
      .from(tenants)
      .orderBy(tenants.name);

    return rows;
  }),

  // Move the current admin user to a different tenant. After this succeeds
  // the client should sign the user out so they obtain a fresh JWT pointing
  // at the new tenantId.
  switchTenant: adminProcedure
    .input(z.object({ tenantId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verify the target tenant actually exists.
      const [target] = await ctx.db
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.id, input.tenantId))
        .limit(1);

      if (!target) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Target tenant does not exist",
        });
      }

      try {
        const [updated] = await ctx.db
          .update(users)
          .set({ tenantId: input.tenantId, updatedAt: new Date() })
          .where(eq(users.id, ctx.session.user.id))
          .returning({ id: users.id, tenantId: users.tenantId });

        if (!updated) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message:
              "Your user account no longer exists. Please sign out and sign back in.",
          });
        }

        return updated;
      } catch (err) {
        throwFriendlyPgError(err, "user");
      }
    }),

  updateCompany: adminProcedure
    .input(
      z.object({
        companyName: z.string().max(255).optional(),
        address: z.string().optional(),
        vatNumber: z.string().max(50).optional(),
        contactEmail: z.string().email().max(255).optional().or(z.literal("")),
        contactPhone: z.string().max(30).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [tenant] = await ctx.db
        .update(tenants)
        .set({
          companyName: input.companyName || null,
          address: input.address || null,
          vatNumber: input.vatNumber || null,
          contactEmail: input.contactEmail || null,
          contactPhone: input.contactPhone || null,
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, ctx.tenantId))
        .returning();

      return tenant;
    }),

  // Called after logo upload to store the path
  setLogoPath: adminProcedure
    .input(z.object({ logoPath: z.string().max(500) }))
    .mutation(async ({ ctx, input }) => {
      const [tenant] = await ctx.db
        .update(tenants)
        .set({
          logoPath: input.logoPath,
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, ctx.tenantId))
        .returning();

      return tenant;
    }),

  removeLogo: adminProcedure.mutation(async ({ ctx }) => {
    const [tenant] = await ctx.db
      .update(tenants)
      .set({
        logoPath: null,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, ctx.tenantId))
      .returning();

    return tenant;
  }),

  // Public endpoint for getting logo (used by sidebar)
  getLogo: adminProcedure.query(async ({ ctx }) => {
    const [tenant] = await ctx.db
      .select({ logoPath: tenants.logoPath, companyName: tenants.companyName })
      .from(tenants)
      .where(eq(tenants.id, ctx.tenantId))
      .limit(1);

    return tenant ?? null;
  }),
});
