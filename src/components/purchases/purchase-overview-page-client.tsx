"use client";

import { useEffect, useMemo, useState } from "react";
import { App, Button, Progress, Space, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

type PurchaseOverviewSummary = {
  totalPostedDocuments: number;
  totalCancelledDocuments: number;
  totalPurchaseAmount: number;
  totalPaidAmount: number;
  totalPayableAmount: number;
  unpaidDocuments: number;
  partialDocuments: number;
  paidDocuments: number;
  currentMonthDocuments: number;
  currentMonthPurchaseAmount: number;
};

type RecentPurchaseItem = {
  id: string;
  documentNumber: string;
  invoiceNumber?: string | null;
  stockInDate: string;
  dueDate?: string | null;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  supplier?: {
    id: string;
    name: string;
  } | null;
  createdBy?: {
    id: string;
    fullName?: string | null;
    username?: string | null;
  } | null;
  itemCount: number;
  paymentCount: number;
};

type PurchaseOverviewResponse = {
  summary: PurchaseOverviewSummary;
  recentPurchases: RecentPurchaseItem[];
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

function getPaymentStatusTag(value: string) {
  if (value === "PAID") return <Tag color="green">PAID</Tag>;
  if (value === "PARTIAL") return <Tag color="blue">PARTIAL</Tag>;
  if (value === "UNPAID") return <Tag color="orange">UNPAID</Tag>;

  return <Tag>{value}</Tag>;
}

function getStatusTag(value: string) {
  if (value === "POSTED") return <Tag color="green">POSTED</Tag>;
  if (value === "CANCELLED") return <Tag color="red">CANCELLED</Tag>;
  if (value === "DRAFT") return <Tag color="gold">DRAFT</Tag>;

  return <Tag>{value}</Tag>;
}

function getCreatedName(record: RecentPurchaseItem) {
  return record.createdBy?.fullName || record.createdBy?.username || "-";
}

function getPaymentPercent(totalAmount: number, paidAmount: number) {
  if (!totalAmount || totalAmount <= 0) return 0;

  return Math.min(
    Math.round((Number(paidAmount || 0) / totalAmount) * 100),
    100,
  );
}

export default function PurchaseOverviewPageClient() {
  const { message } = App.useApp();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PurchaseOverviewResponse | null>(null);

  const summary = data?.summary;

  const payablePercent = useMemo(() => {
    const total = Number(summary?.totalPurchaseAmount || 0);
    const payable = Number(summary?.totalPayableAmount || 0);

    if (!total || total <= 0) return 0;

    return Math.min(Math.round((payable / total) * 100), 100);
  }, [summary]);

  const paidPercent = useMemo(() => {
    const total = Number(summary?.totalPurchaseAmount || 0);
    const paid = Number(summary?.totalPaidAmount || 0);

    if (!total || total <= 0) return 0;

    return Math.min(Math.round((paid / total) * 100), 100);
  }, [summary]);

  async function fetchOverview() {
    try {
      setLoading(true);

      const response = await fetch("/api/purchases/overview");
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch purchase overview");
      }

      setData(result.data);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error
          ? error.message
          : "Gagal mengambil purchase overview",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columns: ColumnsType<RecentPurchaseItem> = [
    {
      title: (
        <div className="leading-tight">
          <div>Document</div>
          <div className="text-xs font-normal text-slate-400">Invoice</div>
        </div>
      ),
      dataIndex: "documentNumber",
      width: 220,
      render: (value: string, record) => (
        <div>
          <div className="table-row-title font-semibold text-slate-800">
            {value}
          </div>

          <div className="mt-0.5 font-mono text-xs text-slate-400">
            {record.invoiceNumber || "-"}
          </div>
        </div>
      ),
    },
    {
      title: (
        <div className="leading-tight">
          <div>Date</div>
          <div className="text-xs font-normal text-slate-400">Due Date</div>
        </div>
      ),
      key: "dates",
      width: 160,
      render: (_, record) => (
        <div>
          <div className="font-medium text-slate-700">
            {formatDate(record.stockInDate)}
          </div>

          <div className="mt-0.5 text-xs text-slate-400">
            Due: {formatDate(record.dueDate)}
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
      key: "supplier",
      width: 240,
      render: (_, record) => (
        <div>
          <div className="font-medium text-slate-700">
            {record.supplier?.name || "-"}
          </div>

          <div className="mt-0.5 text-xs text-slate-400">
            {getCreatedName(record)}
          </div>
        </div>
      ),
    },
    {
      title: (
        <div className="leading-tight">
          <div>Amount</div>
          <div className="text-xs font-normal text-slate-400">
            Total / Paid / Remaining
          </div>
        </div>
      ),
      key: "amount",
      width: 260,
      align: "right",
      render: (_, record) => {
        const percent = getPaymentPercent(
          record.totalAmount,
          record.paidAmount,
        );

        return (
          <div className="text-right">
            <div className="font-semibold text-slate-900">
              {formatCurrency(record.totalAmount)}
            </div>

            <div className="mt-0.5 text-xs text-green-600">
              Paid: {formatCurrency(record.paidAmount)}
            </div>

            <div className="mt-0.5 text-xs font-semibold text-red-600">
              Remain: {formatCurrency(record.remainingAmount)}
            </div>

            <Progress
              percent={percent}
              size="small"
              showInfo={false}
              status={
                record.paymentStatus === "PAID"
                  ? "success"
                  : record.paymentStatus === "PARTIAL"
                    ? "active"
                    : "exception"
              }
              className="mt-1"
            />
          </div>
        );
      },
    },
    {
      title: (
        <div className="leading-tight">
          <div>Status</div>
          <div className="text-xs font-normal text-slate-400">Payment</div>
        </div>
      ),
      key: "status",
      width: 170,
      render: (_, record) => (
        <Space size={4} wrap>
          {getStatusTag(record.status)}
          {getPaymentStatusTag(record.paymentStatus)}
        </Space>
      ),
    },
    {
      title: (
        <div className="leading-tight">
          <div>Count</div>
          <div className="text-xs font-normal text-slate-400">Items / Pay</div>
        </div>
      ),
      key: "count",
      width: 130,
      render: (_, record) => (
        <div>
          <div className="font-medium text-slate-700">
            {record.itemCount} items
          </div>

          <div className="text-xs text-slate-400">
            {record.paymentCount} payments
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="text-sm">
      <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="m-0 text-lg font-bold text-slate-950">
            Purchase Overview
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Ringkasan pembelian, pembayaran supplier, dan utang berjalan.
          </p>
        </div>

        <Button
          size="small"
          icon={<ReloadOutlined />}
          className="dashboard-action-btn"
          onClick={fetchOverview}
          loading={loading}
        >
          Refresh
        </Button>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 xl:grid-cols-3">
        <div className="border border-slate-100 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Total Purchase
              </div>

              <div className="mt-2 text-2xl font-bold text-slate-950">
                {formatCurrency(summary?.totalPurchaseAmount || 0)}
              </div>

              <div className="mt-1 text-xs text-slate-400">
                {summary?.totalPostedDocuments || 0} posted documents
              </div>
            </div>

            <div className="flex h-9 w-9 items-center justify-center border border-slate-100 bg-slate-50 text-slate-600">
              <CheckCircleOutlined />
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
              <span>Paid progress</span>
              <span>{paidPercent}%</span>
            </div>

            <Progress percent={paidPercent} size="small" showInfo={false} />
          </div>
        </div>

        <div className="border border-slate-100 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Total Paid
              </div>

              <div className="mt-2 text-2xl font-bold text-green-600">
                {formatCurrency(summary?.totalPaidAmount || 0)}
              </div>

              <div className="mt-1 text-xs text-slate-400">
                {summary?.paidDocuments || 0} fully paid documents
              </div>
            </div>

            <div className="flex h-9 w-9 items-center justify-center border border-green-100 bg-green-50 text-green-600">
              <CheckCircleOutlined />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <div className="border border-slate-100 bg-slate-50 p-2">
              <div className="text-slate-400">Partial</div>
              <div className="mt-1 font-bold text-blue-600">
                {summary?.partialDocuments || 0}
              </div>
            </div>

            <div className="border border-slate-100 bg-slate-50 p-2">
              <div className="text-slate-400">Unpaid</div>
              <div className="mt-1 font-bold text-orange-600">
                {summary?.unpaidDocuments || 0}
              </div>
            </div>
          </div>
        </div>

        <div className="border border-slate-100 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Total Payable
              </div>

              <div className="mt-2 text-2xl font-bold text-red-600">
                {formatCurrency(summary?.totalPayableAmount || 0)}
              </div>

              <div className="mt-1 text-xs text-slate-400">
                {summary?.totalCancelledDocuments || 0} cancelled documents
              </div>
            </div>

            <div className="flex h-9 w-9 items-center justify-center border border-red-100 bg-red-50 text-red-600">
              <WarningOutlined />
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
              <span>Payable ratio</span>
              <span>{payablePercent}%</span>
            </div>

            <Progress
              percent={payablePercent}
              size="small"
              showInfo={false}
              status={payablePercent > 0 ? "exception" : "success"}
            />
          </div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="border border-slate-100 bg-white p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-slate-500">
                This Month Docs
              </div>

              <div className="mt-1 text-xl font-bold text-slate-900">
                {summary?.currentMonthDocuments || 0}
              </div>
            </div>

            <ClockCircleOutlined className="text-slate-400" />
          </div>
        </div>

        <div className="border border-slate-100 bg-white p-3">
          <div className="text-xs font-medium text-slate-500">
            This Month Purchase
          </div>

          <div className="mt-1 text-lg font-bold text-slate-900">
            {formatCurrency(summary?.currentMonthPurchaseAmount || 0)}
          </div>
        </div>

        <div className="border border-slate-100 bg-white p-3">
          <div className="text-xs font-medium text-slate-500">
            Payment Status
          </div>

          <div className="mt-2 flex flex-wrap gap-1">
            <Tag color="orange">UNPAID {summary?.unpaidDocuments || 0}</Tag>
            <Tag color="blue">PARTIAL {summary?.partialDocuments || 0}</Tag>
            <Tag color="green">PAID {summary?.paidDocuments || 0}</Tag>
          </div>
        </div>

        <div className="border border-slate-100 bg-white p-3">
          <div className="text-xs font-medium text-slate-500">
            Document Status
          </div>

          <div className="mt-2 flex flex-wrap gap-1">
            <Tag color="green">POSTED {summary?.totalPostedDocuments || 0}</Tag>
            <Tag color="red">
              CANCELLED {summary?.totalCancelledDocuments || 0}
            </Tag>
          </div>
        </div>
      </div>

      <div className="border border-slate-100 bg-white p-4">
        <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-base font-bold text-slate-900">
              Recent Purchase / Stock In
            </div>

            <div className="text-sm text-slate-500">
              Dokumen pembelian terakhir beserta status pembayaran.
            </div>
          </div>
        </div>

        <Table<RecentPurchaseItem>
          rowKey="id"
          size="small"
          className="data-table-sm"
          loading={loading}
          columns={columns}
          dataSource={data?.recentPurchases || []}
          pagination={false}
          scroll={{ x: 1300 }}
        />
      </div>
    </div>
  );
}
