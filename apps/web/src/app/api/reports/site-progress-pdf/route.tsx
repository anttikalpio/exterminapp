import { NextRequest, NextResponse } from "next/server";
import { eq, and, sql, gte, lte, inArray } from "drizzle-orm";
import { renderToBuffer } from "@react-pdf/renderer";
import path from "path";
import { existsSync, readFileSync } from "fs";
import { auth } from "@/server/auth";
import { db } from "@/lib/db";
import {
  workOrders,
  workOrderAssignments,
  visits,
  sites,
  customers,
  traps,
  poisonAdditions,
  users,
  tenants,
} from "../../../../../drizzle/schema";
import { SiteProgressPdf } from "@/components/pdf/site-progress-pdf";
import { generateStaticMapImage } from "@/lib/static-map";
import type { PdfLocale } from "@/components/pdf/report-pdf";

export async function GET(req: NextRequest) {
  try {
    return await handlePdfRequest(req);
  } catch (err) {
    console.error("Site progress PDF generation failed:", err);
    const message =
      err instanceof Error ? err.message : "PDF generation failed";
    return new NextResponse(message, { status: 500 });
  }
}

async function handlePdfRequest(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;
  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get("siteId");
  const periodStart = searchParams.get("periodStart");
  const periodEnd = searchParams.get("periodEnd");
  const title = searchParams.get("title") || "Site Progress Report";
  const comments = searchParams.get("comments") || "";

  if (!siteId || !periodStart || !periodEnd) {
    return NextResponse.json(
      { error: "Missing required parameters: siteId, periodStart, periodEnd" },
      { status: 400 }
    );
  }

  // ── Fetch site + customer ────────────────────────────────────

  const [siteInfo] = await db
    .select({
      id: sites.id,
      name: sites.name,
      address: sites.address,
      latitude: sites.latitude,
      longitude: sites.longitude,
      customerName: customers.businessName,
      customerContact: customers.contactName,
      customerPhone: customers.contactPhone,
      customerEmail: customers.contactEmail,
      customerLanguage: customers.preferredLanguage,
    })
    .from(sites)
    .innerJoin(customers, eq(sites.customerId, customers.id))
    .where(and(eq(sites.id, siteId), eq(sites.tenantId, tenantId)))
    .limit(1);

  if (!siteInfo) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  // ── Active work orders at this site ──────────────────────────

  const siteWorkOrders = await db
    .select({
      id: workOrders.id,
      title: workOrders.title,
      workOrderNumber: workOrders.workOrderNumber,
      status: workOrders.status,
      startDate: workOrders.startDate,
      endDate: workOrders.endDate,
    })
    .from(workOrders)
    .where(
      and(
        eq(workOrders.siteId, siteId),
        eq(workOrders.tenantId, tenantId),
        eq(workOrders.isActive, true)
      )
    )
    .orderBy(workOrders.createdAt);

  const woIds = siteWorkOrders.map((wo) => wo.id);

  // ── Batch queries ────────────────────────────────────────────

  let allAssignments: Array<{
    workOrderId: string;
    firstName: string;
    lastName: string;
  }> = [];
  let allVisits: Array<{
    id: string;
    workOrderId: string;
    name: string;
    visitedAt: Date;
    createdByName: string;
  }> = [];
  let allTraps: Array<{
    id: string;
    workOrderId: string;
    label: string;
    latitude: string;
    longitude: string;
    trapType: string;
    status: string;
  }> = [];

  if (woIds.length > 0) {
    [allAssignments, allVisits, allTraps] = await Promise.all([
      db
        .select({
          workOrderId: workOrderAssignments.workOrderId,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(workOrderAssignments)
        .innerJoin(users, eq(workOrderAssignments.userId, users.id))
        .where(inArray(workOrderAssignments.workOrderId, woIds)),

      db
        .select({
          id: visits.id,
          workOrderId: visits.workOrderId,
          name: visits.name,
          visitedAt: visits.visitedAt,
          createdByName:
            sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
        })
        .from(visits)
        .innerJoin(users, eq(visits.createdBy, users.id))
        .where(
          and(
            eq(visits.tenantId, tenantId),
            inArray(visits.workOrderId, woIds),
            gte(visits.visitedAt, new Date(periodStart)),
            lte(visits.visitedAt, new Date(periodEnd + "T23:59:59.999Z"))
          )
        )
        .orderBy(visits.visitedAt),

      db
        .select({
          id: traps.id,
          workOrderId: traps.workOrderId,
          label: traps.label,
          latitude: traps.latitude,
          longitude: traps.longitude,
          trapType: traps.trapType,
          status: traps.status,
        })
        .from(traps)
        .where(
          and(eq(traps.tenantId, tenantId), inArray(traps.workOrderId, woIds))
        )
        .orderBy(traps.label),
    ]);
  }

  // Poison history
  const allTrapIds = allTraps.map((t) => t.id);
  let allPoisonHistory: Array<{
    id: string;
    trapId: string;
    trapLabel: string;
    poisonType: string;
    remainingGrams: string | null;
    quantityGrams: string;
    notes: string | null;
    performedAt: Date;
    performedByName: string;
  }> = [];

  if (allTrapIds.length > 0) {
    allPoisonHistory = await db
      .select({
        id: poisonAdditions.id,
        trapId: poisonAdditions.trapId,
        trapLabel: traps.label,
        poisonType: poisonAdditions.poisonType,
        remainingGrams: poisonAdditions.remainingGrams,
        quantityGrams: poisonAdditions.quantityGrams,
        notes: poisonAdditions.notes,
        performedAt: poisonAdditions.performedAt,
        performedByName:
          sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
      })
      .from(poisonAdditions)
      .innerJoin(traps, eq(poisonAdditions.trapId, traps.id))
      .innerJoin(users, eq(poisonAdditions.performedBy, users.id))
      .where(
        and(
          eq(poisonAdditions.tenantId, tenantId),
          inArray(poisonAdditions.trapId, allTrapIds),
          gte(poisonAdditions.performedAt, new Date(periodStart)),
          lte(
            poisonAdditions.performedAt,
            new Date(periodEnd + "T23:59:59.999Z")
          )
        )
      )
      .orderBy(traps.label, poisonAdditions.performedAt);
  }

  // ── Group by work order ──────────────────────────────────────

  const trapIdToWo = new Map<string, string>();
  for (const t of allTraps) trapIdToWo.set(t.id, t.workOrderId);

  const enrichedWorkOrders = siteWorkOrders.map((wo) => ({
    title: wo.title,
    workOrderNumber: wo.workOrderNumber,
    status: wo.status,
    startDate: wo.startDate,
    endDate: wo.endDate,
    assignedTechnicians: allAssignments
      .filter((a) => a.workOrderId === wo.id)
      .map((a) => ({ firstName: a.firstName, lastName: a.lastName })),
    visits: allVisits.filter((v) => v.workOrderId === wo.id),
    traps: allTraps
      .filter((t) => t.workOrderId === wo.id)
      .map((t) => ({
        id: t.id,
        label: t.label,
        trapType: t.trapType,
        status: t.status,
      })),
    poisonHistory: allPoisonHistory.filter(
      (p) => trapIdToWo.get(p.trapId) === wo.id
    ),
  }));

  // ── Generate static map ──────────────────────────────────────

  const trapMarkers = allTraps
    .map((t) => ({
      lat: parseFloat(t.latitude),
      lng: parseFloat(t.longitude),
      status: t.status,
      label: t.label,
    }))
    .filter((m) => !isNaN(m.lat) && !isNaN(m.lng));

  let staticMapDataUri: string | undefined;
  if (trapMarkers.length > 0) {
    try {
      staticMapDataUri = await generateStaticMapImage({ traps: trapMarkers });
    } catch (err) {
      console.error("Static map generation failed, continuing without map:", err);
    }
  }

  // ── Resolve logo ─────────────────────────────────────────────

  const [company] = await db
    .select({
      companyName: tenants.companyName,
      address: tenants.address,
      vatNumber: tenants.vatNumber,
      contactEmail: tenants.contactEmail,
      contactPhone: tenants.contactPhone,
      logoPath: tenants.logoPath,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  let logoUrl: string | undefined;
  if (company?.logoPath) {
    const relPath = company.logoPath.startsWith("/")
      ? company.logoPath.slice(1)
      : company.logoPath;
    const absolutePath = path.join(process.cwd(), "public", relPath);
    if (existsSync(absolutePath)) {
      const ext = path.extname(absolutePath).toLowerCase();
      const mime = ext === ".png" ? "image/png" : "image/jpeg";
      const data = readFileSync(absolutePath).toString("base64");
      logoUrl = `data:${mime};base64,${data}`;
    }
  }

  // ── Render PDF ───────────────────────────────────────────────

  const preparedBy = session.user.name || session.user.email || "";
  const locale: PdfLocale =
    siteInfo.customerLanguage === "fi" ? "fi" : "en";

  const pdfBuffer = await renderToBuffer(
    <SiteProgressPdf
      title={title}
      periodStart={periodStart}
      periodEnd={periodEnd}
      comments={comments}
      preparedBy={preparedBy}
      company={company ?? null}
      logoUrl={logoUrl}
      locale={locale}
      staticMapDataUri={staticMapDataUri}
      site={{
        name: siteInfo.name,
        address: siteInfo.address,
      }}
      customer={{
        businessName: siteInfo.customerName,
        contactName: siteInfo.customerContact,
        contactPhone: siteInfo.customerPhone,
        contactEmail: siteInfo.customerEmail,
      }}
      workOrders={enrichedWorkOrders}
    />
  );

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${title.replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf"`,
    },
  });
}
