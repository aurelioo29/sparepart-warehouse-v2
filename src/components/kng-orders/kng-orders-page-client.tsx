"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  FileExcelOutlined,
  PlusOutlined,
  PrinterOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";

const { RangePicker } = DatePicker;

type KngOrderItem = {
  id: string;
  orderNumber: string;
  orderDate: string;
  discountPercent: string | number;
  totalQty: number;
  // totalAmount: string | number;
  status: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    items: number;
  };
  createdBy?: {
    id: string;
    fullName: string;
    username: string;
    email: string;
  } | null;
};

type KngOrdersResponse = {
  items: KngOrderItem[];
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
  { key: "orderNumber", label: "Order Number", disabled: true },
  { key: "orderDate", label: "Order Date" },
  { key: "items", label: "Items" },
  { key: "totalQty", label: "Total Qty" },
  // { key: "totalAmount", label: "Total Amount" },
  { key: "status", label: "Status" },
  { key: "createdBy", label: "Created By" },
  { key: "createdAt", label: "Created at" },
  { key: "action", label: "Action", disabled: true },
];

const defaultVisibleColumns = columnOptions
  .filter((item) => {
    return item.key !== "createdBy" && item.key !== "createdAt";
  })
  .map((item) => item.key);

function formatRupiah(value?: string | number | null) {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function getStatusColor(status: string) {
  if (status === "POSTED") return "green";
  if (status === "DRAFT") return "blue";
  if (status === "CANCELLED") return "red";

  return "default";
}

function getSafeExportFileName(orderNumber: string) {
  return `Order-KNG-${orderNumber.replace(/\//g, "-")}.xlsx`;
}

export default function KngOrdersPageClient() {
  const router = useRouter();
  const { message } = App.useApp();

  const [orders, setOrders] = useState<KngOrderItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

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

  async function fetchOrders(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }) {
    try {
      setLoading(true);

      const query = new URLSearchParams({
        page: String(params?.page ?? page),
        limit: String(params?.limit ?? limit),
        search: params?.search ?? search,
        status: params?.status ?? status,
        dateFrom: params?.dateFrom ?? dateFrom,
        dateTo: params?.dateTo ?? dateTo,
        sortBy: params?.sortBy ?? sortBy,
        sortOrder: params?.sortOrder ?? sortOrder,
      });

      const response = await fetch(`/api/kng-orders?${query.toString()}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch KNG orders");
      }

      const data: KngOrdersResponse = result.data;

      setOrders(data.items || []);
      setMeta(data.meta);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal mengambil order KNG",
      );
    } finally {
      setLoading(false);
    }
  }

  const handleExportExcel = useCallback(
    async (record: KngOrderItem) => {
      try {
        const response = await fetch(`/api/kng-orders/${record.id}/export`);

        if (!response.ok) {
          const result = await response.json().catch(() => null);

          throw new Error(result?.message || "Gagal export order KNG");
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.download = getSafeExportFileName(record.orderNumber);

        document.body.appendChild(link);
        link.click();
        link.remove();

        window.URL.revokeObjectURL(url);

        message.success("Order KNG berhasil diexport");
      } catch (error) {
        console.error(error);

        message.error(
          error instanceof Error ? error.message : "Gagal export order KNG",
        );
      }
    },
    [message],
  );

  useEffect(() => {
    void fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, sortBy, sortOrder]);

  function handleTableChange(
    pagination: TablePaginationConfig,
    _filters: Record<string, unknown>,
    sorter: SorterResult<KngOrderItem> | SorterResult<KngOrderItem>[],
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

    void fetchOrders({
      page: 1,
      search,
      status,
      dateFrom,
      dateTo,
      sortBy,
      sortOrder,
    });
  }

  function handleReset() {
    setSearch("");
    setStatus("");
    setDateFrom("");
    setDateTo("");
    setPage(1);

    void fetchOrders({
      page: 1,
      search: "",
      status: "",
      dateFrom: "",
      dateTo: "",
      sortBy,
      sortOrder,
    });
  }

  const allColumns: ColumnsType<KngOrderItem> = useMemo(
    () => [
      {
        title: "Order Number",
        dataIndex: "orderNumber",
        key: "orderNumber",
        sorter: true,
        sortOrder:
          sortBy === "orderNumber"
            ? sortOrder === "asc"
              ? "ascend"
              : "descend"
            : null,
        render: (value: string) => (
          <span className="table-row-title font-semibold text-slate-800">
            {value}
          </span>
        ),
      },
      {
        title: "Order Date",
        dataIndex: "orderDate",
        key: "orderDate",
        sorter: true,
        sortOrder:
          sortBy === "orderDate"
            ? sortOrder === "asc"
              ? "ascend"
              : "descend"
            : null,
        render: (value: string) => (
          <span className="whitespace-nowrap text-slate-700">
            {dayjs(value).format("YYYY-MM-DD")}
          </span>
        ),
      },
      {
        title: "Items",
        key: "items",
        width: 90,
        align: "right",
        render: (_, record) => (
          <span className="font-medium text-slate-700">
            {record._count?.items || 0}
          </span>
        ),
      },
      {
        title: "Total Qty",
        dataIndex: "totalQty",
        key: "totalQty",
        sorter: true,
        align: "right",
        sortOrder:
          sortBy === "totalQty"
            ? sortOrder === "asc"
              ? "ascend"
              : "descend"
            : null,
        render: (value: number) => (
          <span className="font-semibold text-slate-800">
            {Number(value || 0).toLocaleString("id-ID")}
          </span>
        ),
      },
      // {
      //   title: "Total Amount",
      //   dataIndex: "totalAmount",
      //   key: "totalAmount",
      //   sorter: true,
      //   align: "right",
      //   sortOrder:
      //     sortBy === "totalAmount"
      //       ? sortOrder === "asc"
      //         ? "ascend"
      //         : "descend"
      //       : null,
      //   render: (value: string | number) => (
      //     <span className="whitespace-nowrap font-semibold text-slate-800">
      //       {formatRupiah(value)}
      //     </span>
      //   ),
      // },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        sorter: true,
        sortOrder:
          sortBy === "status"
            ? sortOrder === "asc"
              ? "ascend"
              : "descend"
            : null,
        render: (value: string) => (
          <Tag color={getStatusColor(value)}>{value}</Tag>
        ),
      },
      {
        title: "Created By",
        key: "createdBy",
        render: (_, record) => (
          <div>
            <div className="font-medium text-slate-700">
              {record.createdBy?.fullName || record.createdBy?.username || "-"}
            </div>

            {record.createdBy?.email ? (
              <div className="text-xs text-slate-400">
                {record.createdBy.email}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        title: "Created at",
        dataIndex: "createdAt",
        key: "createdAt",
        sorter: true,
        sortOrder:
          sortBy === "createdAt"
            ? sortOrder === "asc"
              ? "ascend"
              : "descend"
            : null,
        render: (value: string) => (
          <span className="whitespace-nowrap text-slate-700">
            {dayjs(value).format("YYYY-MM-DD HH:mm:ss")}
          </span>
        ),
      },
      {
        title: "Action",
        key: "action",
        width: 180,
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
                  router.push(`/dashboard/kng-orders/${record.id}`)
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
                  router.push(`/dashboard/kng-orders/${record.id}/edit`)
                }
              />
            </Tooltip>

            <Tooltip title="Print">
              <Button
                type="link"
                size="small"
                icon={<PrinterOutlined />}
                className="dashboard-table-action-btn"
                onClick={() =>
                  window.open(
                    `/dashboard/kng-orders/${record.id}/print`,
                    "_blank",
                  )
                }
              />
            </Tooltip>

            <Tooltip title="Export Excel">
              <Button
                type="link"
                size="small"
                icon={<FileExcelOutlined />}
                className="dashboard-table-action-btn"
                onClick={() => void handleExportExcel(record)}
              />
            </Tooltip>
          </Space>
        ),
      },
    ],
    [router, sortBy, sortOrder, handleExportExcel],
  );

  const tableColumns = allColumns.filter((column) =>
    visibleColumns.includes(String(column.key)),
  );

  return (
    <div className="text-sm">
      <div className="form-compact mb-4 border-b border-slate-100 bg-white pb-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-4">
            <div className="mb-1 text-sm font-semibold text-slate-700">
              Search
            </div>

            <Input
              allowClear
              className="dashboard-filter-control"
              placeholder="Search nomor order / part number"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onPressEnter={handleSearch}
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
                { label: "Draft", value: "DRAFT" },
                { label: "Posted", value: "POSTED" },
                { label: "Cancelled", value: "CANCELLED" },
              ]}
            />
          </div>

          <div className="lg:col-span-4">
            <div className="mb-1 text-sm font-semibold text-slate-700">
              Date Range
            </div>

            <RangePicker
              className="dashboard-filter-control w-full"
              format="YYYY-MM-DD"
              value={
                dateFrom && dateTo ? [dayjs(dateFrom), dayjs(dateTo)] : null
              }
              onChange={(_, dateStrings) => {
                setDateFrom(dateStrings[0] || "");
                setDateTo(dateStrings[1] || "");
              }}
            />
          </div>

          <div className="flex justify-start gap-2 lg:col-span-2 lg:justify-end">
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
            {search || status || dateFrom || dateTo
              ? "Filter applied"
              : "No filter applied"}
          </div>

          <Space wrap size={8}>
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              className="dashboard-action-btn"
              onClick={() => router.push("/dashboard/kng-orders/create")}
            >
              Add New
            </Button>

            <Button
              size="small"
              icon={<ReloadOutlined />}
              className="dashboard-icon-btn"
              onClick={() => void fetchOrders()}
            />

            <Popover
              open={columnOpen}
              onOpenChange={setColumnOpen}
              trigger="click"
              placement="bottomRight"
              content={
                <div className="w-[190px]">
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

        <Table<KngOrderItem>
          rowKey="id"
          size="small"
          className="data-table-sm clickable-table-row"
          loading={loading}
          columns={tableColumns}
          dataSource={orders}
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
              router.push(`/dashboard/kng-orders/${record.id}`);
            },
          })}
          scroll={{ x: 1280 }}
        />
      </div>
    </div>
  );
}
