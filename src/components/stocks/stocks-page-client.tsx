"use client";

import { useEffect, useMemo, useState } from "react";
import { App, Button, Input, Progress, Select, Space, Table, Tag } from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import {
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

type StockItem = {
  id: string;
  sku: string;
  barcode?: string | null;
  name: string;
  category?: OptionItem | null;
  brand?: OptionItem | null;
  unit: {
    id: string;
    name: string;
    shortName: string;
  };
  warehouse?: OptionItem | null;
  rackLocation?: OptionItem | null;
  currentStock: number;
  minStock: number;
  stockStatus: string;
  lastMovement?: {
    id: string;
    type: string;
    quantity: number;
    referenceType: string;
    createdAt: string;
  } | null;
};

type StocksResponse = {
  items: StockItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
};

function getStockStatusColor(value: string) {
  if (value === "NORMAL") return "green";
  if (value === "LOW_STOCK") return "orange";
  return "red";
}

function getStockStatusLabel(value: string) {
  if (value === "NORMAL") return "NORMAL";
  if (value === "LOW_STOCK") return "LOW STOCK";
  return "OUT OF STOCK";
}

function getMovementTypeColor(value: string) {
  if (value === "IN") return "green";
  if (value === "OUT") return "red";
  if (value === "ADJUSTMENT") return "orange";
  return "default";
}

function getStockPercent(currentStock: number, minStock: number) {
  if (currentStock <= 0) return 0;
  if (minStock <= 0) return 100;

  return Math.min(
    Math.round((currentStock / Math.max(minStock * 2, 1)) * 100),
    100,
  );
}

function getProgressStatus(stockStatus: string) {
  if (stockStatus === "OUT_OF_STOCK") return "exception";
  if (stockStatus === "LOW_STOCK") return "active";
  return "success";
}

export default function StocksPageClient() {
  const router = useRouter();
  const { message } = App.useApp();

  const [items, setItems] = useState<StockItem[]>([]);
  const [categories, setCategories] = useState<OptionItem[]>([]);
  const [brands, setBrands] = useState<OptionItem[]>([]);
  const [warehouses, setWarehouses] = useState<OptionItem[]>([]);

  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [stockStatus, setStockStatus] = useState("");

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [meta, setMeta] = useState({
    page: 1,
    limit: 10,
    total: 0,
  });

  const overview = useMemo(() => {
    const normal = items.filter((item) => item.stockStatus === "NORMAL").length;
    const low = items.filter((item) => item.stockStatus === "LOW_STOCK").length;
    const out = items.filter(
      (item) => item.stockStatus === "OUT_OF_STOCK",
    ).length;

    return {
      totalOnPage: items.length,
      normal,
      low,
      out,
    };
  }, [items]);

  async function fetchOptions() {
    try {
      const [categoriesRes, brandsRes, warehousesRes] = await Promise.all([
        fetch("/api/categories/options"),
        fetch("/api/brands/options"),
        fetch("/api/warehouses/options"),
      ]);

      const [categoriesJson, brandsJson, warehousesJson] = await Promise.all([
        categoriesRes.json(),
        brandsRes.json(),
        warehousesRes.json(),
      ]);

      if (categoriesJson.success) setCategories(categoriesJson.data || []);
      if (brandsJson.success) setBrands(brandsJson.data || []);
      if (warehousesJson.success) setWarehouses(warehousesJson.data || []);
    } catch (error) {
      console.error(error);

      message.error("Gagal mengambil stock options");
    }
  }

  async function fetchStocks(params?: {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: string;
    brandId?: string;
    warehouseId?: string;
    stockStatus?: string;
  }) {
    try {
      setLoading(true);

      const query = new URLSearchParams({
        page: String(params?.page ?? page),
        limit: String(params?.limit ?? limit),
        search: params?.search ?? search,
        categoryId: params?.categoryId ?? categoryId,
        brandId: params?.brandId ?? brandId,
        warehouseId: params?.warehouseId ?? warehouseId,
        stockStatus: params?.stockStatus ?? stockStatus,
      });

      const response = await fetch(`/api/stocks?${query.toString()}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch stocks");
      }

      const data: StocksResponse = result.data;

      setItems(data.items || []);
      setMeta(data.meta);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal mengambil stock",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchOptions();
    void fetchStocks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearch() {
    setPage(1);

    void fetchStocks({
      page: 1,
      search,
      categoryId,
      brandId,
      warehouseId,
      stockStatus,
    });
  }

  function handleReset() {
    setSearch("");
    setCategoryId("");
    setBrandId("");
    setWarehouseId("");
    setStockStatus("");
    setPage(1);

    void fetchStocks({
      page: 1,
      search: "",
      categoryId: "",
      brandId: "",
      warehouseId: "",
      stockStatus: "",
    });
  }

  function handleRefresh() {
    void fetchStocks({
      page,
      limit,
      search,
      categoryId,
      brandId,
      warehouseId,
      stockStatus,
    });
  }

  function handleTableChange(pagination: TablePaginationConfig) {
    const nextPage = pagination.current || 1;
    const nextLimit = pagination.pageSize || 10;

    setPage(nextPage);
    setLimit(nextLimit);

    void fetchStocks({
      page: nextPage,
      limit: nextLimit,
      search,
      categoryId,
      brandId,
      warehouseId,
      stockStatus,
    });
  }

  const columns: ColumnsType<StockItem> = [
    {
      title: (
        <div className="leading-tight">
          <div>Product</div>
          <div className="text-xs font-normal text-slate-400">SKU</div>
          <div className="text-xs font-normal text-slate-400">
            Category / Brand
          </div>
        </div>
      ),
      key: "product",
      width: 320,
      render: (_, record) => (
        <div>
          <div className="table-row-title font-semibold text-slate-800">
            {record.name}
          </div>

          <div className="mt-0.5 font-mono text-xs text-slate-400">
            {record.sku}
            {record.barcode ? ` • ${record.barcode}` : ""}
          </div>

          <div className="mt-0.5 text-xs text-slate-500">
            {record.category?.name || "-"}
            {record.brand?.name ? ` / ${record.brand.name}` : ""}
          </div>
        </div>
      ),
    },
    {
      title: (
        <div className="leading-tight">
          <div>Location</div>
          <div className="text-xs font-normal text-slate-400">Rack</div>
        </div>
      ),
      key: "location",
      width: 220,
      render: (_, record) => (
        <div>
          <div className="font-medium text-slate-700">
            {record.warehouse?.name || "-"}
          </div>

          <div className="text-xs text-slate-400">
            {record.rackLocation?.name || "-"}
          </div>
        </div>
      ),
    },
    {
      title: (
        <div className="leading-tight">
          <div>Stock</div>
          <div className="text-xs font-normal text-slate-400">
            Current / Min
          </div>
        </div>
      ),
      key: "stock",
      width: 210,
      render: (_, record) => {
        const percent = getStockPercent(record.currentStock, record.minStock);

        return (
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="font-semibold text-slate-900">
                {record.currentStock}
              </span>

              <span className="text-xs text-slate-500">
                {record.unit.shortName}
              </span>

              <span className="text-xs text-slate-400">
                / Min {record.minStock}
              </span>
            </div>

            <Progress
              percent={percent}
              size="small"
              showInfo={false}
              status={getProgressStatus(record.stockStatus)}
            />
          </div>
        );
      },
    },
    {
      title: "Status",
      dataIndex: "stockStatus",
      key: "stockStatus",
      width: 140,
      render: (value: string) => (
        <Tag color={getStockStatusColor(value)}>
          {getStockStatusLabel(value)}
        </Tag>
      ),
    },
    {
      title: (
        <div className="leading-tight">
          <div>Last Movement</div>
          <div className="text-xs font-normal text-slate-400">Type / Date</div>
        </div>
      ),
      key: "lastMovement",
      width: 210,
      render: (_, record) =>
        record.lastMovement ? (
          <div>
            <Space size={4} wrap>
              <Tag color={getMovementTypeColor(record.lastMovement.type)}>
                {record.lastMovement.type}
              </Tag>

              <span className="text-xs text-slate-500">
                {record.lastMovement.quantity} {record.unit.shortName}
              </span>
            </Space>

            <div className="mt-1 text-xs text-slate-400">
              {record.lastMovement.referenceType} •{" "}
              {dayjs(record.lastMovement.createdAt).format("YYYY-MM-DD HH:mm")}
            </div>
          </div>
        ) : (
          <span className="text-slate-400">No movement</span>
        ),
    },
  ];

  return (
    <div className="text-sm">
      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="border border-slate-100 bg-white p-4">
          <div className="text-xs font-medium text-slate-500">
            Total Displayed
          </div>

          <div className="mt-1 text-2xl font-bold text-slate-950">
            {overview.totalOnPage}
          </div>

          <div className="mt-1 text-xs text-slate-400">
            Dari {meta.total} total data
          </div>
        </div>

        <div className="border border-slate-100 bg-white p-4">
          <div className="text-xs font-medium text-slate-500">Normal Stock</div>

          <div className="mt-1 text-2xl font-bold text-green-600">
            {overview.normal}
          </div>

          <div className="mt-1 text-xs text-slate-400">Stock masih aman</div>
        </div>

        <div className="border border-slate-100 bg-white p-4">
          <div className="text-xs font-medium text-slate-500">Low Stock</div>

          <div className="mt-1 flex items-center gap-2">
            <div className="text-2xl font-bold text-orange-500">
              {overview.low}
            </div>

            {overview.low > 0 ? (
              <WarningOutlined className="text-orange-500" />
            ) : null}
          </div>

          <div className="mt-1 text-xs text-slate-400">
            Perlu dicek untuk restock
          </div>
        </div>

        <div className="border border-slate-100 bg-white p-4">
          <div className="text-xs font-medium text-slate-500">Out of Stock</div>

          <div className="mt-1 flex items-center gap-2">
            <div className="text-2xl font-bold text-red-600">
              {overview.out}
            </div>

            {overview.out > 0 ? (
              <WarningOutlined className="text-red-600" />
            ) : null}
          </div>

          <div className="mt-1 text-xs text-slate-400">
            Stock kosong di halaman ini
          </div>
        </div>
      </div>

      <div className="form-compact mb-4 border-b border-slate-100 bg-white pb-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-3">
            <div className="mb-1 text-sm font-semibold text-slate-700">
              Product
            </div>

            <Input
              allowClear
              className="dashboard-filter-control"
              placeholder="Search SKU / name / barcode"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onPressEnter={handleSearch}
            />
          </div>

          <div className="lg:col-span-2">
            <div className="mb-1 text-sm font-semibold text-slate-700">
              Category
            </div>

            <Select
              allowClear
              showSearch
              className="dashboard-filter-control w-full"
              placeholder="Category"
              optionFilterProp="label"
              value={categoryId || undefined}
              onChange={(value) => setCategoryId(value || "")}
              options={categories.map((item) => ({
                label: item.name,
                value: item.id,
              }))}
            />
          </div>

          <div className="lg:col-span-2">
            <div className="mb-1 text-sm font-semibold text-slate-700">
              Brand
            </div>

            <Select
              allowClear
              showSearch
              className="dashboard-filter-control w-full"
              placeholder="Brand"
              optionFilterProp="label"
              value={brandId || undefined}
              onChange={(value) => setBrandId(value || "")}
              options={brands.map((item) => ({
                label: item.name,
                value: item.id,
              }))}
            />
          </div>

          <div className="lg:col-span-2">
            <div className="mb-1 text-sm font-semibold text-slate-700">
              Warehouse
            </div>

            <Select
              allowClear
              showSearch
              className="dashboard-filter-control w-full"
              placeholder="Warehouse"
              optionFilterProp="label"
              value={warehouseId || undefined}
              onChange={(value) => setWarehouseId(value || "")}
              options={warehouses.map((item) => ({
                label: `${item.name}${item.code ? ` (${item.code})` : ""}`,
                value: item.id,
              }))}
            />
          </div>

          <div className="lg:col-span-2">
            <div className="mb-1 text-sm font-semibold text-slate-700">
              Stock Status
            </div>

            <Select
              allowClear
              className="dashboard-filter-control w-full"
              placeholder="Status"
              value={stockStatus || undefined}
              onChange={(value) => setStockStatus(value || "")}
              options={[
                { label: "Normal", value: "NORMAL" },
                { label: "Low Stock", value: "LOW_STOCK" },
                { label: "Out Of Stock", value: "OUT_OF_STOCK" },
              ]}
            />
          </div>

          <div className="flex justify-start gap-2 lg:col-span-1 lg:justify-end">
            <Button
              type="primary"
              size="small"
              icon={<SearchOutlined />}
              className="dashboard-action-btn"
              onClick={handleSearch}
            >
              Search
            </Button>
          </div>

          <div className="flex justify-start gap-2 lg:col-span-12 lg:justify-end">
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
              className="dashboard-icon-btn"
              onClick={handleRefresh}
            />
          </div>
        </div>
      </div>

      <div>
        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-slate-500">
            {search || categoryId || brandId || warehouseId || stockStatus
              ? "Filter applied"
              : "No filter applied"}
          </div>

          <div className="text-sm text-slate-500">
            Showing stock condition by product location.
          </div>
        </div>

        <Table<StockItem>
          rowKey="id"
          size="small"
          className="data-table-sm clickable-table-row"
          loading={loading}
          dataSource={items}
          columns={columns}
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
              router.push(`/dashboard/products/${record.id}`);
            },
          })}
          scroll={{ x: 1100 }}
        />
      </div>
    </div>
  );
}
