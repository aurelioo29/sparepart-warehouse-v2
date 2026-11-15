"use client";
import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  App,
  Button,
  DatePicker,
  Dropdown,
  Input,
  Progress,
  Select,
  Table,
  Tag,
} from "antd";
import type { MenuProps } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  BarChartOutlined,
  DatabaseOutlined,
  DownloadOutlined,
  DownOutlined,
  FileTextOutlined,
  ReloadOutlined,
  SearchOutlined,
  TeamOutlined,
  TrophyOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
const { RangePicker } = DatePicker;
type ReportType = "inventory" | "stock-in" | "stock-out" | "salesman";
type ReportPageClientProps = {
  type: ReportType;
  title: string;
};
type OptionItem = {
  id: string;
  name: string;
  code?: string;
  sku?: string;
};
type ReportItem = Record<string, unknown>;
type ReportItemWithRowKey = ReportItem & {
  __rowKey: string;
};
type ReportData = {
  summary: Record<string, number>;
  items: ReportItem[];
  period?: {
    year: number;
    month: number;
    mode?: string;
    dateFrom: string;
    dateTo: string;
  };
  sort?: {
    sortBy: string;
    sortOrder: string;
  };
};
type SalesmanSortBy =
  | "salesmanName"
  | "salesmanType"
  | "totalInvoices"
  | "totalSales"
  | "totalPaid"
  | "totalReceivable"
  | "estimatedCommission";
type SortOrder = "asc" | "desc";
type SalesmanExportFormat = "salesman-recap" | "kng-sales-report";
const endpointMap: Record<ReportType, string> = {
  inventory: "/api/reports/inventory",
  "stock-in": "/api/reports/stock-in",
  "stock-out": "/api/reports/stock-out",
  salesman: "/api/reports/salesman",
};
const salesmanSortOptions: { label: string; value: SalesmanSortBy }[] = [
  { label: "Salesman Name", value: "salesmanName" },
  { label: "Type", value: "salesmanType" },
  { label: "Total Invoices", value: "totalInvoices" },
  { label: "Total Sales", value: "totalSales" },
  { label: "Total Paid", value: "totalPaid" },
  { label: "Total Receivable", value: "totalReceivable" },
  { label: "Estimated Commission", value: "estimatedCommission" },
];
function formatCurrency(value: string | number | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}
function formatNumber(value: string | number | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}
function formatDate(value?: string | null) {
  if (!value) return "-";
  return dayjs(value).format("YYYY-MM-DD");
}
function isMoneyKey(key: string) {
  return [
    "purchasePrice",
    "sellingPrice",
    "purchaseStockValue",
    "sellingStockValue",
    "totalPurchaseValue",
    "totalSellingValue",
    "unitPrice",
    "totalPrice",
    "totalAmount",
    "totalSales",
    "totalPaid",
    "totalReceivable",
    "estimatedCommission",
    "totalEstimatedCommission",
    "paidAmount",
    "remainingAmount",
    "totalRemaining",
    "overdueAmount",
    "overdueDebt",
  ].includes(key);
}
function labelize(key: string) {
  const customLabels: Record<string, string> = {
    totalItems: "Total Item",
    totalStock: "Total Stok",
    totalPurchaseValue: "Nilai Beli",
    totalSellingValue: "Nilai Jual",
    lowStockItems: "Stok Rendah",
    outOfStockItems: "Stok Habis",
    totalRows: "Total Data",
    totalQuantity: "Total Quantity",
    totalAmount: "Total Amount",
    totalPaid: "Total Dibayar",
    totalRemaining: "Total Sisa",
    totalSalesmen: "Total Salesmen",
    totalInvoices: "Total Invoices",
    totalSales: "Total Sales",
    totalReceivable: "Total Receivable",
    totalEstimatedCommission: "Estimated Commission",
    estimatedCommission: "Estimated Commission",
    sku: "SKU",
    productName: "Nama Produk",
    name: "Nama Produk",
    category: "Kategori",
    brand: "Brand",
    unit: "Satuan",
    currentStock: "Stok Saat Ini",
    sellingPrice: "Harga Jual",
    purchasePrice: "Harga Beli",
    purchaseStockValue: "Nilai Stok Beli",
    sellingStockValue: "Nilai Stok Jual",
    salesmanName: "Salesman Name",
    salesmanType: "Type",
    commissionType: "Commission Type",
    commissionValue: "Commission Value",
  };
  if (customLabels[key]) return customLabels[key];
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase());
}
function buildQuery(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  });
  return query.toString();
}
function getTextValue(record: ReportItem, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value !== null && value !== undefined && value !== "") {
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        return String(value);
      }
    }
  }
  return "-";
}
function getNumberValue(record: ReportItem, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value !== null && value !== undefined && value !== "") {
      const numberValue = Number(value);
      if (!Number.isNaN(numberValue)) {
        return numberValue;
      }
    }
  }
  return 0;
}
function getStockInDetailId(record: ReportItem) {
  return getTextValue(record, ["stockInId"]);
}
function isOutOfStockRow(record: ReportItem) {
  return getNumberValue(record, ["currentStock"]) === 0;
}
function isLowStockRow(record: ReportItem) {
  const stock = getNumberValue(record, ["currentStock"]);
  const minStock = getNumberValue(record, ["minimumStock", "minStock"]);
  if (stock <= 0) return false;
  if (minStock <= 0) return false;
  return stock <= minStock;
}
function getInventoryStatus(record: ReportItem) {
  if (isOutOfStockRow(record)) {
    return <Tag color="red">OUT OF STOCK</Tag>;
  }
  if (isLowStockRow(record)) {
    return <Tag color="orange">LOW STOCK</Tag>;
  }
  return <Tag color="green">NORMAL</Tag>;
}
function getCommissionTag(value?: string | null) {
  if (value === "PERCENTAGE") return <Tag color="blue">PERCENTAGE</Tag>;
  if (value === "FIXED") return <Tag color="green">FIXED</Tag>;
  if (value === "NONE") return <Tag>NONE</Tag>;
  return <Tag>{value || "-"}</Tag>;
}
function getSalesmanPaidPercent(record: ReportItem) {
  const paid = getNumberValue(record, ["totalPaid"]);
  const receivable = getNumberValue(record, ["totalReceivable"]);
  const total = paid + receivable;
  if (total <= 0) return 0;
  return Math.min(Math.round((paid / total) * 100), 100);
}
function renderNoWrap(value: ReactNode, className = "") {
  return (
    <div className={`whitespace-nowrap leading-5 ${className}`}>{value}</div>
  );
}
function getReportRowKey(record: ReportItem, index: number) {
  const stableKey =
    record.rowId ||
    record.id ||
    record.stockInId ||
    record.documentNumber ||
    record.invoiceNumber ||
    record.sku ||
    record.salesmanId ||
    `${record.productName || record.name || record.salesmanName || "row"}-${
      record.category || ""
    }-${record.brand || ""}-${record.currentStock || 0}-${index}`;
  return String(stableKey);
}
function getSummaryIcon(key: string) {
  const lowerKey = key.toLowerCase();
  if (lowerKey.includes("salesman")) return <TeamOutlined />;
  if (lowerKey.includes("commission")) return <TrophyOutlined />;
  if (lowerKey.includes("stock")) return <DatabaseOutlined />;
  if (lowerKey.includes("low")) return <WarningOutlined />;
  if (lowerKey.includes("out")) return <WarningOutlined />;
  if (isMoneyKey(key)) return <BarChartOutlined />;
  return <FileTextOutlined />;
}
function getSummaryValueClass(key: string) {
  const lowerKey = key.toLowerCase();
  if (lowerKey.includes("out")) return "text-red-600";
  if (lowerKey.includes("low")) return "text-orange-600";
  if (lowerKey.includes("receivable")) return "text-red-600";
  if (lowerKey.includes("commission")) return "text-slate-950";
  if (isMoneyKey(key)) return "text-blue-600";
  return "text-slate-950";
}
function getSalesmanExportLabel(format: SalesmanExportFormat) {
  if (format === "kng-sales-report") return "Laporan Penjualan KNG";
  return "Rekap Persalesman";
}
export default function ReportPageClient({
  type,
  title,
}: ReportPageClientProps) {
  const { message } = App.useApp();
  const endpoint = endpointMap[type];
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(20);
  const [categories, setCategories] = useState<OptionItem[]>([]);
  const [brands, setBrands] = useState<OptionItem[]>([]);
  const [warehouses, setWarehouses] = useState<OptionItem[]>([]);
  const [suppliers, setSuppliers] = useState<OptionItem[]>([]);
  const [products, setProducts] = useState<OptionItem[]>([]);
  const [salesmen, setSalesmen] = useState<OptionItem[]>([]);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [productId, setProductId] = useState("");
  const [stockStatus, setStockStatus] = useState("");
  const [reason, setReason] = useState("");
  const [dateRange, setDateRange] = useState<
    [dayjs.Dayjs | null, dayjs.Dayjs | null] | null
  >(null);
  const now = dayjs();
  const [year, setYear] = useState(now.year());
  const [month, setMonth] = useState(now.month() + 1);
  const [kngMonthRange, setKngMonthRange] = useState<
    [dayjs.Dayjs | null, dayjs.Dayjs | null] | null
  >([now.startOf("month"), now.startOf("month")]);
  const [salesmanId, setSalesmanId] = useState("");
  const [salesmanSortBy, setSalesmanSortBy] =
    useState<SalesmanSortBy>("totalSales");
  const [salesmanSortOrder, setSalesmanSortOrder] = useState<SortOrder>("desc");
  const [salesmanExportFormat, setSalesmanExportFormat] =
    useState<SalesmanExportFormat>("salesman-recap");
  const reportRequestRef = useRef(0);
  const appliedReportRef = useRef<{ endpoint: string; query: string } | null>(null);

  async function fetchOptions() {
    try {
      const requests = await Promise.allSettled([
        fetch("/api/categories/options").then((res) => res.json()),
        fetch("/api/brands/options").then((res) => res.json()),
        fetch("/api/warehouses/options").then((res) => res.json()),
        fetch("/api/suppliers/options").then((res) => res.json()),
        fetch("/api/products/options").then((res) => res.json()),
        fetch("/api/salesmen/options").then((res) => res.json()),
      ]);
      const [
        categoriesResult,
        brandsResult,
        warehousesResult,
        suppliersResult,
        productsResult,
        salesmenResult,
      ] = requests;
      if (
        categoriesResult.status === "fulfilled" &&
        categoriesResult.value.success
      ) {
        setCategories(categoriesResult.value.data || []);
      }
      if (brandsResult.status === "fulfilled" && brandsResult.value.success) {
        setBrands(brandsResult.value.data || []);
      }
      if (
        warehousesResult.status === "fulfilled" &&
        warehousesResult.value.success
      ) {
        setWarehouses(warehousesResult.value.data || []);
      }
      if (
        suppliersResult.status === "fulfilled" &&
        suppliersResult.value.success
      ) {
        setSuppliers(suppliersResult.value.data || []);
      }
      if (
        productsResult.status === "fulfilled" &&
        productsResult.value.success
      ) {
        setProducts(productsResult.value.data || []);
      }
      if (
        salesmenResult.status === "fulfilled" &&
        salesmenResult.value.success
      ) {
        setSalesmen(salesmenResult.value.data || []);
      }
    } catch (error) {
      console.error(error);
      message.error("Gagal mengambil opsi laporan");
    }
  }
  function getQuery(exportType?: "xlsx", exportFormat?: SalesmanExportFormat) {
    const baseParams: Record<string, string | number | undefined> = {
      export: exportType,
    };
    if (type === "inventory") {
      return buildQuery({
        ...baseParams,
        search,
        categoryId,
        brandId,
        warehouseId,
        stockStatus,
      });
    }
    if (type === "stock-in") {
      return buildQuery({
        ...baseParams,
        search,
        supplierId,
        productId,
        warehouseId,
        dateFrom: dateRange?.[0]?.format("YYYY-MM-DD"),
        dateTo: dateRange?.[1]?.format("YYYY-MM-DD"),
      });
    }
    if (type === "stock-out") {
      return buildQuery({
        ...baseParams,
        search,
        reason,
        productId,
        warehouseId,
        dateFrom: dateRange?.[0]?.format("YYYY-MM-DD"),
        dateTo: dateRange?.[1]?.format("YYYY-MM-DD"),
      });
    }
    return buildQuery({
      ...baseParams,
      year,
      month,
      salesmanId,
      sortBy: salesmanSortBy,
      sortOrder: salesmanSortOrder,
      exportFormat: exportType
        ? exportFormat || salesmanExportFormat
        : undefined,
    });
  }
  async function fetchReport(query = getQuery()) {
    const requestId = ++reportRequestRef.current;
    try {
      setLoading(true);
      const response = await fetch(`${endpoint}?${query}`, { cache: "no-store" });
      const result = await response.json();
      if (requestId !== reportRequestRef.current) return;
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal mengambil laporan");
      }
      appliedReportRef.current = { endpoint, query };
      setReportData(result.data);
      setTablePage(1);
    } catch (error) {
      if (requestId !== reportRequestRef.current) return;
      appliedReportRef.current = null;
      setReportData(null);
      console.error(error);
      message.error(error instanceof Error ? error.message : "Gagal mengambil laporan");
    } finally {
      if (requestId === reportRequestRef.current) setLoading(false);
    }
  }
  function downloadExcel(format?: SalesmanExportFormat) {
    const applied = appliedReportRef.current;
    if (loading || !applied || applied.endpoint !== endpoint || applied.query !== getQuery()) {
      message.info("Tunggu laporan selesai dimuat atau klik Cari sebelum export.");
      return;
    }
    // Reuse the filters of the successfully displayed report.
    const params = new URLSearchParams(applied.query);
    params.set("export", "xlsx");
    if (type === "salesman") {
      const selectedFormat = format || salesmanExportFormat;
      setSalesmanExportFormat(selectedFormat);
      params.set("exportFormat", selectedFormat);
      if (selectedFormat === "kng-sales-report") {
        const from = kngMonthRange?.[0];
        const to = kngMonthRange?.[1];
        if (!from || !to || from.startOf("month").isAfter(to.startOf("month"))) {
          message.error("Pilih bulan awal dan akhir ekspor KNG yang valid.");
          return;
        }
        params.set("monthFrom", from.format("YYYY-MM"));
        params.set("monthTo", to.format("YYYY-MM"));
      }
    }
    window.open(`${endpoint}?${params.toString()}`, "_blank");
  }
  function handleSearch() {
    void fetchReport();
  }
  function handleRefresh() {
    void fetchReport();
  }
  function handleReset() {
    const resetDate = dayjs();
    setSearch("");
    setCategoryId("");
    setBrandId("");
    setWarehouseId("");
    setSupplierId("");
    setProductId("");
    setStockStatus("");
    setReason("");
    setDateRange(null);
    setSalesmanId("");
    setYear(resetDate.year());
    setMonth(resetDate.month() + 1);
    setKngMonthRange([resetDate.startOf("month"), resetDate.startOf("month")]);
    setSalesmanSortBy("totalSales");
    setSalesmanSortOrder("desc");
    setSalesmanExportFormat("salesman-recap");
    const query = type === "salesman"
      ? buildQuery({
          year: resetDate.year(),
          month: resetDate.month() + 1,
          sortBy: "totalSales",
          sortOrder: "desc",
        })
      : buildQuery({});
    void fetchReport(query);
  }
  useEffect(() => {
    void fetchOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);
  useEffect(() => {
    appliedReportRef.current = null;
    void fetchReport();
    return () => { reportRequestRef.current += 1; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    type,
    type === "salesman" ? year : null,
    type === "salesman" ? month : null,
    type === "salesman" ? salesmanId : null,
    type === "salesman" ? salesmanSortBy : null,
    type === "salesman" ? salesmanSortOrder : null,
  ]);
  const sortedItems = useMemo(() => {
    const items = reportData?.items || [];
    if (type !== "inventory") return items;
    return [...items].sort((a, b) => {
      const productA = getTextValue(a, ["productName", "name"]);
      const productB = getTextValue(b, ["productName", "name"]);
      const productCompare = productA.localeCompare(productB);
      if (productCompare !== 0) return productCompare;
      return getTextValue(a, ["sku"]).localeCompare(getTextValue(b, ["sku"]));
    });
  }, [reportData?.items, type]);
  const tableItems = useMemo<ReportItemWithRowKey[]>(() => {
    return sortedItems.map((item, index) => ({
      ...item,
      __rowKey: getReportRowKey(item, index),
    }));
  }, [sortedItems]);
  const columns: ColumnsType<ReportItemWithRowKey> = useMemo(() => {
    if (type === "inventory") {
      return [
        {
          title: (
            <div className="leading-tight">
              <div>Product</div>
              <div className="text-xs font-normal text-slate-400">
                SKU / Unit
              </div>
            </div>
          ),
          key: "productName",
          width: 340,
          sorter: (a, b) =>
            getTextValue(a, ["productName", "name"]).localeCompare(
              getTextValue(b, ["productName", "name"]),
            ),
          render: (_, record) => {
            const isOut = isOutOfStockRow(record);
            const isLow = isLowStockRow(record);
            return (
              <div>
                <div
                  className={`table-row-title font-semibold ${
                    isOut
                      ? "text-red-600"
                      : isLow
                        ? "text-orange-600"
                        : "text-slate-800"
                  }`}
                >
                  {getTextValue(record, ["productName", "name"])}
                </div>
                <div className="mt-0.5 font-mono text-xs text-slate-400">
                  {getTextValue(record, ["sku"])} •{" "}
                  {getTextValue(record, ["unit", "unitName", "unitShortName"])}
                </div>
              </div>
            );
          },
        },
        {
          title: (
            <div className="leading-tight">
              <div>Group</div>
              <div className="text-xs font-normal text-slate-400">
                Category / Brand
              </div>
            </div>
          ),
          key: "group",
          width: 230,
          render: (_, record) => (
            <div>
              <div className="font-medium text-slate-700">
                {getTextValue(record, ["category", "categoryName"])}
              </div>
              <div className="mt-0.5 text-xs text-slate-400">
                {getTextValue(record, ["brand", "brandName"])}
              </div>
            </div>
          ),
        },
        {
          title: (
            <div className="leading-tight">
              <div>Stock</div>
              <div className="text-xs font-normal text-slate-400">Status</div>
            </div>
          ),
          key: "currentStock",
          width: 170,
          align: "right",
          sorter: (a, b) =>
            getNumberValue(a, ["currentStock"]) -
            getNumberValue(b, ["currentStock"]),
          render: (_, record) => {
            const stock = getNumberValue(record, ["currentStock"]);
            return (
              <div className="text-right">
                <div
                  className={`text-lg font-bold ${
                    isOutOfStockRow(record)
                      ? "text-red-600"
                      : isLowStockRow(record)
                        ? "text-orange-600"
                        : "text-slate-900"
                  }`}
                >
                  {formatNumber(stock)}
                </div>
                <div className="mt-1">{getInventoryStatus(record)}</div>
              </div>
            );
          },
        },
        {
          title: (
            <div className="leading-tight">
              <div>Purchase</div>
              <div className="text-xs font-normal text-slate-400">
                Price / Value
              </div>
            </div>
          ),
          key: "purchase",
          width: 210,
          align: "right",
          render: (_, record) => (
            <div className="text-right">
              <div className="font-semibold text-slate-900">
                {formatCurrency(getNumberValue(record, ["purchasePrice"]))}
              </div>
              <div className="mt-0.5 text-xs text-slate-500">
                Value:{" "}
                {formatCurrency(getNumberValue(record, ["purchaseStockValue"]))}
              </div>
            </div>
          ),
        },
        {
          title: (
            <div className="leading-tight">
              <div>Selling</div>
              <div className="text-xs font-normal text-slate-400">
                Price / Value
              </div>
            </div>
          ),
          key: "selling",
          width: 210,
          align: "right",
          render: (_, record) => (
            <div className="text-right">
              <div className="font-semibold text-blue-600">
                {formatCurrency(getNumberValue(record, ["sellingPrice"]))}
              </div>
              <div className="mt-0.5 text-xs text-slate-500">
                Value:{" "}
                {formatCurrency(getNumberValue(record, ["sellingStockValue"]))}
              </div>
            </div>
          ),
        },
      ];
    }
    if (type === "stock-in") {
      return [
        {
          title: (
            <div className="leading-tight">
              <div>Document</div>
              <div className="text-xs font-normal text-slate-400">Date</div>
            </div>
          ),
          key: "documentNumber",
          width: 230,
          sorter: (a, b) =>
            getTextValue(a, ["documentNumber"]).localeCompare(
              getTextValue(b, ["documentNumber"]),
            ),
          render: (_, record) => {
            const documentNumber = getTextValue(record, ["documentNumber"]);
            const stockInId = getStockInDetailId(record);
            return (
              <div>
                {stockInId && stockInId !== "-" ? (
                  <Link
                    href={`/dashboard/stock-ins/${stockInId}`}
                    className="table-row-title font-semibold text-slate-800 hover:text-blue-600"
                  >
                    {documentNumber}
                  </Link>
                ) : (
                  <div className="font-semibold text-slate-800">
                    {documentNumber}
                  </div>
                )}
                <div className="mt-0.5 text-xs text-slate-400">
                  {formatDate(getTextValue(record, ["stockInDate", "date"]))}
                </div>
              </div>
            );
          },
        },
        {
          title: (
            <div className="leading-tight">
              <div>Supplier</div>
              <div className="text-xs font-normal text-slate-400">Product</div>
            </div>
          ),
          key: "supplier",
          width: 320,
          sorter: (a, b) =>
            getTextValue(a, ["supplier", "supplierName"]).localeCompare(
              getTextValue(b, ["supplier", "supplierName"]),
            ),
          render: (_, record) => (
            <div>
              <div className="font-medium text-slate-700">
                {getTextValue(record, ["supplier", "supplierName"])}
              </div>
              <div className="mt-0.5 text-xs text-slate-400">
                {getTextValue(record, ["productName", "name"])}
              </div>
            </div>
          ),
        },
        {
          title: "Qty",
          key: "quantity",
          width: 120,
          align: "right",
          sorter: (a, b) =>
            getNumberValue(a, ["quantity"]) - getNumberValue(b, ["quantity"]),
          render: (_, record) =>
            renderNoWrap(
              formatNumber(getNumberValue(record, ["quantity"])),
              "font-semibold text-slate-700",
            ),
        },
        {
          title: "Total",
          key: "totalPrice",
          width: 180,
          align: "right",
          sorter: (a, b) =>
            getNumberValue(a, ["totalPrice", "totalAmount"]) -
            getNumberValue(b, ["totalPrice", "totalAmount"]),
          render: (_, record) =>
            renderNoWrap(
              formatCurrency(
                getNumberValue(record, ["totalPrice", "totalAmount"]),
              ),
              "font-semibold text-slate-900",
            ),
        },
      ];
    }
    if (type === "salesman") {
      return [
        {
          title: (
            <div className="leading-tight">
              <div>Salesman Name</div>
              <div className="text-xs font-normal text-slate-400">Type</div>
            </div>
          ),
          key: "salesman",
          width: 280,
          sorter: (a, b) =>
            getTextValue(a, ["salesmanName"]).localeCompare(
              getTextValue(b, ["salesmanName"]),
            ),
          render: (_, record) => (
            <div>
              <div className="table-row-title font-semibold text-slate-800">
                {getTextValue(record, ["salesmanName"])}
              </div>
              <div className="mt-1">
                <Tag color="blue">{getTextValue(record, ["salesmanType"])}</Tag>
              </div>
            </div>
          ),
        },
        {
          title: (
            <div className="leading-tight">
              <div>Invoices</div>
              <div className="text-xs font-normal text-slate-400">
                Total Invoice
              </div>
            </div>
          ),
          key: "totalInvoices",
          width: 150,
          align: "center",
          sorter: (a, b) =>
            getNumberValue(a, ["totalInvoices"]) -
            getNumberValue(b, ["totalInvoices"]),
          render: (_, record) => (
            <div className="text-center">
              <div className="text-lg font-bold text-slate-900">
                {formatNumber(getNumberValue(record, ["totalInvoices"]))}
              </div>
              <div className="text-xs text-slate-400">invoices</div>
            </div>
          ),
        },
        {
          title: (
            <div className="leading-tight">
              <div>Total Sales</div>
              <div className="text-xs font-normal text-slate-400">
                Gross Sales
              </div>
            </div>
          ),
          key: "totalSales",
          width: 220,
          align: "right",
          sorter: (a, b) =>
            getNumberValue(a, ["totalSales"]) -
            getNumberValue(b, ["totalSales"]),
          render: (_, record) => (
            <div className="text-right">
              <div className="font-bold text-blue-600">
                {formatCurrency(getNumberValue(record, ["totalSales"]))}
              </div>
              <div className="text-xs text-slate-400">sales generated</div>
            </div>
          ),
        },
        {
          title: (
            <div className="leading-tight">
              <div>Receivable</div>
              <div className="text-xs font-normal text-slate-400">
                Remaining
              </div>
            </div>
          ),
          key: "totalReceivable",
          width: 220,
          align: "right",
          sorter: (a, b) =>
            getNumberValue(a, ["totalReceivable"]) -
            getNumberValue(b, ["totalReceivable"]),
          render: (_, record) => (
            <div className="text-right">
              <div className="font-bold text-red-600">
                {formatCurrency(getNumberValue(record, ["totalReceivable"]))}
              </div>
              <div className="text-xs text-slate-400">unpaid balance</div>
            </div>
          ),
        },
        {
          title: (
            <div className="leading-tight">
              <div>Payment Progress</div>
              <div className="text-xs font-normal text-slate-400">
                Paid / Receivable
              </div>
            </div>
          ),
          key: "payment",
          width: 260,
          align: "right",
          render: (_, record) => {
            const percent = getSalesmanPaidPercent(record);
            return (
              <div className="text-right">
                <div className="text-xs text-green-600">
                  Paid: {formatCurrency(getNumberValue(record, ["totalPaid"]))}
                </div>
                <div className="mt-0.5 text-xs font-semibold text-red-600">
                  Receivable:{" "}
                  {formatCurrency(getNumberValue(record, ["totalReceivable"]))}
                </div>
                <Progress
                  percent={percent}
                  size="small"
                  showInfo={false}
                  status={
                    percent >= 100
                      ? "success"
                      : percent > 0
                        ? "active"
                        : "exception"
                  }
                  className="mt-1"
                />
              </div>
            );
          },
        },
        {
          title: (
            <div className="leading-tight">
              <div>Commission</div>
              <div className="text-xs font-normal text-slate-400">
                Type / Estimate
              </div>
            </div>
          ),
          key: "commission",
          width: 240,
          align: "right",
          render: (_, record) => {
            const commissionType = getTextValue(record, ["commissionType"]);
            const commissionValue = getNumberValue(record, ["commissionValue"]);
            const estimatedCommission = getNumberValue(record, [
              "estimatedCommission",
            ]);
            return (
              <div className="text-right">
                <div>{getCommissionTag(commissionType)}</div>
                <div className="mt-1 text-xs text-slate-400">
                  Value:{" "}
                  {commissionType === "PERCENTAGE"
                    ? `${formatNumber(commissionValue)}%`
                    : formatCurrency(commissionValue)}
                </div>
                <div className="mt-0.5 font-bold text-slate-900">
                  {formatCurrency(estimatedCommission)}
                </div>
              </div>
            );
          },
        },
      ];
    }
    const firstItem = tableItems?.[0];
    if (!firstItem) return [];
    return Object.keys(firstItem)
      .filter(
        (key) => key !== "id" && key !== "__rowKey" && !key.endsWith("Id"),
      )
      .map((key) => ({
        title: labelize(key),
        dataIndex: key,
        key,
        width: isMoneyKey(key) ? 180 : 160,
        render: (value: unknown) => {
          if (value === null || value === undefined || value === "") return "-";
          if (isMoneyKey(key)) {
            return renderNoWrap(formatCurrency(value as string | number));
          }
          if (
            key.toLowerCase().includes("status") &&
            typeof value === "string"
          ) {
            return <Tag>{value}</Tag>;
          }
          return renderNoWrap(String(value));
        },
      }));
  }, [tableItems, type]);
  function renderSummary() {
    const summary = reportData?.summary || {};
    const entries = Object.entries(summary);
    if (entries.length === 0) return null;
    return (
      <div
        className={`mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 ${
          type === "salesman" ? "xl:grid-cols-6" : "xl:grid-cols-4"
        }`}
      >
        {entries.map(([key, value]) => (
          <div key={key} className="border border-slate-100 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {labelize(key)}
                </div>
                <div
                  className={`mt-2 text-xl font-bold ${getSummaryValueClass(
                    key,
                  )}`}
                >
                  {isMoneyKey(key)
                    ? formatCurrency(value)
                    : formatNumber(value)}
                </div>
              </div>
              <div className="flex h-9 w-9 items-center justify-center border border-slate-100 bg-slate-50 text-slate-500">
                {getSummaryIcon(key)}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }
  function renderFilterField(label: string, children: ReactNode) {
    return (
      <div>
        <div className="mb-1 text-sm font-semibold text-slate-700">{label}</div>
        {children}
      </div>
    );
  }
  function renderFilters() {
    if (type === "inventory") {
      return (
        <>
          {renderFilterField(
            "Search",
            <Input
              allowClear
              className="dashboard-filter-control"
              placeholder="Cari SKU / nama produk"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onPressEnter={handleSearch}
            />,
          )}
          {renderFilterField(
            "Kategori",
            <Select
              allowClear
              className="dashboard-filter-control w-full"
              placeholder="Kategori"
              value={categoryId || undefined}
              onChange={(value) => setCategoryId(value || "")}
              options={categories.map((item) => ({
                label: item.name,
                value: item.id,
              }))}
            />,
          )}
          {renderFilterField(
            "Brand",
            <Select
              allowClear
              className="dashboard-filter-control w-full"
              placeholder="Brand"
              value={brandId || undefined}
              onChange={(value) => setBrandId(value || "")}
              options={brands.map((item) => ({
                label: item.name,
                value: item.id,
              }))}
            />,
          )}
          {renderFilterField(
            "Gudang",
            <Select
              allowClear
              className="dashboard-filter-control w-full"
              placeholder="Gudang"
              value={warehouseId || undefined}
              onChange={(value) => setWarehouseId(value || "")}
              options={warehouses.map((item) => ({
                label: `${item.name}${item.code ? ` (${item.code})` : ""}`,
                value: item.id,
              }))}
            />,
          )}
          {renderFilterField(
            "Status Stok",
            <Select
              allowClear
              className="dashboard-filter-control w-full"
              placeholder="Status"
              value={stockStatus || undefined}
              onChange={(value) => setStockStatus(value || "")}
              options={[
                { label: "Normal", value: "NORMAL" },
                { label: "Stok Rendah", value: "LOW_STOCK" },
                { label: "Stok Habis", value: "OUT_OF_STOCK" },
              ]}
            />,
          )}
        </>
      );
    }
    if (type === "stock-in") {
      return (
        <>
          {renderFilterField(
            "Search",
            <Input
              allowClear
              className="dashboard-filter-control"
              placeholder="Dokumen / produk"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onPressEnter={handleSearch}
            />,
          )}
          {renderFilterField(
            "Supplier",
            <Select
              allowClear
              className="dashboard-filter-control w-full"
              placeholder="Supplier"
              value={supplierId || undefined}
              onChange={(value) => setSupplierId(value || "")}
              options={suppliers.map((item) => ({
                label: item.name,
                value: item.id,
              }))}
            />,
          )}
          {renderFilterField(
            "Produk",
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              className="dashboard-filter-control w-full"
              placeholder="Produk"
              value={productId || undefined}
              onChange={(value) => setProductId(value || "")}
              options={products.map((item) => ({
                label: `${item.sku ? `${item.sku} - ` : ""}${item.name}`,
                value: item.id,
              }))}
            />,
          )}
          {renderFilterField(
            "Gudang",
            <Select
              allowClear
              className="dashboard-filter-control w-full"
              placeholder="Gudang"
              value={warehouseId || undefined}
              onChange={(value) => setWarehouseId(value || "")}
              options={warehouses.map((item) => ({
                label: `${item.name}${item.code ? ` (${item.code})` : ""}`,
                value: item.id,
              }))}
            />,
          )}
          {renderFilterField(
            "Tanggal",
            <RangePicker
              className="dashboard-filter-control w-full"
              value={dateRange}
              onChange={(value) => setDateRange(value)}
            />,
          )}
        </>
      );
    }
    if (type === "stock-out") {
      return (
        <>
          {renderFilterField(
            "Search",
            <Input
              allowClear
              className="dashboard-filter-control"
              placeholder="Dokumen / produk"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onPressEnter={handleSearch}
            />,
          )}
          {renderFilterField(
            "Alasan",
            <Select
              allowClear
              className="dashboard-filter-control w-full"
              placeholder="Alasan"
              value={reason || undefined}
              onChange={(value) => setReason(value || "")}
              options={[
                { label: "Pemakaian Internal", value: "INTERNAL_USE" },
                { label: "Rusak", value: "DAMAGED" },
                { label: "Hilang", value: "LOST" },
                { label: "Retur ke Supplier", value: "RETURN_TO_SUPPLIER" },
                { label: "Lainnya", value: "OTHER" },
              ]}
            />,
          )}
          {renderFilterField(
            "Produk",
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              className="dashboard-filter-control w-full"
              placeholder="Produk"
              value={productId || undefined}
              onChange={(value) => setProductId(value || "")}
              options={products.map((item) => ({
                label: `${item.sku ? `${item.sku} - ` : ""}${item.name}`,
                value: item.id,
              }))}
            />,
          )}
          {renderFilterField(
            "Gudang",
            <Select
              allowClear
              className="dashboard-filter-control w-full"
              placeholder="Gudang"
              value={warehouseId || undefined}
              onChange={(value) => setWarehouseId(value || "")}
              options={warehouses.map((item) => ({
                label: `${item.name}${item.code ? ` (${item.code})` : ""}`,
                value: item.id,
              }))}
            />,
          )}
          {renderFilterField(
            "Tanggal",
            <RangePicker
              className="dashboard-filter-control w-full"
              value={dateRange}
              onChange={(value) => setDateRange(value)}
            />,
          )}
        </>
      );
    }
    return (
      <>
        {renderFilterField(
          "Tahun",
          <Input
            type="number"
            className="dashboard-filter-control"
            placeholder="Tahun"
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
          />,
        )}
        {renderFilterField(
          "Bulan",
          <Select
            className="dashboard-filter-control w-full"
            placeholder="Bulan"
            value={month}
            onChange={setMonth}
            options={Array.from({ length: 12 }).map((_, index) => ({
              label: dayjs().month(index).format("MMMM"),
              value: index + 1,
            }))}
          />,
        )}
        {renderFilterField(
          "Periode ekspor KNG",
          <RangePicker
            picker="month"
            format="MM/YYYY"
            allowClear={false}
            className="dashboard-filter-control w-full"
            value={kngMonthRange}
            onChange={(value) => setKngMonthRange(value)}
            placeholder={["Bulan awal", "Bulan akhir"]}
          />,
        )}
        {renderFilterField(
          "Salesman",
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            className="dashboard-filter-control w-full"
            placeholder="Salesman"
            value={salesmanId || undefined}
            onChange={(value) => setSalesmanId(value || "")}
            options={salesmen.map((item) => ({
              label: item.name,
              value: item.id,
            }))}
          />,
        )}
        {renderFilterField(
          "Sort By",
          <Select
            className="dashboard-filter-control w-full"
            value={salesmanSortBy}
            onChange={setSalesmanSortBy}
            options={salesmanSortOptions}
          />,
        )}
        {renderFilterField(
          "Sort Order",
          <Select
            className="dashboard-filter-control w-full"
            value={salesmanSortOrder}
            onChange={setSalesmanSortOrder}
            options={[
              { label: "Descending", value: "desc" },
              { label: "Ascending", value: "asc" },
            ]}
          />,
        )}
      </>
    );
  }
  const salesmanExportMenuItems: MenuProps["items"] = [
    {
      key: "salesman-recap",
      label: "Export Rekap Persalesman",
      icon: <FileTextOutlined />,
      onClick: () => downloadExcel("salesman-recap"),
    },
    {
      key: "kng-sales-report",
      label: "Export Laporan Penjualan KNG",
      icon: <FileTextOutlined />,
      onClick: () => downloadExcel("kng-sales-report"),
    },
  ];
  const filteredText =
    search ||
    categoryId ||
    brandId ||
    warehouseId ||
    supplierId ||
    productId ||
    stockStatus ||
    reason ||
    salesmanId ||
    dateRange
      ? "Filter applied"
      : "No filter applied";
  const periodText = reportData?.period
    ? `${formatDate(reportData.period.dateFrom)} - ${formatDate(
        reportData.period.dateTo,
      )}`
    : "-";
  return (
    <div className="text-sm">
      <div className="mb-5 border-b border-slate-100 pb-4">
        <h1 className="m-0 text-lg font-bold text-slate-950">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">
          Pantau laporan {title.toLowerCase()}, filter data, sort data, dan
          export ke Excel.
        </p>
      </div>
      <div className="form-compact mb-4 border border-slate-100 bg-white p-4">
        <div
          className={`grid grid-cols-1 gap-3 ${
            type === "salesman"
              ? "md:grid-cols-2 xl:grid-cols-6"
              : "lg:grid-cols-5"
          }`}
        >
          {renderFilters()}
        </div>
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <Button
            size="small"
            type="primary"
            icon={<SearchOutlined />}
            className="dashboard-action-btn"
            onClick={handleSearch}
          >
            Search
          </Button>
          <Button
            size="small"
            className="dashboard-action-btn"
            onClick={handleReset}
          >
            Reset
          </Button>
          <Button
            size="small"
            icon={<ReloadOutlined />}
            loading={loading}
            className="dashboard-icon-btn"
            onClick={handleRefresh}
          />
          {type === "salesman" ? (
            <Dropdown
              trigger={["click"]}
              menu={{
                items: salesmanExportMenuItems,
              }}
            >
              <Button
                size="small"
                type="primary"
                icon={<DownloadOutlined />}
                className="dashboard-action-btn"
              >
                Export Excel <DownOutlined className="text-[10px]" />
              </Button>
            </Dropdown>
          ) : (
            <Button
              size="small"
              type="primary"
              icon={<DownloadOutlined />}
              className="dashboard-action-btn"
              onClick={() => downloadExcel()}
            >
              Export Excel
            </Button>
          )}
        </div>
      </div>
      {type === "salesman" ? (
        <div className="mb-4 border border-slate-100 bg-white p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Periode Laporan
              </div>
              <div className="mt-1 font-bold text-slate-900">{periodText}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Sort
              </div>
              <div className="mt-1 font-bold text-slate-900">
                {labelize(salesmanSortBy)} /{" "}
                {salesmanSortOrder === "asc" ? "Ascending" : "Descending"}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Export Format
              </div>
              <div className="mt-1 font-bold text-slate-900">
                {getSalesmanExportLabel(salesmanExportFormat)}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {renderSummary()}
      <div>
        <div className="mb-3 text-sm text-slate-500">{filteredText}</div>
        <Table<ReportItemWithRowKey>
          rowKey={(record) => record.__rowKey}
          size="small"
          className="data-table-sm clickable-table-row"
          loading={loading}
          columns={columns}
          dataSource={tableItems}
          scroll={{
            x:
              type === "inventory"
                ? 1200
                : type === "stock-in"
                  ? 1000
                  : type === "salesman"
                    ? 1350
                    : 1600,
          }}
          rowClassName={(record) => {
            if (type !== "inventory") return "";
            if (isOutOfStockRow(record)) return "report-row-danger";
            if (isLowStockRow(record)) return "report-row-warning";
            return "";
          }}
          pagination={{
            current: tablePage,
            pageSize: tablePageSize,
            total: tableItems.length,
            showSizeChanger: true,
            pageSizeOptions: [20, 50, 100],
            showTotal: (total, range) =>
              `showing ${range[0]} to ${range[1]} of ${total} items`,
            onChange: (nextPage, nextPageSize) => {
              setTablePage(nextPage);
              setTablePageSize(nextPageSize);
            },
          }}
        />
      </div>
    </div>
  );
}
