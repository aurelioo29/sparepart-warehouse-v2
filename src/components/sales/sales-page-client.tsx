"use client";

import { useEffect, useMemo, useState } from "react";
import {
  App,
  Button,
  Checkbox,
  DatePicker,
  Input,
  Popover,
  Progress,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
} from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import type { SorterResult } from "antd/es/table/interface";
import {
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  PrinterOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";

const { RangePicker } = DatePicker;

type CustomerOption = {
  id: string;
  name: string;
  customerType: string;
  paymentTermDays?: number | null;
};

type SalesmanOption = {
  id: string;
  code: string;
  name: string;
  salesmanType: string;
};

type SaleItem = {
  id: string;
  invoiceNumber: string;
  saleDate: string;
  status: string;
  paymentStatus: string;
  subtotal: string | number;
  discountAmount: string | number;
  totalAmount: string | number;
  paidAmount: string | number;
  remainingAmount: string | number;
  dueDate?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: {
    id: string;
    name: string;
    customerType: string;
  } | null;
  salesman?: {
    id: string;
    code: string;
    name: string;
  } | null;
  createdBy?: {
    id: string;
    fullName: string;
    username: string;
  } | null;
  _count?: {
    items: number;
    payments: number;
  };
};

type SalesResponse = {
  items: SaleItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    sortBy?: string;
    sortOrder?: string;
  };
};

const columnOptions = [
  { key: "invoice", label: "Invoice", disabled: true },
  { key: "customer", label: "Customer" },
  { key: "amount", label: "Amount" },
  { key: "status", label: "Status" },
  { key: "count", label: "Count" },
  { key: "created", label: "Created" },
  { key: "action", label: "Action", disabled: true },
];

const defaultVisibleColumns = columnOptions.map((item) => item.key);

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

function getPaymentTag(value: string) {
  if (value === "PAID") return <Tag color="green">PAID</Tag>;
  if (value === "PARTIAL") return <Tag color="orange">PARTIAL</Tag>;

  return <Tag color="red">UNPAID</Tag>;
}

function getStatusTag(value: string) {
  if (value === "POSTED") return <Tag color="green">POSTED</Tag>;
  if (value === "CANCELLED") return <Tag color="red">CANCELLED</Tag>;
  if (value === "DRAFT") return <Tag color="gold">DRAFT</Tag>;

  return <Tag>{value || "-"}</Tag>;
}

function getCreatedName(record: SaleItem) {
  return record.createdBy?.fullName || record.createdBy?.username || "-";
}

function getPaymentPercent(record: SaleItem) {
  const totalAmount = Number(record.totalAmount || 0);
  const paidAmount = Number(record.paidAmount || 0);

  if (!totalAmount || totalAmount <= 0) return 0;

  return Math.min(Math.round((paidAmount / totalAmount) * 100), 100);
}

function buildSalesQuery(params: {
  page?: number;
  limit?: number;
  search?: string;
  customerId?: string;
  salesmanId?: string;
  status?: string;
  paymentStatus?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  exportType?: "xlsx";
}) {
  const query = new URLSearchParams();

  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));

  if (params.search) query.set("search", params.search);
  if (params.customerId) query.set("customerId", params.customerId);
  if (params.salesmanId) query.set("salesmanId", params.salesmanId);
  if (params.status) query.set("status", params.status);
  if (params.paymentStatus) query.set("paymentStatus", params.paymentStatus);
  if (params.dateFrom) query.set("dateFrom", params.dateFrom);
  if (params.dateTo) query.set("dateTo", params.dateTo);
  if (params.sortBy) query.set("sortBy", params.sortBy);
  if (params.sortOrder) query.set("sortOrder", params.sortOrder);
  if (params.exportType) query.set("export", params.exportType);

  return query.toString();
}

export default function SalesPageClient() {
  const router = useRouter();
  const { message } = App.useApp();

  const [sales, setSales] = useState<SaleItem[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [salesmen, setSalesmen] = useState<SalesmanOption[]>([]);

  const [loading, setLoading] = useState(false);
  const [printingSaleId, setPrintingSaleId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [salesmanId, setSalesmanId] = useState("");
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [dateRange, setDateRange] = useState<
    [dayjs.Dayjs | null, dayjs.Dayjs | null] | null
  >(null);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [columnOpen, setColumnOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    defaultVisibleColumns,
  );

  const [meta, setMeta] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

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
      message.error("Gagal mengambil sales options");
    }
  }

  async function fetchSales(params?: {
    page?: number;
    limit?: number;
    search?: string;
    customerId?: string;
    salesmanId?: string;
    status?: string;
    paymentStatus?: string;
    dateFrom?: string;
    dateTo?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }) {
    try {
      setLoading(true);

      const dateFrom =
        params?.dateFrom ??
        (dateRange?.[0] ? dateRange[0].format("YYYY-MM-DD") : "");

      const dateTo =
        params?.dateTo ??
        (dateRange?.[1] ? dateRange[1].format("YYYY-MM-DD") : "");

      const query = buildSalesQuery({
        page: params?.page ?? page,
        limit: params?.limit ?? limit,
        search: params?.search ?? search,
        customerId: params?.customerId ?? customerId,
        salesmanId: params?.salesmanId ?? salesmanId,
        status: params?.status ?? status,
        paymentStatus: params?.paymentStatus ?? paymentStatus,
        dateFrom,
        dateTo,
        sortBy: params?.sortBy ?? sortBy,
        sortOrder: params?.sortOrder ?? sortOrder,
      });

      const response = await fetch(`/api/sales?${query}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch sales");
      }

      const data: SalesResponse = result.data;

      setSales(data.items || []);
      setMeta(data.meta);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal mengambil sales",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handlePrintInvoice(saleId: string) {
    let blobUrl = "";
    let iframe: HTMLIFrameElement | null = null;

    try {
      setPrintingSaleId(saleId);

      const response = await fetch(`/api/sales/${saleId}/invoice-pdf`, {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error("Gagal mengambil invoice PDF");
      }

      const blob = await response.blob();

      blobUrl = URL.createObjectURL(blob);
      iframe = document.createElement("iframe");

      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.src = blobUrl;

      document.body.appendChild(iframe);

      iframe.onload = () => {
        window.setTimeout(() => {
          iframe?.contentWindow?.focus();
          iframe?.contentWindow?.print();

          window.setTimeout(() => {
            if (iframe && document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }

            if (blobUrl) {
              URL.revokeObjectURL(blobUrl);
            }

            setPrintingSaleId(null);
          }, 1500);
        }, 500);
      };
    } catch (error) {
      console.error(error);

      if (iframe && document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }

      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }

      setPrintingSaleId(null);

      message.error(
        error instanceof Error ? error.message : "Gagal print invoice",
      );
    }
  }

  function handleExportExcel() {
    const query = buildSalesQuery({
      search,
      customerId,
      salesmanId,
      status,
      paymentStatus,
      dateFrom: dateRange?.[0] ? dateRange[0].format("YYYY-MM-DD") : "",
      dateTo: dateRange?.[1] ? dateRange[1].format("YYYY-MM-DD") : "",
      sortBy,
      sortOrder,
      exportType: "xlsx",
    });

    window.open(`/api/sales?${query}`, "_blank");
  }

  useEffect(() => {
    void fetchOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void fetchSales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, sortBy, sortOrder]);

  function handleSearch() {
    setPage(1);

    void fetchSales({
      page: 1,
      search,
      customerId,
      salesmanId,
      status,
      paymentStatus,
      dateFrom: dateRange?.[0] ? dateRange[0].format("YYYY-MM-DD") : "",
      dateTo: dateRange?.[1] ? dateRange[1].format("YYYY-MM-DD") : "",
      sortBy,
      sortOrder,
    });
  }

  function handleReset() {
    setSearch("");
    setCustomerId("");
    setSalesmanId("");
    setStatus("");
    setPaymentStatus("");
    setDateRange(null);
    setPage(1);

    void fetchSales({
      page: 1,
      search: "",
      customerId: "",
      salesmanId: "",
      status: "",
      paymentStatus: "",
      dateFrom: "",
      dateTo: "",
      sortBy,
      sortOrder,
    });
  }

  function handleRefresh() {
    void fetchSales({
      page,
      limit,
      search,
      customerId,
      salesmanId,
      status,
      paymentStatus,
      dateFrom: dateRange?.[0] ? dateRange[0].format("YYYY-MM-DD") : "",
      dateTo: dateRange?.[1] ? dateRange[1].format("YYYY-MM-DD") : "",
      sortBy,
      sortOrder,
    });

    void fetchOptions();
  }

  function handleTableChange(
    pagination: TablePaginationConfig,
    _filters: Record<string, unknown>,
    sorter: SorterResult<SaleItem> | SorterResult<SaleItem>[],
  ) {
    const singleSorter = Array.isArray(sorter) ? sorter[0] : sorter;
    const sorterKey = singleSorter?.field || singleSorter?.columnKey;

    setPage(pagination.current || 1);
    setLimit(pagination.pageSize || 10);

    if (sorterKey && singleSorter.order) {
      setSortBy(String(sorterKey));
      setSortOrder(singleSorter.order === "ascend" ? "asc" : "desc");
      return;
    }

    setSortBy("createdAt");
    setSortOrder("desc");
  }

  const allColumns: ColumnsType<SaleItem> = useMemo(
    () => [
      {
        title: (
          <div className="leading-tight">
            <div>Invoice</div>
            <div className="text-xs font-normal text-slate-400">Date / Due</div>
          </div>
        ),
        dataIndex: "invoiceNumber",
        key: "invoice",
        sorter: true,
        sortOrder:
          sortBy === "invoiceNumber"
            ? sortOrder === "asc"
              ? "ascend"
              : "descend"
            : null,
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
            <div className="text-xs font-normal text-slate-400">Salesman</div>
          </div>
        ),
        key: "customer",
        columnKey: "customer",
        sorter: true,
        sortOrder:
          sortBy === "customer"
            ? sortOrder === "asc"
              ? "ascend"
              : "descend"
            : null,
        width: 260,
        render: (_, record) => (
          <div>
            <div className="font-medium text-slate-700">
              {record.customer?.name || "Walk-in Customer"}
            </div>

            <div className="mt-0.5 text-xs text-slate-400">
              {record.salesman?.name || "-"}
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
        columnKey: "totalAmount",
        sorter: true,
        sortOrder:
          sortBy === "totalAmount"
            ? sortOrder === "asc"
              ? "ascend"
              : "descend"
            : null,
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
            <div className="text-xs font-normal text-slate-400">Payment</div>
          </div>
        ),
        key: "status",
        width: 170,
        render: (_, record) => (
          <Space size={4} wrap>
            {getStatusTag(record.status)}
            {getPaymentTag(record.paymentStatus)}
          </Space>
        ),
      },
      {
        title: (
          <div className="leading-tight">
            <div>Count</div>
            <div className="text-xs font-normal text-slate-400">
              Items / Pay
            </div>
          </div>
        ),
        key: "count",
        width: 130,
        render: (_, record) => (
          <div>
            <div className="font-medium text-slate-700">
              {record._count?.items || 0} items
            </div>

            <div className="text-xs text-slate-400">
              {record._count?.payments || 0} payments
            </div>
          </div>
        ),
      },
      {
        title: (
          <div className="leading-tight">
            <div>Created</div>
            <div className="text-xs font-normal text-slate-400">User</div>
          </div>
        ),
        key: "created",
        dataIndex: "createdAt",
        sorter: true,
        sortOrder:
          sortBy === "createdAt"
            ? sortOrder === "asc"
              ? "ascend"
              : "descend"
            : null,
        width: 220,
        render: (value: string, record) => (
          <div>
            <div className="font-medium text-slate-700">
              {dayjs(value).format("YYYY-MM-DD HH:mm:ss")}
            </div>

            <div className="text-xs text-slate-400">
              {getCreatedName(record)}
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
            <Tooltip title="Detail">
              <Button
                type="link"
                size="small"
                icon={<EyeOutlined />}
                className="dashboard-table-action-btn"
                onClick={() =>
                  router.push(`/dashboard/sales-invoices/${record.id}`)
                }
              />
            </Tooltip>

            <Tooltip title="Edit">
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                className="dashboard-table-action-btn"
                disabled={record.status === "CANCELLED"}
                onClick={() =>
                  router.push(`/dashboard/sales-invoices/${record.id}/edit`)
                }
              />
            </Tooltip>

            <Tooltip title="Print Invoice">
              <Button
                type="link"
                size="small"
                icon={<PrinterOutlined />}
                loading={printingSaleId === record.id}
                disabled={record.status === "CANCELLED"}
                className="dashboard-table-action-btn"
                onClick={() => {
                  void handlePrintInvoice(record.id);
                }}
              />
            </Tooltip>
          </Space>
        ),
      },
    ],
    [printingSaleId, router, sortBy, sortOrder],
  );

  const tableColumns = allColumns.filter((column) =>
    visibleColumns.includes(String(column.key)),
  );

  return (
    <div className="text-sm">
      <div className="form-compact mb-4 border border-slate-100 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-12 xl:items-end">
          <div className="xl:col-span-3">
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

          <div className="xl:col-span-3">
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
              options={customers.map((customer) => ({
                label: `${customer.name} (${customer.customerType})`,
                value: customer.id,
              }))}
            />
          </div>

          <div className="xl:col-span-3">
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
              options={salesmen.map((salesman) => ({
                label: `${salesman.code} - ${salesman.name}`,
                value: salesman.id,
              }))}
            />
          </div>

          <div className="xl:col-span-1">
            <div className="mb-1 text-sm font-semibold text-slate-700">
              Status
            </div>

            <Select
              allowClear
              className="dashboard-filter-control w-full"
              placeholder="Status"
              value={status || undefined}
              onChange={(value) => setStatus(value || "")}
              options={[
                { label: "Draft", value: "DRAFT" },
                { label: "Posted", value: "POSTED" },
                { label: "Cancelled", value: "CANCELLED" },
              ]}
            />
          </div>

          <div className="xl:col-span-2">
            <div className="mb-1 text-sm font-semibold text-slate-700">
              Payment
            </div>

            <Select
              allowClear
              className="dashboard-filter-control w-full"
              placeholder="Payment"
              value={paymentStatus || undefined}
              onChange={(value) => setPaymentStatus(value || "")}
              options={[
                { label: "Unpaid", value: "UNPAID" },
                { label: "Partial", value: "PARTIAL" },
                { label: "Paid", value: "PAID" },
              ]}
            />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-12 xl:items-end">
          <div className="xl:col-span-4">
            <div className="mb-1 text-sm font-semibold text-slate-700">
              Date
            </div>

            <RangePicker
              className="dashboard-filter-control w-full"
              value={dateRange}
              onChange={(value) => setDateRange(value)}
            />
          </div>

          <div className="flex flex-wrap justify-start gap-2 xl:col-span-8 xl:justify-end">
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

      <div>
        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-slate-500">
            {search ||
            customerId ||
            salesmanId ||
            status ||
            paymentStatus ||
            dateRange
              ? "Filter applied"
              : "No filter applied"}
          </div>

          <Space wrap size={8}>
            <Button
              size="small"
              type="primary"
              icon={<PlusOutlined />}
              className="dashboard-action-btn"
              onClick={() => router.push("/dashboard/sales-invoices/create")}
            >
              Add Sale
            </Button>

            <Button
              size="small"
              type="primary"
              icon={<DownloadOutlined />}
              className="dashboard-action-btn"
              onClick={handleExportExcel}
            >
              Export Excel
            </Button>

            <Button
              size="small"
              icon={<ReloadOutlined />}
              className="dashboard-icon-btn"
              onClick={handleRefresh}
            />

            <Popover
              open={columnOpen}
              onOpenChange={setColumnOpen}
              trigger="click"
              placement="bottomRight"
              content={
                <div className="w-[180px]">
                  <div className="mb-2 text-sm font-semibold text-slate-700">
                    Column Display
                  </div>

                  <Checkbox.Group
                    value={visibleColumns}
                    onChange={(values) => setVisibleColumns(values as string[])}
                    className="flex flex-col gap-2"
                  >
                    {columnOptions.map((column) => (
                      <Checkbox
                        key={column.key}
                        value={column.key}
                        disabled={column.disabled}
                        className="text-sm"
                      >
                        {column.label}
                      </Checkbox>
                    ))}
                  </Checkbox.Group>
                </div>
              }
            >
              <Button
                size="small"
                icon={<SettingOutlined />}
                className="dashboard-icon-btn"
              />
            </Popover>
          </Space>
        </div>

        <Table<SaleItem>
          rowKey="id"
          size="small"
          className="data-table-sm clickable-table-row"
          loading={loading}
          columns={tableColumns}
          dataSource={sales}
          pagination={{
            current: meta.page,
            pageSize: meta.limit,
            total: meta.total,
            showSizeChanger: true,
            pageSizeOptions: [10, 25, 50, 100],
            showTotal: (total, range) =>
              `showing ${range[0]} to ${range[1]} of ${total} items`,
          }}
          onChange={handleTableChange}
          onRow={(record) => ({
            onClick: () => {
              router.push(`/dashboard/sales-invoices/${record.id}`);
            },
          })}
          scroll={{ x: 1350 }}
        />
      </div>
    </div>
  );
}
