import { router } from "./trpc";
import { customerRouter } from "./routers/customer";
import { employeeRouter } from "./routers/employee";
import { dashboardRouter } from "./routers/dashboard";
import { siteRouter } from "./routers/site";
import { trapRouter } from "./routers/trap";
import { settingsRouter } from "./routers/settings";

export const appRouter = router({
  customer: customerRouter,
  employee: employeeRouter,
  dashboard: dashboardRouter,
  site: siteRouter,
  trap: trapRouter,
  settings: settingsRouter,
});

export type AppRouter = typeof appRouter;
