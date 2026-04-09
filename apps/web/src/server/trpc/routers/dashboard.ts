import { eq, and, sql } from "drizzle-orm";
import { router, authedProcedure } from "../trpc";
import {
  customers,
  users,
  sites,
  workOrders,
  traps,
} from "../../../../drizzle/schema";

export const dashboardRouter = router({
  stats: authedProcedure.query(async ({ ctx }) => {
    const [
      customerCount,
      employeeCount,
      siteCount,
      workOrderCount,
      trapCount,
    ] = await Promise.all([
      ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(customers)
        .where(
          and(
            eq(customers.tenantId, ctx.tenantId),
            eq(customers.isActive, true)
          )
        ),
      ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(
          and(
            eq(users.tenantId, ctx.tenantId),
            eq(users.isActive, true)
          )
        ),
      ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(sites)
        .where(
          and(
            eq(sites.tenantId, ctx.tenantId),
            eq(sites.isActive, true)
          )
        ),
      ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(workOrders)
        .where(
          and(
            eq(workOrders.tenantId, ctx.tenantId),
            eq(workOrders.isActive, true)
          )
        ),
      ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(traps)
        .where(eq(traps.tenantId, ctx.tenantId)),
    ]);

    return {
      customers: Number(customerCount[0].count),
      employees: Number(employeeCount[0].count),
      sites: Number(siteCount[0].count),
      workOrders: Number(workOrderCount[0].count),
      traps: Number(trapCount[0].count),
    };
  }),
});
