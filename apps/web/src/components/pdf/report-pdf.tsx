import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";

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
  workOrder,
  traps,
  poisonHistory,
}: ReportPdfProps) {
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
            {company?.vatNumber && <Text>VAT: {company.vatNumber}</Text>}
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
          <Text style={styles.sectionTitle}>Customer, Site & Work Order</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Customer</Text>
              <Text style={styles.infoValue}>{workOrder.customerName}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Site</Text>
              <Text style={styles.infoValue}>{workOrder.siteName}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Work order</Text>
              <Text style={styles.infoValue}>
                {workOrder.title}
                {workOrder.workOrderNumber
                  ? ` (#${workOrder.workOrderNumber})`
                  : ""}
              </Text>
            </View>
            {workOrder.customerContact && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Contact</Text>
                <Text style={styles.infoValue}>
                  {workOrder.customerContact}
                </Text>
              </View>
            )}
            {workOrder.customerPhone && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Phone</Text>
                <Text style={styles.infoValue}>{workOrder.customerPhone}</Text>
              </View>
            )}
            {workOrder.siteAddress && (
              <View style={{ width: "100%", marginTop: 4 }}>
                <Text style={styles.infoLabel}>Site address</Text>
                <Text style={styles.infoValue}>{workOrder.siteAddress}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Total traps</Text>
              <Text style={styles.infoValue}>{traps.length}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Active traps</Text>
              <Text style={styles.infoValue}>{activeTraps}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Service visits</Text>
              <Text style={styles.infoValue}>{visitDates.size}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Poison additions</Text>
              <Text style={styles.infoValue}>{poisonHistory.length}</Text>
            </View>
          </View>
        </View>

        {/* Traps */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trap Summary</Text>
          {traps.length === 0 ? (
            <Text style={styles.empty}>No traps on this work order</Text>
          ) : (
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={{ width: "30%" }}>Trap</Text>
                <Text style={{ width: "40%" }}>Type</Text>
                <Text style={{ width: "30%" }}>Status</Text>
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
          <Text style={styles.sectionTitle}>Poison Activity</Text>
          {poisonHistory.length === 0 ? (
            <Text style={styles.empty}>No poison activity in this period</Text>
          ) : (
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={{ width: "14%" }}>Date</Text>
                <Text style={{ width: "12%" }}>Trap</Text>
                <Text style={{ width: "20%" }}>Poison</Text>
                <Text style={{ width: "10%", textAlign: "right" }}>
                  Rem.
                </Text>
                <Text style={{ width: "10%", textAlign: "right" }}>Added</Text>
                <Text style={{ width: "18%" }}>Technician</Text>
                <Text style={{ width: "16%" }}>Notes</Text>
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
            <Text style={styles.sectionTitle}>Comments</Text>
            <View style={styles.comments}>
              <Text>{comments}</Text>
            </View>
          </View>
        )}

        {/* Footer */}
        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `Prepared by ${preparedBy}  •  Page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}
