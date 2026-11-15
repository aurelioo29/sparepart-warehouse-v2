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

type OptionItem = {
  id: string;
  name: string;
  code?: string;
};

type ReceivableItem = {
  id: string;
  invoiceNumber: string;
  saleDate: string;
  dueDate?: string | null;
  customer?: {
    id: string;
    name: string;
    phone?: string | null;
  } | null;
  salesman?: {
    id: string;
    name: string;
  } | null;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: string;
  overdueDays: number;
};

type ReceivableResponse = {
  summary: {
    totalInvoices: number;
    totalReceivable: number;
    overdueInvoices: number;
    overdueAmount: number;
  };
  items: ReceivableItem[];
};

function formatCurrency(value: string | number | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDate(value: string | null | undefined) {
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

function getPaymentPercent(record: ReceivableItem) {
  const totalAmount = Number(record.totalAmount || 0);
  const paidAmount = Number(record.paidAmount || 0);

  if (!totalAmount || totalAmount <= 0) return 0;

  return Math.min(Math.round((paidAmount / totalAmount) * 100), 100);
}

function getProgressStatus(record: ReceivableItem) {
  if (record.paymentStatus === "PAID") return "success";
  if (record.paymentStatus === "PARTIAL") return "active";

  return "exception";
}

function buildReceivableQuery(params: {
  search?: string;
  customerId?: string;
  salesmanId?: string;
  overdueOnly?: string;
  exportType?: "xlsx";
}) {
  const query = new URLSearchParams();

  if (params.search) query.set("search", params.search);
  if (params.customerId) query.set("customerId", params.customerId);
  if (params.salesmanId) query.set("salesmanId", params.salesmanId);
  if (params.overdueOnly) query.set("overdueOnly", params.overdueOnly);
  if (params.exportType) query.set("export", params.exportType);

  return query.toString();
}

export default function ReceivablesPageClient() {
  const router = useRouter();
  const { message } = App.useApp();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReceivableResponse | null>(null);

  const [customers, setCustomers] = useState<OptionItem[]>([]);
  const [salesmen, setSalesmen] = useState<OptionItem[]>([]);

  const [search, setSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [salesmanId, setSalesmanId] = useState("");
  const [overdueOnly, setOverdueOnly] = useState("");

  async function fetchOptions() {
    try {
      const [customersRes, salesmenRes] = await Promise.all([
        fetch("/api/customers/options"),
        fetch("/api/salesmen/options"),
      ]);

      const [customersJson, salesmenJson] = await Promise.all([
        customersRes.json(),
        salesmenRes.json(),
      ]);

      if (customersJson.success) setCustomers(customersJson.data || []);
      if (salesmenJson.success) setSalesmen(salesmenJson.data || []);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error
          ? error.message
          : "Gagal mengambil options piutang",
      );
    }
  }

  async function fetchReceivables(params?: {
    search?: string;
    customerId?: string;
    salesmanId?: string;
    overdueOnly?: string;
  }) {
    try {
      setLoading(true);

      const query = buildReceivableQuery({
        search: params?.search ?? search,
        customerId: params?.customerId ?? customerId,
        salesmanId: params?.salesmanId ?? salesmanId,
        overdueOnly: params?.overdueOnly ?? overdueOnly,
      });

      const response = await fetch(`/api/receivables?${query}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch receivables");
      }

      setData(result.data);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal mengambil piutang",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleSearch() {
    void fetchReceivables({
      search,
      customerId,
      salesmanId,
      overdueOnly,
    });
  }

  function handleReset() {
    setSearch("");
    setCustomerId("");
    setSalesmanId("");
    setOverdueOnly("");

    void fetchReceivables({
      search: "",
      customerId: "",
      salesmanId: "",
      overdueOnly: "",
    });
  }

  function handleRefresh() {
    void fetchReceivables({
      search,
      customerId,
      salesmanId,
      overdueOnly,
    });

    void fetchOptions();
  }

  function handleExportExcel() {
    const query = buildReceivableQuery({
      search,
      customerId,
      salesmanId,
      overdueOnly,
      exportType: "xlsx",
    });

    window.open(`/api/receivables?${query}`, "_blank");
  }

  function handleOpenSale(record: ReceivableItem) {
    router.push(`/dashboard/sales-invoices/${record.id}`);
  }

  function handlePay(record: ReceivableItem) {
    router.push(`/dashboard/sales-payments/create?saleId=${record.id}`);
  }

  useEffect(() => {
    void fetchOptions();
    void fetchReceivables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columns: ColumnsType<ReceivableItem> = [
    {
      title: (
        <div className="leading-tight">
          <div>Invoice</div>
          <div className="text-xs font-normal text-slate-400">Sale / Due</div>
        </div>
      ),
      dataIndex: "invoiceNumber",
      width: 250,
      render: (value: string, record) => (
        <div>
          <div className="table-row-title font-semibold text-slate-800">
            {value}
          </div>

          <div className="mt-0.5 text-xs text-slate-500">
            {formatDate(record.saleDate)}
            {record.dueDate ? ` • Due ${formatDate(record.dueDate)}` : ""}
          </div>
        </div>
      ),
    },
    {
      title: (
        <div className="leading-tight">
          <div>Customer</div>
          <div className="text-xs font-normal text-slate-400">
            Phone / Salesman
          </div>
        </div>
      ),
      width: 260,
      render: (_, record) => (
        <div>
          <div className="font-medium text-slate-700">
            {record.customer?.name || "Walk-in Customer"}
          </div>

          <div className="mt-0.5 text-xs text-slate-400">
            {record.customer?.phone || "-"} • {record.salesman?.name || "-"}
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
              status={getProgressStatus(record)}
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
      width: 180,
      render: (_, record) => (
        <Space size={4} wrap>
          {getPaymentStatusTag(record.paymentStatus)}
          {getOverdueTag(record.overdueDays)}
        </Space>
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
          <Tooltip title="Detail Invoice">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              className="dashboard-table-action-btn"
              onClick={() => handleOpenSale(record)}
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
              placeholder="Invoice / customer / salesman"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onPressEnter={handleSearch}
            />
          </div>

          <div className="lg:col-span-3">
            <div className="mb-1 text-sm font-semibold text-slate-700">
              Customer
            </div>

            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              className="dashboard-filter-control w-full"
              placeholder="Customer"
              value={customerId || undefined}
              onChange={(value) => setCustomerId(value || "")}
              options={customers.map((item) => ({
                label: item.name,
                value: item.id,
              }))}
            />
          </div>

          <div className="lg:col-span-3">
            <div className="mb-1 text-sm font-semibold text-slate-700">
              Salesman
            </div>

            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              className="dashboard-filter-control w-full"
              placeholder="Salesman"
              value={salesmanId || undefined}
              onChange={(value) => setSalesmanId(value || "")}
              options={salesmen.map((item) => ({
                label: item.code ? `${item.code} - ${item.name}` : item.name,
                value: item.id,
              }))}
            />
          </div>

          <div className="lg:col-span-1">
            <div className="mb-1 text-sm font-semibold text-slate-700">
              Overdue
            </div>

            <Select
              allowClear
              className="dashboard-filter-control w-full"
              placeholder="Overdue"
              value={overdueOnly || undefined}
              onChange={(value) => setOverdueOnly(value || "")}
              options={[{ label: "Only", value: "true" }]}
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
                Total Receivable
              </div>

              <div className="mt-2 text-xl font-bold text-blue-600">
                {formatCurrency(data?.summary.totalReceivable || 0)}
              </div>
            </div>

            <div className="flex h-9 w-9 items-center justify-center border border-blue-100 bg-blue-50 text-blue-500">
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
                Overdue Amount
              </div>

              <div className="mt-2 text-xl font-bold text-red-600">
                {formatCurrency(data?.summary.overdueAmount || 0)}
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
            {search || customerId || salesmanId || overdueOnly
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

        <Table<ReceivableItem>
          rowKey="id"
          size="small"
          className="data-table-sm clickable-table-row"
          loading={loading}
          dataSource={data?.items || []}
          columns={columns}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: [20, 50, 100],
            showTotal: (total, range) =>
              `showing ${range[0]} to ${range[1]} of ${total} items`,
          }}
          onRow={(record) => ({
            onClick: () => {
              handleOpenSale(record);
            },
          })}
          scroll={{ x: 1200 }}
        />
      </div>
    </div>
  );
}
