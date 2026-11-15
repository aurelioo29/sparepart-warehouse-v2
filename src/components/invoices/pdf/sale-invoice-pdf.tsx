import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

type SaleInvoicePdfProps = {
  sale: {
    invoiceNumber: string;
    saleDate: Date | string;
    dueDate?: Date | string | null;
    status: string;
    paymentStatus: string;
    subtotal: string | number;
    discountAmount: string | number;
    totalAmount: string | number;
    paidAmount: string | number;
    notes?: string | null;
    customer?: {
      name?: string | null;
      customerType?: string | null;
      phone?: string | null;
      email?: string | null;
      address?: string | null;
    } | null;
    salesman?: {
      name?: string | null;
    } | null;
    createdBy?: {
      fullName?: string | null;
      username?: string | null;
    } | null;
    items: {
      id: string;
      quantity: number;
      unitPrice: string | number;
      discountPercent?: string | number | null;
      discountQty?: number | null;
      additionalDiscountPercent?: string | number | null;
      additionalDiscountPercent2?: string | number | null;
      discountAmount: string | number;
      totalPrice: string | number;
      product: {
        sku: string;
        name: string;
        category?: {
          name?: string | null;
        } | null;
        unit: {
          shortName: string;
        };
      };
    }[];
    payments: {
      id: string;
      paymentDate: Date | string;
      amount: string | number;
      method: string;
    }[];
  };
  settings: {
    storeName?: string | null;
    ownerName?: string | null;
    logoUrl?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    city?: string | null;
    province?: string | null;
    postalCode?: string | null;
    invoiceFooter?: string | null;
    bankAccounts?: {
      id: string;
      bankName: string;
      accountNumber: string;
      logoUrl?: string | null;
    }[];

    warehouse_name?: string;
    warehouse_logo_url?: string;
    warehouse_address?: string;
    warehouse_phone?: string;
    warehouse_email?: string;
    store_name?: string;
    store_address?: string;
    store_phone?: string;
    store_email?: string;
    app_name?: string;
  };
};

/**
 * Untuk Epson LX-310 / dot matrix:
 * Maksimal 8 item per halaman agar footer, rekening, dan TTD
 * selalu muat pada setiap lembar.
 */
const ITEMS_PER_PAGE = 8;

function toNumber(value: string | number | null | undefined) {
  const numberValue = Number(value || 0);
  return Number.isNaN(numberValue) ? 0 : numberValue;
}

function formatCurrency(value: string | number | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatPercent(value: string | number | null | undefined) {
  const numberValue = toNumber(value);

  if (numberValue <= 0) return "";

  if (Number.isInteger(numberValue)) {
    return `${numberValue}%`;
  }

  return `${numberValue.toFixed(2)}%`;
}

function getDiscountText(item: {
  discountPercent?: string | number | null;
  discountQty?: number | null;
  additionalDiscountPercent?: string | number | null;
  additionalDiscountPercent2?: string | number | null;
  discountAmount: string | number;
}) {
  const discountAmount = toNumber(item.discountAmount);

  if (discountAmount <= 0) return "-";

  const discounts = [
    formatPercent(item.discountPercent),
    formatPercent(item.additionalDiscountPercent),
    formatPercent(item.additionalDiscountPercent2),
  ].filter(Boolean);

  return discounts.length > 0 ? discounts.join("+") : "-";
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks.length > 0 ? chunks : [[]];
}

function compactText(...values: Array<string | null | undefined>) {
  return values
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(", ");
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 24,
    paddingHorizontal: 30,
    paddingBottom: 24,
    fontFamily: "Courier",
    fontSize: 11,
    color: "#000000",
    backgroundColor: "#ffffff",
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 7,
  },

  companyBlock: {
    width: "58%",
    flexDirection: "row",
  },

  logoBox: {
    width: 42,
    height: 42,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },

  logo: {
    width: 38,
    height: 38,
    objectFit: "contain",
  },

  logoPlaceholder: {
    fontSize: 8,
    fontWeight: "bold",
    textAlign: "center",
  },

  companyTextBlock: {
    flex: 1,
  },

  companyName: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 3,
  },

  companyLine: {
    fontSize: 10,
    lineHeight: 1.25,
  },

  titleBlock: {
    width: "34%",
    alignItems: "center",
  },

  invoiceTitle: {
    fontSize: 16,
    fontWeight: "bold",
    letterSpacing: 0.4,
    marginBottom: 7,
  },

  invoiceNumber: {
    fontSize: 10,
    fontWeight: "bold",
    textAlign: "center",
  },

  pageInfo: {
    fontSize: 9,
    marginTop: 3,
    textAlign: "center",
  },

  topRule: {
    borderTopWidth: 1,
    borderTopColor: "#000000",
    marginBottom: 6,
  },

  infoArea: {
    flexDirection: "row",
    marginBottom: 9,
  },

  billTo: {
    width: "48%",
    paddingRight: 10,
  },

  invoiceInfo: {
    width: "52%",
  },

  sectionTitle: {
    fontSize: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
    marginBottom: 3,
  },

  customerName: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 2,
  },

  smallText: {
    fontSize: 10,
    lineHeight: 1.25,
  },

  infoTitleBox: {
    borderWidth: 1,
    borderColor: "#000000",
    borderBottomWidth: 0,
    paddingVertical: 3,
    paddingHorizontal: 4,
    textAlign: "center",
    fontSize: 10,
    fontWeight: "bold",
  },

  infoRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#000000",
    borderBottomWidth: 0,
  },

  infoRowLast: {
    borderBottomWidth: 1,
  },

  infoLabel: {
    width: "42%",
    paddingVertical: 3,
    paddingHorizontal: 4,
    fontSize: 10,
    fontWeight: "bold",
  },

  infoValue: {
    width: "58%",
    paddingVertical: 3,
    paddingHorizontal: 4,
    fontSize: 10,
  },

  table: {
    width: "100%",
    marginTop: 6,
  },

  tableRow: {
    flexDirection: "row",
  },

  th: {
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#000000",
    paddingVertical: 4,
    paddingHorizontal: 3,
    fontSize: 10,
    fontWeight: "bold",
    textAlign: "center",
  },

  thLast: {
    borderRightWidth: 1,
  },

  td: {
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#000000",
    paddingVertical: 4,
    paddingHorizontal: 3,
    fontSize: 10,
    minHeight: 34,
  },

  tdLast: {
    borderRightWidth: 1,
  },

  textCenter: {
    textAlign: "center",
  },

  discountCell: {
    fontSize: 9,
    textAlign: "center",
  },

  textRight: {
    textAlign: "right",
  },

  itemName: {
    fontSize: 10.5,
    fontWeight: "bold",
    lineHeight: 1.2,
  },

  itemSku: {
    fontSize: 9.5,
    lineHeight: 1.2,
  },

  bottomArea: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 11,
  },

  notesBox: {
    width: "56%",
    fontSize: 10,
    lineHeight: 1.25,
  },

  notesText: {
    fontSize: 10,
    fontWeight: "bold",
    lineHeight: 1.25,
  },

  bankSection: {
    width: "65%",
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: "#000000",
    paddingVertical: 7,
    paddingHorizontal: 8,
  },

  bankSectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 5,
  },

  bankOwnerText: {
    fontSize: 11,
    fontWeight: "bold",
    lineHeight: 1.4,
    marginBottom: 2,
  },

  bankAccountRow: {
    flexDirection: "row",
    marginTop: 2,
  },

  bankNameText: {
    width: 48,
    fontSize: 11,
    fontWeight: "bold",
    lineHeight: 1.4,
  },

  bankAccountNumber: {
    flex: 1,
    fontSize: 11,
    fontWeight: "bold",
    lineHeight: 1.4,
  },

  bankList: {
    flexDirection: "row",
    flexWrap: "wrap",
  },

  bankItem: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    marginRight: "2%",
    marginBottom: 4,
  },

  bankLogoBox: {
    width: 28,
    height: 18,
    marginRight: 5,
    alignItems: "center",
    justifyContent: "center",
  },

  bankLogo: {
    width: 28,
    height: 18,
    objectFit: "contain",
  },

  bankText: {
    flex: 1,
    fontSize: 8.5,
    lineHeight: 1.2,
  },

  totalBox: {
    width: "36%",
  },

  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 3,
  },

  totalLabel: {
    width: "38%",
    fontSize: 10,
    fontWeight: "bold",
  },

  totalValue: {
    width: "62%",
    fontSize: 11,
    fontWeight: "bold",
    textAlign: "right",
  },

  grandTotalLabel: {
    width: "38%",
    fontSize: 11,
    fontWeight: "bold",
  },

  grandTotalValue: {
    width: "62%",
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "right",
  },

  signatureArea: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 48,
  },

  signatureBox: {
    width: "34%",
    textAlign: "center",
  },

  signatureTitle: {
    fontSize: 10,
    marginBottom: 44,
  },

  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: "#000000",
    paddingTop: 4,
    fontSize: 10,
  },
});

function InvoiceHeader({
  sale,
  settings,
  pageNumber,
  totalPages,
}: {
  sale: SaleInvoicePdfProps["sale"];
  settings: SaleInvoicePdfProps["settings"];
  pageNumber: number;
  totalPages: number;
}) {
  const companyName =
    settings.storeName ||
    settings.warehouse_name ||
    settings.store_name ||
    settings.app_name ||
    "KNG Sparepart";

  const logoUrl = settings.logoUrl || settings.warehouse_logo_url || "";

  const location = compactText(settings.city, settings.province);

  const address =
    location ||
    settings.address ||
    settings.warehouse_address ||
    settings.store_address ||
    "Medan, Sumatera Utara";

  return (
    <>
      <View style={styles.header}>
        <View style={styles.companyBlock}>
          <View style={styles.logoBox}>
            {logoUrl ? (
              <Image src={logoUrl} style={styles.logo} />
            ) : (
              <Text style={styles.logoPlaceholder}>LOGO</Text>
            )}
          </View>

          <View style={styles.companyTextBlock}>
            <Text style={styles.companyName}>{companyName}</Text>
            <Text style={styles.companyLine}>{address}</Text>
          </View>
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.invoiceTitle}>INVOICE</Text>
          <Text style={styles.invoiceNumber}>{sale.invoiceNumber}</Text>
          <Text style={styles.pageInfo}>
            Page {pageNumber} of {totalPages}
          </Text>
        </View>
      </View>

      <View style={styles.topRule} />

      <View style={styles.infoArea}>
        <View style={styles.billTo}>
          <Text style={styles.sectionTitle}>Bill To</Text>

          <Text style={styles.customerName}>
            {sale.customer?.name || "Walk-in Customer"}
          </Text>

          <Text style={styles.smallText}>
            Type : {sale.customer?.customerType || "-"}
          </Text>

          <Text style={styles.smallText}>
            Address : {sale.customer?.address || "-"}
          </Text>

          {sale.customer?.phone ? (
            <Text style={styles.smallText}>Phone : {sale.customer.phone}</Text>
          ) : null}
        </View>

        <View style={styles.invoiceInfo}>
          <Text style={styles.infoTitleBox}>INVOICE INFO</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Invoice Date</Text>
            <Text style={styles.infoValue}>{formatDate(sale.saleDate)}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Due Date</Text>
            <Text style={styles.infoValue}>{formatDate(sale.dueDate)}</Text>
          </View>

          <View style={[styles.infoRow, styles.infoRowLast]}>
            <Text style={styles.infoLabel}>Salesman</Text>
            <Text style={styles.infoValue}>{sale.salesman?.name || "-"}</Text>
          </View>
        </View>
      </View>
    </>
  );
}

function ItemsTable({
  items,
  startIndex,
}: {
  items: SaleInvoicePdfProps["sale"]["items"];
  startIndex: number;
}) {
  return (
    <View style={styles.table}>
      <View style={styles.tableRow}>
        <Text style={[styles.th, { width: "5%" }]}>No</Text>
        <Text style={[styles.th, { width: "41%" }]}>Item</Text>
        <Text style={[styles.th, { width: "9%" }]}>Qty</Text>
        <Text style={[styles.th, { width: "14%" }]}>Harga</Text>
        <Text style={[styles.th, { width: "14%" }]}>Disc</Text>
        <Text style={[styles.th, styles.thLast, { width: "17%" }]}>Total</Text>
      </View>

      {items.map((item, index) => {
        const discountText = getDiscountText(item);

        return (
          <View style={styles.tableRow} key={item.id}>
            <Text style={[styles.td, styles.textCenter, { width: "5%" }]}>
              {startIndex + index + 1}
            </Text>

            <View style={[styles.td, { width: "41%" }]}>
              <Text style={styles.itemName}>{item.product.name}</Text>
              <Text style={styles.itemSku}>SKU: {item.product.sku}</Text>
            </View>

            <Text style={[styles.td, styles.textCenter, { width: "9%" }]}>
              {item.quantity} {item.product.unit.shortName}
            </Text>

            <Text style={[styles.td, styles.textRight, { width: "14%" }]}>
              {formatCurrency(item.unitPrice)}
            </Text>

            <Text style={[styles.td, styles.discountCell, { width: "14%" }]}>
              {discountText}
            </Text>

            <Text
              style={[
                styles.td,
                styles.tdLast,
                styles.textRight,
                { width: "17%" },
              ]}
            >
              {formatCurrency(item.totalPrice)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function InvoiceBottom({
  sale,
  settings,
}: {
  sale: SaleInvoicePdfProps["sale"];
  settings: SaleInvoicePdfProps["settings"];
}) {
  const footerText =
    settings.invoiceFooter ||
    "Apabila barang yang diterima tidak sesuai dengan faktur, agar di konfirmasi paling lambat 2 minggu.";

  return (
    <>
      <View style={styles.bottomArea}>
        <View style={styles.notesBox}>
          <Text style={styles.notesText}>Notes : {footerText}</Text>

          {settings.bankAccounts && settings.bankAccounts.length > 0 ? (
            <View style={styles.bankSection}>
              <Text style={styles.bankSectionTitle}>INFORMASI REKENING</Text>

              <Text style={styles.bankOwnerText}>
                a/n : {settings.ownerName || "-"}
              </Text>

              {settings.bankAccounts.map((account) => (
                <View style={styles.bankAccountRow} key={account.id}>
                  <Text style={styles.bankNameText}>
                    {account.bankName.toUpperCase()} :
                  </Text>

                  <Text style={styles.bankAccountNumber}>
                    {account.accountNumber}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.totalBox}>
          <View style={styles.totalRow}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={styles.grandTotalValue}>
              Rp {formatCurrency(sale.totalAmount)}
            </Text>
          </View>

          {toNumber(sale.paidAmount) > 0 ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Paid</Text>
              <Text style={styles.totalValue}>
                Rp {formatCurrency(sale.paidAmount)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.signatureArea}>
        <View style={styles.signatureBox}>
          <Text style={styles.signatureTitle}>Diketahui Oleh</Text>
          <Text style={styles.signatureLine}> </Text>
        </View>

        <View style={styles.signatureBox}>
          <Text style={styles.signatureTitle}>Diterima Oleh</Text>
          <Text style={styles.signatureLine}> </Text>
        </View>
      </View>
    </>
  );
}

export default function SaleInvoicePdf({
  sale,
  settings,
}: SaleInvoicePdfProps) {
  // Pertahankan urutan item dari API/detail tanpa sorting ulang.
  const itemPages = chunkArray(sale.items, ITEMS_PER_PAGE);
  const totalPages = itemPages.length;

  return (
    <Document>
      {itemPages.map((items, pageIndex) => {
        const startIndex = pageIndex * ITEMS_PER_PAGE;

        return (
          <Page
            key={`invoice-page-${pageIndex + 1}`}
            size="A4"
            style={styles.page}
          >
            <InvoiceHeader
              sale={sale}
              settings={settings}
              pageNumber={pageIndex + 1}
              totalPages={totalPages}
            />

            <ItemsTable items={items} startIndex={startIndex} />

            <InvoiceBottom sale={sale} settings={settings} />
          </Page>
        );
      })}
    </Document>
  );
}
