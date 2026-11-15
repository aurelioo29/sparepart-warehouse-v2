"use client";

import { useEffect, useState } from "react";
import {
  App,
  Button,
  DatePicker,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  EditOutlined,
  EyeOutlined,
  FileImageOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";

const { RangePicker } = DatePicker;

type SupplierOption = {
  id: string;
  name: string;
};

type PurchasePaymentAttachment = {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  fileUrl: string;
  createdAt: string;
};

type PurchasePaymentItem = {
  id: string;
  paymentDate: string;
  amount: number;
  method: string;
  referenceNumber?: string | null;
  notes?: string | null;
  createdAt: string;
  supplier?: {
    id: string;
    name: string;
  } | null;
  stockIn?: {
    id: string;
    documentNumber: string;
    invoiceNumber?: string | null;
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    paymentStatus: string;
  } | null;
  createdBy?: {
    id: string;
    fullName?: string | null;
    username?: string | null;
  } | null;
  attachments?: PurchasePaymentAttachment[];
  _count?: {
    attachments: number;
  };
};

type PurchasePaymentsResponse = {
  items: PurchasePaymentItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

function formatCurrency(value: string | number | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function getMethodTag(value: string) {
  if (value === "CASH") return <Tag color="green">CASH</Tag>;
  if (value === "TRANSFER") return <Tag color="blue">TRANSFER</Tag>;
  if (value === "QRIS") return <Tag color="purple">QRIS</Tag>;
  if (value === "DEBIT") return <Tag color="cyan">DEBIT</Tag>;
  if (value === "CREDIT") return <Tag color="gold">CREDIT</Tag>;

  return <Tag>{value}</Tag>;
}

function getCreatedName(record: PurchasePaymentItem) {
  return record.createdBy?.fullName || record.createdBy?.username || "-";
}

export default function PurchasePaymentsPageClient() {
  const router = useRouter();
  const { message } = App.useApp();

  const [loading, setLoading] = useState(false);

  const [items, setItems] = useState<PurchasePaymentItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);

  const [search, setSearch] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [method, setMethod] = useState("");
  const [dateRange, setDateRange] = useState<
    [dayjs.Dayjs | null, dayjs.Dayjs | null] | null
  >(null);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [meta, setMeta] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  async function fetchOptions() {
    try {
      const suppliersRes = await fetch("/api/suppliers/options");
      const suppliersJson = await suppliersRes.json();

      if (suppliersJson.success) setSuppliers(suppliersJson.data || []);
    } catch (error) {
      console.error(error);
      message.error("Gagal mengambil purchase payment options");
    }
  }

  async function fetchPayments(params?: {
    page?: number;
    limit?: number;
    search?: string;
    supplierId?: string;
    method?: string;
    dateFrom?: string;
    dateTo?: string;
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
        supplierId: params?.supplierId ?? supplierId,
        method: params?.method ?? method,
        dateFrom,
        dateTo,
      });

      const response = await fetch(`/api/purchase-payments?${query}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch purchase payments");
      }

      const data: PurchasePaymentsResponse = result.data;

      setItems(data.items || []);
      setMeta(data.meta);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error
          ? error.message
          : "Gagal mengambil purchase payments",
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
    void fetchPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit]);

  function handleSearch() {
    setPage(1);

    void fetchPayments({
      page: 1,
      search,
      supplierId,
      method,
      dateFrom: dateRange?.[0] ? dateRange[0].format("YYYY-MM-DD") : "",
      dateTo: dateRange?.[1] ? dateRange[1].format("YYYY-MM-DD") : "",
    });
  }

  function handleReset() {
    setSearch("");
    setSupplierId("");
    setMethod("");
    setDateRange(null);
    setPage(1);

    void fetchPayments({
      page: 1,
      search: "",
      supplierId: "",
      method: "",
      dateFrom: "",
      dateTo: "",
    });
  }

  function handleRefresh() {
    void fetchPayments({
      page,
      limit,
      search,
      supplierId,
      method,
      dateFrom: dateRange?.[0] ? dateRange[0].format("YYYY-MM-DD") : "",
      dateTo: dateRange?.[1] ? dateRange[1].format("YYYY-MM-DD") : "",
    });

    void fetchOptions();
  }

  const columns: ColumnsType<PurchasePaymentItem> = [
    {
      title: (
        <div className="leading-tight">
          <div>Date</div>
          <div className="text-xs font-normal text-slate-400">Method</div>
        </div>
      ),
      dataIndex: "paymentDate",
      width: 150,
      render: (value: string, record) => (
        <div>
          <div className="font-medium text-slate-700">
            {dayjs(value).format("YYYY-MM-DD")}
          </div>

          <div className="mt-1">{getMethodTag(record.method)}</div>
        </div>
      ),
    },
    {
      title: (
        <div className="leading-tight">
          <div>Document</div>
          <div className="text-xs font-normal text-slate-400">Invoice</div>
        </div>
      ),
      width: 230,
      render: (_, record) => (
        <div>
          <div className="table-row-title font-semibold text-slate-800">
            {record.stockIn?.documentNumber || "-"}
          </div>

          <div className="font-mono text-xs text-slate-400">
            {record.stockIn?.invoiceNumber || "-"}
          </div>
        </div>
      ),
    },
    {
      title: (
        <div className="leading-tight">
          <div>Supplier</div>
          <div className="text-xs font-normal text-slate-400">Created By</div>
        </div>
      ),
      width: 230,
      render: (_, record) => (
        <div>
          <div className="font-medium text-slate-700">
            {record.supplier?.name || "-"}
          </div>

          <div className="text-xs text-slate-400">{getCreatedName(record)}</div>
        </div>
      ),
    },
    {
      title: (
        <div className="leading-tight">
          <div>Amount</div>
          <div className="text-xs font-normal text-slate-400">Reference</div>
        </div>
      ),
      dataIndex: "amount",
      width: 220,
      align: "right",
      render: (value, record) => (
        <div className="text-right">
          <div className="font-semibold text-green-700">
            {formatCurrency(value)}
          </div>

          <div className="mt-0.5 truncate font-mono text-xs text-slate-400">
            {record.referenceNumber || "-"}
          </div>
        </div>
      ),
    },
    {
      title: "Bukti",
      key: "attachments",
      width: 100,
      align: "center",
      render: (_, record) => {
        const count =
          record._count?.attachments || record.attachments?.length || 0;

        return count > 0 ? (
          <Tag color="blue" icon={<FileImageOutlined />}>
            {count}
          </Tag>
        ) : (
          <span className="text-slate-300">-</span>
        );
      },
    },
    {
      title: (
        <div className="leading-tight">
          <div>Created</div>
          <div className="text-xs font-normal text-slate-400">Time</div>
        </div>
      ),
      width: 180,
      render: (_, record) => (
        <div>
          <div className="font-medium text-slate-700">
            {dayjs(record.createdAt).format("YYYY-MM-DD")}
          </div>

          <div className="text-xs text-slate-400">
            {dayjs(record.createdAt).format("HH:mm:ss")}
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
                router.push(`/dashboard/purchase-payments/${record.id}`)
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
                router.push(`/dashboard/purchase-payments/${record.id}/edit`)
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
              Search
            </div>

            <Input
              allowClear
              className="dashboard-filter-control"
              placeholder="Document / faktur / supplier / reference"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onPressEnter={handleSearch}
            />
          </div>

          <div className="lg:col-span-3">
            <div className="mb-1 text-sm font-semibold text-slate-700">
              Supplier
            </div>

            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              className="dashboard-filter-control w-full"
              placeholder="Supplier"
              value={supplierId || undefined}
              onChange={(value) => setSupplierId(value || "")}
              options={suppliers.map((item) => ({
                label: item.name,
                value: item.id,
              }))}
            />
          </div>

          <div className="lg:col-span-2">
            <div className="mb-1 text-sm font-semibold text-slate-700">
              Method
            </div>

            <Select
              allowClear
              className="dashboard-filter-control w-full"
              placeholder="Method"
              value={method || undefined}
              onChange={(value) => setMethod(value || "")}
              options={[
                { label: "Cash", value: "CASH" },
                { label: "Transfer", value: "TRANSFER" },
                { label: "Debit", value: "DEBIT" },
                { label: "Credit", value: "CREDIT" },
                { label: "QRIS", value: "QRIS" },
                { label: "Other", value: "OTHER" },
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

          <div className="flex justify-start gap-2 lg:col-span-2 lg:justify-end">
            <Button
              size="small"
              type="primary"
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
            {search || supplierId || method || dateRange
              ? "Filter applied"
              : "No filter applied"}
          </div>

          <Space wrap size={8}>
            <Button
              size="small"
              type="primary"
              icon={<PlusOutlined />}
              className="dashboard-action-btn"
              onClick={() => router.push("/dashboard/purchase-payments/create")}
            >
              Add Payment
            </Button>

            <Button
              size="small"
              icon={<ReloadOutlined />}
              className="dashboard-icon-btn"
              onClick={handleRefresh}
            />
          </Space>
        </div>

        <Table<PurchasePaymentItem>
          rowKey="id"
          size="small"
          className="data-table-sm clickable-table-row"
          loading={loading}
          columns={columns}
          dataSource={items}
          pagination={{
            current: meta.page,
            pageSize: meta.limit,
            total: meta.total,
            showSizeChanger: true,
            pageSizeOptions: [10, 25, 50, 100],
            showTotal: (total, range) =>
              `showing ${range[0]} to ${range[1]} of ${total} items`,
            onChange: (nextPage, nextLimit) => {
              setPage(nextPage);
              setLimit(nextLimit);
            },
          }}
          onRow={(record) => ({
            onClick: () => {
              router.push(`/dashboard/purchase-payments/${record.id}`);
            },
          })}
          scroll={{ x: 1200 }}
        />
      </div>
    </div>
  );
}
