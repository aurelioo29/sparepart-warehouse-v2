"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Checkbox,
  DatePicker,
  Input,
  Modal,
  Popover,
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
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

import StockOutFormModal, { StockOutFormValues } from "./stock-out-form-modal";

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

type WarehouseOption = {
  id: string;
  name: string;
  code: string;
};

type RackLocationOption = {
  id: string;
  warehouseId: string;
  name: string;
  code: string;
};

type StockOutItem = {
  id: string;
  documentNumber: string;
  stockOutDate: string;
  reason: string;
  status: string;
  totalAmount: string | number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: string;
    fullName: string;
    username: string;
  } | null;
  _count?: {
    items: number;
  };
};

type StockOutsResponse = {
  items: StockOutItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    sortBy?: string;
    sortOrder?: string;
  };
};

const reasonOptions = [
  { label: "Internal Use", value: "INTERNAL_USE" },
  { label: "Damaged", value: "DAMAGED" },
  { label: "Lost", value: "LOST" },
  { label: "Return To Supplier", value: "RETURN_TO_SUPPLIER" },
  { label: "Other", value: "OTHER" },
];

const columnOptions = [
  { key: "documentNumber", label: "Document Number", disabled: true },
  { key: "stockOutDate", label: "Date" },
  { key: "reason", label: "Reason" },
  { key: "items", label: "Items" },
  { key: "totalAmount", label: "Total" },
  { key: "status", label: "Status" },
  { key: "createdBy", label: "Created By" },
  { key: "createdAt", label: "Created at" },
  { key: "action", label: "Action", disabled: true },
];

function formatCurrency(value: string | number | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export default function StockOutsPageClient() {
  const [modal, contextHolder] = Modal.useModal();

  const [stockOuts, setStockOuts] = useState<StockOutItem[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [rackLocations, setRackLocations] = useState<RackLocationOption[]>([]);

  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  const [formOpen, setFormOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("");
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
      const [productsRes, warehousesRes, rackLocationsRes] = await Promise.all([
        fetch("/api/products/options"),
        fetch("/api/warehouses/options"),
        fetch("/api/rack-locations?limit=1000&isActive=true"),
      ]);

      const [productsJson, warehousesJson, rackLocationsJson] =
        await Promise.all([
          productsRes.json(),
          warehousesRes.json(),
          rackLocationsRes.json(),
        ]);

      if (productsJson.success) setProducts(productsJson.data || []);
      if (warehousesJson.success) setWarehouses(warehousesJson.data || []);
      if (rackLocationsJson.success) {
        setRackLocations(rackLocationsJson.data.items || []);
      }
    } catch (error) {
      console.error(error);
      message.error("Gagal mengambil stock out options");
    }
  }

  async function fetchStockOuts(params?: {
    page?: number;
    limit?: number;
    search?: string;
    reason?: string;
    status?: string;
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
        reason: params?.reason ?? reason,
        status: params?.status ?? status,
        dateFrom,
        dateTo,
        sortBy: params?.sortBy ?? sortBy,
        sortOrder: params?.sortOrder ?? sortOrder,
      });

      const response = await fetch(`/api/stock-outs?${query.toString()}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch stock out");
      }

      const data: StockOutsResponse = result.data;

      setStockOuts(data.items || []);
      setMeta(data.meta);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal mengambil stock out",
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
    void fetchStockOuts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, sortBy, sortOrder]);

  async function handleSubmit(values: StockOutFormValues) {
    try {
      setSubmitLoading(true);

      const response = await fetch("/api/stock-outs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to create stock out");
      }

      message.success(result.message || "Stock out created successfully");

      setFormOpen(false);

      await fetchStockOuts();
      await fetchOptions();
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal membuat stock out",
      );
    } finally {
      setSubmitLoading(false);
    }
  }

  function handleCancelStockOut(record: StockOutItem) {
    modal.confirm({
      title: "Batalkan barang keluar?",
      content: `Dokumen "${record.documentNumber}" akan dibatalkan dan stok akan dikembalikan.`,
      okText: "Ya, Batalkan",
      cancelText: "Tidak",
      okButtonProps: {
        danger: true,
      },
      centered: true,
      async onOk() {
        try {
          const response = await fetch(`/api/stock-outs/${record.id}`, {
            method: "DELETE",
          });

          const result = await response.json();

          if (!response.ok || !result.success) {
            throw new Error(result.message || "Failed to cancel stock out");
          }

          message.success(result.message || "Stock out cancelled successfully");

          await fetchStockOuts();
          await fetchOptions();
        } catch (error) {
          console.error(error);

          message.error(
            error instanceof Error
              ? error.message
              : "Gagal membatalkan stock out",
          );
        }
      },
    });
  }

  function handleView(record: StockOutItem) {
    modal.info({
      title: record.documentNumber,
      width: 720,
      content: (
        <div className="text-sm">
          <div className="mb-2">
            <strong>Date:</strong>{" "}
            {dayjs(record.stockOutDate).format("YYYY-MM-DD")}
          </div>
          <div className="mb-2">
            <strong>Reason:</strong> {record.reason}
          </div>
          <div className="mb-2">
            <strong>Total:</strong> {formatCurrency(record.totalAmount)}
          </div>
          <div className="mb-2">
            <strong>Status:</strong> {record.status}
          </div>
          <div>
            <strong>Notes:</strong> {record.notes || "-"}
          </div>
        </div>
      ),
    });
  }

  function handleTableChange(
    pagination: TablePaginationConfig,
    _filters: Record<string, unknown>,
    sorter: SorterResult<StockOutItem> | SorterResult<StockOutItem>[],
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

    void fetchStockOuts({
      page: 1,
      search,
      reason,
      status,
      dateFrom: dateRange?.[0] ? dateRange[0].format("YYYY-MM-DD") : "",
      dateTo: dateRange?.[1] ? dateRange[1].format("YYYY-MM-DD") : "",
      sortBy,
      sortOrder,
    });
  }

  function handleReset() {
    setSearch("");
    setReason("");
    setStatus("");
    setDateRange(null);
    setPage(1);

    void fetchStockOuts({
      page: 1,
      search: "",
      reason: "",
      status: "",
      dateFrom: "",
      dateTo: "",
      sortBy,
      sortOrder,
    });
  }

  const allColumns: ColumnsType<StockOutItem> = useMemo(
    () => [
      {
        title: "Document Number",
        dataIndex: "documentNumber",
        key: "documentNumber",
        sorter: true,
        sortOrder:
          sortBy === "documentNumber"
            ? sortOrder === "asc"
              ? "ascend"
              : "descend"
            : null,
        render: (value: string) => (
          <span className="font-semibold text-blue-600">{value}</span>
        ),
      },
      {
        title: "Date",
        dataIndex: "stockOutDate",
        key: "stockOutDate",
        sorter: true,
        sortOrder:
          sortBy === "stockOutDate"
            ? sortOrder === "asc"
              ? "ascend"
              : "descend"
            : null,
        render: (value: string) => dayjs(value).format("YYYY-MM-DD"),
      },
      {
        title: "Reason",
        dataIndex: "reason",
        key: "reason",
        sorter: true,
        sortOrder:
          sortBy === "reason"
            ? sortOrder === "asc"
              ? "ascend"
              : "descend"
            : null,
        render: (value: string) => <Tag>{value}</Tag>,
      },
      {
        title: "Items",
        key: "items",
        render: (_, record) => record._count?.items || 0,
      },
      {
        title: "Total",
        dataIndex: "totalAmount",
        key: "totalAmount",
        sorter: true,
        sortOrder:
          sortBy === "totalAmount"
            ? sortOrder === "asc"
              ? "ascend"
              : "descend"
            : null,
        render: (value) => formatCurrency(value),
      },
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
        render: (value: string) =>
          value === "POSTED" ? (
            <Tag color="green">POSTED</Tag>
          ) : value === "CANCELLED" ? (
            <Tag color="red">CANCELLED</Tag>
          ) : (
            <Tag>{value}</Tag>
          ),
      },
      {
        title: "Created By",
        key: "createdBy",
        render: (_, record) => record.createdBy?.fullName || "-",
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
        render: (value: string) => dayjs(value).format("YYYY-MM-DD HH:mm:ss"),
      },
      {
        title: "Action",
        key: "action",
        width: 100,
        align: "center",
        render: (_, record) => (
          <Space size={6}>
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleView(record)}
            />

            <Button
              danger
              type="link"
              size="small"
              icon={<DeleteOutlined />}
              disabled={record.status === "CANCELLED"}
              onClick={() => handleCancelStockOut(record)}
            />
          </Space>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sortBy, sortOrder],
  );

  const tableColumns = allColumns.filter((column) =>
    visibleColumns.includes(String(column.key)),
  );

  return (
    <>
      {contextHolder}

      <div className="text-sm">
        <div className="form-compact mb-3 bg-white p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">
                Search
              </div>

              <Input
                size="small"
                allowClear
                placeholder="Document / notes"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onPressEnter={handleSearch}
              />
            </div>

            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">
                Reason
              </div>

              <Select
                size="small"
                allowClear
                placeholder="Select reason"
                value={reason || undefined}
                onChange={(value) => setReason(value || "")}
                className="w-full"
                options={reasonOptions}
              />
            </div>

            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">
                Status
              </div>

              <Select
                size="small"
                allowClear
                placeholder="Select status"
                value={status || undefined}
                onChange={(value) => setStatus(value || "")}
                className="w-full"
                options={[
                  { label: "Posted", value: "POSTED" },
                  { label: "Cancelled", value: "CANCELLED" },
                ]}
              />
            </div>

            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">
                Date
              </div>

              <RangePicker
                size="small"
                className="w-full"
                value={dateRange}
                onChange={(value) => setDateRange(value)}
              />
            </div>

            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">
                Action
              </div>

              <Space>
                <Button
                  size="small"
                  type="primary"
                  icon={<SearchOutlined />}
                  onClick={handleSearch}
                >
                  Search
                </Button>

                <Button size="small" onClick={handleReset}>
                  Reset
                </Button>
              </Space>
            </div>
          </div>
        </div>

        <div className="bg-white p-4">
          <div className="mb-4 text-sm text-slate-500">
            Parameter:{" "}
            {search || reason || status || dateRange
              ? "search params applied"
              : "no search params found"}
          </div>

          <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div />

            <Space wrap>
              <Button
                size="small"
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setFormOpen(true)}
              >
                Add New
              </Button>

              <Button
                size="small"
                icon={<ReloadOutlined />}
                onClick={() => fetchStockOuts()}
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
                      onChange={(values) =>
                        setVisibleColumns(values as string[])
                      }
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
                <Button size="small" icon={<SettingOutlined />} />
              </Popover>
            </Space>
          </div>

          <Table<StockOutItem>
            rowKey="id"
            size="small"
            className="data-table-sm"
            loading={loading}
            columns={tableColumns}
            dataSource={stockOuts}
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
            scroll={{ x: 1200 }}
          />
        </div>
      </div>

      <StockOutFormModal
        open={formOpen}
        loading={submitLoading}
        products={products}
        warehouses={warehouses}
        rackLocations={rackLocations}
        onCancel={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />
    </>
  );
}
