"use client";

import { useEffect, useState } from "react";
import {
  App,
  Button,
  Input,
  Progress,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CreditCardOutlined,
  DownloadOutlined,
  EyeOutlined,
  FileTextOutlined,
  ReloadOutlined,
  SearchOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";

import type { PayableOption } from "@/components/purchase-payments/purchase-payment-form";

type SupplierOption = {
  id: string;
  name: string;
};

type PayablesResponse = {
  summary: {
    totalInvoices: number;
    totalDebt: number;
    overdueInvoices: number;
    overdueDebt: number;
  };
  items: PayableOption[];
};

type PayableTableItem = PayableOption & {
  paymentStatus?: string;
  overdueDays?: number;
  paymentCount?: number;
  itemCount?: number;
};

function formatCurrency(value: string | number | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDate(value?: string | null) {
  if (!value) return "-";

  return dayjs(value).format("YYYY-MM-DD");
}

function getPaymentStatusTag(value?: string | null) {
  if (value === "PAID") return <Tag color="green">PAID</Tag>;
  if (value === "PARTIAL") return <Tag color="blue">PARTIAL</Tag>;
  if (value === "UNPAID") return <Tag color="orange">UNPAID</Tag>;

  return <Tag>{value || "-"}</Tag>;
}

function getOverdueTag(value?: number | null) {
  const days = Number(value || 0);

  if (days > 0) {
    return <Tag color="red">{days} days</Tag>;
  }

  return <Tag>0 days</Tag>;
}

function getPaymentPercent(record: PayableTableItem) {
  const totalAmount = Number(record.totalAmount || 0);
  const paidAmount = Number(record.paidAmount || 0);

  if (!totalAmount || totalAmount <= 0) return 0;

  return Math.min(Math.round((paidAmount / totalAmount) * 100), 100);
}

function buildPayableQuery(params: {
  search?: string;
  supplierId?: string;
  paymentStatus?: string;
  overdueOnly?: string;
  exportType?: "xlsx";
}) {
  const query = new URLSearchParams();

  if (params.search) query.set("search", params.search);
  if (params.supplierId) query.set("supplierId", params.supplierId);
  if (params.paymentStatus) query.set("paymentStatus", params.paymentStatus);
  if (params.overdueOnly) query.set("overdueOnly", params.overdueOnly);
  if (params.exportType) query.set("export", params.exportType);

  return query.toString();
}

export default function PayablesPageClient() {
  const router = useRouter();
  const { message } = App.useApp();

  const [loading, setLoading] = useState(false);

  const [data, setData] = useState<PayablesResponse | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);

  const [search, setSearch] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [overdueOnly, setOverdueOnly] = useState("");

  async function fetchOptions() {
    try {
      const response = await fetch("/api/suppliers/options");
      const result = await response.json();

      if (result.success) {
        setSuppliers(result.data || []);
      }
    } catch (error) {
      console.error(error);
      message.error("Gagal mengambil supplier options");
    }
  }

  async function fetchPayables(params?: {
    search?: string;
    supplierId?: string;
    paymentStatus?: string;
    overdueOnly?: string;
  }) {
    try {
      setLoading(true);

      const query = buildPayableQuery({
        search: params?.search ?? search,
        supplierId: params?.supplierId ?? supplierId,
        paymentStatus: params?.paymentStatus ?? paymentStatus,
        overdueOnly: params?.overdueOnly ?? overdueOnly,
      });

      const response = await fetch(`/api/payables?${query}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch payables");
      }

      setData(result.data);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal mengambil payables",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleSearch() {
    void fetchPayables({
      search,
      supplierId,
      paymentStatus,
      overdueOnly,
    });
  }

  function handleReset() {
    setSearch("");
    setSupplierId("");
    setPaymentStatus("");
    setOverdueOnly("");

    void fetchPayables({
      search: "",
      supplierId: "",
      paymentStatus: "",
      overdueOnly: "",
    });
  }

  function handleRefresh() {
    void fetchPayables({
      search,
      supplierId,
      paymentStatus,
      overdueOnly,
    });

    void fetchOptions();
  }

  function handlePay(record: PayableTableItem) {
    router.push(`/dashboard/purchase-payments/create?stockInId=${record.id}`);
  }

  function handleOpenStockIn(record: PayableTableItem) {
    router.push(`/dashboard/stock-ins/${record.id}`);
  }

  function handleExportExcel() {
    const query = buildPayableQuery({
      search,
      supplierId,
      paymentStatus,
      overdueOnly,
      exportType: "xlsx",
    });

    window.open(`/api/payables?${query}`, "_blank");
  }

  useEffect(() => {
    void fetchOptions();
    void fetchPayables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columns: ColumnsType<PayableTableItem> = [
    {
      title: (
        <div className="leading-tight">
          <div>Document</div>
          <div className="text-xs font-normal text-slate-400">
            Invoice / Date
          </div>
        </div>
      ),
      dataIndex: "documentNumber",
      width: 260,
      render: (value: string, record) => (
        <div>
          <div className="table-row-title font-semibold text-slate-800">
            {value}
          </div>

          <div className="mt-0.5 font-mono text-xs text-slate-400">
            {record.invoiceNumber || "-"}
          </div>

          <div className="mt-0.5 text-xs text-slate-500">
            {formatDate(record.stockInDate)}
          </div>
        </div>
      ),
    },
    {
      title: (
        <div className="leading-tight">
          <div>Supplier</div>
          <div className="text-xs font-normal text-slate-400">Due Date</div>
        </div>
      ),
      width: 240,
      render: (_, record) => (
        <div>
          <div className="font-medium text-slate-700">
            {record.supplier?.name || "-"}
          </div>

          <div className="mt-0.5 text-xs text-slate-400">
            Due: {formatDate(record.dueDate)}
          </div>
        </div>
      ),
    },
    {
      title: (
        <div className="leading-tight">
          <div>Amount</div>
          <div className="text-xs font-normal text-slate-400">
            Total / Paid / Remaining
          </div>
        </div>
      ),
      key: "amount",
      width: 280,
      align: "right",
      render: (_, record) => {
        const percent = getPaymentPercent(record);

        return (
          <div className="text-right">
            <div className="font-semibold text-slate-900">
              {formatCurrency(record.totalAmount)}
            </div>

            <div className="mt-0.5 text-xs text-green-600">
              Paid: {formatCurrency(record.paidAmount)}
            </div>

            <div className="mt-0.5 text-xs font-semibold text-red-600">
              Remain: {formatCurrency(record.remainingAmount)}
            </div>

            <Progress
              percent={percent}
              size="small"
              showInfo={false}
              status={
                record.paymentStatus === "PAID"
                  ? "success"
                  : record.paymentStatus === "PARTIAL"
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
          <div>Status</div>
          <div className="text-xs font-normal text-slate-400">Overdue</div>
        </div>
      ),
      key: "status",
      width: 170,
      render: (_, record) => (
        <Space size={4} wrap>
          {getPaymentStatusTag(record.paymentStatus)}
          {getOverdueTag(record.overdueDays)}
        </Space>
      ),
    },
    {
      title: (
        <div className="leading-tight">
          <div>Count</div>
          <div className="text-xs font-normal text-slate-400">Items / Pay</div>
        </div>
      ),
      key: "count",
      width: 130,
      render: (_, record) => (
        <div>
          <div className="font-medium text-slate-700">
            {record.itemCount || 0} items
          </div>

          <div className="text-xs text-slate-400">
            {record.paymentCount || 0} payments
          </div>
        </div>
      ),
    },
    {
      title: "Action",
      key: "action",
      width: 120,
      align: "center",
      fixed: "right",
      render: (_, record) => (
        <Space size={4} onClick={(event) => event.stopPropagation()}>
          <Tooltip title="Detail Stock In">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              className="dashboard-table-action-btn"
              onClick={() => handleOpenStockIn(record)}
            />
          </Tooltip>

          <Tooltip title="Pay">
            <Button
              type="link"
              size="small"
              icon={<CreditCardOutlined />}
              className="dashboard-table-action-btn"
              disabled={Number(record.remainingAmount || 0) <= 0}
              onClick={() => handlePay(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="text-sm">
      <div className="form-compact mb-4 border-b border-slate-100 bg-white pb-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-3">
            <div className="mb-1 text-sm font-semibold text-slate-700">
              Search
            </div>

            <Input
              allowClear
              className="dashboard-filter-control"
              placeholder="Document / faktur / supplier"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onPressEnter={handleSearch}
            />
          </div>

          <div className="lg:col-span-3">
            <div className="mb-1 text-sm font-semibold text-slate-700">
              Supplier
            </div>

            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              className="dashboard-filter-control w-full"
              placeholder="Select supplier"
              value={supplierId || undefined}
              onChange={(value) => setSupplierId(value || "")}
              options={suppliers.map((item) => ({
                label: item.name,
                value: item.id,
              }))}
            />
          </div>

          <div className="lg:col-span-2">
            <div className="mb-1 text-sm font-semibold text-slate-700">
              Payment Status
            </div>

            <Select
              allowClear
              className="dashboard-filter-control w-full"
              placeholder="Payment status"
              value={paymentStatus || undefined}
              onChange={(value) => setPaymentStatus(value || "")}
              options={[
                { label: "Unpaid", value: "UNPAID" },
                { label: "Partial", value: "PARTIAL" },
              ]}
            />
          </div>

          <div className="lg:col-span-2">
            <div className="mb-1 text-sm font-semibold text-slate-700">
              Overdue
            </div>

            <Select
              allowClear
              className="dashboard-filter-control w-full"
              placeholder="Overdue"
              value={overdueOnly || undefined}
              onChange={(value) => setOverdueOnly(value || "")}
              options={[{ label: "Overdue Only", value: "true" }]}
            />
          </div>

          <div className="flex justify-start gap-2 lg:col-span-2 lg:justify-end">
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
          </div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="border border-slate-100 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Invoices
              </div>

              <div className="mt-2 text-2xl font-bold text-slate-950">
                {data?.summary.totalInvoices || 0}
              </div>
            </div>

            <div className="flex h-9 w-9 items-center justify-center border border-slate-100 bg-slate-50 text-slate-500">
              <FileTextOutlined />
            </div>
          </div>
        </div>

        <div className="border border-slate-100 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Total Debt
              </div>

              <div className="mt-2 text-xl font-bold text-red-600">
                {formatCurrency(data?.summary.totalDebt || 0)}
              </div>
            </div>

            <div className="flex h-9 w-9 items-center justify-center border border-red-100 bg-red-50 text-red-500">
              <CreditCardOutlined />
            </div>
          </div>
        </div>

        <div className="border border-slate-100 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Overdue Invoices
              </div>

              <div className="mt-2 text-2xl font-bold text-slate-950">
                {data?.summary.overdueInvoices || 0}
              </div>
            </div>

            <div className="flex h-9 w-9 items-center justify-center border border-orange-100 bg-orange-50 text-orange-500">
              <WarningOutlined />
            </div>
          </div>
        </div>

        <div className="border border-slate-100 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Overdue Debt
              </div>

              <div className="mt-2 text-xl font-bold text-red-600">
                {formatCurrency(data?.summary.overdueDebt || 0)}
              </div>
            </div>

            <div className="flex h-9 w-9 items-center justify-center border border-red-100 bg-red-50 text-red-500">
              <WarningOutlined />
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-slate-500">
            {search || supplierId || paymentStatus || overdueOnly
              ? "Filter applied"
              : "No filter applied"}
          </div>

          <Space wrap size={8}>
            <Button
              size="small"
              icon={<ReloadOutlined />}
              className="dashboard-icon-btn"
              onClick={handleRefresh}
            />

            <Button
              size="small"
              type="primary"
              icon={<DownloadOutlined />}
              className="dashboard-action-btn"
              onClick={handleExportExcel}
            >
              Export Excel
            </Button>
          </Space>
        </div>

        <Table<PayableTableItem>
          rowKey="id"
          size="small"
          className="data-table-sm clickable-table-row"
          loading={loading}
          columns={columns}
          dataSource={(data?.items || []) as PayableTableItem[]}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: [20, 50, 100],
            showTotal: (total, range) =>
              `showing ${range[0]} to ${range[1]} of ${total} items`,
          }}
          onRow={(record) => ({
            onClick: () => {
              handleOpenStockIn(record);
            },
          })}
          scroll={{ x: 1250 }}
        />
      </div>
    </div>
  );
}
