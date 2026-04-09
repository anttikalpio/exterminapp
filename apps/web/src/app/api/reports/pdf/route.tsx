import { NextRequest, NextResponse } from "next/server";
import { eq, and, sql, gte, lte, inArray } from "drizzle-orm";
import { renderToBuffer } from "@react-pdf/renderer";
import path from "path";
import { existsSync, readFileSync } from "fs";
import { auth } from "@/server/auth";
import { db } from "@/lib/db";
import {
  workOrders,
  sites,
  customers,
  traps,
  poisonAdditions,
  users,
  tenants,
} from "../../../../../drizzle/schema";
import { ReportPdf, type PdfLocale } from "@/components/pdf/report-pdf";

export async function GET(req: NextRequest) {
  try {
    return await handlePdfRequest(req);
  } catch (err) {
    console.error("PDF generation failed:", err);
    const message = err instanceof Error ? err.message : "PDF generation failed";
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
  const workOrderId = searchParams.get("workOrderId");
  const periodStart = searchParams.get("periodStart");
  const periodEnd = searchParams.get("periodEnd");
  const title = searchParams.get("title") || "Report";
  const comments = searchParams.get("comments") || "";

  if (!workOrderId || !periodStart || !periodEnd) {
    return NextResponse.json(
      { error: "Missing required parameters" },
      { status: 400 }
    );
  }

  // Fetch work order + site + customer
  const [workOrderInfo] = await db
    .select({
      id: workOrders.id,
      title: workOrders.title,
      workOrderNumber: workOrders.workOrderNumber,
      siteName: sites.name,
      siteAddress: sites.address,
      customerName: customers.businessName,
      customerContact: customers.contactName,
      customerPhone: customers.contactPhone,
      customerEmail: customers.contactEmail,
      customerLanguage: customers.preferredLanguage,
    })
    .from(workOrders)
    .innerJoin(sites, eq(workOrders.siteId, sites.id))
    .innerJoin(customers, eq(workOrders.customerId, customers.id))
    .where(
      and(eq(workOrders.id, workOrderId), eq(workOrders.tenantId, tenantId))
    )
    .limit(1);

  if (!workOrderInfo) {
    return NextResponse.json(
      { error: "Work order not found" },
      { status: 404 }
    );
  }

  // Fetch traps for this work order
  const workOrderTraps = await db
    .select({
      id: traps.id,
      label: traps.label,
      trapType: traps.trapType,
      status: traps.status,
    })
    .from(traps)
    .where(
      and(eq(traps.workOrderId, workOrderId), eq(traps.tenantId, tenantId))
    )
    .orderBy(traps.label);

  // Fetch poison history within period
  const trapIds = workOrderTraps.map((t) => t.id);
  let poisonHistory: Array<{
    id: string;
    trapLabel: string;
    poisonType: string;
    remainingGrams: string | null;
    quantityGrams: string;
    notes: string | null;
    performedAt: Date;
    performedByName: string;
  }> = [];

  if (trapIds.length > 0) {
    poisonHistory = await db
      .select({
        id: poisonAdditions.id,
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
          inArray(poisonAdditions.trapId, trapIds),
          gte(poisonAdditions.performedAt, new Date(periodStart)),
          lte(
            poisonAdditions.performedAt,
            new Date(periodEnd + "T23:59:59.999Z")
          )
        )
      )
      .orderBy(traps.label, poisonAdditions.performedAt);
  }

  // Fetch company / tenant info
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

  // Resolve logo to data URI so @react-pdf can embed it
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

  const preparedBy = session.user.name || session.user.email || "";

  // Fall back to English if the customer's preferred language isn't one the
  // PDF component has translations for. Avoids crashing the render path if
  // someone sets an unsupported locale directly in the DB.
  const locale: PdfLocale =
    workOrderInfo.customerLanguage === "fi" ? "fi" : "en";

  const pdfBuffer = await renderToBuffer(
    <ReportPdf
      title={title}
      periodStart={periodStart}
      periodEnd={periodEnd}
      comments={comments}
      preparedBy={preparedBy}
      company={company ?? null}
      logoUrl={logoUrl}
      locale={locale}
      workOrder={{
        title: workOrderInfo.title,
        workOrderNumber: workOrderInfo.workOrderNumber,
        siteName: workOrderInfo.siteName,
        siteAddress: workOrderInfo.siteAddress,
        customerName: workOrderInfo.customerName,
        customerContact: workOrderInfo.customerContact,
        customerPhone: workOrderInfo.customerPhone,
        customerEmail: workOrderInfo.customerEmail,
      }}
      traps={workOrderTraps}
      poisonHistory={poisonHistory}
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
