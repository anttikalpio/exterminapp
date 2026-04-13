import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";
import type { PdfLocale } from "./report-pdf";

// ── Bilingual labels ───────────────────────────────────────────

const LABELS = {
  en: {
    siteProgressReport: "Site Progress Report",
    customerAndSite: "Customer & Site",
    customer: "Customer",
    site: "Site",
    contact: "Contact",
    phone: "Phone",
    siteAddress: "Site address",
    siteMap: "Site Map",
    legendActive: "Active",
    legendInactive: "Inactive",
    legendDamaged: "Damaged",
    legendRemoved: "Removed",
    workOrder: "Work Order",
    woStatus: "Status",
    assignedTo: "Assigned to",
    period: "Period",
    visitLog: "Visits",
    visitName: "Visit",
    visitDate: "Date",
    performedBy: "Performed by",
    noVisits: "No visits in this period",
    trapSummary: "Traps",
    trap: "Trap",
    type: "Type",
    status: "Status",
    noTraps: "No traps",
    poisonActivity: "Poison Activity",
    date: "Date",
    poison: "Poison",
    remaining: "Rem.",
    added: "Added",
    technician: "Technician",
    notes: "Notes",
    noPoisonActivity: "No poison activity in this period",
    consumptionTrend: "Consumption Trend",
    totalRemaining: "Total remaining (g)",
    totalAdded: "Total added (g)",
    comments: "Comments",
    vat: "VAT:",
    footer: (preparedBy: string, page: number, total: number) =>
      `Prepared by ${preparedBy}  •  Page ${page} of ${total}`,
  },
  fi: {
    siteProgressReport: "Kohteen edistymisraportti",
    customerAndSite: "Asiakas ja kohde",
    customer: "Asiakas",
    site: "Kohde",
    contact: "Yhteyshenkilö",
    phone: "Puhelin",
    siteAddress: "Kohteen osoite",
    siteMap: "Kohteen kartta",
    legendActive: "Aktiivinen",
    legendInactive: "Ei käytössä",
    legendDamaged: "Vaurioitunut",
    legendRemoved: "Poistettu",
    workOrder: "Työtilaus",
    woStatus: "Tila",
    assignedTo: "Tekijä(t)",
    period: "Jakso",
    visitLog: "Käynnit",
    visitName: "Käynti",
    visitDate: "Päivämäärä",
    performedBy: "Suorittanut",
    noVisits: "Ei käyntejä tällä jaksolla",
    trapSummary: "Ansat",
    trap: "Ansa",
    type: "Tyyppi",
    status: "Tila",
    noTraps: "Ei ansoja",
    poisonActivity: "Myrkkytoiminta",
    date: "Päivämäärä",
    poison: "Myrkky",
    remaining: "Jälj.",
    added: "Lisätty",
    technician: "Teknikko",
    notes: "Muistiinpanot",
    noPoisonActivity: "Ei myrkkytoimintaa tällä jaksolla",
    consumptionTrend: "Kulutuskehitys",
    totalRemaining: "Jäljellä yhteensä (g)",
    totalAdded: "Lisätty yhteensä (g)",
    comments: "Kommentit",
    vat: "ALV:",
    footer: (preparedBy: string, page: number, total: number) =>
      `Laatija ${preparedBy}  •  Sivu ${page} / ${total}`,
  },
} as const;

// ── Types ──────────────────────────────────────────────────────

type PoisonEntry = {
  id: string;
  trapLabel: string;
  poisonType: string;
  remainingGrams: string | null;
  quantityGrams: string;
  notes: string | null;
  performedAt: Date | string;
  performedByName: string;
};

type Visit = {
  id: string;
  name: string;
  visitedAt: Date | string;
  createdByName: string;
};

type TrapInfo = {
  id: string;
  label: string;
  trapType: string;
  status: string;
};

type WorkOrderSection = {
  title: string;
  workOrderNumber: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  assignedTechnicians: Array<{ firstName: string; lastName: string }>;
  visits: Visit[];
  traps: TrapInfo[];
  poisonHistory: PoisonEntry[];
};

type Company = {
  companyName: string | null;
  address: string | null;
  vatNumber: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  logoPath: string | null;
};

export type SiteProgressPdfProps = {
  title: string;
  periodStart: string;
  periodEnd: string;
  comments: string;
  preparedBy: string;
  company: Company | null;
  logoUrl?: string;
  locale: PdfLocale;
  staticMapDataUri?: string;
  site: {
    name: string;
    address: string | null;
  };
  customer: {
    businessName: string;
    contactName: string | null;
    contactPhone: string | null;
    contactEmail: string | null;
  };
  workOrders: WorkOrderSection[];
};

// ── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#111827",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 2,
    borderBottomColor: "#16a34a",
    paddingBottom: 12,
    marginBottom: 16,
  },
  logo: { width: 120, height: 48, objectFit: "contain" },
  companyInfo: { textAlign: "right", fontSize: 9, color: "#4b5563" },
  companyName: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 2,
  },
  title: { fontSize: 18, fontWeight: "bold", marginTop: 8, marginBottom: 4 },
  subtitle: { fontSize: 11, color: "#6b7280", marginBottom: 16 },
  section: { marginBottom: 14 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#16a34a",
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingBottom: 2,
  },
  subSectionTitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#374151",
    marginBottom: 4,
    marginTop: 8,
  },
  infoGrid: { flexDirection: "row", flexWrap: "wrap" },
  infoItem: { width: "50%", marginBottom: 4 },
  infoLabel: { color: "#6b7280", fontSize: 9 },
  infoValue: { color: "#111827", fontSize: 10 },
  table: { marginTop: 4 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    padding: 5,
    fontSize: 9,
    fontWeight: "bold",
    color: "#4b5563",
  },
  tableRow: {
    flexDirection: "row",
    padding: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
    fontSize: 9,
  },
  comments: {
    backgroundColor: "#f9fafb",
    borderLeftWidth: 3,
    borderLeftColor: "#16a34a",
    padding: 10,
    fontSize: 10,
    lineHeight: 1.5,
  },
  empty: { fontSize: 9, color: "#9ca3af", fontStyle: "italic" },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 8,
    color: "#9ca3af",
    borderTopWidth: 0.5,
    borderTopColor: "#e5e7eb",
    paddingTop: 6,
  },
  woHeader: {
    backgroundColor: "#f0fdf4",
    padding: 8,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: "#16a34a",
  },
  woTitle: { fontSize: 12, fontWeight: "bold", color: "#111827" },
  woMeta: { fontSize: 9, color: "#4b5563", marginTop: 2 },
  mapImage: { width: "100%", marginBottom: 6 },
  legend: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 8, color: "#6b7280" },
  trendRow: {
    flexDirection: "row",
    padding: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
    fontSize: 9,
  },
});

// ── Helpers ────────────────────────────────────────────────────

function formatDate(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString();
}

function buildConsumptionTrend(
  poisonHistory: PoisonEntry[]
): Array<{ date: string; totalRemaining: number; totalAdded: number }> {
  const byDate = new Map<
    string,
    { totalRemaining: number; totalAdded: number }
  >();

  for (const entry of poisonHistory) {
    const dateStr = formatDate(entry.performedAt);
    const existing = byDate.get(dateStr) ?? {
      totalRemaining: 0,
      totalAdded: 0,
    };
    existing.totalRemaining += parseFloat(entry.remainingGrams ?? "0");
    existing.totalAdded += parseFloat(entry.quantityGrams);
    byDate.set(dateStr, existing);
  }

  return Array.from(byDate.entries()).map(([date, vals]) => ({
    date,
    ...vals,
  }));
}

// ── Component ──────────────────────────────────────────────────

export function SiteProgressPdf({
  title,
  periodStart,
  periodEnd,
  comments,
  preparedBy,
  company,
  logoUrl,
  locale,
  staticMapDataUri,
  site,
  customer,
  workOrders,
}: SiteProgressPdfProps) {
  const l = LABELS[locale] ?? LABELS.en;

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        {/* ── Header ── */}
        <View style={styles.header} fixed>
          <View>
            {logoUrl ? (
              <Image src={logoUrl} style={styles.logo} />
            ) : (
              <Text style={styles.companyName}>
                {company?.companyName || "ExterminApp"}
              </Text>
            )}
          </View>
          <View style={styles.companyInfo}>
            {logoUrl && company?.companyName && (
              <Text style={styles.companyName}>{company.companyName}</Text>
            )}
            {company?.address && <Text>{company.address}</Text>}
            {company?.vatNumber && (
              <Text>
                {l.vat} {company.vatNumber}
              </Text>
            )}
            {company?.contactEmail && <Text>{company.contactEmail}</Text>}
            {company?.contactPhone && <Text>{company.contactPhone}</Text>}
          </View>
        </View>

        {/* ── Title & Period ── */}
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>
          {periodStart} — {periodEnd}
        </Text>

        {/* ── Customer & Site Info ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{l.customerAndSite}</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{l.customer}</Text>
              <Text style={styles.infoValue}>{customer.businessName}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{l.site}</Text>
              <Text style={styles.infoValue}>{site.name}</Text>
            </View>
            {customer.contactName && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>{l.contact}</Text>
                <Text style={styles.infoValue}>{customer.contactName}</Text>
              </View>
            )}
            {customer.contactPhone && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>{l.phone}</Text>
                <Text style={styles.infoValue}>{customer.contactPhone}</Text>
              </View>
            )}
            {site.address && (
              <View style={{ width: "100%", marginTop: 4 }}>
                <Text style={styles.infoLabel}>{l.siteAddress}</Text>
                <Text style={styles.infoValue}>{site.address}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Site Map ── */}
        {staticMapDataUri && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{l.siteMap}</Text>
            <Image src={staticMapDataUri} style={styles.mapImage} />
            <View style={styles.legend}>
              {(
                [
                  ["#16a34a", l.legendActive],
                  ["#9ca3af", l.legendInactive],
                  ["#f59e0b", l.legendDamaged],
                  ["#ef4444", l.legendRemoved],
                ] as const
              ).map(([color, label]) => (
                <View key={color} style={styles.legendItem}>
                  <View
                    style={[styles.legendDot, { backgroundColor: color }]}
                  />
                  <Text style={styles.legendText}>{label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Per Work Order Sections ── */}
        {workOrders.map((wo, woIndex) => {
          const trend = buildConsumptionTrend(wo.poisonHistory);

          return (
            <View key={woIndex} wrap={false} break={woIndex > 0}>
              {/* WO header */}
              <View style={styles.woHeader}>
                <Text style={styles.woTitle}>
                  {l.workOrder}: {wo.title}
                  {wo.workOrderNumber ? ` (#${wo.workOrderNumber})` : ""}
                </Text>
                <Text style={styles.woMeta}>
                  {l.woStatus}: {wo.status}
                  {wo.assignedTechnicians.length > 0 &&
                    `  |  ${l.assignedTo}: ${wo.assignedTechnicians.map((t) => `${t.firstName} ${t.lastName}`).join(", ")}`}
                  {wo.startDate &&
                    `  |  ${l.period}: ${wo.startDate}${wo.endDate ? ` — ${wo.endDate}` : ""}`}
                </Text>
              </View>

              {/* Visits */}
              <Text style={styles.subSectionTitle}>{l.visitLog}</Text>
              {wo.visits.length === 0 ? (
                <Text style={styles.empty}>{l.noVisits}</Text>
              ) : (
                <View style={styles.table}>
                  <View style={styles.tableHeader}>
                    <Text style={{ width: "30%" }}>{l.visitDate}</Text>
                    <Text style={{ width: "35%" }}>{l.visitName}</Text>
                    <Text style={{ width: "35%" }}>{l.performedBy}</Text>
                  </View>
                  {wo.visits.map((visit) => (
                    <View key={visit.id} style={styles.tableRow}>
                      <Text style={{ width: "30%" }}>
                        {formatDate(visit.visitedAt)}
                      </Text>
                      <Text style={{ width: "35%" }}>{visit.name}</Text>
                      <Text style={{ width: "35%" }}>
                        {visit.createdByName}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Traps */}
              <Text style={styles.subSectionTitle}>{l.trapSummary}</Text>
              {wo.traps.length === 0 ? (
                <Text style={styles.empty}>{l.noTraps}</Text>
              ) : (
                <View style={styles.table}>
                  <View style={styles.tableHeader}>
                    <Text style={{ width: "30%" }}>{l.trap}</Text>
                    <Text style={{ width: "40%" }}>{l.type}</Text>
                    <Text style={{ width: "30%" }}>{l.status}</Text>
                  </View>
                  {wo.traps.map((trap) => (
                    <View key={trap.id} style={styles.tableRow}>
                      <Text style={{ width: "30%" }}>{trap.label}</Text>
                      <Text style={{ width: "40%" }}>
                        {trap.trapType.replace(/_/g, " ")}
                      </Text>
                      <Text style={{ width: "30%" }}>{trap.status}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Poison Activity */}
              <Text style={styles.subSectionTitle}>{l.poisonActivity}</Text>
              {wo.poisonHistory.length === 0 ? (
                <Text style={styles.empty}>{l.noPoisonActivity}</Text>
              ) : (
                <View style={styles.table}>
                  <View style={styles.tableHeader}>
                    <Text style={{ width: "14%" }}>{l.date}</Text>
                    <Text style={{ width: "12%" }}>{l.trap}</Text>
                    <Text style={{ width: "20%" }}>{l.poison}</Text>
                    <Text style={{ width: "10%", textAlign: "right" }}>
                      {l.remaining}
                    </Text>
                    <Text style={{ width: "10%", textAlign: "right" }}>
                      {l.added}
                    </Text>
                    <Text style={{ width: "18%" }}>{l.technician}</Text>
                    <Text style={{ width: "16%" }}>{l.notes}</Text>
                  </View>
                  {wo.poisonHistory.map((entry) => (
                    <View key={entry.id} style={styles.tableRow}>
                      <Text style={{ width: "14%" }}>
                        {formatDate(entry.performedAt)}
                      </Text>
                      <Text style={{ width: "12%" }}>{entry.trapLabel}</Text>
                      <Text style={{ width: "20%" }}>{entry.poisonType}</Text>
                      <Text style={{ width: "10%", textAlign: "right" }}>
                        {entry.remainingGrams ?? "—"}
                      </Text>
                      <Text style={{ width: "10%", textAlign: "right" }}>
                        {entry.quantityGrams}
                      </Text>
                      <Text style={{ width: "18%" }}>
                        {entry.performedByName}
                      </Text>
                      <Text style={{ width: "16%" }}>
                        {entry.notes || ""}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Consumption Trend */}
              {trend.length > 0 && (
                <>
                  <Text style={styles.subSectionTitle}>
                    {l.consumptionTrend}
                  </Text>
                  <View style={styles.table}>
                    <View style={styles.tableHeader}>
                      <Text style={{ width: "34%" }}>{l.date}</Text>
                      <Text style={{ width: "33%", textAlign: "right" }}>
                        {l.totalRemaining}
                      </Text>
                      <Text style={{ width: "33%", textAlign: "right" }}>
                        {l.totalAdded}
                      </Text>
                    </View>
                    {trend.map((row, i) => (
                      <View key={i} style={styles.trendRow}>
                        <Text style={{ width: "34%" }}>{row.date}</Text>
                        <Text style={{ width: "33%", textAlign: "right" }}>
                          {row.totalRemaining.toFixed(1)}
                        </Text>
                        <Text style={{ width: "33%", textAlign: "right" }}>
                          {row.totalAdded.toFixed(1)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </View>
          );
        })}

        {/* ── Comments ── */}
        {comments && comments.trim().length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{l.comments}</Text>
            <View style={styles.comments}>
              <Text>{comments}</Text>
            </View>
          </View>
        )}

        {/* ── Footer ── */}
        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            l.footer(preparedBy, pageNumber, totalPages)
          }
          fixed
        />
      </Page>
    </Document>
  );
}
