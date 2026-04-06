import { router } from "./trpc";
import { customerRouter } from "./routers/customer";
import { employeeRouter } from "./routers/employee";
import { dashboardRouter } from "./routers/dashboard";

export const appRouter = router({
  customer: customerRouter,
  employee: employeeRouter,
  dashboard: dashboardRouter,
});

export type AppRouter = typeof appRouter;
