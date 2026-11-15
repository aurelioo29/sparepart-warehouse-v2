"use client";

import { useEffect, useMemo, useState } from "react";
import {
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
  message,
} from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import type { SorterResult } from "antd/es/table/interface";
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";

const { RangePicker } = DatePicker;

type UnpaidSaleOption = {
  id: string;
  invoiceNumber: string;
  saleDate: string;
  totalAmount: string | number;
  paidAmount: string | number;
  remainingAmount: string | number;
  paymentStatus: string;
  customer?: {
    id: string;
    name: string;
  } | null;
};

type SalePaymentItem = {
  id: string;
  saleId: string;
  paymentDate: string;
  amount: string | number;
  discountPercent?: string | number;
  discountAmount?: string | number;
  method: string;
  referenceNumber?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  sale: {
    id: string;
    invoiceNumber: string;
    saleDate: string;
    totalAmount: string | number;
    paidAmount: string | number;
    remainingAmount: string | number;
    paymentStatus: string;
    customer?: {
      id: string;
      name: string;
    } | null;
  };
  createdBy?: {
    id: string;
    fullName: string;
    username: string;
  } | null;
};

type SalePaymentsResponse = {
  items: SalePaymentItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    sortBy?: string;
    sortOrder?: string;
  };
};

const paymentMethodOptions = [
  { label: "Cash", value: "CASH" },
  { label: "Transfer", value: "TRANSFER" },
  { label: "Debit", value: "DEBIT" },
  { label: "Credit", value: "CREDIT" },
  { label: "QRIS", value: "QRIS" },
  { label: "Other", value: "OTHER" },
];

const columnOptions = [
  { key: "payment", label: "Payment", disabled: true },
  { key: "invoice", label: "Invoice", disabled: true },
  { key: "amount", label: "Amount" },
  { key: "method", label: "Method" },
  { key: "reference", label: "Reference" },
  { key: "created", label: "Created" },
  { key: "action", label: "Action", disabled: true },
];

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

function getSaleSettlementDiscount(sale: SalePaymentItem["sale"]) {
  const totalAmount = Number(sale.totalAmount || 0);
  const paidAmount = Number(sale.paidAmount || 0);
  const remainingAmount = Number(sale.remainingAmount || 0);

  return Math.max(totalAmount - paidAmount - remainingAmount, 0);
}

function getPaymentPercent(record: SalePaymentItem) {
  const totalAmount = Number(record.sale.totalAmount || 0);
  const paidAmount = Number(record.sale.paidAmount || 0);
  const settlementDiscount = getSaleSettlementDiscount(record.sale);
  const settledAmount = paidAmount + settlementDiscount;

  if (!totalAmount || totalAmount <= 0) return 0;

  return Math.min(Math.round((settledAmount / totalAmount) * 100), 100);
}

function getPaymentStatusTag(value: string) {
  if (value === "PAID") return <Tag color="green">PAID</Tag>;
  if (value === "PARTIAL") return <Tag color="blue">PARTIAL</Tag>;

  return <Tag color="orange">UNPAID</Tag>;
}

function getMethodTag(value: string) {
  if (value === "CASH") return <Tag color="green">CASH</Tag>;
  if (value === "TRANSFER") return <Tag color="blue">TRANSFER</Tag>;
  if (value === "QRIS") return <Tag color="purple">QRIS</Tag>;

  return <Tag>{value}</Tag>;
}

function getCreatedName(record: SalePaymentItem) {
  return record.createdBy?.fullName || record.createdBy?.username || "-";
}

export default function SalePaymentsPageClient() {
  const router = useRouter();

  const [payments, setPayments] = useState<SalePaymentItem[]>([]);
  const [unpaidSales, setUnpaidSales] = useState<UnpaidSaleOption[]>([]);

  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [saleId, setSaleId] = useState("");
  const [method, setMethod] = useState("");
  const [dateRange, setDateRange] = useState<
    [dayjs.Dayjs | null, dayjs.Dayjs | null] | null
  >(null);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [columnOpen, setColumnOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    columnOptions.map((item) => item.key),
  );

  const [meta, setMeta] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  async function fetchUnpaidSales() {
    try {
      const response = await fetch("/api/sales/unpaid-options");
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch unpaid sales");
      }

      setUnpaidSales(result.data || []);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error
          ? error.message
          : "Gagal mengambil invoice belum lunas",
      );
    }
  }

  async function fetchPayments(params?: {
    page?: number;
    limit?: number;
    search?: string;
    saleId?: string;
    method?: string;
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

      const query = new URLSearchParams({
        page: String(params?.page ?? page),
        limit: String(params?.limit ?? limit),
        search: params?.search ?? search,
        saleId: params?.saleId ?? saleId,
        method: params?.method ?? method,
        dateFrom,
        dateTo,
        sortBy: params?.sortBy ?? sortBy,
        sortOrder: params?.sortOrder ?? sortOrder,
      });

      const response = await fetch(`/api/sale-payments?${query.toString()}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch sale payments");
      }

      const data: SalePaymentsResponse = result.data;

      setPayments(data.items || []);
      setMeta(data.meta);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal mengambil pembayaran",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(record: SalePaymentItem) {
    const confirmed = window.confirm(
      `Hapus pembayaran untuk invoice ${record.sale.invoiceNumber}?`,
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/sale-payments/${record.id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to delete payment");
      }

      message.success(result.message || "Sale payment deleted successfully");

      await fetchPayments();
      await fetchUnpaidSales();
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal menghapus pembayaran",
      );
    }
  }

  useEffect(() => {
    void fetchUnpaidSales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void fetchPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, sortBy, sortOrder]);

  function handleSearch() {
    setPage(1);

    void fetchPayments({
      page: 1,
      search,
      saleId,
      method,
      dateFrom: dateRange?.[0] ? dateRange[0].format("YYYY-MM-DD") : "",
      dateTo: dateRange?.[1] ? dateRange[1].format("YYYY-MM-DD") : "",
      sortBy,
      sortOrder,
    });
  }

  function handleReset() {
    setSearch("");
    setSaleId("");
    setMethod("");
    setDateRange(null);
    setPage(1);

    void fetchPayments({
      page: 1,
      search: "",
      saleId: "",
      method: "",
      dateFrom: "",
      dateTo: "",
      sortBy,
      sortOrder,
    });
  }

  function handleRefresh() {
    void fetchPayments();
    void fetchUnpaidSales();
  }

  function handleTableChange(
    pagination: TablePaginationConfig,
    _filters: Record<string, unknown>,
    sorter: SorterResult<SalePaymentItem> | SorterResult<SalePaymentItem>[],
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

  const allColumns: ColumnsType<SalePaymentItem> = useMemo(
    () => [
      {
        title: (
          <div className="leading-tight">
            <div>Payment</div>
            <div className="text-xs font-normal text-slate-400">
              Date / Created
            </div>
          </div>
        ),
        dataIndex: "paymentDate",
        key: "payment",
        sorter: true,
        sortOrder:
          sortBy === "paymentDate"
            ? sortOrder === "asc"
              ? "ascend"
              : "descend"
            : null,
        width: 210,
        render: (value: string, record) => (
          <div>
            <div className="table-row-title font-semibold text-slate-800">
              {formatDate(value)}
            </div>

            <div className="mt-0.5 text-xs text-slate-400">
              {dayjs(record.createdAt).format("YYYY-MM-DD HH:mm")}
            </div>
          </div>
        ),
      },
      {
        title: (
          <div className="leading-tight">
            <div>Invoice</div>
            <div className="text-xs font-normal text-slate-400">Customer</div>
          </div>
        ),
        key: "invoice",
        columnKey: "invoiceNumber",
        sorter: true,
        sortOrder:
          sortBy === "invoiceNumber"
            ? sortOrder === "asc"
              ? "ascend"
              : "descend"
            : null,
        width: 260,
        render: (_, record) => (
          <div>
            <div className="font-semibold text-slate-800">
              {record.sale.invoiceNumber}
            </div>

            <div className="mt-0.5 text-xs text-slate-400">
              {record.sale.customer?.name || "-"}
            </div>
          </div>
        ),
      },
      {
        title: (
          <div className="leading-tight">
            <div>Amount</div>
            <div className="text-xs font-normal text-slate-400">
              Cash / Discount
            </div>
          </div>
        ),
        dataIndex: "amount",
        key: "amount",
        sorter: true,
        sortOrder:
          sortBy === "amount"
            ? sortOrder === "asc"
              ? "ascend"
              : "descend"
            : null,
        width: 280,
        align: "right",
        render: (value, record) => {
          const percent = getPaymentPercent(record);

          const paymentDiscount = Number(record.discountAmount || 0);
          const settlementAmount = Number(value || 0) + paymentDiscount;

          return (
            <div className="text-right">
              <div className="font-bold text-blue-600">
                Cash: {formatCurrency(value)}
              </div>

              <div className="mt-0.5 text-xs font-semibold text-amber-600">
                {paymentDiscount > 0
                  ? Number(record.discountPercent || 0) > 0
                    ? `Discount ${Number(record.discountPercent || 0)}%: `
                    : "Discount Nominal: "
                  : "Discount: "}
                {formatCurrency(paymentDiscount)}
              </div>

              <div className="mt-0.5 text-xs text-green-600">
                Settlement: {formatCurrency(settlementAmount)}
              </div>

              <div className="mt-0.5 text-xs font-semibold text-red-600">
                Remain: {formatCurrency(record.sale.remainingAmount)}
              </div>

              <Progress
                percent={percent}
                size="small"
                showInfo={false}
                status={
                  record.sale.paymentStatus === "PAID"
                    ? "success"
                    : record.sale.paymentStatus === "PARTIAL"
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
            <div>Method</div>
            <div className="text-xs font-normal text-slate-400">Status</div>
          </div>
        ),
        dataIndex: "method",
        key: "method",
        sorter: true,
        sortOrder:
          sortBy === "method"
            ? sortOrder === "asc"
              ? "ascend"
              : "descend"
            : null,
        width: 160,
        render: (value: string, record) => (
          <Space size={4} wrap>
            {getMethodTag(value)}
            {getPaymentStatusTag(record.sale.paymentStatus)}
          </Space>
        ),
      },
      {
        title: (
          <div className="leading-tight">
            <div>Reference</div>
            <div className="text-xs font-normal text-slate-400">Notes</div>
          </div>
        ),
        key: "reference",
        width: 250,
        render: (_, record) => (
          <div>
            <div className="font-medium text-slate-700">
              {record.referenceNumber || "-"}
            </div>

            <div className="mt-0.5 max-w-[220px] truncate text-xs text-slate-400">
              {record.notes || "-"}
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
        dataIndex: "createdAt",
        key: "created",
        sorter: true,
        sortOrder:
          sortBy === "createdAt"
            ? sortOrder === "asc"
              ? "ascend"
              : "descend"
            : null,
        width: 210,
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
        width: 130,
        align: "center",
        fixed: "right",
        render: (_, record) => (
          <Space size={4} onClick={(event) => event.stopPropagation()}>
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              className="dashboard-table-action-btn"
              onClick={() =>
                router.push(`/dashboard/sales-payments/${record.id}`)
              }
            />

            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              className="dashboard-table-action-btn"
              onClick={() =>
                router.push(`/dashboard/sales-payments/${record.id}/edit`)
              }
            />

            <Button
              danger
              type="link"
              size="small"
              icon={<DeleteOutlined />}
              className="dashboard-table-action-btn"
              onClick={() => {
                void handleDelete(record);
              }}
            />
          </Space>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sortBy, sortOrder, router],
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
              placeholder="Invoice / reference / customer"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onPressEnter={handleSearch}
            />
          </div>

          <div className="xl:col-span-3">
            <div className="mb-1 text-sm font-semibold text-slate-700">
              Invoice
            </div>

            <Select
              showSearch
              allowClear
              placeholder="Unpaid invoice"
              optionFilterProp="label"
              value={saleId || undefined}
              onChange={(value) => setSaleId(value || "")}
              className="dashboard-filter-control w-full"
              options={unpaidSales.map((sale) => ({
                label: `${sale.invoiceNumber} - ${sale.customer?.name || "-"}`,
                value: sale.id,
              }))}
            />
          </div>

          <div className="xl:col-span-2">
            <div className="mb-1 text-sm font-semibold text-slate-700">
              Method
            </div>

            <Select
              allowClear
              placeholder="Method"
              value={method || undefined}
              onChange={(value) => setMethod(value || "")}
              className="dashboard-filter-control w-full"
              options={paymentMethodOptions}
            />
          </div>

          <div className="xl:col-span-3">
            <div className="mb-1 text-sm font-semibold text-slate-700">
              Date
            </div>

            <RangePicker
              className="dashboard-filter-control w-full"
              value={dateRange}
              onChange={(value) => setDateRange(value)}
            />
          </div>

          <div className="flex gap-2 xl:col-span-1 xl:justify-end">
            <Button
              size="small"
              type="primary"
              icon={<SearchOutlined />}
              className="dashboard-action-btn"
              onClick={handleSearch}
            />

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
            {search || saleId || method || dateRange
              ? "Filter applied"
              : "No filter applied"}
          </div>

          <Space wrap size={8}>
            <Button
              size="small"
              type="primary"
              icon={<PlusOutlined />}
              className="dashboard-action-btn"
              onClick={() => router.push("/dashboard/sales-payments/create")}
            >
              Add Payment
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
                <div className="w-[200px]">
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

        <Table<SalePaymentItem>
          rowKey="id"
          size="small"
          className="data-table-sm clickable-table-row"
          loading={loading}
          columns={tableColumns}
          dataSource={payments}
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
              router.push(`/dashboard/sales-payments/${record.id}`);
            },
          })}
          scroll={{ x: 1400 }}
        />
      </div>
    </div>
  );
}
