import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, adminProcedure } from "../trpc";
import { tenants } from "../../../../drizzle/schema";

export const settingsRouter = router({
  getCompany: adminProcedure.query(async ({ ctx }) => {
    const [tenant] = await ctx.db
      .select({
        id: tenants.id,
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
