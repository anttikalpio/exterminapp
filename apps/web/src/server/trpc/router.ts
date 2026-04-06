import { router } from "./trpc";
import { customerRouter } from "./routers/customer";
import { employeeRouter } from "./routers/employee";
import { dashboardRouter } from "./routers/dashboard";
import { siteRouter } from "./routers/site";
import { trapRouter } from "./routers/trap";

export const appRouter = router({
  customer: customerRouter,
  employee: employeeRouter,
  dashboard: dashboardRouter,
  site: siteRouter,
  trap: trapRouter,
});

export type AppRouter = typeof appRouter;
