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

type KngProductItem = {
  id: string;
  jenis: string;
  partNumber: string;
  hargaJkt: string | number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type KngProductsResponse = {
  items: KngProductItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    sortBy?: string;
    sortOrder?: string;
  };
};

type KngProductOptionsResponse = {
  jenisOptions: {
    label: string;
    value: string;
  }[];
};

const columnOptions = [
  { key: "jenis", label: "Jenis", disabled: true },
  { key: "partNumber", label: "Part Number", disabled: true },
  { key: "hargaJkt", label: "Harga JKT" },
  { key: "createdAt", label: "Created at" },
  { key: "updatedAt", label: "Updated at" },
  { key: "status", label: "Status" },
  { key: "action", label: "Action", disabled: true },
];

function formatRupiah(value?: string | number | null) {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function KngProductsPageClient() {
  const router = useRouter();
  const { message } = App.useApp();

  const [products, setProducts] = useState<KngProductItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [jenis, setJenis] = useState("");
  const [isActive, setIsActive] = useState("");

  const [jenisOptions, setJenisOptions] = useState<
    { label: string; value: string }[]
  >([]);

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

  async function fetchJenisOptions() {
    try {
      const response = await fetch("/api/kng-products/options");
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch jenis options");
      }

      const data: KngProductOptionsResponse = result.data;

      setJenisOptions(data.jenisOptions || []);
    } catch (error) {
      console.error(error);
    }
  }

  async function fetchProducts(params?: {
    page?: number;
    limit?: number;
    search?: string;
    jenis?: string;
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
        jenis: params?.jenis ?? jenis,
        isActive: params?.isActive ?? isActive,
        sortBy: params?.sortBy ?? sortBy,
        sortOrder: params?.sortOrder ?? sortOrder,
      });

      const response = await fetch(`/api/kng-products?${query.toString()}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch KNG products");
      }

      const data: KngProductsResponse = result.data;

      setProducts(data.items || []);
      setMeta(data.meta);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal mengambil products KNG",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchJenisOptions();
  }, []);

  useEffect(() => {
    void fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, sortBy, sortOrder]);

  function handleTableChange(
    pagination: TablePaginationConfig,
    _filters: Record<string, unknown>,
    sorter: SorterResult<KngProductItem> | SorterResult<KngProductItem>[],
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
      jenis,
      isActive,
      sortBy,
      sortOrder,
    });
  }

  function handleReset() {
    setSearch("");
    setJenis("");
    setIsActive("");
    setPage(1);

    void fetchProducts({
      page: 1,
      search: "",
      jenis: "",
      isActive: "",
      sortBy,
      sortOrder,
    });
  }

  const allColumns: ColumnsType<KngProductItem> = useMemo(
    () => [
      {
        title: "Jenis",
        dataIndex: "jenis",
        key: "jenis",
        sorter: true,
        sortOrder:
          sortBy === "jenis"
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
        title: "Part Number",
        dataIndex: "partNumber",
        key: "partNumber",
        sorter: true,
        sortOrder:
          sortBy === "partNumber"
            ? sortOrder === "asc"
              ? "ascend"
              : "descend"
            : null,
        render: (value: string) => (
          <span className="font-medium text-slate-700">{value}</span>
        ),
      },
      {
        title: "Harga JKT",
        dataIndex: "hargaJkt",
        key: "hargaJkt",
        sorter: true,
        align: "right",
        sortOrder:
          sortBy === "hargaJkt"
            ? sortOrder === "asc"
              ? "ascend"
              : "descend"
            : null,
        render: (value: string | number) => (
          <span className="whitespace-nowrap font-semibold text-slate-800">
            {formatRupiah(value)}
          </span>
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
                onClick={() =>
                  router.push(`/dashboard/kng-products/${record.id}`)
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
                  router.push(`/dashboard/kng-products/${record.id}/edit`)
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
          <div className="lg:col-span-4">
            <div className="mb-1 text-sm font-semibold text-slate-700">
              Search
            </div>

            <Input
              allowClear
              className="dashboard-filter-control"
              placeholder="Search jenis / part number"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onPressEnter={handleSearch}
            />
          </div>

          <div className="lg:col-span-3">
            <div className="mb-1 text-sm font-semibold text-slate-700">
              Jenis
            </div>

            <Select
              allowClear
              showSearch
              className="dashboard-filter-control w-full"
              placeholder="Select jenis"
              value={jenis || undefined}
              onChange={(value) => setJenis(value || "")}
              options={jenisOptions}
              optionFilterProp="label"
            />
          </div>

          <div className="lg:col-span-3">
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
            {search || jenis || isActive
              ? "Filter applied"
              : "No filter applied"}
          </div>

          <Space wrap size={8}>
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              className="dashboard-action-btn"
              onClick={() => router.push("/dashboard/kng-products/create")}
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

        <Table<KngProductItem>
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
              router.push(`/dashboard/kng-products/${record.id}`);
            },
          })}
          scroll={{ x: 980 }}
        />
      </div>
    </div>
  );
}
