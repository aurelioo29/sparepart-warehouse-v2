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
  DeleteOutlined,
  EditOutlined,
  FileExcelOutlined,
  HistoryOutlined,
  PlusOutlined,
  PrinterOutlined,
  ReloadOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";

type KngOrderDetailItem = {
  id: string;
  kngProductId: string;
  jenisSnapshot: string;
  partNumberSnapshot: string;
  hargaJkt: string | number;
  hargaNetto: string | number;
  quantity: number;
  totalAmount: string | number;
};

type KngOrderDetail = {
  id: string;
  orderNumber: string;
  orderDate: string;
  discountPercent: string | number;
  totalQty: number;
  totalAmount: string | number;
  status: string;
  noteFranco?: string | null;
  noteTop?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  postedAt?: string | null;
  cancelledAt?: string | null;
  items: KngOrderDetailItem[];
  createdBy?: {
    id: string;
    fullName: string;
    username: string;
    email: string;
  } | null;
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
  order: {
    id: string;
    orderNumber: string;
    orderDate: string;
    status: string;
  };
  items: ChangelogItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type KngOrderDetailPageClientProps = {
  id: string;
};

function formatNumber(value?: string | number | null) {
  return Number(value || 0).toLocaleString("id-ID");
}

function getStatusColor(status: string) {
  if (status === "POSTED") return "green";
  if (status === "DRAFT") return "blue";
  if (status === "CANCELLED") return "red";

  return "default";
}

function getActionColor(value: string) {
  if (value === "CREATE") return "green";
  if (value === "UPDATE") return "blue";
  if (value === "DELETE") return "orange";
  if (value === "DELETE_PERMANENT") return "red";

  return "default";
}

function getSafeExportFileName(orderNumber: string) {
  return `Order-KNG-${orderNumber.replace(/\//g, "-")}.xlsx`;
}

// Sembunyikan field keuangan dari JSON changelog yang ditampilkan.
const hiddenFinancialFields = new Set([
  "hargajkt",
  "harganetto",
  "harga",
  "price",
  "unitprice",
  "sellingprice",
  "purchaseprice",
  "costprice",
  "totalprice",
  "totalamount",
  "subtotal",
  "discount",
  "discountpercent",
  "discountamount",
  "totaldiscountamount",
  "additionaldiscountpercent",
  "additionaldiscountpercent2",
  "paidamount",
  "remainingamount",
  "amount",
  "currency",
]);

function hideFinancialFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(hideFinancialFields);
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => {
          const normalizedKey = key.replace(/[_\-\s]/g, "").toLowerCase();

          return !hiddenFinancialFields.has(normalizedKey);
        })
        .map(([key, item]) => [key, hideFinancialFields(item)]),
    );
  }

  return value;
}

function renderChangelogData(value: unknown) {
  return (
    <pre className="max-h-[160px] overflow-auto whitespace-pre-wrap bg-slate-50 p-2 text-xs text-slate-700">
      {value === null || value === undefined
        ? "-"
        : JSON.stringify(hideFinancialFields(value), null, 2)}
    </pre>
  );
}

export default function KngOrderDetailPageClient({
  id,
}: KngOrderDetailPageClientProps) {
  const router = useRouter();
  const { message } = App.useApp();
  const [modal, contextHolder] = Modal.useModal();

  const [order, setOrder] = useState<KngOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const [changelogs, setChangelogs] = useState<ChangelogItem[]>([]);
  const [changelogLoading, setChangelogLoading] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);

  const [changelogMeta, setChangelogMeta] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  async function fetchOrder() {
    try {
      setLoading(true);

      const response = await fetch(`/api/kng-orders/${id}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch KNG order");
      }

      setOrder(result.data);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal mengambil order KNG",
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
        `/api/kng-orders/${id}/changelogs?${query.toString()}`,
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
    void fetchOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function handleOpenChangelog() {
    setShowChangelog(true);

    void fetchChangelogs({
      page: 1,
      limit: changelogMeta.limit,
    });
  }

  async function handleExportExcel() {
    if (!order) return;

    try {
      const response = await fetch(`/api/kng-orders/${order.id}/export`);

      if (!response.ok) {
        const result = await response.json().catch(() => null);

        throw new Error(result?.message || "Gagal export order KNG");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = getSafeExportFileName(order.orderNumber);

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);

      message.success("Order KNG berhasil diexport");
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal export order KNG",
      );
    }
  }

  function handleCancelOrder() {
    if (!order) return;

    modal.confirm({
      title: "Cancel order KNG?",
      content: `Order "${order.orderNumber}" akan dibatalkan. Data tetap ada, tapi status menjadi CANCELLED.`,
      okText: "Ya, Cancel",
      cancelText: "Batal",
      okButtonProps: {
        danger: true,
      },
      centered: true,
      async onOk() {
        try {
          const response = await fetch(`/api/kng-orders/${order.id}`, {
            method: "DELETE",
          });

          const result = await response.json();

          if (!response.ok || !result.success) {
            throw new Error(result.message || "Failed to cancel KNG order");
          }

          message.success(result.message || "KNG order cancelled successfully");

          await fetchOrder();

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
              : "Gagal membatalkan order KNG",
          );
        }
      },
    });
  }

  function handlePermanentDelete() {
    if (!order) return;

    modal.confirm({
      title: "Delete permanent order KNG?",
      content: `Order "${order.orderNumber}" akan dihapus permanent dari database. Aksi ini tidak bisa dibatalkan.`,
      okText: "Ya, Delete Permanent",
      cancelText: "Batal",
      okButtonProps: {
        danger: true,
      },
      centered: true,
      async onOk() {
        try {
          const response = await fetch(
            `/api/kng-orders/${order.id}?permanent=true`,
            {
              method: "DELETE",
            },
          );

          const result = await response.json();

          if (!response.ok || !result.success) {
            throw new Error(
              result.message || "Failed to permanently delete KNG order",
            );
          }

          message.success(
            result.message || "KNG order permanently deleted successfully",
          );

          router.push("/dashboard/kng-orders");
          router.refresh();
        } catch (error) {
          console.error(error);

          message.error(
            error instanceof Error
              ? error.message
              : "Gagal menghapus permanent order KNG",
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

  const itemColumns: ColumnsType<KngOrderDetailItem> = [
    {
      title: "No",
      key: "no",
      width: 60,
      align: "center",
      render: (_, __, index) => index + 1,
    },
    {
      title: "Jenis",
      dataIndex: "jenisSnapshot",
      key: "jenisSnapshot",
      width: 180,
    },
    {
      title: "Part Number",
      dataIndex: "partNumberSnapshot",
      key: "partNumberSnapshot",
      width: 300,
      render: (value: string) => (
        <span className="font-medium text-slate-800">{value}</span>
      ),
    },
    {
      title: "Order/pc",
      dataIndex: "quantity",
      key: "quantity",
      width: 110,
      align: "right",
      render: (value: number) => formatNumber(value),
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
          {dayjs(value).format("YYYY-MM-DD HH:mm:ss")}
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
      render: renderChangelogData,
    },
    {
      title: "New Data",
      dataIndex: "newData",
      key: "newData",
      render: renderChangelogData,
    },
  ];

  return (
    <>
      {contextHolder}

      <div className="text-sm">
        <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="m-0 text-lg font-bold text-slate-950">
              Detail Order KNG
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Lihat detail order KNG, jumlah barang, dan riwayat perubahan.
            </p>
          </div>

          <Space wrap size={8}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              className="dashboard-action-btn"
              onClick={() => router.push("/dashboard/kng-orders/create")}
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
              icon={<PrinterOutlined />}
              className="dashboard-action-btn"
              disabled={!order}
              onClick={() =>
                window.open(`/dashboard/kng-orders/${id}/print`, "_blank")
              }
            >
              Print
            </Button>

            <Button
              size="small"
              icon={<FileExcelOutlined />}
              className="dashboard-action-btn"
              disabled={!order}
              onClick={handleExportExcel}
            >
              Export Excel
            </Button>

            <Button
              size="small"
              type="primary"
              icon={<EditOutlined />}
              className="dashboard-action-btn"
              disabled={!order || order.status === "CANCELLED"}
              onClick={() => router.push(`/dashboard/kng-orders/${id}/edit`)}
            >
              Edit
            </Button>

            <Button
              size="small"
              danger
              icon={<StopOutlined />}
              className="dashboard-action-btn"
              disabled={!order || order.status === "CANCELLED"}
              onClick={handleCancelOrder}
            >
              Cancel
            </Button>

            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              className="dashboard-action-btn"
              disabled={!order}
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
        ) : order ? (
          <>
            <Descriptions
              bordered
              size="small"
              column={1}
              className="detail-descriptions"
              items={[
                {
                  key: "orderNumber",
                  label: "Order Number",
                  children: order.orderNumber,
                },
                {
                  key: "orderDate",
                  label: "Order Date",
                  children: dayjs(order.orderDate).format("YYYY-MM-DD"),
                },
                {
                  key: "totalQty",
                  label: "Total Qty",
                  children: formatNumber(order.totalQty),
                },
                {
                  key: "status",
                  label: "Status",
                  children: (
                    <Tag color={getStatusColor(order.status)}>
                      {order.status}
                    </Tag>
                  ),
                },
                {
                  key: "noteFranco",
                  label: "Keterangan 1",
                  children: order.noteFranco || "-",
                },
                {
                  key: "noteTop",
                  label: "Keterangan 2",
                  children: order.noteTop || "-",
                },
                {
                  key: "notes",
                  label: "Notes",
                  children: order.notes || "-",
                },
                {
                  key: "createdBy",
                  label: "Created By",
                  children:
                    order.createdBy?.fullName ||
                    order.createdBy?.username ||
                    "-",
                },
                {
                  key: "createdAt",
                  label: "Created at",
                  children: dayjs(order.createdAt).format(
                    "YYYY-MM-DD HH:mm:ss",
                  ),
                },
                {
                  key: "updatedAt",
                  label: "Updated at",
                  children: dayjs(order.updatedAt).format(
                    "YYYY-MM-DD HH:mm:ss",
                  ),
                },
                {
                  key: "postedAt",
                  label: "Posted at",
                  children: order.postedAt
                    ? dayjs(order.postedAt).format("YYYY-MM-DD HH:mm:ss")
                    : "-",
                },
                {
                  key: "cancelledAt",
                  label: "Cancelled at",
                  children: order.cancelledAt
                    ? dayjs(order.cancelledAt).format("YYYY-MM-DD HH:mm:ss")
                    : "-",
                },
              ]}
            />

            <div className="mt-6 border-t border-slate-100 pt-5">
              <div className="mb-3">
                <div className="text-base font-bold text-slate-900">
                  Item Order
                </div>

                <div className="text-sm text-slate-500">
                  Detail barang yang masuk dalam order ini.
                </div>
              </div>

              <Table<KngOrderDetailItem>
                rowKey="id"
                size="small"
                className="data-table-sm"
                columns={itemColumns}
                dataSource={order.items || []}
                pagination={false}
                scroll={{ x: 650 }}
                summary={() => (
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={3}>
                      <div className="text-right font-bold tracking-[0.15em] text-slate-950">
                        TOTAL QTY
                      </div>
                    </Table.Summary.Cell>

                    <Table.Summary.Cell index={3}>
                      <div className="text-right font-bold text-slate-950">
                        {formatNumber(order.totalQty)}
                      </div>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                )}
              />
            </div>
          </>
        ) : null}

        {showChangelog ? (
          <div className="mt-6 border-t border-slate-100 pt-5">
            <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-base font-bold text-slate-900">
                  Changelogs
                </div>

                <div className="text-sm text-slate-500">
                  Semua perubahan yang berkaitan dengan order KNG ini.
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
