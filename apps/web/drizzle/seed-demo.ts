import { runDemoSeed } from "./seed-demo-runner";

async function main() {
  const summary = await runDemoSeed();

  console.log("");
  console.log("═══════════════════════════════════════════════");
  console.log("✅ Demo seed complete!");
  console.log("═══════════════════════════════════════════════");
  console.log(`  Customers:         ${summary.customers}`);
  console.log(`  Sites:             ${summary.sites}`);
  console.log(`  Work orders:       ${summary.workOrders}`);
  console.log(`  Traps:             ${summary.traps}`);
  console.log(`  Visits:            ${summary.visits}`);
  console.log(`  Poison additions:  ${summary.poisonAdditions}`);
  console.log("");
  console.log("  Admin login:  admin@exterminapp.com / admin123");
  console.log("  Tech logins:  tech@exterminapp.com  / tech1234");
  console.log("                tech2@exterminapp.com / tech1234");
  console.log("═══════════════════════════════════════════════");
}

main().catch((err) => {
  console.error("Demo seed failed:", err);
  process.exit(1);
});
