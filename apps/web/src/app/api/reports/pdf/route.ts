import { NextRequest, NextResponse } from "next/server";
import { eq, and, sql, gte, lte } from "drizzle-orm";
import { renderToBuffer } from "@react-pdf/renderer";
import path from "path";
import { existsSync, readFileSync } from "fs";
import { auth } from "@/server/auth";
import { db } from "@/lib/db";
import {
  sites,
  customers,
  traps,
  poisonAdditions,
  users,
  tenants,
} from "../../../../../drizzle/schema";
import { ReportPdf } from "@/components/pdf/report-pdf";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;
  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get("siteId");
  const periodStart = searchParams.get("periodStart");
  const periodEnd = searchParams.get("periodEnd");
  const title = searchParams.get("title") || "Report";
  const comments = searchParams.get("comments") || "";

  if (!siteId || !periodStart || !periodEnd) {
    return NextResponse.json(
      { error: "Missing required parameters" },
      { status: 400 }
    );
  }

  // Fetch site + customer
  const [siteInfo] = await db
    .select({
      id: sites.id,
      name: sites.name,
      address: sites.address,
      customerName: customers.businessName,
      customerContact: customers.contactName,
      customerPhone: customers.contactPhone,
      customerEmail: customers.contactEmail,
    })
    .from(sites)
    .innerJoin(customers, eq(sites.customerId, customers.id))
    .where(and(eq(sites.id, siteId), eq(sites.tenantId, tenantId)))
    .limit(1);

  if (!siteInfo) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  // Fetch traps
  const siteTraps = await db
    .select({
      id: traps.id,
      label: traps.label,
      trapType: traps.trapType,
      status: traps.status,
    })
    .from(traps)
    .where(and(eq(traps.siteId, siteId), eq(traps.tenantId, tenantId)))
    .orderBy(traps.label);

  // Fetch poison history within period
  const trapIds = siteTraps.map((t) => t.id);
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
          sql`${poisonAdditions.trapId} = ANY(${trapIds})`,
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

  const pdfBuffer = await renderToBuffer(
    ReportPdf({
      title,
      periodStart,
      periodEnd,
      comments,
      preparedBy,
      company: company ?? null,
      logoUrl,
      site: siteInfo,
      traps: siteTraps,
      poisonHistory,
    })
  );

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${title.replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf"`,
    },
  });
}
