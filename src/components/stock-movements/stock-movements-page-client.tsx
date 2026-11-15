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
} from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import type { SorterResult } from "antd/es/table/interface";
import {
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";

const { RangePicker } = DatePicker;

type ProductOption = {
  id: string;
  sku: string;
  name: string;
  currentStock: number;
  sellingPrice: string | number;
  unit: {
    id: string;
    name: string;
    shortName: string;
  };
};

type StockMovementItem = {
  id: string;
  productId: string;
  warehouseId?: string | null;
  rackLocationId?: string | null;
  type: "IN" | "OUT" | "ADJUSTMENT";
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  referenceType:
    | "STOCK_IN"
    | "STOCK_OUT"
    | "SALE"
    | "SALE_RETURN"
    | "ADJUSTMENT";
  referenceId?: string | null;
  notes?: string | null;
  createdAt: string;
  product: {
    id: string;
    sku: string;
    name: string;
    unit: {
      id: string;
      name: string;
      shortName: string;
    };
  };
  createdBy?: {
    id: string;
    fullName: string;
    username: string;
  } | null;
};

type StockMovementsResponse = {
  items: StockMovementItem[];
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
  { key: "createdAt", label: "Date", disabled: true },
  { key: "product", label: "Product", disabled: true },
  { key: "movement", label: "Movement" },
  { key: "referenceType", label: "Reference" },
  { key: "createdBy", label: "Created By" },
  { key: "notes", label: "Notes" },
];

function getMovementTypeColor(value: string) {
  if (value === "IN") return "green";
  if (value === "OUT") return "red";
  return "orange";
}

function getStockDelta(record: StockMovementItem) {
  return record.stockAfter - record.stockBefore;
}

function getStockDeltaColor(value: number) {
  if (value > 0) return "green";
  if (value < 0) return "red";
  return "default";
}

function formatDelta(value: number) {
  if (value > 0) return `+${value}`;
  return String(value);
}

function getReferenceLabel(value: string) {
  if (value === "STOCK_IN") return "Stock In";
  if (value === "STOCK_OUT") return "Stock Out";
  if (value === "SALE") return "Sale";
  if (value === "SALE_RETURN") return "Sale Return";
  if (value === "ADJUSTMENT") return "Adjustment";
  return value;
}

function getReferenceHref(record: StockMovementItem) {
  if (!record.referenceId) return null;

  if (record.referenceType === "SALE") {
    return `/dashboard/sales-invoices/${record.referenceId}`;
  }

  if (record.referenceType === "STOCK_IN") {
    return `/dashboard/stock-ins/${record.referenceId}`;
  }

  if (record.referenceType === "STOCK_OUT") {
    return `/dashboard/stock-outs/${record.referenceId}`;
  }

  if (record.referenceType === "ADJUSTMENT") {
    return `/dashboard/stock-adjustments/${record.referenceId}`;
  }

  return null;
}

export default function StockMovementsPageClient() {
  const router = useRouter();
  const { message } = App.useApp();

  const [movements, setMovements] = useState<StockMovementItem[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);

  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [productId, setProductId] = useState("");
  const [type, setType] = useState("");
  const [referenceType, setReferenceType] = useState("");
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
      const productsRes = await fetch("/api/products/options");
      const productsJson = await productsRes.json();

      if (productsJson.success) {
        setProducts(productsJson.data || []);
      }
    } catch (error) {
      console.error(error);

      message.error("Gagal mengambil options kartu stok");
    }
  }

  async function fetchMovements(params?: {
    page?: number;
    limit?: number;
    search?: string;
    productId?: string;
    type?: string;
    referenceType?: string;
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
        productId: params?.productId ?? productId,
        type: params?.type ?? type,
        referenceType: params?.referenceType ?? referenceType,
        dateFrom,
        dateTo,
        sortBy: params?.sortBy ?? sortBy,
        sortOrder: params?.sortOrder ?? sortOrder,
      });

      const response = await fetch(`/api/stock-movements?${query.toString()}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch stock movements");
      }

      const data: StockMovementsResponse = result.data;

      setMovements(data.items || []);
      setMeta(data.meta);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal mengambil kartu stok",
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
    void fetchMovements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, sortBy, sortOrder]);

  function handleSearch() {
    setPage(1);

    void fetchMovements({
      page: 1,
      search,
      productId,
      type,
      referenceType,
      dateFrom: dateRange?.[0] ? dateRange[0].format("YYYY-MM-DD") : "",
      dateTo: dateRange?.[1] ? dateRange[1].format("YYYY-MM-DD") : "",
      sortBy,
      sortOrder,
    });
  }

  function handleReset() {
    setSearch("");
    setProductId("");
    setType("");
    setReferenceType("");
    setDateRange(null);
    setPage(1);

    void fetchMovements({
      page: 1,
      search: "",
      productId: "",
      type: "",
      referenceType: "",
      dateFrom: "",
      dateTo: "",
      sortBy,
      sortOrder,
    });
  }

  function handleRefresh() {
    void fetchMovements({
      page,
      limit,
      search,
      productId,
      type,
      referenceType,
      dateFrom: dateRange?.[0] ? dateRange[0].format("YYYY-MM-DD") : "",
      dateTo: dateRange?.[1] ? dateRange[1].format("YYYY-MM-DD") : "",
      sortBy,
      sortOrder,
    });
  }

  function handleTableChange(
    pagination: TablePaginationConfig,
    _filters: Record<string, unknown>,
    sorter: SorterResult<StockMovementItem> | SorterResult<StockMovementItem>[],
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

  const allColumns: ColumnsType<StockMovementItem> = useMemo(
    () => [
      {
        title: (
          <div className="leading-tight">
            <div>Date</div>
            <div className="text-xs font-normal text-slate-400">Time</div>
          </div>
        ),
        dataIndex: "createdAt",
        key: "createdAt",
        sorter: true,
        width: 130,
        sortOrder:
          sortBy === "createdAt"
            ? sortOrder === "asc"
              ? "ascend"
              : "descend"
            : null,
        render: (value: string) => (
          <div className="w-[110px]">
            <div className="font-medium text-slate-700">
              {dayjs(value).format("YYYY-MM-DD")}
            </div>

            <div className="text-xs text-slate-400">
              {dayjs(value).format("HH:mm:ss")}
            </div>
          </div>
        ),
      },
      {
        title: (
          <div className="leading-tight">
            <div>Product</div>
            <div className="text-xs font-normal text-slate-400">SKU</div>
          </div>
        ),
        key: "product",
        sorter: true,
        width: 280,
        sortOrder:
          sortBy === "product"
            ? sortOrder === "asc"
              ? "ascend"
              : "descend"
            : null,
        render: (_, record) => (
          <button
            type="button"
            className="block max-w-[250px] text-left"
            onClick={() =>
              router.push(`/dashboard/products/${record.product.id}`)
            }
          >
            <div className="table-row-title truncate font-semibold text-slate-800">
              {record.product.name}
            </div>

            <div className="truncate font-mono text-xs text-slate-400">
              {record.product.sku}
            </div>
          </button>
        ),
      },
      {
        title: (
          <div className="leading-tight">
            <div>Movement</div>
            <div className="text-xs font-normal text-slate-400">
              Qty / Before / After
            </div>
          </div>
        ),
        key: "movement",
        width: 180,
        render: (_, record) => {
          const delta = getStockDelta(record);

          return (
            <div className="w-[150px]">
              <Space size={4} wrap>
                <Tag color={getMovementTypeColor(record.type)}>
                  {record.type}
                </Tag>

                <Tag color={getStockDeltaColor(delta)}>
                  {formatDelta(delta)}
                </Tag>
              </Space>

              <div className="mt-1 whitespace-nowrap text-sm font-medium text-slate-700">
                {record.quantity} {record.product.unit.shortName}
              </div>

              <div className="mt-0.5 whitespace-nowrap text-xs text-slate-400">
                {record.stockBefore} → {record.stockAfter}
              </div>
            </div>
          );
        },
      },
      {
        title: (
          <div className="leading-tight">
            <div>Reference</div>
            <div className="text-xs font-normal text-slate-400">Document</div>
          </div>
        ),
        dataIndex: "referenceType",
        key: "referenceType",
        sorter: true,
        width: 260,
        sortOrder:
          sortBy === "referenceType"
            ? sortOrder === "asc"
              ? "ascend"
              : "descend"
            : null,
        render: (value: string, record) => {
          const href = getReferenceHref(record);

          return (
            <div className="max-w-[230px]">
              <Tag>{getReferenceLabel(value)}</Tag>

              <div className="mt-1 truncate font-mono text-xs text-slate-400">
                {record.referenceId ? (
                  href ? (
                    <button
                      type="button"
                      className="inline-block max-w-full truncate align-bottom text-blue-600 hover:underline"
                      onClick={() => router.push(href)}
                      title={record.referenceId}
                    >
                      {record.referenceId}
                    </button>
                  ) : (
                    <span title={record.referenceId}>{record.referenceId}</span>
                  )
                ) : (
                  "-"
                )}
              </div>
            </div>
          );
        },
      },
      {
        title: (
          <div className="leading-tight">
            <div>Created By</div>
            <div className="text-xs font-normal text-slate-400">User</div>
          </div>
        ),
        key: "createdBy",
        width: 170,
        render: (_, record) => (
          <div className="max-w-[150px]">
            <div className="truncate font-medium text-slate-700">
              {record.createdBy?.fullName || record.createdBy?.username || "-"}
            </div>

            {record.createdBy?.username ? (
              <div className="truncate text-xs text-slate-400">
                @{record.createdBy.username}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        title: "Notes",
        dataIndex: "notes",
        key: "notes",
        width: 260,
        render: (value: string | null) => (
          <div className="max-w-[240px] text-slate-700">{value || "-"}</div>
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
              placeholder="Product / SKU / notes"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onPressEnter={handleSearch}
            />
          </div>

          <div className="lg:col-span-3">
            <div className="mb-1 text-sm font-semibold text-slate-700">
              Product
            </div>

            <Select
              showSearch
              allowClear
              className="dashboard-filter-control w-full"
              placeholder="Select product"
              optionFilterProp="label"
              value={productId || undefined}
              onChange={(value) => setProductId(value || "")}
              options={products.map((product) => ({
                label: `${product.sku} - ${product.name}`,
                value: product.id,
              }))}
            />
          </div>

          <div className="lg:col-span-2">
            <div className="mb-1 text-sm font-semibold text-slate-700">
              Type
            </div>

            <Select
              allowClear
              className="dashboard-filter-control w-full"
              placeholder="Type"
              value={type || undefined}
              onChange={(value) => setType(value || "")}
              options={[
                { label: "IN", value: "IN" },
                { label: "OUT", value: "OUT" },
                { label: "ADJUSTMENT", value: "ADJUSTMENT" },
              ]}
            />
          </div>

          <div className="lg:col-span-2">
            <div className="mb-1 text-sm font-semibold text-slate-700">
              Reference
            </div>

            <Select
              allowClear
              className="dashboard-filter-control w-full"
              placeholder="Reference"
              value={referenceType || undefined}
              onChange={(value) => setReferenceType(value || "")}
              options={[
                { label: "Stock In", value: "STOCK_IN" },
                { label: "Stock Out", value: "STOCK_OUT" },
                { label: "Sale", value: "SALE" },
                { label: "Sale Return", value: "SALE_RETURN" },
                { label: "Adjustment", value: "ADJUSTMENT" },
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
            {search || productId || type || referenceType || dateRange
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

        <Table<StockMovementItem>
          rowKey="id"
          size="small"
          className="data-table-sm"
          loading={loading}
          columns={tableColumns}
          dataSource={movements}
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
          scroll={{ x: 1250 }}
        />
      </div>
    </div>
  );
}
