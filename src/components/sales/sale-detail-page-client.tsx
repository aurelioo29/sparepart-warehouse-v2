"use client";

import { useEffect, useState } from "react";
import {
  App,
  Button,
  Descriptions,
  Modal,
  Space,
  Spin,
  Table,
  Tag,
} from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import {
  CloseCircleOutlined,
  EditOutlined,
  HistoryOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";

import PrintInvoiceButton from "./print-invoice-button";

type SaleDetailItem = {
  id: string;
  productId: string;
  warehouseId?: string | null;
  rackLocationId?: string | null;
  quantity: number;
  unitPrice: string | number;
  discountPercent?: string | number | null;
  discountQty?: number | null;
  additionalDiscountPercent?: string | number | null;
  discountAmount?: string | number | null;
  totalPrice: string | number;
  product?: {
    id: string;
    sku: string;
    name: string;
    currentStock?: number;
    unit?: {
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
};

type SalePaymentItem = {
  id: string;
  paymentDate: string;
  amount: string | number;
  method: string;
  referenceNumber?: string | null;
  notes?: string | null;
  createdAt: string;
  createdBy?: {
    id: string;
    fullName?: string | null;
    username?: string | null;
  } | null;
};

type SaleDetail = {
  id: string;
  customerId?: string | null;
  salesmanId?: string | null;
  invoiceNumber: string;
  saleDate: string;
  dueDate?: string | null;
  status: string;
  paymentStatus: string;
  subtotal: string | number;
  discountAmount: string | number;
  totalAmount: string | number;
  paidAmount: string | number;
  remainingAmount: string | number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string | null;
  customer?: {
    id: string;
    name: string;
    customerType?: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
  } | null;
  salesman?: {
    id: string;
    code: string;
    name: string;
  } | null;
  createdBy?: {
    id: string;
    fullName?: string | null;
    username?: string | null;
  } | null;
  items: SaleDetailItem[];
  payments: SalePaymentItem[];
};

type ChangelogItem = {
  id: string;
  action: string;
  module: string;
  resourceType?: string | null;
  resourceId?: string | null;
  oldData?: unknown;
  newData?: unknown;
  createdAt: string;
  user?: {
    id: string;
    fullName: string;
    username: string;
    email: string;
  } | null;
};

type ChangelogsResponse = {
  items: ChangelogItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type SaleDetailPageClientProps = {
  id: string;
};

function formatCurrency(value: string | number | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDate(value?: string | null) {
  if (!value) return "-";

  return dayjs(value).format("YYYY-MM-DD");
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";

  return dayjs(value).format("YYYY-MM-DD HH:mm:ss");
}

function getPaymentTag(value?: string | null) {
  if (value === "PAID") return <Tag color="green">PAID</Tag>;
  if (value === "PARTIAL") return <Tag color="orange">PARTIAL</Tag>;

  return <Tag color="red">UNPAID</Tag>;
}

function getStatusTag(value?: string | null) {
  if (value === "POSTED") return <Tag color="green">POSTED</Tag>;
  if (value === "CANCELLED") return <Tag color="red">CANCELLED</Tag>;
  if (value === "DRAFT") return <Tag color="gold">DRAFT</Tag>;

  return <Tag>{value || "-"}</Tag>;
}

function getMethodTag(value?: string | null) {
  if (value === "CASH") return <Tag color="green">CASH</Tag>;
  if (value === "TRANSFER") return <Tag color="blue">TRANSFER</Tag>;
  if (value === "QRIS") return <Tag color="purple">QRIS</Tag>;
  if (value === "DEBIT") return <Tag color="cyan">DEBIT</Tag>;
  if (value === "CREDIT") return <Tag color="gold">CREDIT</Tag>;

  return <Tag>{value || "-"}</Tag>;
}

function getActionColor(value: string) {
  if (value === "CREATE") return "green";
  if (value === "UPDATE") return "blue";
  if (value === "DELETE") return "red";

  return "default";
}

export default function SaleDetailPageClient({
  id,
}: SaleDetailPageClientProps) {
  const router = useRouter();
  const { message } = App.useApp();
  const [modal, contextHolder] = Modal.useModal();

  const [sale, setSale] = useState<SaleDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const [changelogs, setChangelogs] = useState<ChangelogItem[]>([]);
  const [changelogLoading, setChangelogLoading] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);

  const [changelogMeta, setChangelogMeta] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  async function fetchSale() {
    try {
      setLoading(true);

      const response = await fetch(`/api/sales/${id}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch sale");
      }

      setSale(result.data);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal mengambil sale",
      );
    } finally {
      setLoading(false);
    }
  }

  async function fetchChangelogs(params?: { page?: number; limit?: number }) {
    try {
      setChangelogLoading(true);

      const query = new URLSearchParams({
        page: String(params?.page ?? changelogMeta.page),
        limit: String(params?.limit ?? changelogMeta.limit),
      });

      const response = await fetch(
        `/api/sales/${id}/changelogs?${query.toString()}`,
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch changelogs");
      }

      const data: ChangelogsResponse = result.data;

      setChangelogs(data.items || []);
      setChangelogMeta(data.meta);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal mengambil changelogs",
      );
    } finally {
      setChangelogLoading(false);
    }
  }

  useEffect(() => {
    void fetchSale();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function handleOpenChangelog() {
    setShowChangelog(true);

    void fetchChangelogs({
      page: 1,
      limit: changelogMeta.limit,
    });
  }

  function handleCancelSale() {
    if (!sale) return;

    modal.confirm({
      title: "Cancel sale?",
      content: `Invoice "${sale.invoiceNumber}" akan dibatalkan dan stok akan dikembalikan.`,
      okText: "Ya, Cancel Sale",
      cancelText: "Batal",
      okButtonProps: {
        danger: true,
      },
      centered: true,
      async onOk() {
        try {
          const response = await fetch(`/api/sales/${sale.id}`, {
            method: "DELETE",
          });

          const result = await response.json();

          if (!response.ok || !result.success) {
            throw new Error(result.message || "Failed to cancel sale");
          }

          message.success(result.message || "Sale cancelled successfully");

          await fetchSale();

          if (showChangelog) {
            await fetchChangelogs({
              page: 1,
              limit: changelogMeta.limit,
            });
          }
        } catch (error) {
          console.error(error);

          message.error(
            error instanceof Error ? error.message : "Gagal membatalkan sale",
          );
        }
      },
    });
  }

  function handleChangelogTableChange(pagination: TablePaginationConfig) {
    void fetchChangelogs({
      page: pagination.current || 1,
      limit: pagination.pageSize || 10,
    });
  }

  const itemColumns: ColumnsType<SaleDetailItem> = [
    {
      title: (
        <div className="leading-tight">
          <div>Product</div>
          <div className="text-xs font-normal text-slate-400">SKU</div>
        </div>
      ),
      width: 280,
      render: (_, record) => (
        <div>
          <div className="font-medium text-slate-700">
            {record.product?.name || "-"}
          </div>

          <div className="text-xs text-slate-400">
            {record.product?.sku || "-"}
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
      width: 240,
      render: (_, record) => (
        <div>
          <div className="font-medium text-slate-700">
            {record.warehouse
              ? `${record.warehouse.name} (${record.warehouse.code})`
              : "-"}
          </div>

          <div className="text-xs text-slate-400">
            {record.rackLocation
              ? `${record.rackLocation.name} (${record.rackLocation.code})`
              : "-"}
          </div>
        </div>
      ),
    },
    {
      title: "Qty",
      dataIndex: "quantity",
      width: 100,
      render: (value, record) =>
        `${value} ${record.product?.unit?.shortName || ""}`,
    },
    {
      title: "Price",
      dataIndex: "unitPrice",
      width: 150,
      align: "right",
      render: (value) => formatCurrency(value),
    },
    {
      title: "Discount",
      dataIndex: "discountAmount",
      width: 150,
      align: "right",
      render: (value) => (
        <span className="font-medium text-red-600">
          {formatCurrency(value)}
        </span>
      ),
    },
    {
      title: "Total",
      dataIndex: "totalPrice",
      width: 160,
      align: "right",
      render: (value) => (
        <span className="font-semibold text-slate-900">
          {formatCurrency(value)}
        </span>
      ),
    },
  ];

  const paymentColumns: ColumnsType<SalePaymentItem> = [
    {
      title: (
        <div className="leading-tight">
          <div>Payment Date</div>
          <div className="text-xs font-normal text-slate-400">Method</div>
        </div>
      ),
      width: 160,
      render: (_, record) => (
        <div>
          <div className="font-medium text-slate-700">
            {formatDate(record.paymentDate)}
          </div>

          <div className="mt-1">{getMethodTag(record.method)}</div>
        </div>
      ),
    },
    {
      title: "Amount",
      dataIndex: "amount",
      width: 170,
      align: "right",
      render: (value) => (
        <span className="font-semibold text-green-700">
          {formatCurrency(value)}
        </span>
      ),
    },
    {
      title: (
        <div className="leading-tight">
          <div>Reference</div>
          <div className="text-xs font-normal text-slate-400">Created By</div>
        </div>
      ),
      width: 240,
      render: (_, record) => (
        <div>
          <div className="font-mono text-xs text-slate-600">
            {record.referenceNumber || "-"}
          </div>

          <div className="mt-1 text-xs text-slate-400">
            {record.createdBy?.fullName || record.createdBy?.username || "-"}
          </div>
        </div>
      ),
    },
    {
      title: "Notes",
      dataIndex: "notes",
      render: (value: string | null) => value || "-",
    },
  ];

  const changelogColumns: ColumnsType<ChangelogItem> = [
    {
      title: "Date",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 170,
      render: (value: string) => formatDateTime(value),
    },
    {
      title: "Action",
      dataIndex: "action",
      key: "action",
      width: 140,
      render: (value: string) => (
        <Tag color={getActionColor(value)}>{value}</Tag>
      ),
    },
    {
      title: "User",
      key: "user",
      width: 180,
      render: (_, record) => (
        <div>
          <div className="font-medium text-slate-700">
            {record.user?.fullName || record.user?.username || "-"}
          </div>

          {record.user?.email ? (
            <div className="text-xs text-slate-400">{record.user.email}</div>
          ) : null}
        </div>
      ),
    },
    {
      title: "Old Data",
      dataIndex: "oldData",
      key: "oldData",
      render: (value: unknown) => (
        <pre className="max-h-[160px] overflow-auto whitespace-pre-wrap bg-slate-50 p-2 text-xs text-slate-700">
          {value ? JSON.stringify(value, null, 2) : "-"}
        </pre>
      ),
    },
    {
      title: "New Data",
      dataIndex: "newData",
      key: "newData",
      render: (value: unknown) => (
        <pre className="max-h-[160px] overflow-auto whitespace-pre-wrap bg-slate-50 p-2 text-xs text-slate-700">
          {value ? JSON.stringify(value, null, 2) : "-"}
        </pre>
      ),
    },
  ];

  return (
    <>
      {contextHolder}

      <div className="text-sm">
        <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="m-0 text-lg font-bold text-slate-950">
              Sale Detail
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Detail invoice penjualan, customer, item, pembayaran, dan
              changelog.
            </p>
          </div>

          <Space wrap size={8}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              className="dashboard-action-btn"
              onClick={() => router.push("/dashboard/sales-invoices/create")}
            >
              Add More
            </Button>

            <Button
              size="small"
              icon={<HistoryOutlined />}
              className="dashboard-action-btn"
              onClick={handleOpenChangelog}
            >
              Changelogs
            </Button>

            {sale ? (
              <PrintInvoiceButton
                saleId={id}
                disabled={sale.status === "CANCELLED"}
              />
            ) : null}

            <Button
              size="small"
              type="primary"
              icon={<EditOutlined />}
              className="dashboard-action-btn"
              disabled={!sale || sale.status === "CANCELLED"}
              onClick={() =>
                router.push(`/dashboard/sales-invoices/${id}/edit`)
              }
            >
              Edit
            </Button>

            <Button
              size="small"
              danger
              icon={<CloseCircleOutlined />}
              className="dashboard-action-btn"
              disabled={!sale || sale.status === "CANCELLED"}
              onClick={handleCancelSale}
            >
              Cancel Sale
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
                key: "invoiceNumber",
                label: "Invoice Number",
                children: sale?.invoiceNumber || "-",
              },
              {
                key: "saleDate",
                label: "Sale Date",
                children: formatDate(sale?.saleDate),
              },
              {
                key: "dueDate",
                label: "Due Date",
                children: formatDate(sale?.dueDate),
              },
              {
                key: "customer",
                label: "Customer",
                children: sale?.customer?.name || "Walk-in Customer",
              },
              {
                key: "salesman",
                label: "Salesman",
                children: sale?.salesman?.name || "-",
              },
              {
                key: "subtotal",
                label: "Subtotal",
                children: formatCurrency(sale?.subtotal),
              },
              {
                key: "discount",
                label: "Discount",
                children: formatCurrency(sale?.discountAmount),
              },
              {
                key: "total",
                label: "Total",
                children: formatCurrency(sale?.totalAmount),
              },
              {
                key: "paid",
                label: "Paid",
                children: formatCurrency(sale?.paidAmount),
              },
              {
                key: "remaining",
                label: "Remaining",
                children: formatCurrency(sale?.remainingAmount),
              },
              {
                key: "paymentStatus",
                label: "Payment Status",
                children: getPaymentTag(sale?.paymentStatus),
              },
              {
                key: "status",
                label: "Status",
                children: getStatusTag(sale?.status),
              },
              {
                key: "createdBy",
                label: "Created By",
                children:
                  sale?.createdBy?.fullName || sale?.createdBy?.username || "-",
              },
              {
                key: "notes",
                label: "Notes",
                children: sale?.notes || "-",
              },
              {
                key: "createdAt",
                label: "Created At",
                children: formatDateTime(sale?.createdAt),
              },
              {
                key: "updatedAt",
                label: "Updated At",
                children: formatDateTime(sale?.updatedAt),
              },
              {
                key: "cancelledAt",
                label: "Cancelled At",
                children: formatDateTime(sale?.cancelledAt),
              },
            ]}
          />
        )}

        <div className="mt-6 border-t border-slate-100 pt-5">
          <div className="mb-3">
            <div className="text-base font-bold text-slate-900">Sale Items</div>

            <div className="text-sm text-slate-500">
              List product yang keluar melalui invoice ini.
            </div>
          </div>

          <Table<SaleDetailItem>
            rowKey="id"
            size="small"
            className="data-table-sm"
            columns={itemColumns}
            dataSource={sale?.items || []}
            pagination={false}
            scroll={{ x: 1100 }}
          />
        </div>

        <div className="mt-6 border-t border-slate-100 pt-5">
          <div className="mb-3">
            <div className="text-base font-bold text-slate-900">Payments</div>

            <div className="text-sm text-slate-500">
              Riwayat pembayaran untuk invoice ini.
            </div>
          </div>

          <Table<SalePaymentItem>
            rowKey="id"
            size="small"
            className="data-table-sm"
            columns={paymentColumns}
            dataSource={sale?.payments || []}
            pagination={false}
            scroll={{ x: 900 }}
          />
        </div>

        {showChangelog ? (
          <div className="mt-6 border-t border-slate-100 pt-5">
            <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-base font-bold text-slate-900">
                  Changelogs
                </div>

                <div className="text-sm text-slate-500">
                  Semua perubahan yang berkaitan dengan sale ini.
                </div>
              </div>

              <Button
                size="small"
                icon={<ReloadOutlined />}
                className="dashboard-action-btn"
                onClick={() =>
                  void fetchChangelogs({
                    page: changelogMeta.page,
                    limit: changelogMeta.limit,
                  })
                }
              >
                Refresh
              </Button>
            </div>

            <Table<ChangelogItem>
              rowKey="id"
              size="small"
              className="data-table-sm"
              loading={changelogLoading}
              columns={changelogColumns}
              dataSource={changelogs}
              pagination={{
                current: changelogMeta.page,
                pageSize: changelogMeta.limit,
                total: changelogMeta.total,
                showSizeChanger: true,
                pageSizeOptions: [10, 25, 50],
                showTotal: (total, range) =>
                  `showing ${range[0]} to ${range[1]} of ${total} items`,
              }}
              onChange={handleChangelogTableChange}
              scroll={{ x: 1100 }}
            />
          </div>
        ) : null}
      </div>
    </>
  );
}
