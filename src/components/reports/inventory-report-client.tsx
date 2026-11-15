"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  Alert,
  App,
  Button,
  DatePicker,
  Input,
  Select,
  Table,
  Tag,
} from "antd";

import type { ColumnsType } from "antd/es/table";

import {
  DatabaseOutlined,
  DownloadOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";

import dayjs from "dayjs";
import type { Dayjs } from "dayjs";

import { currentPeriod } from "@/lib/inventory/monthly-core";

import type {
  InventoryReportData,
  InventoryRow,
  InventoryStockStatus,
  InventorySummary,
} from "@/lib/inventory/types";

type OptionItem = {
  id: string;
  name: string;
  code?: string;
};

type ReportResponse = {
  success: boolean;
  message?: string;
  data?: InventoryReportData;
};

type OptionsResponse = {
  success: boolean;
  data?: OptionItem[];
};

const ENDPOINT = "/api/reports/inventory";

const emptySummary: InventorySummary = {
  totalItems: 0,
  totalStock: 0,
  totalPurchaseValue: 0,
  totalSellingValue: 0,
  lowStockItems: 0,
  outOfStockItems: 0,
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCapturedAt(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function stockStatusTag(status: InventoryStockStatus) {
  if (status === "OUT_OF_STOCK") {
    return <Tag color="red">STOK HABIS</Tag>;
  }

  if (status === "LOW_STOCK") {
    return <Tag color="orange">STOK RENDAH</Tag>;
  }

  return <Tag color="green">NORMAL</Tag>;
}

export default function InventoryReportClient() {
  const { message } = App.useApp();

  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [reportData, setReportData] = useState<InventoryReportData | null>(
    null,
  );

  const [loadedQuery, setLoadedQuery] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState("");

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");

  const [stockStatus, setStockStatus] = useState<InventoryStockStatus | "">("");

  const [selectedMonth, setSelectedMonth] = useState<Dayjs | null>(null);

  const [categories, setCategories] = useState<OptionItem[]>([]);

  const [brands, setBrands] = useState<OptionItem[]>([]);

  const [warehouses, setWarehouses] = useState<OptionItem[]>([]);

  const [tablePage, setTablePage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const requestIdRef = useRef(0);

  const reportAbortRef = useRef<AbortController | null>(null);

  const exportAbortRef = useRef<AbortController | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();

    if (search.trim()) {
      params.set("search", search.trim());
    }

    if (categoryId) {
      params.set("categoryId", categoryId);
    }

    if (brandId) {
      params.set("brandId", brandId);
    }

    if (warehouseId) {
      params.set("warehouseId", warehouseId);
    }

    if (stockStatus) {
      params.set("stockStatus", stockStatus);
    }

    if (selectedMonth) {
      params.set("period", selectedMonth.format("YYYY-MM"));
    }

    return params.toString();
  }, [search, categoryId, brandId, warehouseId, stockStatus, selectedMonth]);

  const filtersChanged = loadedQuery !== null && loadedQuery !== query;

  const summary = reportData?.summary || emptySummary;

  const snapshotPeriod = reportData?.period;

  const summaryCards = [
    {
      label: "Total Produk",
      value: formatNumber(summary.totalItems),
      className: "text-slate-950",
    },
    {
      label: snapshotPeriod ? "Total Stok Akhir" : "Total Stok",
      value: formatNumber(summary.totalStock),
      className: "text-blue-600",
    },
    {
      label: "Nilai Beli",
      value: formatCurrency(summary.totalPurchaseValue),
      className: "text-slate-950",
    },
    {
      label: "Nilai Jual",
      value: formatCurrency(summary.totalSellingValue),
      className: "text-blue-600",
    },
    {
      label: "Stok Rendah",
      value: formatNumber(summary.lowStockItems),
      className: "text-orange-600",
    },
    {
      label: "Stok Habis",
      value: formatNumber(summary.outOfStockItems),
      className: "text-red-600",
    },
  ];

  async function fetchReport(requestedQuery: string) {
    reportAbortRef.current?.abort();

    const controller = new AbortController();

    reportAbortRef.current = controller;

    const requestId = ++requestIdRef.current;

    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch(`${ENDPOINT}?${requestedQuery}`, {
        cache: "no-store",
        signal: controller.signal,
      });

      const result = (await response.json()) as ReportResponse;

      if (requestId !== requestIdRef.current) {
        return;
      }

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.message || "Gagal mengambil laporan inventory.");
      }

      setReportData(result.data);
      setLoadedQuery(requestedQuery);
      setTablePage(1);
    } catch (error) {
      if (controller.signal.aborted || requestId !== requestIdRef.current) {
        return;
      }

      const text =
        error instanceof Error
          ? error.message
          : "Gagal mengambil laporan inventory.";

      setReportData(null);
      setLoadedQuery(null);
      setErrorMessage(text);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }

  function handleReset() {
    setSearch("");
    setCategoryId("");
    setBrandId("");
    setWarehouseId("");
    setStockStatus("");
    setSelectedMonth(null);

    void fetchReport("");
  }

  async function handleExport() {
    if (
      loading ||
      exporting ||
      !reportData ||
      loadedQuery === null ||
      loadedQuery !== query
    ) {
      message.info(
        "Klik Tampilkan dan tunggu laporan selesai dimuat sebelum export.",
      );

      return;
    }

    exportAbortRef.current?.abort();

    const controller = new AbortController();

    exportAbortRef.current = controller;

    setExporting(true);

    try {
      const params = new URLSearchParams(loadedQuery);

      params.set("export", "xlsx");

      const response = await fetch(`${ENDPOINT}?${params.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      });

      const contentType = response.headers.get("content-type") || "";

      if (
        !response.ok ||
        !contentType.includes(
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
      ) {
        let text = "Gagal export laporan.";

        if (contentType.includes("application/json")) {
          const result = (await response.json()) as {
            message?: string;
          };

          text = result.message || text;
        }

        throw new Error(text);
      }

      const disposition = response.headers.get("content-disposition") || "";

      const match = /filename="([^"]+)"/i.exec(disposition);

      const filename = match?.[1] || "inventory-report.xlsx";

      const blob = await response.blob();

      if (controller.signal.aborted) {
        return;
      }

      const url = window.URL.createObjectURL(blob);

      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = filename;

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      window.setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 1000);
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      message.error(
        error instanceof Error ? error.message : "Gagal export laporan.",
      );
    } finally {
      if (!controller.signal.aborted) {
        setExporting(false);
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController();

    let active = true;

    const endpoints = [
      "/api/categories/options",
      "/api/brands/options",
      "/api/warehouses/options",
    ];

    async function fetchOptions() {
      const results = await Promise.allSettled(
        endpoints.map(async (endpoint) => {
          const response = await fetch(endpoint, {
            cache: "no-store",
            signal: controller.signal,
          });

          const result = (await response.json()) as OptionsResponse;

          if (!response.ok || !result.success) {
            throw new Error("Gagal mengambil opsi filter.");
          }

          return result.data || [];
        }),
      );

      if (!active) {
        return;
      }

      const [categoriesResult, brandsResult, warehousesResult] = results;

      if (categoriesResult.status === "fulfilled") {
        setCategories(categoriesResult.value);
      }

      if (brandsResult.status === "fulfilled") {
        setBrands(brandsResult.value);
      }

      if (warehousesResult.status === "fulfilled") {
        setWarehouses(warehousesResult.value);
      }
    }

    void fetchOptions();

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    void fetchReport("");

    return () => {
      requestIdRef.current += 1;

      reportAbortRef.current?.abort();
      exportAbortRef.current?.abort();
    };

    // Laporan pertama memakai stok saat ini tanpa filter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columns = useMemo<ColumnsType<InventoryRow>>(
    () => [
      {
        title: "Produk",
        key: "productName",
        width: 300,

        sorter: (a, b) => a.productName.localeCompare(b.productName),

        render: (_, record) => (
          <div>
            <div className="font-semibold text-slate-900">
              {record.productName}
            </div>

            <div className="mt-1 font-mono text-xs text-slate-500">
              {record.sku} · {record.unit}
            </div>

            {record.barcode ? (
              <div className="mt-1 text-xs text-slate-400">
                {record.barcode}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        title: "Kategori / Brand",
        key: "category",
        width: 200,

        render: (_, record) => (
          <div>
            <div className="font-medium text-slate-700">{record.category}</div>

            <div className="mt-1 text-xs text-slate-500">{record.brand}</div>
          </div>
        ),
      },
      {
        title: "Gudang / Rak",
        key: "warehouse",
        width: 180,

        render: (_, record) => (
          <div>
            <div className="text-slate-700">{record.warehouse}</div>

            <div className="mt-1 text-xs text-slate-500">
              {record.rackLocation}
            </div>
          </div>
        ),
      },
      {
        title: snapshotPeriod ? "Stok Akhir Bulan" : "Stok Saat Ini",
        dataIndex: "currentStock",
        key: "currentStock",
        width: 180,
        align: "right",

        sorter: (a, b) => a.currentStock - b.currentStock,

        render: (value: number, record) => (
          <div>
            <div
              className={`text-lg font-bold ${
                value <= 0
                  ? "text-red-600"
                  : record.stockStatus === "LOW_STOCK"
                    ? "text-orange-600"
                    : "text-slate-900"
              }`}
            >
              {formatNumber(value)}
            </div>

            <div className="mt-1">{stockStatusTag(record.stockStatus)}</div>
          </div>
        ),
      },
      {
        title: "Minimum",
        dataIndex: "minStock",
        key: "minStock",
        width: 100,
        align: "right",

        render: (value: number) => formatNumber(value),
      },
      {
        title: "Harga Beli",
        dataIndex: "purchasePrice",
        key: "purchasePrice",
        width: 160,
        align: "right",

        render: (value: number) => (
          <span className="whitespace-nowrap">{formatCurrency(value)}</span>
        ),
      },
      {
        title: "Harga Jual",
        dataIndex: "sellingPrice",
        key: "sellingPrice",
        width: 160,
        align: "right",

        render: (value: number) => (
          <span className="whitespace-nowrap font-medium">
            {formatCurrency(value)}
          </span>
        ),
      },
      {
        title: "Nilai Stok Beli",
        dataIndex: "purchaseStockValue",
        key: "purchaseStockValue",
        width: 180,
        align: "right",

        render: (value: number) => (
          <span className="whitespace-nowrap">{formatCurrency(value)}</span>
        ),
      },
      {
        title: "Nilai Stok Jual",
        dataIndex: "sellingStockValue",
        key: "sellingStockValue",
        width: 180,
        align: "right",

        render: (value: number) => (
          <span className="whitespace-nowrap font-medium text-blue-600">
            {formatCurrency(value)}
          </span>
        ),
      },
    ],
    [snapshotPeriod],
  );

  return (
    <div className="text-sm">
      <div className="mb-5 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2">
          <DatabaseOutlined className="text-blue-600" />

          <h1 className="m-0 text-lg font-bold text-slate-950">
            Inventory Report
          </h1>
        </div>

        <p className="mt-1 text-sm text-slate-500">
          Pantau stok saat ini atau lihat sisa stok yang tersimpan pada akhir
          bulan.
        </p>
      </div>

      <div className="mb-4 border border-slate-100 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <div className="mb-1 font-semibold text-slate-700">
              Periode Rekap
            </div>

            <DatePicker
              picker="month"
              allowClear
              format="MMMM YYYY"
              className="w-full"
              placeholder="Stok saat ini"
              value={selectedMonth}
              onChange={(value) => setSelectedMonth(value)}
              disabledDate={(date) => date.format("YYYY-MM") >= currentPeriod()}
            />

            <div className="mt-1 text-xs text-slate-400">
              Kosongkan untuk melihat stok saat ini.
            </div>
          </div>

          <div>
            <div className="mb-1 font-semibold text-slate-700">Pencarian</div>

            <Input
              allowClear
              placeholder="SKU / barcode / nama produk"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onPressEnter={() => {
                void fetchReport(query);
              }}
            />
          </div>

          <div>
            <div className="mb-1 font-semibold text-slate-700">Kategori</div>

            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              className="w-full"
              placeholder="Semua kategori"
              value={categoryId || undefined}
              onChange={(value: string | undefined) =>
                setCategoryId(value || "")
              }
              options={categories.map((item) => ({
                label: item.name,
                value: item.id,
              }))}
            />
          </div>

          <div>
            <div className="mb-1 font-semibold text-slate-700">Brand</div>

            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              className="w-full"
              placeholder="Semua brand"
              value={brandId || undefined}
              onChange={(value: string | undefined) => setBrandId(value || "")}
              options={brands.map((item) => ({
                label: item.name,
                value: item.id,
              }))}
            />
          </div>

          <div>
            <div className="mb-1 font-semibold text-slate-700">Gudang</div>

            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              className="w-full"
              placeholder="Semua gudang"
              value={warehouseId || undefined}
              onChange={(value: string | undefined) =>
                setWarehouseId(value || "")
              }
              options={warehouses.map((item) => ({
                label: item.code ? `${item.name} (${item.code})` : item.name,
                value: item.id,
              }))}
            />
          </div>

          <div>
            <div className="mb-1 font-semibold text-slate-700">Status Stok</div>

            <Select
              allowClear
              className="w-full"
              placeholder="Semua status"
              value={stockStatus || undefined}
              onChange={(value: InventoryStockStatus | undefined) =>
                setStockStatus(value || "")
              }
              options={[
                {
                  label: "Normal",
                  value: "NORMAL",
                },
                {
                  label: "Stok Rendah",
                  value: "LOW_STOCK",
                },
                {
                  label: "Stok Habis",
                  value: "OUT_OF_STOCK",
                },
              ]}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button
            type="primary"
            icon={<SearchOutlined />}
            loading={loading}
            onClick={() => {
              void fetchReport(query);
            }}
          >
            Tampilkan
          </Button>

          <Button disabled={loading} onClick={handleReset}>
            Reset
          </Button>

          <Button
            icon={<ReloadOutlined />}
            disabled={loading}
            onClick={() => {
              void fetchReport(query);
            }}
          >
            Refresh
          </Button>

          <Button
            icon={<DownloadOutlined />}
            loading={exporting}
            disabled={loading || !reportData || loadedQuery !== query}
            onClick={() => {
              void handleExport();
            }}
          >
            Export Excel
          </Button>
        </div>
      </div>

      {errorMessage ? (
        <Alert showIcon type="error" title={errorMessage} className="mb-4" />
      ) : null}

      {filtersChanged ? (
        <Alert
          showIcon
          type="warning"
          title="Filter berubah. Klik Tampilkan untuk memperbarui laporan."
          className="mb-4"
        />
      ) : null}

      {snapshotPeriod ? (
        <Alert
          showIcon
          type="info"
          className="mb-4"
          title={`Rekap stok akhir bulan ${String(
            snapshotPeriod.month,
          ).padStart(2, "0")}/${snapshotPeriod.year}`}
          description={
            <div className="space-y-1">
              <div>
                Periode: {snapshotPeriod.dateFrom}
                {" sampai "}
                {snapshotPeriod.dateTo}
                {" (WIB)."}
              </div>

              <div>
                Disimpan: {formatCapturedAt(snapshotPeriod.capturedAt)}
                {" WIB."}
              </div>

              <div>
                Stok menggunakan snapshot tersimpan. Nama, harga, dan informasi
                master merupakan salinan ketika proses rekap dijalankan.
              </div>
            </div>
          }
        />
      ) : reportData ? (
        <div className="mb-4 text-sm text-slate-500">
          Menampilkan stok saat ini.
        </div>
      ) : null}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="border border-slate-100 bg-white p-4"
          >
            <div className="text-xs font-medium text-slate-500">
              {card.label}
            </div>

            <div
              className={`mt-2 break-words text-lg font-bold ${card.className}`}
            >
              {card.value}
            </div>
          </div>
        ))}
      </div>

      <Table<InventoryRow>
        rowKey="id"
        size="small"
        loading={loading}
        columns={columns}
        dataSource={reportData?.items || []}
        scroll={{
          x: 1740,
        }}
        pagination={{
          current: tablePage,
          pageSize,
          total: reportData?.items.length || 0,
          showSizeChanger: true,
          pageSizeOptions: ["20", "50", "100"],
          showTotal: (total) => `${formatNumber(total)} produk`,
          onChange: (nextPage, nextPageSize) => {
            setTablePage(nextPageSize !== pageSize ? 1 : nextPage);

            setPageSize(nextPageSize);
          },
        }}
        rowClassName={(record) => {
          if (record.currentStock <= 0) {
            return "bg-red-50/40";
          }

          if (record.stockStatus === "LOW_STOCK") {
            return "bg-orange-50/40";
          }

          return "";
        }}
      />
    </div>
  );
}
