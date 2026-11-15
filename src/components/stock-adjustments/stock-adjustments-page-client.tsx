"use client";

import { useEffect, useState } from "react";
import {
  App,
  Button,
  DatePicker,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { Dayjs } from "dayjs";
import {
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";

const { RangePicker } = DatePicker;

type AdjustmentItem = {
  id: string;
  documentNumber: string;
  adjustmentDate: string;
  reason: string;
  status: string;
  notes?: string | null;
  createdAt: string;
  createdBy?: {
    fullName?: string | null;
    username?: string | null;
  } | null;
  _count?: {
    items: number;
  };
};

type DateRange = [Dayjs, Dayjs] | null;

const reasonOptions = [
  { label: "Stock Opname", value: "STOCK_OPNAME" },
  { label: "Damaged", value: "DAMAGED" },
  { label: "Lost", value: "LOST" },
  { label: "Found", value: "FOUND" },
  { label: "Input Error", value: "INPUT_ERROR" },
  { label: "Other", value: "OTHER" },
];

function getStatusColor(value: string) {
  if (value === "POSTED") return "green";
  return "red";
}

function getReasonLabel(value: string) {
  return reasonOptions.find((item) => item.value === value)?.label || value;
}

function getDownloadFilename(disposition: string | null, fallback: string) {
  if (!disposition) return fallback;

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);

  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const normalMatch = disposition.match(/filename="?([^"]+)"?/i);

  return normalMatch?.[1] || fallback;
}

export default function StockAdjustmentsPageClient() {
  const router = useRouter();
  const { message } = App.useApp();

  const [items, setItems] = useState<AdjustmentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>(null);

  const [exportDateRange, setExportDateRange] = useState<DateRange>([
    dayjs().startOf("month"),
    dayjs(),
  ]);

  function createQuery(params?: {
    search?: string;
    reason?: string;
    status?: string;
    dateRange?: DateRange;
  }) {
    const selectedDateRange =
      params?.dateRange !== undefined ? params.dateRange : dateRange;

    const query = new URLSearchParams();

    const selectedSearch = params?.search ?? search;
    const selectedReason = params?.reason ?? reason;
    const selectedStatus = params?.status ?? status;

    if (selectedSearch.trim()) {
      query.set("search", selectedSearch.trim());
    }

    if (selectedReason) {
      query.set("reason", selectedReason);
    }

    if (selectedStatus) {
      query.set("status", selectedStatus);
    }

    if (selectedDateRange) {
      query.set("startDate", selectedDateRange[0].format("YYYY-MM-DD"));

      query.set("endDate", selectedDateRange[1].format("YYYY-MM-DD"));
    }

    return query;
  }

  async function fetchAdjustments(params?: {
    search?: string;
    reason?: string;
    status?: string;
    dateRange?: DateRange;
  }) {
    try {
      setLoading(true);

      const query = createQuery(params);

      const response = await fetch(
        `/api/stock-adjustments?${query.toString()}`,
        {
          cache: "no-store",
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch adjustments");
      }

      setItems(result.data.items || []);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal mengambil adjustment",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchAdjustments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearch() {
    void fetchAdjustments({
      search,
      reason,
      status,
      dateRange,
    });
  }

  function handleReset() {
    setSearch("");
    setReason("");
    setStatus("");
    setDateRange(null);

    void fetchAdjustments({
      search: "",
      reason: "",
      status: "",
      dateRange: null,
    });
  }

  function handleOpenExport() {
    if (dateRange) {
      setExportDateRange(dateRange);
    } else {
      setExportDateRange([dayjs().startOf("month"), dayjs()]);
    }

    setExportModalOpen(true);
  }

  async function handleExport() {
    if (!exportDateRange) {
      message.warning(
        "Pilih tanggal mulai dan tanggal selesai terlebih dahulu",
      );
      return;
    }

    try {
      setExporting(true);

      const query = createQuery({
        search,
        reason,
        status,
        dateRange: exportDateRange,
      });

      const response = await fetch(
        `/api/stock-adjustments/export?${query.toString()}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      if (!response.ok) {
        const contentType = response.headers.get("content-type") || "";

        if (contentType.includes("application/json")) {
          const result = await response.json();

          throw new Error(result.message || "Gagal export stock adjustment");
        }

        throw new Error("Gagal export stock adjustment");
      }

      const blob = await response.blob();

      const fallbackFilename =
        `stock-adjustments_` +
        `${exportDateRange[0].format("YYYY-MM-DD")}_sampai_` +
        `${exportDateRange[1].format("YYYY-MM-DD")}.xlsx`;

      const filename = getDownloadFilename(
        response.headers.get("content-disposition"),
        fallbackFilename,
      );

      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = downloadUrl;
      link.download = filename;

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(downloadUrl);

      setExportModalOpen(false);

      message.success("Stock adjustment berhasil diexport");
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error
          ? error.message
          : "Gagal export stock adjustment",
      );
    } finally {
      setExporting(false);
    }
  }

  const columns: ColumnsType<AdjustmentItem> = [
    {
      title: (
        <div className="leading-tight">
          <div>Document</div>
          <div className="text-xs font-normal text-slate-400">Date</div>
          <div className="text-xs font-normal text-slate-400">Reason</div>
        </div>
      ),
      dataIndex: "documentNumber",
      key: "documentNumber",
      render: (value: string, record) => (
        <div>
          <div className="table-row-title font-semibold text-slate-800">
            {value}
          </div>

          <div className="mt-0.5 text-xs text-slate-400">
            {dayjs(record.adjustmentDate).format("YYYY-MM-DD")}
          </div>

          <div className="mt-1">
            <Tag>{getReasonLabel(record.reason)}</Tag>
          </div>
        </div>
      ),
    },
    {
      title: "Items",
      key: "items",
      width: 100,
      render: (_, record) => (
        <span className="font-medium text-slate-700">
          {record._count?.items || 0}
        </span>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 130,
      render: (value: string) => (
        <Tag color={getStatusColor(value)}>{value}</Tag>
      ),
    },
    {
      title: (
        <div className="leading-tight">
          <div>Created By</div>
          <div className="text-xs font-normal text-slate-400">Created At</div>
        </div>
      ),
      key: "createdBy",
      render: (_, record) => (
        <div>
          <div className="font-medium text-slate-700">
            {record.createdBy?.fullName || record.createdBy?.username || "-"}
          </div>

          <div className="mt-0.5 text-xs text-slate-400">
            {dayjs(record.createdAt).format("YYYY-MM-DD HH:mm:ss")}
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
              onClick={() =>
                router.push(`/dashboard/stock-adjustments/${record.id}`)
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
                router.push(`/dashboard/stock-adjustments/${record.id}/edit`)
              }
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
              Document
            </div>

            <Input
              allowClear
              className="dashboard-filter-control"
              placeholder="Search document / notes"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onPressEnter={handleSearch}
            />
          </div>

          <div className="lg:col-span-3">
            <div className="mb-1 text-sm font-semibold text-slate-700">
              Adjustment Date
            </div>

            <RangePicker
              allowClear
              className="dashboard-filter-control w-full"
              format="DD/MM/YYYY"
              value={dateRange}
              onChange={(value) => setDateRange(value as DateRange)}
            />
          </div>

          <div className="lg:col-span-2">
            <div className="mb-1 text-sm font-semibold text-slate-700">
              Reason
            </div>

            <Select
              allowClear
              className="dashboard-filter-control w-full"
              placeholder="Select reason"
              value={reason || undefined}
              onChange={(value) => setReason(value || "")}
              options={reasonOptions}
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
                {
                  label: "Posted",
                  value: "POSTED",
                },
                {
                  label: "Cancelled",
                  value: "CANCELLED",
                },
              ]}
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
            {search || reason || status || dateRange
              ? "Filter applied"
              : "No filter applied"}
          </div>

          <Space wrap size={8}>
            <Button
              size="small"
              icon={<DownloadOutlined />}
              className="dashboard-action-btn"
              onClick={handleOpenExport}
            >
              Export Excel
            </Button>

            <Button
              size="small"
              type="primary"
              icon={<PlusOutlined />}
              className="dashboard-action-btn"
              onClick={() => router.push("/dashboard/stock-adjustments/create")}
            >
              Add Adjustment
            </Button>

            <Button
              size="small"
              icon={<ReloadOutlined />}
              className="dashboard-icon-btn"
              onClick={() => void fetchAdjustments()}
            />
          </Space>
        </div>

        <Table<AdjustmentItem>
          rowKey="id"
          size="small"
          className="data-table-sm clickable-table-row"
          loading={loading}
          dataSource={items}
          columns={columns}
          onRow={(record) => ({
            onClick: () => {
              router.push(`/dashboard/stock-adjustments/${record.id}`);
            },
          })}
          scroll={{ x: 900 }}
        />
      </div>

      <Modal
        title="Export Stock Adjustment"
        open={exportModalOpen}
        confirmLoading={exporting}
        okText="Export Excel"
        cancelText="Cancel"
        destroyOnHidden
        onCancel={() => setExportModalOpen(false)}
        onOk={() => void handleExport()}
      >
        <div className="py-2">
          <div className="mb-1 text-sm font-semibold text-slate-700">
            Periode Adjustment
          </div>

          <RangePicker
            className="w-full"
            format="DD/MM/YYYY"
            value={exportDateRange}
            onChange={(value) => setExportDateRange(value as DateRange)}
          />

          <div className="mt-2 text-xs text-slate-500">
            Data Excel akan mengikuti filter document, reason, status, dan
            periode yang dipilih.
          </div>
        </div>
      </Modal>
    </div>
  );
}
