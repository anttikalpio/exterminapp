import { router } from "./trpc";
import { customerRouter } from "./routers/customer";
import { employeeRouter } from "./routers/employee";
import { dashboardRouter } from "./routers/dashboard";
import { siteRouter } from "./routers/site";
import { trapRouter } from "./routers/trap";
import { visitRouter } from "./routers/visit";
import { settingsRouter } from "./routers/settings";
import { reportRouter } from "./routers/report";

export const appRouter = router({
  customer: customerRouter,
  employee: employeeRouter,
  dashboard: dashboardRouter,
  site: siteRouter,
  trap: trapRouter,
  visit: visitRouter,
  settings: settingsRouter,
  report: reportRouter,
});

export type AppRouter = typeof appRouter;
