"use client";

import { useEffect, useState } from "react";
import {
  App,
  Button,
  Descriptions,
  Progress,
  Space,
  Spin,
  Table,
  Tag,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  DeleteOutlined,
  EditOutlined,
  HistoryOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";

type SalePaymentDetailPageClientProps = {
  id: string;
};

type ActivityLogItem = {
  id: string;
  action: string;
  module: string;
  resourceType: string;
  resourceId: string;
  oldData?: unknown;
  newData?: unknown;
  createdAt: string;
  user?: {
    id: string;
    fullName?: string | null;
    username?: string | null;
    email?: string | null;
  } | null;
};

type SalePaymentDetail = {
  id: string;
  saleId: string;
  paymentDate: string;
  amount: string | number;
  discountPercent?: string | number;
  discountAmount?: string | number;
  method: string;
  referenceNumber?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  sale: {
    id: string;
    invoiceNumber: string;
    saleDate: string;
    totalAmount: string | number;
    paidAmount: string | number;
    remainingAmount: string | number;
    paymentStatus: string;
    status: string;
    customer?: {
      id: string;
      name: string;
    } | null;
    salesman?: {
      id: string;
      name: string;
    } | null;
  };
  createdBy?: {
    id: string;
    fullName?: string | null;
    username?: string | null;
  } | null;
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

function getSaleSettlementDiscount(payment: SalePaymentDetail) {
  const totalAmount = Number(payment.sale.totalAmount || 0);
  const paidAmount = Number(payment.sale.paidAmount || 0);
  const remainingAmount = Number(payment.sale.remainingAmount || 0);

  return Math.max(totalAmount - paidAmount - remainingAmount, 0);
}

function getPaymentPercent(payment: SalePaymentDetail) {
  const totalAmount = Number(payment.sale.totalAmount || 0);
  const paidAmount = Number(payment.sale.paidAmount || 0);
  const settlementDiscount = getSaleSettlementDiscount(payment);
  const settledAmount = paidAmount + settlementDiscount;

  if (!totalAmount || totalAmount <= 0) return 0;

  return Math.min(Math.round((settledAmount / totalAmount) * 100), 100);
}

function getPaymentStatusTag(value: string) {
  if (value === "PAID") return <Tag color="green">PAID</Tag>;
  if (value === "PARTIAL") return <Tag color="blue">PARTIAL</Tag>;

  return <Tag color="orange">UNPAID</Tag>;
}

function getMethodTag(value: string) {
  if (value === "CASH") return <Tag color="green">CASH</Tag>;
  if (value === "TRANSFER") return <Tag color="blue">TRANSFER</Tag>;
  if (value === "QRIS") return <Tag color="purple">QRIS</Tag>;

  return <Tag>{value}</Tag>;
}

function getActionTag(value: string) {
  if (value === "CREATE") return <Tag color="green">CREATE</Tag>;
  if (value === "UPDATE") return <Tag color="blue">UPDATE</Tag>;
  if (value === "DELETE") return <Tag color="red">DELETE</Tag>;

  return <Tag>{value}</Tag>;
}

function getUserName(item: ActivityLogItem) {
  return item.user?.fullName || item.user?.username || item.user?.email || "-";
}

function getCreatedName(payment: SalePaymentDetail) {
  return payment.createdBy?.fullName || payment.createdBy?.username || "-";
}

export default function SalePaymentDetailPageClient({
  id,
}: SalePaymentDetailPageClientProps) {
  const router = useRouter();
  const { message } = App.useApp();

  const [payment, setPayment] = useState<SalePaymentDetail | null>(null);
  const [changelogs, setChangelogs] = useState<ActivityLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [changelogLoading, setChangelogLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function fetchPayment() {
    try {
      setLoading(true);

      const response = await fetch(`/api/sale-payments/${id}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch sale payment");
      }

      setPayment(result.data);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error
          ? error.message
          : "Gagal mengambil detail pembayaran",
      );
    } finally {
      setLoading(false);
    }
  }

  async function fetchChangelogs() {
    try {
      setChangelogLoading(true);

      const response = await fetch(`/api/sale-payments/${id}/changelogs`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch changelogs");
      }

      setChangelogs(result.data.items || []);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal mengambil changelog",
      );
    } finally {
      setChangelogLoading(false);
    }
  }

  async function handleDelete() {
    if (!payment) return;

    const confirmed = window.confirm(
      `Hapus pembayaran untuk invoice ${payment.sale.invoiceNumber}?`,
    );

    if (!confirmed) return;

    try {
      setDeleteLoading(true);

      const response = await fetch(`/api/sale-payments/${payment.id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to delete sale payment");
      }

      message.success(result.message || "Sale payment deleted successfully");

      router.push("/dashboard/sales-payments");
      router.refresh();
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal hapus pembayaran",
      );
    } finally {
      setDeleteLoading(false);
    }
  }

  useEffect(() => {
    void fetchPayment();
    void fetchChangelogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const changelogColumns: ColumnsType<ActivityLogItem> = [
    {
      title: "Action",
      dataIndex: "action",
      width: 120,
      render: getActionTag,
    },
    {
      title: "User",
      width: 200,
      render: (_, record) => getUserName(record),
    },
    {
      title: "Created At",
      dataIndex: "createdAt",
      width: 180,
      render: formatDateTime,
    },
  ];

  if (loading && !payment) {
    return (
      <div className="flex min-h-[260px] items-center justify-center border border-slate-100 bg-white">
        <Spin />
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="border border-slate-100 bg-white p-4 text-sm text-slate-500">
        Sale payment tidak ditemukan.
      </div>
    );
  }

  const percent = getPaymentPercent(payment);
  const paymentDiscountPercent = Number(payment.discountPercent || 0);
  const paymentDiscountAmount = Number(payment.discountAmount || 0);
  const settlementAmount = Number(payment.amount || 0) + paymentDiscountAmount;
  const saleSettlementDiscount = getSaleSettlementDiscount(payment);

  return (
    <div className="text-sm">
      <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="m-0 text-lg font-bold text-slate-950">
            Sale Payment Detail
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            {payment.sale.invoiceNumber} • {payment.sale.customer?.name || "-"}
          </p>
        </div>

        <Space wrap>
          <Button
            size="small"
            icon={<ReloadOutlined />}
            className="dashboard-icon-btn"
            onClick={() => {
              void fetchPayment();
              void fetchChangelogs();
            }}
          />

          <Button
            type="primary"
            icon={<PlusOutlined />}
            className="dashboard-action-btn"
            onClick={() => router.push("/dashboard/sales-payments/create")}
          >
            Add More
          </Button>

          <Button
            size="small"
            icon={<EditOutlined />}
            className="dashboard-action-btn"
            onClick={() => router.push(`/dashboard/sales-payments/${id}/edit`)}
          >
            Edit
          </Button>

          <Button
            danger
            size="small"
            icon={<DeleteOutlined />}
            loading={deleteLoading}
            className="dashboard-action-btn"
            onClick={handleDelete}
          >
            Delete
          </Button>
        </Space>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="border border-slate-100 bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Cash Payment
          </div>
          <div className="mt-2 text-xl font-bold text-blue-600">
            {formatCurrency(payment.amount)}
          </div>
        </div>

        <div className="border border-slate-100 bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Payment Discount
          </div>
          <div className="mt-2 text-xl font-bold text-amber-600">
            {formatCurrency(paymentDiscountAmount)}
          </div>
        </div>

        <div className="border border-slate-100 bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Settlement
          </div>
          <div className="mt-2 text-xl font-bold text-green-600">
            {formatCurrency(settlementAmount)}
          </div>
        </div>

        <div className="border border-slate-100 bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Remaining
          </div>
          <div className="mt-2 text-xl font-bold text-red-600">
            {formatCurrency(payment.sale.remainingAmount)}
          </div>
        </div>
      </div>

      <div className="mb-4 border border-slate-100 bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="font-semibold text-slate-900">Invoice Progress</div>
          {getPaymentStatusTag(payment.sale.paymentStatus)}
        </div>

        <Progress
          percent={percent}
          status={
            payment.sale.paymentStatus === "PAID"
              ? "success"
              : payment.sale.paymentStatus === "PARTIAL"
                ? "active"
                : "exception"
          }
        />
      </div>

      <div className="mb-4 border border-slate-100 bg-white p-4">
        <Descriptions
          bordered
          size="small"
          column={1}
          className="detail-descriptions"
          items={[
            {
              key: "paymentDate",
              label: "Payment Date",
              children: formatDate(payment.paymentDate),
            },
            {
              key: "invoice",
              label: "Invoice",
              children: payment.sale.invoiceNumber,
            },
            {
              key: "customer",
              label: "Customer",
              children: payment.sale.customer?.name || "-",
            },
            {
              key: "salesman",
              label: "Salesman",
              children: payment.sale.salesman?.name || "-",
            },
            {
              key: "amount",
              label: "Cash Payment",
              children: formatCurrency(payment.amount),
            },
            {
              key: "discountType",
              label: "Discount Type",
              children:
                paymentDiscountAmount <= 0
                  ? "Tanpa Diskon"
                  : paymentDiscountPercent > 0
                    ? `Persen (${paymentDiscountPercent}%)`
                    : "Nominal",
            },
            {
              key: "discountAmount",
              label: "Payment Discount",
              children: formatCurrency(paymentDiscountAmount),
            },
            {
              key: "settlementAmount",
              label: "Settlement Amount",
              children: formatCurrency(settlementAmount),
            },
            {
              key: "saleSettlementDiscount",
              label: "Total Discount Settled",
              children: formatCurrency(saleSettlementDiscount),
            },
            {
              key: "method",
              label: "Method",
              children: getMethodTag(payment.method),
            },
            {
              key: "reference",
              label: "Reference",
              children: payment.referenceNumber || "-",
            },
            {
              key: "notes",
              label: "Notes",
              children: payment.notes || "-",
            },
            {
              key: "createdBy",
              label: "Created By",
              children: getCreatedName(payment),
            },
            {
              key: "createdAt",
              label: "Created At",
              children: formatDateTime(payment.createdAt),
            },
          ]}
        />
      </div>

      <div className="border border-slate-100 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="font-semibold text-slate-900">Changelogs</div>
            <div className="text-xs text-slate-500">
              Riwayat perubahan payment.
            </div>
          </div>

          <Button
            size="small"
            icon={<HistoryOutlined />}
            className="dashboard-icon-btn"
            onClick={fetchChangelogs}
          />
        </div>

        <Table<ActivityLogItem>
          rowKey="id"
          size="small"
          className="data-table-sm"
          loading={changelogLoading}
          columns={changelogColumns}
          dataSource={changelogs}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: [10, 25, 50],
            showTotal: (total, range) =>
              `showing ${range[0]} to ${range[1]} of ${total} items`,
          }}
        />
      </div>
    </div>
  );
}
