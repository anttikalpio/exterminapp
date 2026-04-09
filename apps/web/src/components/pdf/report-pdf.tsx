import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";

// PDF-specific label dictionary. Kept colocated with the PDF component
// rather than loaded from next-intl because @react-pdf/renderer runs in
// a standalone server-side React tree that is not wrapped by the app's
// NextIntlClientProvider.
const PDF_LABELS = {
  en: {
    customerSection: "Customer, Site & Work Order",
    customer: "Customer",
    site: "Site",
    workOrder: "Work order",
    contact: "Contact",
    phone: "Phone",
    siteAddress: "Site address",
    summary: "Summary",
    totalTraps: "Total traps",
    activeTraps: "Active traps",
    serviceVisits: "Service visits",
    poisonAdditions: "Poison additions",
    trapSummary: "Trap Summary",
    noTraps: "No traps on this work order",
    trap: "Trap",
    type: "Type",
    status: "Status",
    poisonActivity: "Poison Activity",
    noPoisonActivity: "No poison activity in this period",
    date: "Date",
    poison: "Poison",
    remaining: "Rem.",
    added: "Added",
    technician: "Technician",
    notes: "Notes",
    comments: "Comments",
    vat: "VAT:",
    footer: (preparedBy: string, page: number, total: number) =>
      `Prepared by ${preparedBy}  •  Page ${page} of ${total}`,
  },
  fi: {
    customerSection: "Asiakas, kohde ja työtilaus",
    customer: "Asiakas",
    site: "Kohde",
    workOrder: "Työtilaus",
    contact: "Yhteyshenkilö",
    phone: "Puhelin",
    siteAddress: "Kohteen osoite",
    summary: "Yhteenveto",
    totalTraps: "Ansoja yhteensä",
    activeTraps: "Aktiivisia ansoja",
    serviceVisits: "Huoltokäynnit",
    poisonAdditions: "Myrkkylisäykset",
    trapSummary: "Ansayhteenveto",
    noTraps: "Ei ansoja tässä työtilauksessa",
    trap: "Ansa",
    type: "Tyyppi",
    status: "Tila",
    poisonActivity: "Myrkkytoiminta",
    noPoisonActivity: "Ei myrkkytoimintaa tällä jaksolla",
    date: "Päivämäärä",
    poison: "Myrkky",
    remaining: "Jälj.",
    added: "Lisätty",
    technician: "Teknikko",
    notes: "Muistiinpanot",
    comments: "Kommentit",
    vat: "ALV:",
    footer: (preparedBy: string, page: number, total: number) =>
      `Laatija ${preparedBy}  •  Sivu ${page} / ${total}`,
  },
} as const;

export type PdfLocale = keyof typeof PDF_LABELS;

type Trap = {
  id: string;
  label: string;
  trapType: string;
  status: string;
};

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

type Company = {
  companyName: string | null;
  address: string | null;
  vatNumber: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  logoPath: string | null;
};

export type ReportPdfProps = {
  title: string;
  periodStart: string;
  periodEnd: string;
  comments: string;
  preparedBy: string;
  company: Company | null;
  logoUrl?: string;
  locale: PdfLocale;
  workOrder: {
    title: string;
    workOrderNumber: string | null;
    siteName: string;
    siteAddress: string | null;
    customerName: string;
    customerContact: string | null;
    customerPhone: string | null;
    customerEmail: string | null;
  };
  traps: Trap[];
  poisonHistory: PoisonEntry[];
};

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
  logo: {
    width: 120,
    height: 48,
    objectFit: "contain",
  },
  companyInfo: {
    textAlign: "right",
    fontSize: 9,
    color: "#4b5563",
  },
  companyName: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 8,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    color: "#6b7280",
    marginBottom: 16,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#16a34a",
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingBottom: 2,
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  infoItem: {
    width: "50%",
    marginBottom: 4,
  },
  infoLabel: {
    color: "#6b7280",
    fontSize: 9,
  },
  infoValue: {
    color: "#111827",
    fontSize: 10,
  },
  table: {
    marginTop: 4,
  },
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
  empty: {
    fontSize: 9,
    color: "#9ca3af",
    fontStyle: "italic",
  },
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
});

function formatDate(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString();
}

export function ReportPdf({
  title,
  periodStart,
  periodEnd,
  comments,
  preparedBy,
  company,
  logoUrl,
  locale,
  workOrder,
  traps,
  poisonHistory,
}: ReportPdfProps) {
  const labels = PDF_LABELS[locale] ?? PDF_LABELS.en;
  const activeTraps = traps.filter((t) => t.status === "active").length;
  const visitDates = new Set(
    poisonHistory.map((p) => formatDate(p.performedAt))
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
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
                {labels.vat} {company.vatNumber}
              </Text>
            )}
            {company?.contactEmail && <Text>{company.contactEmail}</Text>}
            {company?.contactPhone && <Text>{company.contactPhone}</Text>}
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>
          {periodStart} — {periodEnd}
        </Text>

        {/* Customer, Site & Work Order */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{labels.customerSection}</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{labels.customer}</Text>
              <Text style={styles.infoValue}>{workOrder.customerName}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{labels.site}</Text>
              <Text style={styles.infoValue}>{workOrder.siteName}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{labels.workOrder}</Text>
              <Text style={styles.infoValue}>
                {workOrder.title}
                {workOrder.workOrderNumber
                  ? ` (#${workOrder.workOrderNumber})`
                  : ""}
              </Text>
            </View>
            {workOrder.customerContact && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>{labels.contact}</Text>
                <Text style={styles.infoValue}>
                  {workOrder.customerContact}
                </Text>
              </View>
            )}
            {workOrder.customerPhone && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>{labels.phone}</Text>
                <Text style={styles.infoValue}>{workOrder.customerPhone}</Text>
              </View>
            )}
            {workOrder.siteAddress && (
              <View style={{ width: "100%", marginTop: 4 }}>
                <Text style={styles.infoLabel}>{labels.siteAddress}</Text>
                <Text style={styles.infoValue}>{workOrder.siteAddress}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{labels.summary}</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{labels.totalTraps}</Text>
              <Text style={styles.infoValue}>{traps.length}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{labels.activeTraps}</Text>
              <Text style={styles.infoValue}>{activeTraps}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{labels.serviceVisits}</Text>
              <Text style={styles.infoValue}>{visitDates.size}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{labels.poisonAdditions}</Text>
              <Text style={styles.infoValue}>{poisonHistory.length}</Text>
            </View>
          </View>
        </View>

        {/* Traps */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{labels.trapSummary}</Text>
          {traps.length === 0 ? (
            <Text style={styles.empty}>{labels.noTraps}</Text>
          ) : (
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={{ width: "30%" }}>{labels.trap}</Text>
                <Text style={{ width: "40%" }}>{labels.type}</Text>
                <Text style={{ width: "30%" }}>{labels.status}</Text>
              </View>
              {traps.map((trap) => (
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
        </View>

        {/* Poison Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{labels.poisonActivity}</Text>
          {poisonHistory.length === 0 ? (
            <Text style={styles.empty}>{labels.noPoisonActivity}</Text>
          ) : (
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={{ width: "14%" }}>{labels.date}</Text>
                <Text style={{ width: "12%" }}>{labels.trap}</Text>
                <Text style={{ width: "20%" }}>{labels.poison}</Text>
                <Text style={{ width: "10%", textAlign: "right" }}>
                  {labels.remaining}
                </Text>
                <Text style={{ width: "10%", textAlign: "right" }}>
                  {labels.added}
                </Text>
                <Text style={{ width: "18%" }}>{labels.technician}</Text>
                <Text style={{ width: "16%" }}>{labels.notes}</Text>
              </View>
              {poisonHistory.map((entry) => (
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
                  <Text style={{ width: "18%" }}>{entry.performedByName}</Text>
                  <Text style={{ width: "16%" }}>{entry.notes || ""}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Comments */}
        {comments && comments.trim().length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{labels.comments}</Text>
            <View style={styles.comments}>
              <Text>{comments}</Text>
            </View>
          </View>
        )}

        {/* Footer */}
        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            labels.footer(preparedBy, pageNumber, totalPages)
          }
          fixed
        />
      </Page>
    </Document>
  );
}
