import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { hash } from "bcryptjs";
import { tenants, users, customers } from "./schema";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://dev:dev@localhost:5432/exterminapp";

async function seed() {
  const client = postgres(DATABASE_URL);
  const db = drizzle(client);

  console.log("Seeding database...");

  // Create default tenant
  const [tenant] = await db
    .insert(tenants)
    .values({
      name: "Default",
      slug: "default",
      settings: {},
    })
    .onConflictDoNothing()
    .returning();

  const tenantId = tenant?.id;
  if (!tenantId) {
    console.log("Tenant already exists, skipping seed.");
    await client.end();
    return;
  }

  // Create admin user
  const adminPasswordHash = await hash("admin123", 12);
  await db.insert(users).values({
    tenantId,
    email: "admin@exterminapp.com",
    passwordHash: adminPasswordHash,
    firstName: "Admin",
    lastName: "User",
    role: "admin",
    phone: "+358 40 1234567",
  });

  // Create field technician
  const techPasswordHash = await hash("tech1234", 12);
  await db.insert(users).values({
    tenantId,
    email: "tech@exterminapp.com",
    passwordHash: techPasswordHash,
    firstName: "Matti",
    lastName: "Meikäläinen",
    role: "field_technician",
    phone: "+358 50 7654321",
  });

  // Create sample customers
  await db.insert(customers).values([
    {
      tenantId,
      businessName: "Ravintola Helsinki Oy",
      contactName: "Anna Virtanen",
      contactEmail: "anna@ravintolahelsinki.fi",
      contactPhone: "+358 9 1234567",
      billingAddress: "Mannerheimintie 10, 00100 Helsinki",
      billingEmail: "laskut@ravintolahelsinki.fi",
    },
    {
      tenantId,
      businessName: "K-Market Kallio",
      contactName: "Pekka Korhonen",
      contactEmail: "pekka@k-market-kallio.fi",
      contactPhone: "+358 9 2345678",
      billingAddress: "Hämeentie 25, 00530 Helsinki",
    },
    {
      tenantId,
      businessName: "Hotelli Tampere",
      contactName: "Liisa Mäkinen",
      contactEmail: "liisa@hotellitampere.fi",
      contactPhone: "+358 3 3456789",
      billingAddress: "Hämeenkatu 15, 33100 Tampere",
      billingEmail: "billing@hotellitampere.fi",
    },
  ]);

  console.log("Seed complete!");
  console.log("Admin login: admin@exterminapp.com / admin123");
  console.log("Tech login:  tech@exterminapp.com / tech1234");

  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
