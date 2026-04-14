import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { hash } from "bcryptjs";
import { sql } from "drizzle-orm";
import {
  tenants,
  users,
  customers,
  sites,
  workOrders,
  workOrderAssignments,
  traps,
  visits,
  poisonAdditions,
  reports,
} from "./schema";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://dev:dev@localhost:5432/exterminapp";

// Deterministic IDs — same across runs so existing sessions keep working.
const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const ADMIN_ID = "00000000-0000-0000-0000-000000000002";
const TECH_ID = "00000000-0000-0000-0000-000000000003";
const TECH2_ID = "00000000-0000-0000-0000-000000000004";

// ── Helsinki-area demo data ──────────────────────────────────

type SiteSpec = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  // Each work order at this site: title + number of traps (1-5).
  workOrders: Array<{
    title: string;
    number: string;
    trapCount: number;
    description?: string;
  }>;
};

type CustomerSpec = {
  businessName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  billingStreet: string;
  billingZip: string;
  billingCity: string;
  preferredLanguage: "en" | "fi";
  sites: SiteSpec[];
};

const DEMO_CUSTOMERS: CustomerSpec[] = [
  {
    businessName: "Ravintola Kampin Helmi Oy",
    contactName: "Anna Virtanen",
    contactEmail: "anna@kampinhelmi.fi",
    contactPhone: "+358 9 1234567",
    billingStreet: "Urho Kekkosen katu 1",
    billingZip: "00100",
    billingCity: "Helsinki",
    preferredLanguage: "fi",
    sites: [
      {
        name: "Kampin ravintola",
        address: "Urho Kekkosen katu 1, 00100 Helsinki",
        lat: 60.1688,
        lng: 24.9319,
        workOrders: [
          {
            title: "Rottien torjunta keittiössä",
            number: "WO-2025-001",
            trapCount: 4,
            description: "Bait stations in kitchen and back areas.",
          },
        ],
      },
    ],
  },
  {
    businessName: "K-Market Kallio",
    contactName: "Pekka Korhonen",
    contactEmail: "pekka@k-market-kallio.fi",
    contactPhone: "+358 9 2345678",
    billingStreet: "Hämeentie 25",
    billingZip: "00530",
    billingCity: "Helsinki",
    preferredLanguage: "fi",
    sites: [
      {
        name: "K-Market Kallio myymälä",
        address: "Hämeentie 25, 00530 Helsinki",
        lat: 60.1847,
        lng: 24.9512,
        workOrders: [
          {
            title: "Jyrsijätorjunta varastossa",
            number: "WO-2025-002",
            trapCount: 3,
          },
          {
            title: "Torakkaohjelma",
            number: "WO-2025-003",
            trapCount: 2,
          },
        ],
      },
    ],
  },
  {
    businessName: "Hotelli Pasila",
    contactName: "Liisa Mäkinen",
    contactEmail: "liisa@hotellipasila.fi",
    contactPhone: "+358 9 3456789",
    billingStreet: "Pasilankatu 12",
    billingZip: "00240",
    billingCity: "Helsinki",
    preferredLanguage: "en",
    sites: [
      {
        name: "Hotelli Pasila pääkiinteistö",
        address: "Pasilankatu 12, 00240 Helsinki",
        lat: 60.1987,
        lng: 24.9339,
        workOrders: [
          {
            title: "Rodent control — basement and garbage areas",
            number: "WO-2025-004",
            trapCount: 5,
          },
        ],
      },
      {
        name: "Hotelli Pasila ravintola",
        address: "Pasilankatu 14, 00240 Helsinki",
        lat: 60.1992,
        lng: 24.9345,
        workOrders: [
          {
            title: "Pest prevention — restaurant kitchen",
            number: "WO-2025-005",
            trapCount: 3,
          },
        ],
      },
    ],
  },
  {
    businessName: "Varasto Vuosaari Oy",
    contactName: "Jari Nieminen",
    contactEmail: "jari@varastovuosaari.fi",
    contactPhone: "+358 9 4567890",
    billingStreet: "Vuosaarentie 100",
    billingZip: "00980",
    billingCity: "Helsinki",
    preferredLanguage: "fi",
    sites: [
      {
        name: "Logistiikkavarasto",
        address: "Vuosaarentie 100, 00980 Helsinki",
        lat: 60.2095,
        lng: 25.1442,
        workOrders: [
          {
            title: "Rottien ja hiirten torjunta",
            number: "WO-2025-006",
            trapCount: 5,
          },
        ],
      },
    ],
  },
  {
    businessName: "Kauppakeskus Itäkeskus",
    contactName: "Riikka Salminen",
    contactEmail: "riikka@itakeskus-kk.fi",
    contactPhone: "+358 9 5678901",
    billingStreet: "Itäkatu 1-7",
    billingZip: "00930",
    billingCity: "Helsinki",
    preferredLanguage: "fi",
    sites: [
      {
        name: "Kauppakeskus pääkiinteistö",
        address: "Itäkatu 1-7, 00930 Helsinki",
        lat: 60.2116,
        lng: 25.0782,
        workOrders: [
          {
            title: "Jyrsijöiden torjunta ruokapaikat",
            number: "WO-2025-007",
            trapCount: 4,
          },
        ],
      },
    ],
  },
];

// ── Helpers ──────────────────────────────────────────────────

function offsetCoord(base: number, meters: number): number {
  // Rough conversion: 1 degree latitude ≈ 111,320 m; longitude varies, but at
  // Helsinki latitude we use a close approximation for jitter.
  return base + meters / 111320;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// Simulated declining poison consumption:
// - First visit after install: full replenishment (~40g per trap)
// - Subsequent visits: less consumption each time
const CONSUMPTION_CURVE = [40, 28, 18, 10, 6];

// ── Main ─────────────────────────────────────────────────────

async function seedDemo() {
  const client = postgres(DATABASE_URL);
  const db = drizzle(client);

  console.log("Wiping existing data...");

  // Delete in dependency order
  await db.execute(sql`TRUNCATE TABLE ${poisonAdditions} CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ${visits} CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ${traps} CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ${workOrderAssignments} CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ${reports} CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ${workOrders} CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ${sites} CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ${customers} CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ${users} CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ${tenants} CASCADE`);

  console.log("Creating tenant and users...");

  await db.insert(tenants).values({
    id: TENANT_ID,
    name: "ExterminApp Demo",
    slug: "default",
    companyName: "ExterminApp Demo Oy",
    address: "Demokatu 1, 00100 Helsinki",
    vatNumber: "FI12345678",
    contactEmail: "info@exterminapp.demo",
    contactPhone: "+358 10 1234567",
    settings: {},
  });

  const adminHash = await hash("admin123", 12);
  const techHash = await hash("tech1234", 12);

  await db.insert(users).values([
    {
      id: ADMIN_ID,
      tenantId: TENANT_ID,
      email: "admin@exterminapp.com",
      passwordHash: adminHash,
      firstName: "Admin",
      lastName: "User",
      role: "admin",
      phone: "+358 40 1234567",
    },
    {
      id: TECH_ID,
      tenantId: TENANT_ID,
      email: "tech@exterminapp.com",
      passwordHash: techHash,
      firstName: "Matti",
      lastName: "Meikäläinen",
      role: "field_technician",
      phone: "+358 50 7654321",
    },
    {
      id: TECH2_ID,
      tenantId: TENANT_ID,
      email: "tech2@exterminapp.com",
      passwordHash: techHash,
      firstName: "Sanna",
      lastName: "Virtanen",
      role: "field_technician",
      phone: "+358 50 1122334",
    },
  ]);

  const POISON_TYPES = ["brodifacoum", "bromadiolone", "difenacoum"];

  let customerNumber = 1001;
  let totalSites = 0;
  let totalWorkOrders = 0;
  let totalTraps = 0;
  let totalVisits = 0;
  let totalPoisonAdditions = 0;

  for (const cust of DEMO_CUSTOMERS) {
    console.log(`Creating customer: ${cust.businessName}`);

    const [customer] = await db
      .insert(customers)
      .values({
        tenantId: TENANT_ID,
        customerNumber: String(customerNumber++),
        businessName: cust.businessName,
        contactName: cust.contactName,
        contactEmail: cust.contactEmail,
        contactPhone: cust.contactPhone,
        billingStreetAddress: cust.billingStreet,
        billingZipCode: cust.billingZip,
        billingCity: cust.billingCity,
        preferredLanguage: cust.preferredLanguage,
      })
      .returning();

    for (const siteSpec of cust.sites) {
      const [site] = await db
        .insert(sites)
        .values({
          tenantId: TENANT_ID,
          customerId: customer.id,
          name: siteSpec.name,
          address: siteSpec.address,
          latitude: siteSpec.lat.toFixed(7),
          longitude: siteSpec.lng.toFixed(7),
          serviceRadiusMeters: 200,
        })
        .returning();
      totalSites++;

      for (const woSpec of siteSpec.workOrders) {
        // Work order started 90 days ago
        const startDate = daysAgo(90).toISOString().slice(0, 10);

        const [wo] = await db
          .insert(workOrders)
          .values({
            tenantId: TENANT_ID,
            customerId: customer.id,
            siteId: site.id,
            workOrderNumber: woSpec.number,
            title: woSpec.title,
            description: woSpec.description ?? null,
            status: "active",
            startDate,
          })
          .returning();
        totalWorkOrders++;

        // Assign both technicians to some work orders for variety
        await db.insert(workOrderAssignments).values({
          tenantId: TENANT_ID,
          workOrderId: wo.id,
          userId: TECH_ID,
        });
        if (woSpec.trapCount >= 4) {
          await db.insert(workOrderAssignments).values({
            tenantId: TENANT_ID,
            workOrderId: wo.id,
            userId: TECH2_ID,
          });
        }

        // Create traps scattered around the site
        const createdTraps: Array<{ id: string; label: string }> = [];
        for (let i = 0; i < woSpec.trapCount; i++) {
          const angle = (i / woSpec.trapCount) * 2 * Math.PI;
          const distance = 30 + ((i * 7) % 40); // 30-70 m jitter
          const dLat = (Math.sin(angle) * distance) / 111320;
          const dLng =
            (Math.cos(angle) * distance) /
            (111320 * Math.cos((siteSpec.lat * Math.PI) / 180));

          const label = `T${String(i + 1).padStart(2, "0")}`;
          const [trap] = await db
            .insert(traps)
            .values({
              tenantId: TENANT_ID,
              workOrderId: wo.id,
              label,
              latitude: offsetCoord(siteSpec.lat, 0).toFixed(7) + "",
              longitude: offsetCoord(siteSpec.lng, 0).toFixed(7) + "",
              trapType: i === 0 ? "snap_trap" : "bait_station",
              status: i === woSpec.trapCount - 1 && woSpec.trapCount > 3 ? "damaged" : "active",
              installedBy: TECH_ID,
            })
            .returning();
          // Patch coordinates with the computed offset (we did it wrong above)
          await db
            .update(traps)
            .set({
              latitude: (siteSpec.lat + dLat).toFixed(7),
              longitude: (siteSpec.lng + dLng).toFixed(7),
            })
            .where(sql`${traps.id} = ${trap.id}`);

          createdTraps.push({ id: trap.id, label });
          totalTraps++;
        }

        // Create 4 visits at ~3-week intervals (days 75, 54, 33, 12 ago)
        const visitDays = [75, 54, 33, 12];
        for (let v = 0; v < visitDays.length; v++) {
          const visitedAt = daysAgo(visitDays[v]);
          const performingTech = v % 2 === 0 ? TECH_ID : TECH2_ID;

          const visitName =
            cust.preferredLanguage === "fi"
              ? `Käynti ${v + 1}`
              : `Visit ${v + 1}`;

          const [visit] = await db
            .insert(visits)
            .values({
              tenantId: TENANT_ID,
              workOrderId: wo.id,
              name: visitName,
              visitedAt,
              createdBy: performingTech,
              notes:
                v === 0
                  ? "Initial setup and baiting."
                  : v === visitDays.length - 1
                    ? "Minor consumption observed. Activity declining."
                    : null,
            })
            .returning();
          totalVisits++;

          // Add poison to each trap at this visit (skipping first visit for
          // snap traps to show variety)
          const poisonType = POISON_TYPES[v % POISON_TYPES.length];
          const baseConsumption = CONSUMPTION_CURVE[v] ?? 4;
          let runningRemaining = 100; // Each bait station starts with 100g slot

          for (const t of createdTraps) {
            // Skip snap traps for poison additions
            if (t.label === "T01") continue;

            // Slight per-trap variation so totals look realistic
            const qty = baseConsumption + ((parseInt(t.id.slice(0, 2), 16) % 5) - 2);
            const actualQty = Math.max(1, qty);
            runningRemaining = Math.max(
              0,
              runningRemaining - baseConsumption + actualQty
            );

            await db.insert(poisonAdditions).values({
              tenantId: TENANT_ID,
              visitId: visit.id,
              trapId: t.id,
              performedBy: performingTech,
              poisonType,
              remainingGrams: String(runningRemaining),
              quantityGrams: String(actualQty),
              notes:
                v === visitDays.length - 1 && Math.random() < 0.3
                  ? "Low consumption — rodent activity decreasing."
                  : null,
              performedAt: visitedAt,
            });
            totalPoisonAdditions++;
          }
        }
      }
    }
  }

  console.log("");
  console.log("═══════════════════════════════════════════════");
  console.log("✅ Demo seed complete!");
  console.log("═══════════════════════════════════════════════");
  console.log(`  Customers:         ${DEMO_CUSTOMERS.length}`);
  console.log(`  Sites:             ${totalSites}`);
  console.log(`  Work orders:       ${totalWorkOrders}`);
  console.log(`  Traps:             ${totalTraps}`);
  console.log(`  Visits:            ${totalVisits}`);
  console.log(`  Poison additions:  ${totalPoisonAdditions}`);
  console.log("");
  console.log("  Admin login:  admin@exterminapp.com / admin123");
  console.log("  Tech logins:  tech@exterminapp.com  / tech1234");
  console.log("                tech2@exterminapp.com / tech1234");
  console.log("═══════════════════════════════════════════════");

  await client.end();
}

seedDemo().catch((err) => {
  console.error("Demo seed failed:", err);
  process.exit(1);
});
