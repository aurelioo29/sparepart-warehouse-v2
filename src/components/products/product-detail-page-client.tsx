"use client";

import { useEffect, useState } from "react";
import {
  App,
  Button,
  DatePicker,
  Descriptions,
  Modal,
  Select,
  Space,
  Spin,
  Table,
  Tag,
} from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import type { SorterResult } from "antd/es/table/interface";
import {
  DeleteOutlined,
  EditOutlined,
  HistoryOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";

const { RangePicker } = DatePicker;

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
  slug: string;

  purchasePrice: string | number;
  sellingPrice: string | number;
  currentStock: number;
  minStock: number;

  imageUrl?: string | null;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;

  category?: {
    id: string;
    name: string;
  } | null;
  brand?: {
    id: string;
    name: string;
  } | null;
  unit: {
    id: string;
    name: string;
    shortName: string;
  };
  supplier?: {
    id: string;
    name: string;
  } | null;
  warehouse?: {
    id: string;
    name: string;
    code: string;
  } | null;
  rackLocation?: {
    id: string;
    name: string;
    code: string;
  } | null;
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
  referenceStatus?: string | null;
  referenceDocumentNumber?: string | null;
  isCancelledReference?: boolean;
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
  warehouse?: {
    id: string;
    name: string;
    code: string;
  } | null;
  rackLocation?: {
    id: string;
    name: string;
    code: string;
  } | null;
  createdBy?: {
    id: string;
    fullName: string;
    username: string;
  } | null;
};

type ProductStockMovementResponse = {
  product: {
    id: string;
    sku: string;
    name: string;
    currentStock: number;
    unit: {
      id: string;
      name: string;
      shortName: string;
    };
  };
  summary: {
    totalIn: number;
    totalOut: number;
    totalAdjustmentDelta: number;
    totalMovementDelta: number;
    firstStockBefore: number;
    calculatedFinalStock: number;
    latestMovementStockAfter: number | null;
    currentStock: number;
    balanceDifference: number | null;
    isBalanced: boolean | null;
    isFiltered: boolean;
    showCancelledReferences?: boolean;
    hiddenCancelledReferences?: number;
  };
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

type ProductDetailPageClientProps = {
  id: string;
};

function formatCurrency(value: string | number | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function renderMovementType(value: string) {
  if (value === "IN") return <Tag color="green">IN</Tag>;
  if (value === "OUT") return <Tag color="red">OUT</Tag>;

  return <Tag color="orange">ADJUSTMENT</Tag>;
}

function renderStockDelta(record: StockMovementItem) {
  const delta = record.stockAfter - record.stockBefore;

  return (
    <Tag color={delta > 0 ? "green" : delta < 0 ? "red" : "default"}>
      {delta > 0 ? `+${delta}` : delta}
    </Tag>
  );
}

function getMovementReferenceHref(record: StockMovementItem) {
  if (!record.referenceId) return null;

  if (record.referenceType === "SALE") {
    return `/dashboard/sales-invoices/${record.referenceId}`;
  }

  if (record.referenceType === "STOCK_IN") {
    return `/dashboard/stock-ins/${record.referenceId}`;
  }

  if (record.referenceType === "ADJUSTMENT") {
    return `/dashboard/stock-adjustments/${record.referenceId}`;
  }

  if (record.referenceType === "STOCK_OUT") {
    return `/dashboard/stock-outs/${record.referenceId}`;
  }

  return null;
}

export default function ProductDetailPageClient({
  id,
}: ProductDetailPageClientProps) {
  const router = useRouter();
  const { message } = App.useApp();
  const [modal, contextHolder] = Modal.useModal();

  const [product, setProduct] = useState<ProductItem | null>(null);
  const [loading, setLoading] = useState(false);

  const [stockMovements, setStockMovements] = useState<StockMovementItem[]>([]);
  const [stockMovementLoading, setStockMovementLoading] = useState(false);
  const [showStockAudit, setShowStockAudit] = useState(false);

  const [movementType, setMovementType] = useState("");
  const [movementReferenceType, setMovementReferenceType] = useState("");
  const [movementDateRange, setMovementDateRange] = useState<
    [dayjs.Dayjs | null, dayjs.Dayjs | null] | null
  >(null);

  const [showCancelledReferences, setShowCancelledReferences] = useState(false);

  const [stockAuditSummary, setStockAuditSummary] = useState<
    ProductStockMovementResponse["summary"] | null
  >(null);

  const [stockMovementMeta, setStockMovementMeta] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  const [stockMovementSortBy, setStockMovementSortBy] = useState("createdAt");
  const [stockMovementSortOrder, setStockMovementSortOrder] = useState<
    "asc" | "desc"
  >("desc");

  async function fetchProduct() {
    try {
      setLoading(true);

      const response = await fetch(`/api/products/${id}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch product");
      }

      setProduct(result.data);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal mengambil product",
      );
    } finally {
      setLoading(false);
    }
  }

  async function fetchStockMovements(params?: {
    page?: number;
    limit?: number;
    type?: string;
    referenceType?: string;
    dateFrom?: string;
    dateTo?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    showCancelledReferences?: boolean;
  }) {
    try {
      setStockMovementLoading(true);

      const dateFrom =
        params?.dateFrom ??
        (movementDateRange?.[0]
          ? movementDateRange[0].format("YYYY-MM-DD")
          : "");

      const dateTo =
        params?.dateTo ??
        (movementDateRange?.[1]
          ? movementDateRange[1].format("YYYY-MM-DD")
          : "");

      const query = new URLSearchParams({
        page: String(params?.page ?? stockMovementMeta.page),
        limit: String(params?.limit ?? stockMovementMeta.limit),
        type: params?.type ?? movementType,
        referenceType: params?.referenceType ?? movementReferenceType,
        dateFrom,
        dateTo,
        sortBy: params?.sortBy ?? stockMovementSortBy,
        sortOrder: params?.sortOrder ?? stockMovementSortOrder,
        showCancelledReferences: String(
          params?.showCancelledReferences ?? showCancelledReferences,
        ),
      });

      const response = await fetch(
        `/api/products/${id}/stock-movements?${query.toString()}`,
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch stock movements");
      }

      const data: ProductStockMovementResponse = result.data;

      setStockMovements(data.items || []);
      setStockMovementMeta(data.meta);
      setStockAuditSummary(data.summary);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error
          ? error.message
          : "Gagal mengambil stock movements product",
      );
    } finally {
      setStockMovementLoading(false);
    }
  }

  useEffect(() => {
    void fetchProduct();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function handleOpenStockAudit() {
    setShowStockAudit(true);

    void fetchStockMovements({
      page: 1,
      limit: stockMovementMeta.limit,
      showCancelledReferences,
    });
  }

  function handleStockMovementSearch() {
    void fetchStockMovements({
      page: 1,
      limit: stockMovementMeta.limit,
      type: movementType,
      referenceType: movementReferenceType,
      dateFrom: movementDateRange?.[0]
        ? movementDateRange[0].format("YYYY-MM-DD")
        : "",
      dateTo: movementDateRange?.[1]
        ? movementDateRange[1].format("YYYY-MM-DD")
        : "",
      sortBy: stockMovementSortBy,
      sortOrder: stockMovementSortOrder,
      showCancelledReferences,
    });
  }

  function handleStockMovementReset() {
    setMovementType("");
    setMovementReferenceType("");
    setMovementDateRange(null);
    setShowCancelledReferences(false);

    void fetchStockMovements({
      page: 1,
      limit: stockMovementMeta.limit,
      type: "",
      referenceType: "",
      dateFrom: "",
      dateTo: "",
      sortBy: stockMovementSortBy,
      sortOrder: stockMovementSortOrder,
      showCancelledReferences: false,
    });
  }

  function handleStockMovementTableChange(
    pagination: TablePaginationConfig,
    _filters: Record<string, unknown>,
    sorter: SorterResult<StockMovementItem> | SorterResult<StockMovementItem>[],
  ) {
    const singleSorter = Array.isArray(sorter) ? sorter[0] : sorter;

    const nextPage = pagination.current || 1;
    const nextLimit = pagination.pageSize || 10;

    let nextSortBy = stockMovementSortBy;
    let nextSortOrder = stockMovementSortOrder;

    if (singleSorter?.field && singleSorter.order) {
      nextSortBy = String(singleSorter.field);
      nextSortOrder = singleSorter.order === "ascend" ? "asc" : "desc";
    } else {
      nextSortBy = "createdAt";
      nextSortOrder = "desc";
    }

    setStockMovementSortBy(nextSortBy);
    setStockMovementSortOrder(nextSortOrder);

    void fetchStockMovements({
      page: nextPage,
      limit: nextLimit,
      sortBy: nextSortBy,
      sortOrder: nextSortOrder,
      showCancelledReferences,
    });
  }

  function handleInactive() {
    if (!product) return;

    modal.confirm({
      title: "Inactive product?",
      content: `Product "${product.name}" akan dinonaktifkan. Data tetap ada dan bisa diaktifkan lagi lewat edit.`,
      okText: "Ya, Inactive",
      cancelText: "Batal",
      okButtonProps: {
        danger: true,
      },
      centered: true,
      async onOk() {
        try {
          const response = await fetch(`/api/products/${product.id}`, {
            method: "DELETE",
          });

          const result = await response.json();

          if (!response.ok || !result.success) {
            throw new Error(result.message || "Failed to inactive product");
          }

          message.success(result.message || "Product inactivated successfully");

          await fetchProduct();

          if (showStockAudit) {
            await fetchStockMovements({
              page: 1,
              limit: stockMovementMeta.limit,
              showCancelledReferences,
            });
          }
        } catch (error) {
          console.error(error);

          message.error(
            error instanceof Error
              ? error.message
              : "Gagal menonaktifkan product",
          );
        }
      },
    });
  }

  function handlePermanentDelete() {
    if (!product) return;

    modal.confirm({
      title: "Delete permanent product?",
      content: `Product "${product.name}" akan dihapus permanent dari database. Aksi ini tidak bisa dibatalkan.`,
      okText: "Ya, Delete Permanent",
      cancelText: "Batal",
      okButtonProps: {
        danger: true,
      },
      centered: true,
      async onOk() {
        try {
          const response = await fetch(
            `/api/products/${product.id}?permanent=true`,
            {
              method: "DELETE",
            },
          );

          const result = await response.json();

          if (!response.ok || !result.success) {
            throw new Error(
              result.message || "Failed to permanently delete product",
            );
          }

          message.success(
            result.message || "Product permanently deleted successfully",
          );

          router.push("/dashboard/products");
          router.refresh();
        } catch (error) {
          console.error(error);

          message.error(
            error instanceof Error
              ? error.message
              : "Gagal menghapus permanent product",
          );
        }
      },
    });
  }

  const stockMovementColumns: ColumnsType<StockMovementItem> = [
    {
      title: "Date",
      dataIndex: "createdAt",
      key: "createdAt",
      sorter: true,
      sortOrder:
        stockMovementSortBy === "createdAt"
          ? stockMovementSortOrder === "asc"
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
      title: "Type",
      dataIndex: "type",
      key: "type",
      sorter: true,
      sortOrder:
        stockMovementSortBy === "type"
          ? stockMovementSortOrder === "asc"
            ? "ascend"
            : "descend"
          : null,
      render: renderMovementType,
    },
    {
      title: "Qty",
      dataIndex: "quantity",
      key: "quantity",
      sorter: true,
      sortOrder:
        stockMovementSortBy === "quantity"
          ? stockMovementSortOrder === "asc"
            ? "ascend"
            : "descend"
          : null,
      render: (value: number, record) => (
        <span className="font-medium">
          {value} {record.product.unit.shortName}
        </span>
      ),
    },
    {
      title: "Stock Before",
      dataIndex: "stockBefore",
      key: "stockBefore",
      sorter: true,
      sortOrder:
        stockMovementSortBy === "stockBefore"
          ? stockMovementSortOrder === "asc"
            ? "ascend"
            : "descend"
          : null,
    },
    {
      title: "Stock After",
      dataIndex: "stockAfter",
      key: "stockAfter",
      sorter: true,
      sortOrder:
        stockMovementSortBy === "stockAfter"
          ? stockMovementSortOrder === "asc"
            ? "ascend"
            : "descend"
          : null,
    },
    {
      title: "Delta",
      key: "delta",
      render: (_, record) => renderStockDelta(record),
    },
    {
      title: "Reference",
      dataIndex: "referenceType",
      key: "referenceType",
      sorter: true,
      sortOrder:
        stockMovementSortBy === "referenceType"
          ? stockMovementSortOrder === "asc"
            ? "ascend"
            : "descend"
          : null,
      render: (value: string, record) => {
        const href = getMovementReferenceHref(record);

        return (
          <div>
            <Space size={4} wrap>
              <Tag>{value}</Tag>

              {record.referenceStatus === "CANCELLED" ? (
                <Tag color="red">CANCELLED</Tag>
              ) : null}

              {record.referenceStatus === "POSTED" ? (
                <Tag color="green">POSTED</Tag>
              ) : null}

              {record.isCancelledReference ? (
                <Tag color="volcano">VOIDED</Tag>
              ) : null}
            </Space>

            <div className="mt-1 text-xs font-semibold text-slate-600">
              {href ? (
                <button
                  type="button"
                  onClick={() => router.push(href)}
                  className="text-blue-600 hover:underline"
                >
                  {record.referenceDocumentNumber || record.referenceId}
                </button>
              ) : (
                record.referenceDocumentNumber || "-"
              )}
            </div>

            <div className="mt-1 font-mono text-xs text-slate-400">
              {record.referenceId || "-"}
            </div>
          </div>
        );
      },
    },
    {
      title: "Location",
      key: "location",
      render: (_, record) => (
        <div>
          <div>{record.warehouse?.name || "-"}</div>

          <div className="text-xs text-slate-400">
            {record.rackLocation?.name || "-"}
          </div>
        </div>
      ),
    },
    {
      title: "Created By",
      key: "createdBy",
      render: (_, record) =>
        record.createdBy?.fullName || record.createdBy?.username || "-",
    },
    {
      title: "Notes",
      dataIndex: "notes",
      key: "notes",
      render: (value: string | null, record) => {
        const href = getMovementReferenceHref(record);

        if (!value) return "-";

        if (!href) {
          return <span>{value}</span>;
        }

        return (
          <button
            type="button"
            onClick={() => router.push(href)}
            className="text-left text-blue-600 hover:underline"
          >
            {value}
          </button>
        );
      },
    },
  ];

  return (
    <>
      {contextHolder}

      <div className="text-sm">
        <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="m-0 text-lg font-bold text-slate-950">
              Detail Product
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Lihat informasi product, harga, stock, lokasi, dan audit
              pergerakan stok.
            </p>
          </div>

          <Space wrap size={8}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              className="dashboard-action-btn"
              onClick={() => router.push("/dashboard/products/create")}
            >
              Add More
            </Button>

            <Button
              size="small"
              icon={<HistoryOutlined />}
              className="dashboard-action-btn"
              onClick={handleOpenStockAudit}
            >
              Stock Audit
            </Button>

            <Button
              size="small"
              type="primary"
              icon={<EditOutlined />}
              className="dashboard-action-btn"
              disabled={!product}
              onClick={() => router.push(`/dashboard/products/${id}/edit`)}
            >
              Edit
            </Button>

            <Button
              size="small"
              danger
              icon={<StopOutlined />}
              className="dashboard-action-btn"
              disabled={!product?.isActive}
              onClick={handleInactive}
            >
              Inactive
            </Button>

            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              className="dashboard-action-btn"
              disabled={!product}
              onClick={handlePermanentDelete}
            >
              Delete Permanent
            </Button>
          </Space>
        </div>

        {loading ? (
          <div className="flex min-h-[240px] items-center justify-center">
            <Spin />
          </div>
        ) : (
          <Descriptions
            bordered
            size="small"
            column={1}
            className="detail-descriptions"
            items={[
              {
                key: "name",
                label: "Product Name",
                children: product?.name || "-",
              },
              {
                key: "sku",
                label: "SKU",
                children: product?.sku || "-",
              },
              {
                key: "barcode",
                label: "Barcode",
                children: product?.barcode || "-",
              },
              {
                key: "category",
                label: "Category",
                children: product?.category?.name || "-",
              },
              {
                key: "brand",
                label: "Brand",
                children: product?.brand?.name || "-",
              },
              {
                key: "unit",
                label: "Unit",
                children: product?.unit
                  ? `${product.unit.name} (${product.unit.shortName})`
                  : "-",
              },
              {
                key: "supplier",
                label: "Supplier",
                children: product?.supplier?.name || "-",
              },
              {
                key: "purchasePrice",
                label: "Purchase Price",
                children: formatCurrency(product?.purchasePrice),
              },
              {
                key: "sellingPrice",
                label: "Selling Price",
                children: formatCurrency(product?.sellingPrice),
              },
              {
                key: "currentStock",
                label: "Current Stock",
                children: product
                  ? `${product.currentStock} ${product.unit?.shortName || ""}`
                  : "-",
              },
              {
                key: "minStock",
                label: "Minimum Stock",
                children: product?.minStock ?? "-",
              },
              {
                key: "warehouse",
                label: "Warehouse",
                children: product?.warehouse
                  ? `${product.warehouse.name} (${product.warehouse.code})`
                  : "-",
              },
              {
                key: "rackLocation",
                label: "Rack Location",
                children: product?.rackLocation
                  ? `${product.rackLocation.name} (${product.rackLocation.code})`
                  : "-",
              },
              {
                key: "imageUrl",
                label: "Image URL",
                children: product?.imageUrl || "-",
              },
              {
                key: "description",
                label: "Description",
                children: product?.description || "-",
              },
              {
                key: "status",
                label: "Status",
                children: product?.isActive ? (
                  <Tag color="green">Active</Tag>
                ) : (
                  <Tag color="red">Inactive</Tag>
                ),
              },
              {
                key: "createdAt",
                label: "Created at",
                children: product?.createdAt
                  ? dayjs(product.createdAt).format("YYYY-MM-DD HH:mm:ss")
                  : "-",
              },
              {
                key: "updatedAt",
                label: "Updated at",
                children: product?.updatedAt
                  ? dayjs(product.updatedAt).format("YYYY-MM-DD HH:mm:ss")
                  : "-",
              },
            ]}
          />
        )}

        {showStockAudit ? (
          <div className="mt-6 border-t border-slate-100 pt-5">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-base font-bold text-slate-900">
                  Stock Audit / Movements
                </div>

                <div className="text-sm text-slate-500">
                  Audit pergerakan stock product berdasarkan transaksi dan
                  adjustment.
                </div>
              </div>

              <Button
                size="small"
                icon={<ReloadOutlined />}
                className="dashboard-action-btn"
                onClick={() =>
                  void fetchStockMovements({
                    page: stockMovementMeta.page,
                    limit: stockMovementMeta.limit,
                    showCancelledReferences,
                  })
                }
              >
                Refresh
              </Button>
            </div>

            {stockAuditSummary ? (
              <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-5">
                <div className="border border-slate-100 bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Current Stock</div>

                  <div className="text-lg font-bold text-slate-900">
                    {stockAuditSummary.currentStock}
                  </div>
                </div>

                <div className="border border-slate-100 bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Total IN</div>

                  <div className="text-lg font-bold text-green-600">
                    +{stockAuditSummary.totalIn}
                  </div>
                </div>

                <div className="border border-slate-100 bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Total OUT</div>

                  <div className="text-lg font-bold text-red-600">
                    -{stockAuditSummary.totalOut}
                  </div>
                </div>

                <div className="border border-slate-100 bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Adjustment Delta</div>

                  <div
                    className={`text-lg font-bold ${
                      stockAuditSummary.totalAdjustmentDelta > 0
                        ? "text-green-600"
                        : stockAuditSummary.totalAdjustmentDelta < 0
                          ? "text-red-600"
                          : "text-slate-900"
                    }`}
                  >
                    {stockAuditSummary.totalAdjustmentDelta > 0
                      ? `+${stockAuditSummary.totalAdjustmentDelta}`
                      : stockAuditSummary.totalAdjustmentDelta}
                  </div>
                </div>

                <div className="border border-slate-100 bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Balance Check</div>

                  {!stockAuditSummary.showCancelledReferences ? (
                    <div className="text-sm font-semibold text-blue-600">
                      Clean View
                    </div>
                  ) : stockAuditSummary.isBalanced ? (
                    <div className="text-sm font-semibold text-green-600">
                      Balanced
                    </div>
                  ) : (
                    <div className="text-sm font-semibold text-red-600">
                      Difference: {stockAuditSummary.balanceDifference}
                    </div>
                  )}

                  <div className="mt-1 text-xs text-slate-400">
                    Calculated: {stockAuditSummary.calculatedFinalStock}
                  </div>

                  {!!stockAuditSummary.hiddenCancelledReferences &&
                  stockAuditSummary.hiddenCancelledReferences > 0 ? (
                    <div className="mt-1 text-xs text-orange-500">
                      Hidden cancelled:{" "}
                      {stockAuditSummary.hiddenCancelledReferences}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="form-compact mb-4 border-b border-slate-100 pb-4">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 lg:items-end">
                <div className="lg:col-span-2">
                  <div className="mb-1 text-sm font-semibold text-slate-700">
                    Type
                  </div>

                  <Select
                    allowClear
                    placeholder="Type"
                    value={movementType || undefined}
                    onChange={(value) => setMovementType(value || "")}
                    className="dashboard-filter-control w-full"
                    options={[
                      { label: "IN", value: "IN" },
                      { label: "OUT", value: "OUT" },
                      { label: "ADJUSTMENT", value: "ADJUSTMENT" },
                    ]}
                  />
                </div>

                <div className="lg:col-span-3">
                  <div className="mb-1 text-sm font-semibold text-slate-700">
                    Reference
                  </div>

                  <Select
                    allowClear
                    placeholder="Reference"
                    value={movementReferenceType || undefined}
                    onChange={(value) => setMovementReferenceType(value || "")}
                    className="dashboard-filter-control w-full"
                    options={[
                      { label: "Stock In", value: "STOCK_IN" },
                      { label: "Stock Out", value: "STOCK_OUT" },
                      { label: "Sale", value: "SALE" },
                      { label: "Sale Return", value: "SALE_RETURN" },
                      { label: "Adjustment", value: "ADJUSTMENT" },
                    ]}
                  />
                </div>

                <div className="lg:col-span-3">
                  <div className="mb-1 text-sm font-semibold text-slate-700">
                    Date
                  </div>

                  <RangePicker
                    className="w-full"
                    value={movementDateRange}
                    onChange={(value) => setMovementDateRange(value)}
                  />
                </div>

                <div className="lg:col-span-2">
                  <div className="mb-1 text-sm font-semibold text-slate-700">
                    Cancelled
                  </div>

                  <Select
                    value={showCancelledReferences ? "true" : "false"}
                    onChange={(value) =>
                      setShowCancelledReferences(value === "true")
                    }
                    className="dashboard-filter-control w-full"
                    options={[
                      {
                        label: "Hide Cancelled",
                        value: "false",
                      },
                      {
                        label: "Show Cancelled",
                        value: "true",
                      },
                    ]}
                  />
                </div>

                <div className="flex justify-start gap-2 lg:col-span-2 lg:justify-end">
                  <Button
                    size="small"
                    type="primary"
                    icon={<SearchOutlined />}
                    className="dashboard-action-btn"
                    onClick={handleStockMovementSearch}
                  >
                    Search
                  </Button>

                  <Button
                    size="small"
                    className="dashboard-action-btn"
                    onClick={handleStockMovementReset}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            </div>

            <Table<StockMovementItem>
              rowKey="id"
              size="small"
              className="data-table-sm"
              loading={stockMovementLoading}
              columns={stockMovementColumns}
              dataSource={stockMovements}
              pagination={{
                current: stockMovementMeta.page,
                pageSize: stockMovementMeta.limit,
                total: stockMovementMeta.total,
                showSizeChanger: true,
                pageSizeOptions: [10, 25, 50, 100],
                showTotal: (total, range) =>
                  `showing ${range[0]} to ${range[1]} of ${total} items`,
              }}
              onChange={handleStockMovementTableChange}
              scroll={{ x: 1400 }}
            />
          </div>
        ) : null}
      </div>
    </>
  );
}
