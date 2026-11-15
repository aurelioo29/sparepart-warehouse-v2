"use client";

import { useEffect, useMemo, useState } from "react";
import {
  App,
  Button,
  Checkbox,
  DatePicker,
  Input,
  Popover,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
} from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import type { SorterResult } from "antd/es/table/interface";
import {
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

type SupplierOption = {
  id: string;
  name: string;
};

type StockInItem = {
  id: string;
  documentNumber: string;
  invoiceNumber?: string | null;
  stockInDate: string;
  dueDate?: string | null;
  status: string;
  paymentStatus?: string | null;
  totalAmount: string | number;
  paidAmount?: string | number;
  remainingAmount?: string | number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  supplier?: {
    id: string;
    name: string;
  } | null;
  createdBy?: {
    id: string;
    fullName: string;
    username: string;
  } | null;
  _count?: {
    items: number;
    payments?: number;
  };
};

type StockInsResponse = {
  items: StockInItem[];
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
  { key: "document", label: "Document", disabled: true },
  { key: "supplier", label: "Supplier" },
  { key: "amount", label: "Amount" },
  { key: "paymentStatus", label: "Payment" },
  { key: "status", label: "Status" },
  { key: "createdInfo", label: "Created Info" },
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

function getCreatedName(record: StockInItem) {
  return record.createdBy?.fullName || record.createdBy?.username || "-";
}

function getStatusTag(value?: string | null) {
  if (value === "POSTED") return <Tag color="green">POSTED</Tag>;
  if (value === "CANCELLED") return <Tag color="red">CANCELLED</Tag>;
  if (value === "DRAFT") return <Tag color="gold">DRAFT</Tag>;

  return <Tag>{value || "-"}</Tag>;
}

function getPaymentStatusTag(value?: string | null) {
  if (value === "PAID") return <Tag color="green">PAID</Tag>;
  if (value === "PARTIAL") return <Tag color="blue">PARTIAL</Tag>;
  if (value === "UNPAID") return <Tag color="orange">UNPAID</Tag>;

  return <Tag>{value || "-"}</Tag>;
}

export default function StockInsPageClient() {
  const router = useRouter();
  const { message } = App.useApp();

  const [stockIns, setStockIns] = useState<StockInItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [supplierId, setSupplierId] = useState("");
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
    columnOptions.map((item) => item.key),
  );

  const [meta, setMeta] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  async function fetchOptions() {
    try {
      const suppliersRes = await fetch("/api/suppliers/options");
      const suppliersJson = await suppliersRes.json();

      if (suppliersJson.success) {
        setSuppliers(suppliersJson.data || []);
      }
    } catch (error) {
      console.error(error);
      message.error("Gagal mengambil stock in options");
    }
  }

  async function fetchStockIns(params?: {
    page?: number;
    limit?: number;
    search?: string;
    supplierId?: string;
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

      const query = new URLSearchParams({
        page: String(params?.page ?? page),
        limit: String(params?.limit ?? limit),
        search: params?.search ?? search,
        supplierId: params?.supplierId ?? supplierId,
        status: params?.status ?? status,
        paymentStatus: params?.paymentStatus ?? paymentStatus,
        dateFrom,
        dateTo,
        sortBy: params?.sortBy ?? sortBy,
        sortOrder: params?.sortOrder ?? sortOrder,
      });

      const response = await fetch(`/api/stock-ins?${query.toString()}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch stock in");
      }

      const data: StockInsResponse = result.data;

      setStockIns(data.items || []);
      setMeta(data.meta);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal mengambil stock in",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void fetchStockIns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, sortBy, sortOrder]);

  function handleTableChange(
    pagination: TablePaginationConfig,
    _filters: Record<string, unknown>,
    sorter: SorterResult<StockInItem> | SorterResult<StockInItem>[],
  ) {
    const singleSorter = Array.isArray(sorter) ? sorter[0] : sorter;

    setPage(pagination.current || 1);
    setLimit(pagination.pageSize || 10);

    if (singleSorter?.field && singleSorter.order) {
      setSortBy(String(singleSorter.field));
      setSortOrder(singleSorter.order === "ascend" ? "asc" : "desc");
      return;
    }

    setSortBy("createdAt");
    setSortOrder("desc");
  }

  function handleSearch() {
    setPage(1);

    void fetchStockIns({
      page: 1,
      search,
      supplierId,
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
    setSupplierId("");
    setStatus("");
    setPaymentStatus("");
    setDateRange(null);
    setPage(1);

    void fetchStockIns({
      page: 1,
      search: "",
      supplierId: "",
      status: "",
      paymentStatus: "",
      dateFrom: "",
      dateTo: "",
      sortBy,
      sortOrder,
    });
  }

  const allColumns: ColumnsType<StockInItem> = useMemo(
    () => [
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
        key: "document",
        sorter: true,
        sortOrder:
          sortBy === "documentNumber"
            ? sortOrder === "asc"
              ? "ascend"
              : "descend"
            : null,
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
              {record.dueDate ? ` • Due ${formatDate(record.dueDate)}` : ""}
            </div>
          </div>
        ),
      },
      {
        title: (
          <div className="leading-tight">
            <div>Supplier</div>
            <div className="text-xs font-normal text-slate-400">Items</div>
          </div>
        ),
        key: "supplier",
        sorter: true,
        sortOrder:
          sortBy === "supplier"
            ? sortOrder === "asc"
              ? "ascend"
              : "descend"
            : null,
        width: 230,
        render: (_, record) => (
          <div>
            <div className="font-medium text-slate-700">
              {record.supplier?.name || "-"}
            </div>

            <div className="mt-0.5 text-xs text-slate-400">
              {record._count?.items || 0} items
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
        width: 260,
        align: "right",
        render: (_, record) => (
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
          </div>
        ),
      },
      {
        title: "Payment",
        dataIndex: "paymentStatus",
        key: "paymentStatus",
        sorter: true,
        width: 130,
        sortOrder:
          sortBy === "paymentStatus"
            ? sortOrder === "asc"
              ? "ascend"
              : "descend"
            : null,
        render: (value: string) => getPaymentStatusTag(value),
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        sorter: true,
        width: 130,
        sortOrder:
          sortBy === "status"
            ? sortOrder === "asc"
              ? "ascend"
              : "descend"
            : null,
        render: (value: string) => getStatusTag(value),
      },
      {
        title: (
          <div className="leading-tight">
            <div>Created</div>
            <div className="text-xs font-normal text-slate-400">User</div>
          </div>
        ),
        key: "createdInfo",
        width: 210,
        sorter: true,
        sortOrder:
          sortBy === "createdAt"
            ? sortOrder === "asc"
              ? "ascend"
              : "descend"
            : null,
        render: (_, record) => (
          <div>
            <div className="font-medium text-slate-700">
              {dayjs(record.createdAt).format("YYYY-MM-DD HH:mm:ss")}
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
        width: 110,
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
                onClick={() => router.push(`/dashboard/stock-ins/${record.id}`)}
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
                  router.push(`/dashboard/stock-ins/${record.id}/edit`)
                }
              />
            </Tooltip>
          </Space>
        ),
      },
    ],
    [router, sortBy, sortOrder],
  );

  const tableColumns = allColumns.filter((column) =>
    visibleColumns.includes(String(column.key)),
  );

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
              options={suppliers.map((supplier) => ({
                label: supplier.name,
                value: supplier.id,
              }))}
            />
          </div>

          <div className="lg:col-span-2">
            <div className="mb-1 text-sm font-semibold text-slate-700">
              Status
            </div>

            <Select
              allowClear
              className="dashboard-filter-control w-full"
              placeholder="Select status"
              value={status || undefined}
              onChange={(value) => setStatus(value || "")}
              options={[
                { label: "Posted", value: "POSTED" },
                { label: "Cancelled", value: "CANCELLED" },
              ]}
            />
          </div>

          <div className="lg:col-span-2">
            <div className="mb-1 text-sm font-semibold text-slate-700">
              Payment
            </div>

            <Select
              allowClear
              className="dashboard-filter-control w-full"
              placeholder="Payment status"
              value={paymentStatus || undefined}
              onChange={(value) => setPaymentStatus(value || "")}
              options={[
                { label: "Paid", value: "PAID" },
                { label: "Partial", value: "PARTIAL" },
                { label: "Unpaid", value: "UNPAID" },
              ]}
            />
          </div>

          <div className="lg:col-span-2">
            <div className="mb-1 text-sm font-semibold text-slate-700">
              Date
            </div>

            <RangePicker
              className="dashboard-filter-control w-full"
              value={dateRange}
              onChange={(value) => setDateRange(value)}
            />
          </div>

          <div className="flex justify-start gap-2 lg:col-span-12 lg:justify-end">
            <Button
              type="primary"
              size="small"
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
            {search || supplierId || status || paymentStatus || dateRange
              ? "Filter applied"
              : "No filter applied"}
          </div>

          <Space wrap size={8}>
            <Button
              size="small"
              type="primary"
              icon={<PlusOutlined />}
              className="dashboard-action-btn"
              onClick={() => router.push("/dashboard/stock-ins/create")}
            >
              Add New
            </Button>

            <Button
              size="small"
              icon={<ReloadOutlined />}
              className="dashboard-icon-btn"
              onClick={() => void fetchStockIns()}
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

        <Table<StockInItem>
          rowKey="id"
          size="small"
          className="data-table-sm clickable-table-row"
          loading={loading}
          dataSource={stockIns}
          columns={tableColumns}
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
              router.push(`/dashboard/stock-ins/${record.id}`);
            },
          })}
          scroll={{ x: 1250 }}
        />
      </div>
    </div>
  );
}
