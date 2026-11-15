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

type StockInDetailItem = {
  id: string;
  productId: string;
  warehouseId?: string | null;
  rackLocationId?: string | null;
  quantity: number | string;
  unitPrice: string | number;
  totalPrice: string | number;
  product?: {
    id: string;
    sku: string;
    name: string;
    currentStock?: number;
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

type StockInDetail = {
  id: string;
  supplierId?: string | null;
  documentNumber: string;
  invoiceNumber?: string | null;
  stockInDate: string;
  dueDate?: string | null;
  status: string;
  paymentStatus?: string | null;
  totalAmount: string | number;
  paidAmount?: string | number;
  remainingAmount?: string | number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  postedAt?: string | null;
  cancelledAt?: string | null;
  supplier?: {
    id: string;
    name: string;
  } | null;
  createdBy?: {
    id: string;
    fullName: string;
    username: string;
  } | null;
  items: StockInDetailItem[];
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

type StockInDetailPageClientProps = {
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

function getStatusTag(value?: string | null) {
  if (value === "POSTED") return <Tag color="green">POSTED</Tag>;
  if (value === "CANCELLED") return <Tag color="red">CANCELLED</Tag>;
  if (value === "DRAFT") return <Tag color="gold">DRAFT</Tag>;

  return <Tag>{value || "-"}</Tag>;
}

function getPaymentStatusTag(value?: string | null) {
  if (value === "PAID") return <Tag color="green">PAID</Tag>;
  if (value === "PARTIAL") return <Tag color="blue">PARTIAL</Tag>;
  if (value === "UNPAID") return <Tag color="orange">UNPAID</Tag>;

  return <Tag>{value || "-"}</Tag>;
}

function getActionColor(value: string) {
  if (value === "CREATE") return "green";
  if (value === "UPDATE") return "blue";
  if (value === "DELETE") return "red";
  if (value === "CANCEL") return "orange";

  return "default";
}

export default function StockInDetailPageClient({
  id,
}: StockInDetailPageClientProps) {
  const router = useRouter();
  const { message } = App.useApp();
  const [modal, contextHolder] = Modal.useModal();

  const [stockIn, setStockIn] = useState<StockInDetail | null>(null);
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

  async function fetchStockIn() {
    try {
      setLoading(true);

      const response = await fetch(`/api/stock-ins/${id}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch stock in");
      }

      setStockIn(result.data);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal mengambil stock in",
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
        `/api/stock-ins/${id}/changelogs?${query.toString()}`,
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
    void fetchStockIn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function handleOpenChangelog() {
    setShowChangelog(true);

    void fetchChangelogs({
      page: 1,
      limit: changelogMeta.limit,
    });
  }

  function handleCancelStockIn() {
    if (!stockIn) return;

    modal.confirm({
      title: "Cancel stock in?",
      content:
        Number(stockIn.paidAmount || 0) > 0
          ? `Dokumen "${stockIn.documentNumber}" sudah memiliki pembayaran. Hapus/batalkan purchase payment terlebih dahulu.`
          : `Dokumen "${stockIn.documentNumber}" akan dibatalkan dan stok akan dikurangi kembali.`,
      okText: "Ya, Cancel",
      cancelText: "Tidak",
      okButtonProps: {
        danger: true,
        disabled: Number(stockIn.paidAmount || 0) > 0,
      },
      centered: true,
      async onOk() {
        try {
          const response = await fetch(`/api/stock-ins/${stockIn.id}`, {
            method: "DELETE",
          });

          const result = await response.json();

          if (!response.ok || !result.success) {
            throw new Error(result.message || "Failed to cancel stock in");
          }

          message.success(result.message || "Stock in cancelled successfully");

          await fetchStockIn();

          if (showChangelog) {
            await fetchChangelogs({
              page: 1,
              limit: changelogMeta.limit,
            });
          }
        } catch (error) {
          console.error(error);

          message.error(
            error instanceof Error
              ? error.message
              : "Gagal membatalkan stock in",
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

  const itemColumns: ColumnsType<StockInDetailItem> = [
    {
      title: (
        <div className="leading-tight">
          <div>Product</div>
          <div className="text-xs font-normal text-slate-400">SKU</div>
        </div>
      ),
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
    },
    {
      title: "Unit Price",
      dataIndex: "unitPrice",
      width: 160,
      align: "right",
      render: (value) => formatCurrency(value),
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

  const changelogColumns: ColumnsType<ChangelogItem> = [
    {
      title: "Date",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 170,
      render: (value: string) => (
        <span className="whitespace-nowrap text-slate-700">
          {formatDateTime(value)}
        </span>
      ),
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
              Detail Stock In
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Lihat informasi barang masuk, item product, pembayaran, dan
              changelog.
            </p>
          </div>

          <Space wrap size={8}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              className="dashboard-action-btn"
              onClick={() => router.push("/dashboard/stock-ins/create")}
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

            <Button
              size="small"
              type="primary"
              icon={<EditOutlined />}
              className="dashboard-action-btn"
              disabled={!stockIn || stockIn.status === "CANCELLED"}
              onClick={() => router.push(`/dashboard/stock-ins/${id}/edit`)}
            >
              Edit
            </Button>

            <Button
              size="small"
              danger
              icon={<CloseCircleOutlined />}
              className="dashboard-action-btn"
              disabled={
                !stockIn ||
                stockIn.status === "CANCELLED" ||
                Number(stockIn.paidAmount || 0) > 0
              }
              onClick={handleCancelStockIn}
            >
              Cancel Stock In
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
                key: "documentNumber",
                label: "Document Number",
                children: stockIn?.documentNumber || "-",
              },
              {
                key: "invoiceNumber",
                label: "No Faktur",
                children: stockIn?.invoiceNumber || "-",
              },
              {
                key: "supplier",
                label: "Supplier",
                children: stockIn?.supplier?.name || "-",
              },
              {
                key: "stockInDate",
                label: "Stock In Date",
                children: formatDate(stockIn?.stockInDate),
              },
              {
                key: "dueDate",
                label: "Due Date",
                children: formatDate(stockIn?.dueDate),
              },
              {
                key: "totalAmount",
                label: "Total",
                children: formatCurrency(stockIn?.totalAmount),
              },
              {
                key: "paidAmount",
                label: "Paid",
                children: formatCurrency(stockIn?.paidAmount),
              },
              {
                key: "remainingAmount",
                label: "Remaining",
                children: formatCurrency(stockIn?.remainingAmount),
              },
              {
                key: "paymentStatus",
                label: "Payment Status",
                children: getPaymentStatusTag(stockIn?.paymentStatus),
              },
              {
                key: "status",
                label: "Status",
                children: getStatusTag(stockIn?.status),
              },
              {
                key: "createdBy",
                label: "Created By",
                children:
                  stockIn?.createdBy?.fullName ||
                  stockIn?.createdBy?.username ||
                  "-",
              },
              {
                key: "notes",
                label: "Notes",
                children: stockIn?.notes || "-",
              },
              {
                key: "createdAt",
                label: "Created At",
                children: formatDateTime(stockIn?.createdAt),
              },
              {
                key: "postedAt",
                label: "Posted At",
                children: formatDateTime(stockIn?.postedAt),
              },
              {
                key: "cancelledAt",
                label: "Cancelled At",
                children: formatDateTime(stockIn?.cancelledAt),
              },
            ]}
          />
        )}

        <div className="mt-6 border-t border-slate-100 pt-5">
          <div className="mb-3">
            <div className="text-base font-bold text-slate-900">
              Stock In Items
            </div>

            <div className="text-sm text-slate-500">
              List product yang masuk ke stock melalui dokumen ini.
            </div>
          </div>

          <Table<StockInDetailItem>
            rowKey="id"
            size="small"
            className="data-table-sm"
            columns={itemColumns}
            dataSource={stockIn?.items || []}
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
                  Semua perubahan yang berkaitan dengan stock in ini.
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
