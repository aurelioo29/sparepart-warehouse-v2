"use client";

import { useEffect, useMemo, useState } from "react";
import {
  App,
  Button,
  Checkbox,
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

import type {
  BrandOption,
  CategoryOption,
  RackLocationOption,
  SupplierOption,
  UnitOption,
  WarehouseOption,
} from "./product-form";

type ProductItem = {
  id: string;
  categoryId?: string | null;
  brandId?: string | null;
  unitId: string;
  supplierId?: string | null;
  warehouseId?: string | null;
  rackLocationId?: string | null;

  sku: string;
  barcode?: string | null;
  name: string;

  purchasePrice: string | number;
  sellingPrice: string | number;
  currentStock: number;
  minStock: number;

  imageUrl?: string | null;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;

  category?: { id: string; name: string } | null;
  brand?: { id: string; name: string } | null;
  unit: { id: string; name: string; shortName: string };
  supplier?: { id: string; name: string } | null;
  warehouse?: { id: string; name: string; code: string } | null;
  rackLocation?: { id: string; name: string; code: string } | null;
};

type ProductsResponse = {
  items: ProductItem[];
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
  { key: "product", label: "Product", disabled: true },
  { key: "unit", label: "Unit" },
  { key: "prices", label: "Prices" },
  { key: "stock", label: "Stock" },
  { key: "createdAt", label: "Created at" },
  { key: "updatedAt", label: "Updated at" },
  { key: "status", label: "Status" },
  { key: "action", label: "Action", disabled: true },
];

function formatCurrency(value: string | number | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export default function ProductsPageClient() {
  const router = useRouter();
  const { message } = App.useApp();

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [rackLocations, setRackLocations] = useState<RackLocationOption[]>([]);

  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [stockStatus, setStockStatus] = useState("");
  const [isActive, setIsActive] = useState("");

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
      const [
        categoriesRes,
        brandsRes,
        unitsRes,
        suppliersRes,
        warehousesRes,
        rackLocationsRes,
      ] = await Promise.all([
        fetch("/api/categories/options"),
        fetch("/api/brands/options"),
        fetch("/api/units/options"),
        fetch("/api/suppliers/options"),
        fetch("/api/warehouses/options"),
        fetch("/api/rack-locations?limit=1000&isActive=true"),
      ]);

      const [
        categoriesJson,
        brandsJson,
        unitsJson,
        suppliersJson,
        warehousesJson,
        rackLocationsJson,
      ] = await Promise.all([
        categoriesRes.json(),
        brandsRes.json(),
        unitsRes.json(),
        suppliersRes.json(),
        warehousesRes.json(),
        rackLocationsRes.json(),
      ]);

      if (categoriesJson.success) setCategories(categoriesJson.data || []);
      if (brandsJson.success) setBrands(brandsJson.data || []);
      if (unitsJson.success) setUnits(unitsJson.data || []);
      if (suppliersJson.success) setSuppliers(suppliersJson.data || []);
      if (warehousesJson.success) setWarehouses(warehousesJson.data || []);

      if (rackLocationsJson.success) {
        setRackLocations(rackLocationsJson.data.items || []);
      }
    } catch (error) {
      console.error(error);

      message.error("Gagal mengambil product options");
    }
  }

  async function fetchProducts(params?: {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: string;
    brandId?: string;
    warehouseId?: string;
    stockStatus?: string;
    isActive?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
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
        isActive: params?.isActive ?? isActive,
        sortBy: params?.sortBy ?? sortBy,
        sortOrder: params?.sortOrder ?? sortOrder,
      });

      const response = await fetch(`/api/products?${query.toString()}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch products");
      }

      const data: ProductsResponse = result.data;

      setProducts(data.items || []);
      setMeta(data.meta);
    } catch (error) {
      console.error("fetchProducts error:", error);

      message.error(
        error instanceof Error ? error.message : "Gagal mengambil products",
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
    void fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, sortBy, sortOrder]);

  function handleTableChange(
    pagination: TablePaginationConfig,
    _filters: Record<string, unknown>,
    sorter: SorterResult<ProductItem> | SorterResult<ProductItem>[],
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

    void fetchProducts({
      page: 1,
      search,
      categoryId,
      brandId,
      warehouseId,
      stockStatus,
      isActive,
      sortBy,
      sortOrder,
    });
  }

  function handleReset() {
    setSearch("");
    setCategoryId("");
    setBrandId("");
    setWarehouseId("");
    setStockStatus("");
    setIsActive("");
    setPage(1);

    void fetchProducts({
      page: 1,
      search: "",
      categoryId: "",
      brandId: "",
      warehouseId: "",
      stockStatus: "",
      isActive: "",
      sortBy,
      sortOrder,
    });
  }

  const allColumns: ColumnsType<ProductItem> = useMemo(
    () => [
      {
        title: (
          <div className="leading-tight">
            <div>Name</div>
            <div className="text-xs font-normal text-slate-400">SKU</div>
            <div className="text-xs font-normal text-slate-400">Category</div>
          </div>
        ),
        dataIndex: "name",
        key: "product",
        sorter: true,
        sortOrder:
          sortBy === "name"
            ? sortOrder === "asc"
              ? "ascend"
              : "descend"
            : null,
        render: (value: string, record) => (
          <div>
            <div className="table-row-title font-semibold text-slate-800">
              {value}
            </div>

            <div className="mt-0.5 font-mono text-xs text-slate-400">
              {record.sku || "-"}
            </div>

            <div className="mt-0.5 text-xs text-slate-500">
              {record.category?.name || "-"}
            </div>
          </div>
        ),
      },
      {
        title: "Unit",
        key: "unit",
        sorter: true,
        sortOrder:
          sortBy === "unit"
            ? sortOrder === "asc"
              ? "ascend"
              : "descend"
            : null,
        render: (_, record) => (
          <span className="font-medium text-slate-700">
            {record.unit?.shortName || "-"}
          </span>
        ),
      },
      {
        title: "Prices",
        key: "prices",
        width: 170,
        render: (_, record) => (
          <div className="space-y-0.5">
            <div className="whitespace-nowrap text-slate-700">
              Buy: {formatCurrency(record.purchasePrice)}
            </div>

            <div className="whitespace-nowrap font-medium text-slate-900">
              Sell: {formatCurrency(record.sellingPrice)}
            </div>
          </div>
        ),
      },
      {
        title: "Stock",
        key: "stock",
        sorter: true,
        sortOrder:
          sortBy === "currentStock"
            ? sortOrder === "asc"
              ? "ascend"
              : "descend"
            : null,
        render: (_, record) => {
          const lowStock = record.currentStock <= record.minStock;

          return (
            <div>
              <Tag
                color={
                  record.currentStock === 0
                    ? "red"
                    : lowStock
                      ? "orange"
                      : "green"
                }
              >
                {record.currentStock} {record.unit?.shortName || ""}
              </Tag>

              {/* <div className="text-xs text-slate-400">
                Min: {record.minStock}
              </div> */}
            </div>
          );
        },
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
        title: "Updated at",
        dataIndex: "updatedAt",
        key: "updatedAt",
        sorter: true,
        sortOrder:
          sortBy === "updatedAt"
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
        title: "Status",
        dataIndex: "isActive",
        key: "status",
        sorter: true,
        sortOrder:
          sortBy === "isActive"
            ? sortOrder === "asc"
              ? "ascend"
              : "descend"
            : null,
        render: (value: boolean) =>
          value ? (
            <Tag color="green">Active</Tag>
          ) : (
            <Tag color="red">Inactive</Tag>
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
                onClick={() => router.push(`/dashboard/products/${record.id}`)}
              />
            </Tooltip>

            <Tooltip title="Edit">
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                className="dashboard-table-action-btn"
                onClick={() =>
                  router.push(`/dashboard/products/${record.id}/edit`)
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
              Product
            </div>

            <Input
              allowClear
              className="dashboard-filter-control"
              placeholder="Search SKU / name"
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
              className="dashboard-filter-control w-full"
              placeholder="Category"
              value={categoryId || undefined}
              onChange={(value) => setCategoryId(value || "")}
              options={categories.map((category) => ({
                label: category.name,
                value: category.id,
              }))}
            />
          </div>

          <div className="lg:col-span-2">
            <div className="mb-1 text-sm font-semibold text-slate-700">
              Brand
            </div>

            <Select
              allowClear
              className="dashboard-filter-control w-full"
              placeholder="Brand"
              value={brandId || undefined}
              onChange={(value) => setBrandId(value || "")}
              options={brands.map((brand) => ({
                label: brand.name,
                value: brand.id,
              }))}
            />
          </div>

          <div className="lg:col-span-2">
            <div className="mb-1 text-sm font-semibold text-slate-700">
              Warehouse
            </div>

            <Select
              allowClear
              className="dashboard-filter-control w-full"
              placeholder="Warehouse"
              value={warehouseId || undefined}
              onChange={(value) => setWarehouseId(value || "")}
              options={warehouses.map((warehouse) => ({
                label: `${warehouse.name} (${warehouse.code})`,
                value: warehouse.id,
              }))}
            />
          </div>

          <div className="lg:col-span-1">
            <div className="mb-1 text-sm font-semibold text-slate-700">
              Stock
            </div>

            <Select
              allowClear
              className="dashboard-filter-control w-full"
              placeholder="Stock"
              value={stockStatus || undefined}
              onChange={(value) => setStockStatus(value || "")}
              options={[
                { label: "Out", value: "OUT_OF_STOCK" },
                { label: "Low", value: "LOW_STOCK" },
              ]}
            />
          </div>

          <div className="lg:col-span-2">
            <div className="mb-1 text-sm font-semibold text-slate-700">
              Status
            </div>

            <Select
              allowClear
              className="dashboard-filter-control w-full"
              placeholder="Status"
              value={isActive || undefined}
              onChange={(value) => setIsActive(value || "")}
              options={[
                { label: "Active", value: "true" },
                { label: "Inactive", value: "false" },
              ]}
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
            {search ||
            categoryId ||
            brandId ||
            warehouseId ||
            stockStatus ||
            isActive
              ? "Filter applied"
              : "No filter applied"}
          </div>

          <Space wrap size={8}>
            <Button
              size="small"
              type="primary"
              icon={<PlusOutlined />}
              className="dashboard-action-btn"
              onClick={() => router.push("/dashboard/products/create")}
            >
              Add New
            </Button>

            <Button
              size="small"
              icon={<ReloadOutlined />}
              className="dashboard-icon-btn"
              onClick={() => void fetchProducts()}
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

        <Table<ProductItem>
          rowKey="id"
          size="small"
          className="data-table-sm clickable-table-row"
          loading={loading}
          columns={tableColumns}
          dataSource={products}
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
