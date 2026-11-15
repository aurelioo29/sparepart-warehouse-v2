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
  PrinterOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";

import { type WarehouseOption } from "./rack-location-form";
import RackLocationLabelPrint from "./rack-location-label-print";

type RackLocationItem = {
  id: string;
  warehouseId: string;
  name: string;
  code: string;
  barcodeValue?: string | null;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  warehouse: {
    id: string;
    name: string;
    code: string;
  };
};

type RackLocationsResponse = {
  items: RackLocationItem[];
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
  { key: "name", label: "Name", disabled: true },
  { key: "barcodeValue", label: "Barcode Value" },
  { key: "warehouse", label: "Warehouse" },
  { key: "createdAt", label: "Created at" },
  { key: "updatedAt", label: "Updated at" },
  { key: "action", label: "Action", disabled: true },
];

export default function RackLocationsPageClient() {
  const router = useRouter();
  const { message } = App.useApp();

  const [rackLocations, setRackLocations] = useState<RackLocationItem[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);

  const [loading, setLoading] = useState(false);

  const [labelPreviewOpen, setLabelPreviewOpen] = useState(false);
  const [labelAutoPrint, setLabelAutoPrint] = useState(false);
  const [selectedLabelRack, setSelectedLabelRack] =
    useState<RackLocationItem | null>(null);

  const [search, setSearch] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
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

  async function fetchWarehouses() {
    try {
      const response = await fetch("/api/warehouses/options");
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch warehouses");
      }

      setWarehouses(result.data || []);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error
          ? error.message
          : "Gagal mengambil warehouse options",
      );
    }
  }

  async function fetchRackLocations(params?: {
    page?: number;
    limit?: number;
    search?: string;
    warehouseId?: string;
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
        warehouseId: params?.warehouseId ?? warehouseId,
        isActive: params?.isActive ?? isActive,
        sortBy: params?.sortBy ?? sortBy,
        sortOrder: params?.sortOrder ?? sortOrder,
      });

      const response = await fetch(`/api/rack-locations?${query.toString()}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch rack locations");
      }

      const data: RackLocationsResponse = result.data;

      setRackLocations(data.items || []);
      setMeta(data.meta);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error
          ? error.message
          : "Gagal mengambil rack locations",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchWarehouses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void fetchRackLocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, sortBy, sortOrder]);

  function handlePrintLabel(rackLocation: RackLocationItem) {
    setSelectedLabelRack(rackLocation);
    setLabelAutoPrint(true);
    setLabelPreviewOpen(true);
  }

  function handleTableChange(
    pagination: TablePaginationConfig,
    _filters: Record<string, unknown>,
    sorter: SorterResult<RackLocationItem> | SorterResult<RackLocationItem>[],
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

    void fetchRackLocations({
      page: 1,
      search,
      warehouseId,
      isActive,
      sortBy,
      sortOrder,
    });
  }

  function handleReset() {
    setSearch("");
    setWarehouseId("");
    setIsActive("");
    setPage(1);

    void fetchRackLocations({
      page: 1,
      search: "",
      warehouseId: "",
      isActive: "",
      sortBy,
      sortOrder,
    });
  }

  const allColumns: ColumnsType<RackLocationItem> = useMemo(
    () => [
      {
        title: "Name",
        dataIndex: "name",
        key: "name",
        sorter: true,
        sortOrder:
          sortBy === "name"
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
        title: "Barcode Value",
        dataIndex: "barcodeValue",
        key: "barcodeValue",
        render: (value: string | null) =>
          value ? (
            <span className="font-mono text-xs text-slate-700">{value}</span>
          ) : (
            <Tag color="orange">Need Backfill</Tag>
          ),
      },
      {
        title: "Warehouse",
        dataIndex: "warehouse",
        key: "warehouse",
        sorter: true,
        sortOrder:
          sortBy === "warehouse"
            ? sortOrder === "asc"
              ? "ascend"
              : "descend"
            : null,
        render: (_, record) => (
          <div>
            <div className="font-medium text-slate-700">
              {record.warehouse.name}
            </div>

            <div className="text-xs text-slate-400">
              {record.warehouse.code}
            </div>
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
        title: "Action",
        key: "action",
        width: 130,
        align: "center",
        fixed: "right",
        render: (_, record) => (
          <Space size={4} onClick={(event) => event.stopPropagation()}>
            <Tooltip title="Print Barcode">
              <Button
                type="link"
                size="small"
                icon={<PrinterOutlined />}
                className="dashboard-table-action-btn"
                onClick={() => handlePrintLabel(record)}
              />
            </Tooltip>

            <Tooltip title="Detail">
              <Button
                type="link"
                size="small"
                icon={<EyeOutlined />}
                className="dashboard-table-action-btn"
                onClick={() =>
                  router.push(`/dashboard/rack-locations/${record.id}`)
                }
              />
            </Tooltip>

            <Tooltip title="Edit">
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                className="dashboard-table-action-btn"
                onClick={() =>
                  router.push(`/dashboard/rack-locations/${record.id}/edit`)
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
    <>
      <div className="text-sm">
        <div className="form-compact mb-4 border-b border-slate-100 bg-white pb-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-4">
              <div className="mb-1 text-sm font-semibold text-slate-700">
                Rack Location
              </div>

              <Input
                allowClear
                className="dashboard-filter-control"
                placeholder="Search rack location"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onPressEnter={handleSearch}
              />
            </div>

            <div className="lg:col-span-4">
              <div className="mb-1 text-sm font-semibold text-slate-700">
                Warehouse
              </div>

              <Select
                allowClear
                className="dashboard-filter-control w-full"
                placeholder="Select warehouse"
                value={warehouseId || undefined}
                onChange={(value) => setWarehouseId(value || "")}
                options={warehouses.map((warehouse) => ({
                  label: `${warehouse.name} (${warehouse.code})`,
                  value: warehouse.id,
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
                value={isActive || undefined}
                onChange={(value) => setIsActive(value || "")}
                options={[
                  { label: "Active", value: "true" },
                  { label: "Inactive", value: "false" },
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
              {search || warehouseId || isActive
                ? "Filter applied"
                : "No filter applied"}
            </div>

            <Space wrap size={8}>
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                className="dashboard-action-btn"
                onClick={() => router.push("/dashboard/rack-locations/create")}
              >
                Add New
              </Button>

              <Button
                size="small"
                icon={<ReloadOutlined />}
                className="dashboard-icon-btn"
                onClick={() => void fetchRackLocations()}
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
                <Button
                  size="small"
                  icon={<SettingOutlined />}
                  className="dashboard-icon-btn"
                />
              </Popover>
            </Space>
          </div>

          <Table<RackLocationItem>
            rowKey="id"
            size="small"
            className="data-table-sm clickable-table-row"
            loading={loading}
            columns={tableColumns}
            dataSource={rackLocations}
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
                router.push(`/dashboard/rack-locations/${record.id}`);
              },
            })}
            scroll={{ x: 1100 }}
          />
        </div>
      </div>

      <RackLocationLabelPrint
        open={labelPreviewOpen}
        autoPrint={labelAutoPrint}
        rackLocation={selectedLabelRack}
        onClose={() => {
          setLabelPreviewOpen(false);
          setLabelAutoPrint(false);
          setSelectedLabelRack(null);
        }}
      />
    </>
  );
}
