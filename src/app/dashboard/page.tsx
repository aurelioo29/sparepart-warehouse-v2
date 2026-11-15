"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AppstoreOutlined,
  ArrowDownOutlined,
  ArrowUpOutlined,
  DollarOutlined,
  InboxOutlined,
  ReloadOutlined,
  ShoppingCartOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { Alert, Button, Empty, Skeleton, Table, Tabs, Tag } from "antd";
import dayjs from "dayjs";
import "dayjs/locale/id";
import MonthlySalesChart from "@/components/dashboard/monthly-sales-chart";

type Money = string | number | null | undefined;

type DashboardCards = {
  totalProducts: number;
  totalStockQuantity: number;
  normalStockItems: number;
  lowStockItems: number;
  outOfStockItems: number;
  totalPurchaseStockValue: number;
  totalSellingStockValue: number;
  stockInThisMonthCount: number;
  stockInThisMonthAmount: number;
  stockInPaidThisMonthAmount: number;
  stockInRemainingThisMonthAmount: number;
  stockOutThisMonthCount: number;
  stockOutThisMonthAmount: number;
  purchasePaymentThisMonthCount: number;
  purchasePaymentThisMonthAmount: number;
  salesTodayCount: number;
  salesTodayAmount: number;
  salesThisMonthCount: number;
  salesThisMonthAmount: number;
  salesPaidThisMonthAmount: number;
  salesRemainingThisMonthAmount: number;
  receivableReceivedThisMonthCount: number;
  receivableReceivedThisMonthAmount: number;
  totalReceivableReceivedCount: number;
  totalReceivableReceivedAmount: number;
  receivableInvoices: number;
  receivableAmount: number;
  overdueInvoices: number;
  overdueAmount: number;
  payableInvoices: number;
  payableAmount: number;
  overduePayableInvoices: number;
  overduePayableAmount: number;
};

type StockItem = {
  id: string;
  sku: string;
  name: string;
  category: string;
  brand: string;
  unit: string;
  warehouse: string;
  rackLocation: string;
  currentStock: number;
  minStock: number;
  shortage: number;
  stockStatus: string;
};

type TopProduct = {
  productId: string;
  sku: string;
  name: string;
  unit: string;
  totalQty: number;
  totalAmount: number;
};

type Receivable = {
  id: string;
  invoiceNumber: string;
  saleDate: string;
  dueDate?: string | null;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: string;
  overdueDays: number;
  customer?: {
    id: string;
    name: string;
    phone?: string | null;
  } | null;
  salesman?: {
    id: string;
    name: string;
  } | null;
};

type Payable = {
  id: string;
  documentNumber: string;
  invoiceNumber?: string | null;
  stockInDate: string;
  dueDate?: string | null;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: string;
  overdueDays: number;
  supplier?: {
    id: string;
    name: string;
    phone?: string | null;
  } | null;
};

type StockIn = {
  id: string;
  documentNumber: string;
  invoiceNumber?: string | null;
  stockInDate: string;
  dueDate?: string | null;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  supplier?: {
    id: string;
    name: string;
  } | null;
  itemCount: number;
  paymentCount: number;
};

type PurchasePayment = {
  id: string;
  paymentDate: string;
  amount: number;
  method: string;
  referenceNumber?: string | null;
  supplier?: {
    id: string;
    name: string;
  } | null;
  stockIn?: {
    id: string;
    documentNumber: string;
    invoiceNumber?: string | null;
  } | null;
};

type StockMovement = {
  id: string;
  type: string;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  referenceType: string;
  createdAt: string;
  product: {
    sku: string;
    name: string;
    unit?: {
      shortName: string;
    } | null;
  };
  createdBy?: {
    fullName?: string | null;
    username?: string | null;
  } | null;
};

type RecentSale = {
  id: string;
  invoiceNumber: string;
  saleDate: string;
  totalAmount: Money;
  paidAmount: Money;
  remainingAmount: Money;
  paymentStatus: string;
  customer?: {
    name?: string | null;
  } | null;
  salesman?: {
    name?: string | null;
  } | null;
};

type DashboardSummary = {
  cards: DashboardCards;
  charts: {
    stockHealth: {
      normal: number;
      lowStock: number;
      outOfStock: number;
    };
    stockMovementThisMonth: {
      in: number;
      out: number;
      adjustment: number;
    };
    salesVsReceivable: {
      sales: number;
      paid: number;
      remainingThisMonth: number;
      totalReceivable: number;
    };
    purchaseVsPayable?: {
      purchases: number;
      paid: number;
      remainingThisMonth: number;
      totalPayable: number;
    };
    paymentStatus: {
      paid: number;
      partial: number;
      unpaid: number;
    };
    purchasePaymentStatus?: {
      paid: number;
      partial: number;
      unpaid: number;
    };
  };
  tables: {
    criticalStockItems: StockItem[];
    topSellingProducts: TopProduct[];
    overdueReceivables: Receivable[];
    overduePayables: Payable[];
    recentStockIns: StockIn[];
    recentPurchasePayments: PurchasePayment[];
  };
  recentMovements: StockMovement[];
  recentSales: RecentSale[];
};

type BarItem = {
  label: string;
  value: number;
  color: string;
};

const numberFormatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 0,
});

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

function toNumber(value: Money) {
  const result = Number(value || 0);
  return Number.isFinite(result) ? result : 0;
}

function formatNumber(value: Money) {
  return numberFormatter.format(toNumber(value));
}

function formatCurrency(value: Money) {
  return currencyFormatter.format(toNumber(value));
}

function formatDate(value?: string | null, withTime = false) {
  if (!value || !dayjs(value).isValid()) return "—";

  return dayjs(value)
    .locale("id")
    .format(withTime ? "DD MMM YYYY, HH:mm" : "DD MMM YYYY");
}

function PaymentTag({ value }: { value: string }) {
  if (value === "PAID") {
    return <Tag color="green">Lunas</Tag>;
  }

  if (value === "PARTIAL") {
    return <Tag color="orange">Dibayar sebagian</Tag>;
  }

  if (value === "UNPAID") {
    return <Tag color="red">Belum dibayar</Tag>;
  }

  return <Tag>{value || "—"}</Tag>;
}

function StockTag({ value }: { value: string }) {
  if (value === "NORMAL") {
    return <Tag color="green">Stok aman</Tag>;
  }

  if (value === "LOW_STOCK") {
    return <Tag color="orange">Hampir habis</Tag>;
  }

  if (value === "OUT_OF_STOCK") {
    return <Tag color="red">Habis</Tag>;
  }

  return <Tag>{value || "—"}</Tag>;
}

function MovementTag({ value }: { value: string }) {
  if (value === "IN") {
    return <Tag color="green">Barang masuk</Tag>;
  }

  if (value === "OUT") {
    return <Tag color="blue">Barang keluar</Tag>;
  }

  return <Tag color="orange">Penyesuaian</Tag>;
}

function MethodTag({ value }: { value: string }) {
  const labels: Record<string, string> = {
    CASH: "Tunai",
    TRANSFER: "Transfer",
    QRIS: "QRIS",
  };

  return <Tag>{labels[value] || value || "—"}</Tag>;
}

function ProductName({ name, sku }: { name: string; sku: string }) {
  return (
    <div className="min-w-0">
      <div className="font-medium text-slate-800 [overflow-wrap:anywhere]">
        {name}
      </div>
      <div className="mt-0.5 text-xs text-slate-400">{sku}</div>
    </div>
  );
}

function Panel({
  title,
  description,
  extra,
  children,
}: {
  title: string;
  description?: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4 md:px-5 md:pt-5">
        <div className="min-w-0">
          <h2 className="m-0 text-sm font-semibold text-slate-900">{title}</h2>

          {description ? (
            <p className="mb-0 mt-1 text-xs leading-5 text-slate-500">
              {description}
            </p>
          ) : null}
        </div>

        {extra}
      </div>

      <div className="px-4 pb-4 md:px-5 md:pb-5">{children}</div>
    </section>
  );
}

function MetricCard({
  title,
  value,
  description,
  icon,
  tone = "blue",
}: {
  title: string;
  value: string;
  description: string;
  icon: ReactNode;
  tone?: "blue" | "green" | "orange" | "purple";
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    orange: "bg-orange-50 text-orange-600",
    purple: "bg-violet-50 text-violet-600",
  };

  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3.5 md:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium leading-5 text-slate-500">
          {title}
        </span>

        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-base ${tones[tone]}`}
        >
          {icon}
        </span>
      </div>

      <div className="mt-3 text-lg font-bold tracking-tight text-slate-900 [overflow-wrap:anywhere] md:text-2xl">
        {value}
      </div>

      <p className="mb-0 mt-1.5 text-[11px] leading-5 text-slate-500 md:text-xs">
        {description}
      </p>
    </div>
  );
}

function SmallMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-xs leading-5 text-slate-500">{label}</div>

      <div className="mt-1 text-sm font-semibold text-slate-900 [overflow-wrap:anywhere] md:text-base">
        {value}
      </div>

      {detail ? (
        <div className="mt-1 text-[11px] leading-4 text-slate-400">
          {detail}
        </div>
      ) : null}
    </div>
  );
}

function BarChart({
  items,
  money = false,
}: {
  items: BarItem[];
  money?: boolean;
}) {
  const maximum = Math.max(
    ...items.map((item) => Math.abs(toNumber(item.value))),
    0,
  );

  if (maximum === 0) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Belum ada data untuk grafik"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const width = (Math.abs(toNumber(item.value)) / maximum) * 100;

        return (
          <div key={item.label}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
              <span className="text-slate-500">{item.label}</span>

              <span className="font-semibold text-slate-800">
                {money ? formatCurrency(item.value) : formatNumber(item.value)}
              </span>
            </div>

            <div
              className="h-2.5 overflow-hidden rounded-full bg-slate-100"
              role="img"
              aria-label={`${item.label}: ${
                money ? formatCurrency(item.value) : formatNumber(item.value)
              }`}
            >
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${width}%`,
                  backgroundColor: item.color,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StockHealthChart({
  normal,
  low,
  empty,
}: {
  normal: number;
  low: number;
  empty: number;
}) {
  const segments = [
    {
      label: "Stok aman",
      value: Math.max(0, toNumber(normal)),
      color: "#10b981",
    },
    {
      label: "Hampir habis",
      value: Math.max(0, toNumber(low)),
      color: "#f59e0b",
    },
    {
      label: "Stok habis",
      value: Math.max(0, toNumber(empty)),
      color: "#f43f5e",
    },
  ];

  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  if (!total) {
    return (
      <div className="flex min-h-48 items-center justify-center">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Belum ada data stok"
        />
      </div>
    );
  }

  const radius = 66;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center xl:flex-col 2xl:flex-row">
      <div className="relative h-44 w-44 shrink-0">
        <svg
          viewBox="0 0 176 176"
          className="h-full w-full"
          role="img"
          aria-label={`Kondisi stok: ${formatNumber(normal)} produk aman, ${formatNumber(low)} hampir habis, ${formatNumber(empty)} habis`}
        >
          <circle
            cx="88"
            cy="88"
            r={radius}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth="20"
          />

          <g transform="rotate(-90 88 88)">
            {segments.map((segment) => {
              const length = (segment.value / total) * circumference;

              const currentOffset = offset;
              offset += length;

              return (
                <circle
                  key={segment.label}
                  cx="88"
                  cy="88"
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth="20"
                  strokeDasharray={`${length} ${circumference}`}
                  strokeDashoffset={-currentOffset}
                />
              );
            })}
          </g>
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-slate-900">
            {formatNumber(total)}
          </span>
          <span className="mt-1 text-xs text-slate-400">produk</span>
        </div>
      </div>

      <div className="w-full space-y-3 sm:max-w-56">
        {segments.map((segment) => (
          <div
            key={segment.label}
            className="flex items-center justify-between gap-3 text-xs"
          >
            <span className="flex items-center gap-2 text-slate-500">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: segment.color }}
              />
              {segment.label}
            </span>

            <span className="font-semibold text-slate-800">
              {formatNumber(segment.value)}
              <span className="ml-1.5 font-normal text-slate-400">
                {Math.round((segment.value / total) * 100)}%
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PaymentBreakdown({
  paid,
  remaining,
}: {
  paid: number;
  remaining: number;
}) {
  const safePaid = Math.max(0, toNumber(paid));
  const safeRemaining = Math.max(0, toNumber(remaining));
  const total = safePaid + safeRemaining;
  const percentage = total ? (safePaid / total) * 100 : 0;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-xs text-slate-500">
          Bagian yang sudah dibayar
        </span>
        <span className="text-sm font-semibold text-emerald-600">
          {total ? `${percentage.toFixed(0)}%` : "—"}
        </span>
      </div>

      <div
        className="flex h-3 overflow-hidden rounded-full bg-slate-100"
        role="img"
        aria-label={`Sudah dibayar ${formatCurrency(safePaid)}, belum dibayar ${formatCurrency(safeRemaining)}`}
      >
        <div
          className="h-full bg-emerald-500 transition-[width] duration-500"
          style={{ width: `${percentage}%` }}
        />

        <div
          className="h-full bg-orange-300 transition-[width] duration-500"
          style={{
            width: total ? `${100 - percentage}%` : "0%",
          }}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Sudah dibayar
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-800 [overflow-wrap:anywhere]">
            {formatCurrency(safePaid)}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="h-2 w-2 rounded-full bg-orange-300" />
            Belum dibayar
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-800 [overflow-wrap:anywhere]">
            {formatCurrency(safeRemaining)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const requestController = useRef<AbortController | null>(null);

  const fetchSummary = useCallback(async () => {
    requestController.current?.abort();

    const controller = new AbortController();
    requestController.current = controller;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/dashboard/summary", {
        cache: "no-store",
        signal: controller.signal,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Data dashboard belum bisa dimuat");
      }

      if (controller.signal.aborted) return;

      setSummary(result.data);
      setUpdatedAt(new Date());
    } catch (error) {
      if (controller.signal.aborted) return;

      setError(
        error instanceof Error
          ? error.message
          : "Data dashboard belum bisa dimuat",
      );
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchSummary();

    return () => {
      requestController.current?.abort();
    };
  }, [fetchSummary]);

  const topProducts = useMemo(
    () =>
      [...(summary?.tables.topSellingProducts || [])]
        .sort((a, b) => toNumber(b.totalAmount) - toNumber(a.totalAmount))
        .slice(0, 5),
    [summary],
  );

  const topProductMaximum = Math.max(
    ...topProducts.map((item) => toNumber(item.totalAmount)),
    0,
  );

  const cards = summary?.cards;
  const tables = summary?.tables;
  const charts = summary?.charts;

  const tablePagination = {
    pageSize: 5,
    size: "small" as const,
    hideOnSinglePage: true,
    showSizeChanger: false,
  };

  const overdueTabs = [
    {
      key: "receivables",
      label: `Tagihan pelanggan (${formatNumber(cards?.overdueInvoices)})`,
      children: (
        <Table<Receivable>
          rowKey="id"
          size="small"
          pagination={tablePagination}
          scroll={{ x: 700 }}
          locale={{ emptyText: "Tidak ada tagihan yang terlambat" }}
          dataSource={tables?.overdueReceivables || []}
          columns={[
            {
              title: "Faktur / pelanggan",
              key: "invoice",
              width: 230,
              render: (_, record) => (
                <div>
                  <div className="font-medium text-blue-600">
                    {record.invoiceNumber}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {record.customer?.name || "Tanpa nama pelanggan"}
                  </div>
                  {record.customer?.phone ? (
                    <div className="mt-0.5 text-xs text-slate-400">
                      {record.customer.phone}
                    </div>
                  ) : null}
                </div>
              ),
            },
            {
              title: "Batas pembayaran",
              dataIndex: "dueDate",
              render: (value: string | null) => formatDate(value),
            },
            {
              title: "Belum dibayar",
              dataIndex: "remainingAmount",
              align: "right",
              render: (value: number) => (
                <span className="font-semibold text-rose-600">
                  {formatCurrency(value)}
                </span>
              ),
            },
            {
              title: "Terlambat",
              dataIndex: "overdueDays",
              align: "right",
              render: (value: number) => (
                <Tag color="red">{formatNumber(value)} hari</Tag>
              ),
            },
          ]}
        />
      ),
    },
    {
      key: "payables",
      label: `Utang pemasok (${formatNumber(cards?.overduePayableInvoices)})`,
      children: (
        <Table<Payable>
          rowKey="id"
          size="small"
          pagination={tablePagination}
          scroll={{ x: 700 }}
          locale={{ emptyText: "Tidak ada utang yang terlambat" }}
          dataSource={tables?.overduePayables || []}
          columns={[
            {
              title: "Dokumen / pemasok",
              key: "document",
              width: 230,
              render: (_, record) => (
                <div>
                  <div className="font-medium text-blue-600">
                    {record.documentNumber}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {record.supplier?.name || "Tanpa nama pemasok"}
                  </div>
                  {record.invoiceNumber ? (
                    <div className="mt-0.5 text-xs text-slate-400">
                      Faktur: {record.invoiceNumber}
                    </div>
                  ) : null}
                </div>
              ),
            },
            {
              title: "Batas pembayaran",
              dataIndex: "dueDate",
              render: (value: string | null) => formatDate(value),
            },
            {
              title: "Belum dibayar",
              dataIndex: "remainingAmount",
              align: "right",
              render: (value: number) => (
                <span className="font-semibold text-rose-600">
                  {formatCurrency(value)}
                </span>
              ),
            },
            {
              title: "Terlambat",
              dataIndex: "overdueDays",
              align: "right",
              render: (value: number) => (
                <Tag color="red">{formatNumber(value)} hari</Tag>
              ),
            },
          ]}
        />
      ),
    },
  ];

  const activityTabs = [
    {
      key: "sales",
      label: "Penjualan",
      children: (
        <Table<RecentSale>
          rowKey="id"
          size="small"
          pagination={tablePagination}
          scroll={{ x: 760 }}
          dataSource={summary?.recentSales || []}
          columns={[
            {
              title: "Faktur",
              dataIndex: "invoiceNumber",
              render: (value: string) => (
                <span className="font-medium text-blue-600">{value}</span>
              ),
            },
            {
              title: "Tanggal",
              dataIndex: "saleDate",
              render: (value: string) => formatDate(value),
            },
            {
              title: "Pelanggan",
              key: "customer",
              render: (_, record) => record.customer?.name || "—",
            },
            {
              title: "Total penjualan",
              dataIndex: "totalAmount",
              align: "right",
              render: (value: Money) => formatCurrency(value),
            },
            {
              title: "Pembayaran",
              dataIndex: "paymentStatus",
              render: (value: string) => <PaymentTag value={value} />,
            },
          ]}
        />
      ),
    },
    {
      key: "purchases",
      label: "Pembelian",
      children: (
        <Table<StockIn>
          rowKey="id"
          size="small"
          pagination={tablePagination}
          scroll={{ x: 760 }}
          dataSource={tables?.recentStockIns || []}
          columns={[
            {
              title: "Dokumen",
              dataIndex: "documentNumber",
              render: (value: string) => (
                <span className="font-medium text-blue-600">{value}</span>
              ),
            },
            {
              title: "Tanggal",
              dataIndex: "stockInDate",
              render: (value: string) => formatDate(value),
            },
            {
              title: "Pemasok",
              key: "supplier",
              render: (_, record) => record.supplier?.name || "—",
            },
            {
              title: "Total pembelian",
              dataIndex: "totalAmount",
              align: "right",
              render: (value: number) => formatCurrency(value),
            },
            {
              title: "Pembayaran",
              dataIndex: "paymentStatus",
              render: (value: string) => <PaymentTag value={value} />,
            },
          ]}
        />
      ),
    },
    {
      key: "movements",
      label: "Perubahan stok",
      children: (
        <Table<StockMovement>
          rowKey="id"
          size="small"
          pagination={tablePagination}
          scroll={{ x: 850 }}
          dataSource={summary?.recentMovements || []}
          columns={[
            {
              title: "Produk",
              key: "product",
              width: 240,
              render: (_, record) => (
                <ProductName
                  name={record.product.name}
                  sku={record.product.sku}
                />
              ),
            },
            {
              title: "Aktivitas",
              dataIndex: "type",
              render: (value: string) => <MovementTag value={value} />,
            },
            {
              title: "Jumlah",
              key: "quantity",
              align: "right",
              render: (_, record) =>
                `${formatNumber(record.quantity)} ${
                  record.product.unit?.shortName || ""
                }`,
            },
            {
              title: "Stok sebelum → sesudah",
              key: "stock",
              align: "right",
              render: (_, record) =>
                `${formatNumber(record.stockBefore)} → ${formatNumber(
                  record.stockAfter,
                )}`,
            },
            {
              title: "Waktu",
              dataIndex: "createdAt",
              render: (value: string) => formatDate(value, true),
            },
          ]}
        />
      ),
    },
    {
      key: "payments",
      label: "Pembayaran pemasok",
      children: (
        <Table<PurchasePayment>
          rowKey="id"
          size="small"
          pagination={tablePagination}
          scroll={{ x: 760 }}
          dataSource={tables?.recentPurchasePayments || []}
          columns={[
            {
              title: "Tanggal",
              dataIndex: "paymentDate",
              render: (value: string) => formatDate(value),
            },
            {
              title: "Dokumen",
              key: "document",
              render: (_, record) => (
                <span className="font-medium text-blue-600">
                  {record.stockIn?.documentNumber || "—"}
                </span>
              ),
            },
            {
              title: "Pemasok",
              key: "supplier",
              render: (_, record) => record.supplier?.name || "—",
            },
            {
              title: "Jumlah dibayar",
              dataIndex: "amount",
              align: "right",
              render: (value: number) => formatCurrency(value),
            },
            {
              title: "Cara bayar",
              dataIndex: "method",
              render: (value: string) => <MethodTag value={value} />,
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="min-w-0 space-y-4 text-sm md:space-y-5">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="m-0 text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
              Ringkasan usaha
            </h1>

            {updatedAt ? (
              <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-600">
                {dayjs(updatedAt).locale("id").format("MMMM YYYY")}
              </span>
            ) : null}
          </div>

          <p className="mb-0 mt-1.5 text-xs leading-5 text-slate-500 md:text-sm">
            Pantau penjualan, persediaan, dan pembayaran dalam satu halaman.
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <span className="text-[11px] text-slate-400" aria-live="polite">
            {updatedAt
              ? `Diperbarui ${dayjs(updatedAt).format("HH:mm")}`
              : "Memuat data…"}
          </span>

          <Button
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={() => void fetchSummary()}
          >
            Perbarui
          </Button>
        </div>
      </header>

      {error ? (
        <Alert
          type="error"
          showIcon
          message="Data belum berhasil diperbarui"
          description={
            summary
              ? `${error}. Halaman masih menampilkan data sebelumnya.`
              : error
          }
          action={
            <Button
              size="small"
              loading={loading}
              onClick={() => void fetchSummary()}
            >
              Coba lagi
            </Button>
          }
        />
      ) : null}

      {!summary ? (
        loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-slate-200 bg-white p-5"
              >
                <Skeleton active paragraph={{ rows: 3 }} />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-8">
            <Empty description="Data dashboard belum tersedia" />
          </div>
        )
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 md:gap-4">
            <MetricCard
              title="Penjualan bulan ini"
              value={formatCurrency(cards?.salesThisMonthAmount)}
              description={`${formatNumber(
                cards?.salesThisMonthCount,
              )} faktur penjualan`}
              icon={<ShoppingCartOutlined />}
              tone="blue"
            />

            <MetricCard
              title="Pembelian bulan ini"
              value={formatCurrency(cards?.stockInThisMonthAmount)}
              description={`${formatNumber(
                cards?.stockInThisMonthCount,
              )} dokumen pembelian`}
              icon={<InboxOutlined />}
              tone="purple"
            />

            <MetricCard
              title="Tagihan ke pelanggan"
              value={formatCurrency(cards?.receivableAmount)}
              description={`${formatNumber(
                cards?.receivableInvoices,
              )} faktur belum lunas · semua periode`}
              icon={<DollarOutlined />}
              tone="green"
            />

            <MetricCard
              title="Utang ke pemasok"
              value={formatCurrency(cards?.payableAmount)}
              description={`${formatNumber(
                cards?.payableInvoices,
              )} faktur belum lunas · semua periode`}
              icon={<DollarOutlined />}
              tone="orange"
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
            <div className="grid grid-cols-2 gap-5 xl:grid-cols-4">
              <SmallMetric
                label="Penjualan hari ini"
                value={formatCurrency(cards?.salesTodayAmount)}
                detail={`${formatNumber(cards?.salesTodayCount)} faktur`}
              />

              <SmallMetric
                label="Pembayaran pelanggan bulan ini"
                value={formatCurrency(cards?.receivableReceivedThisMonthAmount)}
                detail={`${formatNumber(
                  cards?.receivableReceivedThisMonthCount,
                )} pembayaran diterima`}
              />

              <SmallMetric
                label="Pembayaran ke pemasok bulan ini"
                value={formatCurrency(cards?.purchasePaymentThisMonthAmount)}
                detail={`${formatNumber(
                  cards?.purchasePaymentThisMonthCount,
                )} pembayaran`}
              />

              <SmallMetric
                label="Barang keluar bulan ini"
                value={formatCurrency(cards?.stockOutThisMonthAmount)}
                detail={`${formatNumber(
                  cards?.stockOutThisMonthCount,
                )} dokumen barang keluar`}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-orange-200 bg-orange-50/70 p-4">
            <div className="mb-3 flex items-center gap-2">
              <WarningOutlined className="text-orange-500" />
              <span className="text-xs font-semibold text-slate-800">
                Perlu diperhatikan
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              <SmallMetric
                label="Produk hampir habis"
                value={`${formatNumber(cards?.lowStockItems)} produk`}
              />
              <SmallMetric
                label="Produk sudah habis"
                value={`${formatNumber(cards?.outOfStockItems)} produk`}
              />
              <SmallMetric
                label="Tagihan pelanggan terlambat"
                value={formatCurrency(cards?.overdueAmount)}
                detail={`${formatNumber(cards?.overdueInvoices)} faktur`}
              />
              <SmallMetric
                label="Utang pemasok terlambat"
                value={formatCurrency(cards?.overduePayableAmount)}
                detail={`${formatNumber(cards?.overduePayableInvoices)} faktur`}
              />
            </div>
          </div>

          <MonthlySalesChart />

          <div className="grid items-start gap-4 xl:grid-cols-3">
            <Panel
              title="Kondisi persediaan"
              description="Jumlah produk berdasarkan ketersediaan stok saat ini."
              extra={<AppstoreOutlined className="text-lg text-slate-400" />}
            >
              <StockHealthChart
                normal={
                  charts?.stockHealth?.normal ?? cards?.normalStockItems ?? 0
                }
                low={charts?.stockHealth?.lowStock ?? cards?.lowStockItems ?? 0}
                empty={
                  charts?.stockHealth?.outOfStock ?? cards?.outOfStockItems ?? 0
                }
              />

              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
                <SmallMetric
                  label="Jenis produk"
                  value={formatNumber(cards?.totalProducts)}
                />
                <SmallMetric
                  label="Jumlah stok tercatat"
                  value={formatNumber(cards?.totalStockQuantity)}
                />
              </div>
            </Panel>

            <Panel
              title="Pergerakan stok bulan ini"
              description="Perbandingan jumlah pada rekap barang masuk, keluar, dan penyesuaian."
            >
              <div className="py-3">
                <BarChart
                  items={[
                    {
                      label: "Barang masuk",
                      value: charts?.stockMovementThisMonth?.in ?? 0,
                      color: "#10b981",
                    },
                    {
                      label: "Barang keluar",
                      value: charts?.stockMovementThisMonth?.out ?? 0,
                      color: "#3b82f6",
                    },
                    {
                      label: "Penyesuaian stok",
                      value: charts?.stockMovementThisMonth?.adjustment ?? 0,
                      color: "#f59e0b",
                    },
                  ]}
                />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
                <SmallMetric
                  label="Dokumen masuk"
                  value={formatNumber(cards?.stockInThisMonthCount)}
                />
                <SmallMetric
                  label="Dokumen keluar"
                  value={formatNumber(cards?.stockOutThisMonthCount)}
                />
              </div>
            </Panel>

            <Panel
              title="Penjualan dan pembelian"
              description="Perbandingan nilai transaksi bulan ini."
            >
              <div className="py-3">
                <BarChart
                  money
                  items={[
                    {
                      label: "Penjualan",
                      value: cards?.salesThisMonthAmount ?? 0,
                      color: "#3b82f6",
                    },
                    {
                      label: "Pembelian",
                      value: cards?.stockInThisMonthAmount ?? 0,
                      color: "#8b5cf6",
                    },
                  ]}
                />
              </div>

              <p className="mb-0 mt-4 rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-5 text-slate-500">
                Nilai transaksi belum menunjukkan laba atau saldo kas.
              </p>
            </Panel>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Panel
              title="Pembayaran penjualan bulan ini"
              description="Status pembayaran untuk faktur penjualan yang dibuat bulan ini."
            >
              <PaymentBreakdown
                paid={cards?.salesPaidThisMonthAmount ?? 0}
                remaining={cards?.salesRemainingThisMonthAmount ?? 0}
              />

              {charts?.paymentStatus ? (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                  <Tag color="green">
                    {formatNumber(charts.paymentStatus.paid)} lunas
                  </Tag>
                  <Tag color="orange">
                    {formatNumber(charts.paymentStatus.partial)} dibayar
                    sebagian
                  </Tag>
                  <Tag>
                    {formatNumber(charts.paymentStatus.unpaid)} belum dibayar
                  </Tag>
                </div>
              ) : null}
            </Panel>

            <Panel
              title="Pembayaran pembelian bulan ini"
              description="Status pembayaran untuk dokumen pembelian yang dibuat bulan ini."
            >
              <PaymentBreakdown
                paid={cards?.stockInPaidThisMonthAmount ?? 0}
                remaining={cards?.stockInRemainingThisMonthAmount ?? 0}
              />

              {charts?.purchasePaymentStatus ? (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                  <Tag color="green">
                    {formatNumber(charts.purchasePaymentStatus.paid)} lunas
                  </Tag>
                  <Tag color="orange">
                    {formatNumber(charts.purchasePaymentStatus.partial)} dibayar
                    sebagian
                  </Tag>
                  <Tag>
                    {formatNumber(charts.purchasePaymentStatus.unpaid)} belum
                    dibayar
                  </Tag>
                </div>
              ) : null}
            </Panel>
          </div>

          <div className="grid items-start gap-4 xl:grid-cols-2">
            <Panel
              title="Produk yang perlu diisi ulang"
              description="Periksa produk yang stoknya menipis atau sudah habis."
            >
              <Table<StockItem>
                rowKey="id"
                size="small"
                pagination={tablePagination}
                scroll={{ x: 650 }}
                dataSource={tables?.criticalStockItems || []}
                locale={{
                  emptyText: "Tidak ada produk dengan stok kritis",
                }}
                columns={[
                  {
                    title: "Produk",
                    key: "product",
                    width: 230,
                    render: (_, record) => (
                      <ProductName name={record.name} sku={record.sku} />
                    ),
                  },
                  {
                    title: "Stok",
                    key: "stock",
                    align: "right",
                    render: (_, record) => (
                      <span className="font-semibold">
                        {formatNumber(record.currentStock)} {record.unit}
                      </span>
                    ),
                  },
                  {
                    title: "Batas minimum",
                    dataIndex: "minStock",
                    align: "right",
                    render: (value: number) => formatNumber(value),
                  },
                  {
                    title: "Kondisi",
                    dataIndex: "stockStatus",
                    render: (value: string) => <StockTag value={value} />,
                  },
                ]}
              />
            </Panel>

            <Panel
              title="5 produk terlaris bulan ini"
              description="Diurutkan berdasarkan nilai penjualan pada data produk terlaris."
            >
              {topProducts.length ? (
                <div className="space-y-4">
                  {topProducts.map((product, index) => {
                    const width = topProductMaximum
                      ? Math.max(
                          0,
                          (toNumber(product.totalAmount) / topProductMaximum) *
                            100,
                        )
                      : 0;

                    return (
                      <div key={product.productId}>
                        <div className="flex items-start gap-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[11px] font-semibold text-blue-600">
                            {index + 1}
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                              <div className="min-w-0">
                                <div className="text-xs font-medium leading-5 text-slate-800 [overflow-wrap:anywhere]">
                                  {product.name}
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  {formatNumber(product.totalQty)}{" "}
                                  {product.unit} terjual
                                </div>
                              </div>

                              <span className="text-xs font-semibold text-slate-800">
                                {formatCurrency(product.totalAmount)}
                              </span>
                            </div>

                            <div
                              className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"
                              role="img"
                              aria-label={`${product.name}: ${formatCurrency(
                                product.totalAmount,
                              )}`}
                            >
                              <div
                                className="h-full rounded-full bg-blue-500"
                                style={{ width: `${width}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="Belum ada produk terjual"
                />
              )}
            </Panel>
          </div>

          <Panel
            title="Pembayaran yang sudah lewat batas waktu"
            description="Tagihan pelanggan perlu ditagih, sedangkan utang pemasok perlu diselesaikan."
          >
            <Tabs
              defaultActiveKey="receivables"
              size="small"
              items={overdueTabs}
            />
          </Panel>

          <Panel
            title="Aktivitas terbaru"
            description="Lihat transaksi dan perubahan stok terakhir."
          >
            <Tabs defaultActiveKey="sales" size="small" items={activityTabs} />
          </Panel>

          <Panel
            title="Nilai persediaan dan penerimaan"
            description="Ringkasan persediaan saat ini dan pembayaran pelanggan yang tercatat."
          >
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                  <ArrowDownOutlined />
                </span>
                <SmallMetric
                  label="Modal barang yang masih tersedia"
                  value={formatCurrency(cards?.totalPurchaseStockValue)}
                  detail="Nilai persediaan berdasarkan harga beli."
                />
              </div>

              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <ArrowUpOutlined />
                </span>
                <SmallMetric
                  label="Nilai jual barang yang tersedia"
                  value={formatCurrency(cards?.totalSellingStockValue)}
                  detail="Perkiraan nilai berdasarkan harga jual tercatat."
                />
              </div>

              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <DollarOutlined />
                </span>
                <SmallMetric
                  label="Total pembayaran pelanggan"
                  value={formatCurrency(cards?.totalReceivableReceivedAmount)}
                  detail={`${formatNumber(
                    cards?.totalReceivableReceivedCount,
                  )} pembayaran tercatat · semua periode`}
                />
              </div>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
