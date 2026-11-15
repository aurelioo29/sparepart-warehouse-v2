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
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  HistoryOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";

type PurchasePaymentAttachment = {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  fileUrl: string;
  createdAt: string;
};

type PurchasePaymentDetail = {
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
    stockInDate: string;
    dueDate?: string | null;
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    paymentStatus: string;
    status: string;
    supplier?: {
      id: string;
      name: string;
    } | null;
  } | null;
  createdBy?: {
    id: string;
    fullName?: string | null;
    username?: string | null;
  } | null;
  attachments?: PurchasePaymentAttachment[];
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

type PurchasePaymentDetailPageClientProps = {
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

function formatFileSize(size: number) {
  if (!size) return "-";

  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

function getMethodTag(value?: string | null) {
  if (value === "CASH") return <Tag color="green">CASH</Tag>;
  if (value === "TRANSFER") return <Tag color="blue">TRANSFER</Tag>;
  if (value === "QRIS") return <Tag color="purple">QRIS</Tag>;
  if (value === "DEBIT") return <Tag color="cyan">DEBIT</Tag>;
  if (value === "CREDIT") return <Tag color="gold">CREDIT</Tag>;

  return <Tag>{value || "-"}</Tag>;
}

function getPaymentStatusTag(value?: string | null) {
  if (value === "PAID") return <Tag color="green">PAID</Tag>;
  if (value === "PARTIAL") return <Tag color="blue">PARTIAL</Tag>;
  if (value === "UNPAID") return <Tag color="orange">UNPAID</Tag>;

  return <Tag>{value || "-"}</Tag>;
}

function getStockInStatusTag(value?: string | null) {
  if (value === "POSTED") return <Tag color="green">POSTED</Tag>;
  if (value === "CANCELLED") return <Tag color="red">CANCELLED</Tag>;
  if (value === "DRAFT") return <Tag color="gold">DRAFT</Tag>;

  return <Tag>{value || "-"}</Tag>;
}

function getActionColor(value: string) {
  if (value === "CREATE") return "green";
  if (value === "UPDATE") return "blue";
  if (value === "DELETE") return "red";

  return "default";
}

function isImageFile(mimeType: string) {
  return mimeType.startsWith("image/");
}

function isPdfFile(mimeType: string) {
  return mimeType === "application/pdf";
}

export default function PurchasePaymentDetailPageClient({
  id,
}: PurchasePaymentDetailPageClientProps) {
  const router = useRouter();
  const { message } = App.useApp();
  const [modal, contextHolder] = Modal.useModal();

  const [payment, setPayment] = useState<PurchasePaymentDetail | null>(null);
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

  async function fetchPayment() {
    try {
      setLoading(true);

      const response = await fetch(`/api/purchase-payments/${id}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch purchase payment");
      }

      setPayment(result.data);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error
          ? error.message
          : "Gagal mengambil purchase payment",
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
        `/api/purchase-payments/${id}/changelogs?${query.toString()}`,
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
    void fetchPayment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function handleOpenChangelog() {
    setShowChangelog(true);

    void fetchChangelogs({
      page: 1,
      limit: changelogMeta.limit,
    });
  }

  function handleDeletePayment() {
    if (!payment) return;

    modal.confirm({
      title: "Delete purchase payment?",
      content: `Pembayaran ${formatCurrency(
        payment.amount,
      )} akan dihapus, saldo payable akan dikembalikan, dan file bukti pembayaran juga akan ikut dihapus.`,
      okText: "Ya, Delete Payment",
      cancelText: "Batal",
      okButtonProps: {
        danger: true,
      },
      centered: true,
      async onOk() {
        try {
          const response = await fetch(`/api/purchase-payments/${payment.id}`, {
            method: "DELETE",
          });

          const result = await response.json();

          if (!response.ok || !result.success) {
            throw new Error(
              result.message || "Failed to delete purchase payment",
            );
          }

          message.success(result.message || "Purchase payment deleted");

          router.push("/dashboard/purchase-payments");
          router.refresh();
        } catch (error) {
          console.error(error);

          message.error(
            error instanceof Error
              ? error.message
              : "Gagal menghapus purchase payment",
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

  const attachmentColumns: ColumnsType<PurchasePaymentAttachment> = [
    {
      title: "File",
      key: "file",
      render: (_, record) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center border border-slate-100 bg-slate-50 text-slate-500">
            {isPdfFile(record.mimeType) ? (
              <FilePdfOutlined />
            ) : (
              <FileImageOutlined />
            )}
          </div>

          <div className="min-w-0">
            <div className="truncate font-medium text-slate-800">
              {record.originalName}
            </div>

            <div className="text-xs text-slate-400">
              {record.mimeType} • {formatFileSize(record.size)}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Uploaded At",
      dataIndex: "createdAt",
      width: 170,
      render: (value: string) => formatDateTime(value),
    },
    {
      title: "Action",
      key: "action",
      width: 130,
      align: "center",
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            className="dashboard-table-action-btn"
            href={record.fileUrl}
            target="_blank"
          />

          <Button
            type="link"
            size="small"
            icon={<DownloadOutlined />}
            className="dashboard-table-action-btn"
            href={record.fileUrl}
            download={record.originalName}
          />
        </Space>
      ),
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

  const attachments = payment?.attachments || [];

  return (
    <>
      {contextHolder}

      <div className="text-sm">
        <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="m-0 text-lg font-bold text-slate-950">
              Purchase Payment Detail
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Detail pembayaran supplier, invoice, payable, changelog, dan bukti
              pembayaran.
            </p>
          </div>

          <Space wrap size={8}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              className="dashboard-action-btn"
              onClick={() => router.push("/dashboard/purchase-payments/create")}
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
              disabled={!payment}
              onClick={() =>
                router.push(`/dashboard/purchase-payments/${id}/edit`)
              }
            >
              Edit
            </Button>

            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              className="dashboard-action-btn"
              disabled={!payment}
              onClick={handleDeletePayment}
            >
              Delete Payment
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
                key: "paymentDate",
                label: "Payment Date",
                children: formatDate(payment?.paymentDate),
              },
              {
                key: "amount",
                label: "Amount",
                children: formatCurrency(payment?.amount),
              },
              {
                key: "method",
                label: "Method",
                children: getMethodTag(payment?.method),
              },
              {
                key: "referenceNumber",
                label: "Reference Number",
                children: payment?.referenceNumber || "-",
              },
              {
                key: "supplier",
                label: "Supplier",
                children: payment?.supplier?.name || "-",
              },
              {
                key: "stockInDocument",
                label: "Stock In Document",
                children: payment?.stockIn?.documentNumber || "-",
              },
              {
                key: "invoiceNumber",
                label: "No Faktur",
                children: payment?.stockIn?.invoiceNumber || "-",
              },
              {
                key: "stockInDate",
                label: "Stock In Date",
                children: formatDate(payment?.stockIn?.stockInDate),
              },
              {
                key: "stockInStatus",
                label: "Stock In Status",
                children: getStockInStatusTag(payment?.stockIn?.status),
              },
              {
                key: "totalAmount",
                label: "Invoice Total",
                children: formatCurrency(payment?.stockIn?.totalAmount),
              },
              {
                key: "paidAmount",
                label: "Invoice Paid",
                children: formatCurrency(payment?.stockIn?.paidAmount),
              },
              {
                key: "remainingAmount",
                label: "Invoice Remaining",
                children: formatCurrency(payment?.stockIn?.remainingAmount),
              },
              {
                key: "paymentStatus",
                label: "Invoice Payment Status",
                children: getPaymentStatusTag(payment?.stockIn?.paymentStatus),
              },
              {
                key: "proofCount",
                label: "Bukti Pembayaran",
                children:
                  attachments.length > 0 ? (
                    <Tag color="blue">{attachments.length} file</Tag>
                  ) : (
                    "-"
                  ),
              },
              {
                key: "createdBy",
                label: "Created By",
                children:
                  payment?.createdBy?.fullName ||
                  payment?.createdBy?.username ||
                  "-",
              },
              {
                key: "notes",
                label: "Notes",
                children: payment?.notes || "-",
              },
              {
                key: "createdAt",
                label: "Created At",
                children: formatDateTime(payment?.createdAt),
              },
            ]}
          />
        )}

        <div className="mt-6 border-t border-slate-100 pt-5">
          <div className="mb-3">
            <div className="text-base font-bold text-slate-900">
              Bukti Pembayaran
            </div>

            <div className="text-sm text-slate-500">
              File foto/PDF bukti pembayaran yang diupload pada payment ini.
            </div>
          </div>

          {attachments.length > 0 ? (
            <>
              <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                {attachments
                  .filter((item) => isImageFile(item.mimeType))
                  .slice(0, 6)
                  .map((item) => (
                    <a
                      key={item.id}
                      href={item.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="group block overflow-hidden border border-slate-100 bg-white"
                    >
                      <div className="aspect-[4/3] bg-slate-50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.fileUrl}
                          alt={item.originalName}
                          className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                        />
                      </div>

                      <div className="border-t border-slate-100 px-3 py-2">
                        <div className="truncate text-sm font-medium text-slate-800">
                          {item.originalName}
                        </div>

                        <div className="text-xs text-slate-400">
                          {formatFileSize(item.size)}
                        </div>
                      </div>
                    </a>
                  ))}
              </div>

              <Table<PurchasePaymentAttachment>
                rowKey="id"
                size="small"
                className="data-table-sm"
                columns={attachmentColumns}
                dataSource={attachments}
                pagination={false}
                scroll={{ x: 800 }}
              />
            </>
          ) : (
            <div className="border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">
              Belum ada bukti pembayaran yang diupload.
            </div>
          )}
        </div>

        {showChangelog ? (
          <div className="mt-6 border-t border-slate-100 pt-5">
            <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-base font-bold text-slate-900">
                  Changelogs
                </div>

                <div className="text-sm text-slate-500">
                  Semua perubahan yang berkaitan dengan purchase payment ini.
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
