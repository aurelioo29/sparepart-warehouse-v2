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

type AdjustmentDetail = {
  id: string;
  documentNumber: string;
  adjustmentDate: string;
  reason: string;
  status: string;
  notes?: string | null;
  createdAt: string;
  postedAt?: string | null;
  cancelledAt?: string | null;
  createdBy?: {
    id: string;
    fullName?: string | null;
    username?: string | null;
  } | null;
  items: {
    id: string;
    productId: string;
    warehouseId?: string | null;
    rackLocationId?: string | null;
    stockBefore: number;
    stockAfter: number;
    difference: number;
    notes?: string | null;
    product?: {
      id: string;
      sku: string;
      name: string;
      currentStock: number;
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
  }[];
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

type StockAdjustmentDetailPageClientProps = {
  id: string;
};

function getActionColor(value: string) {
  if (value === "CREATE") return "green";
  if (value === "UPDATE") return "blue";
  if (value === "DELETE") return "red";
  if (value === "CANCEL") return "orange";
  return "default";
}

export default function StockAdjustmentDetailPageClient({
  id,
}: StockAdjustmentDetailPageClientProps) {
  const router = useRouter();
  const { message } = App.useApp();
  const [modal, contextHolder] = Modal.useModal();

  const [adjustment, setAdjustment] = useState<AdjustmentDetail | null>(null);
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

  async function fetchAdjustment() {
    try {
      setLoading(true);

      const response = await fetch(`/api/stock-adjustments/${id}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch stock adjustment");
      }

      setAdjustment(result.data);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error
          ? error.message
          : "Gagal mengambil stock adjustment",
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
        `/api/stock-adjustments/${id}/changelogs?${query.toString()}`,
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
    void fetchAdjustment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function handleOpenChangelog() {
    setShowChangelog(true);

    void fetchChangelogs({
      page: 1,
      limit: changelogMeta.limit,
    });
  }

  function handleCancelAdjustment() {
    if (!adjustment) return;

    modal.confirm({
      title: "Cancel stock adjustment?",
      content: `Dokumen "${adjustment.documentNumber}" akan dibatalkan dan efek stok akan dibalik.`,
      okText: "Ya, Cancel Adjustment",
      cancelText: "Batal",
      okButtonProps: {
        danger: true,
      },
      centered: true,
      async onOk() {
        try {
          const response = await fetch(
            `/api/stock-adjustments/${adjustment.id}`,
            {
              method: "DELETE",
            },
          );

          const result = await response.json();

          if (!response.ok || !result.success) {
            throw new Error(result.message || "Failed to cancel adjustment");
          }

          message.success(
            result.message || "Adjustment cancelled successfully",
          );

          await fetchAdjustment();

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
              : "Gagal cancel stock adjustment",
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

  const itemColumns: ColumnsType<AdjustmentDetail["items"][number]> = [
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
      title: "Before",
      dataIndex: "stockBefore",
      width: 100,
    },
    {
      title: "After",
      dataIndex: "stockAfter",
      width: 100,
    },
    {
      title: "Difference",
      dataIndex: "difference",
      width: 120,
      render: (value: number) => (
        <Tag color={value > 0 ? "green" : value < 0 ? "red" : "default"}>
          {value > 0 ? `+${value}` : value}
        </Tag>
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
              Detail Stock Adjustment
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Lihat informasi dokumen, item adjustment, dan riwayat perubahan.
            </p>
          </div>

          <Space wrap size={8}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              className="dashboard-action-btn"
              onClick={() => router.push("/dashboard/stock-adjustments/create")}
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
              disabled={!adjustment || adjustment.status === "CANCELLED"}
              onClick={() =>
                router.push(`/dashboard/stock-adjustments/${id}/edit`)
              }
            >
              Edit
            </Button>

            <Button
              size="small"
              danger
              icon={<CloseCircleOutlined />}
              className="dashboard-action-btn"
              disabled={!adjustment || adjustment.status === "CANCELLED"}
              onClick={handleCancelAdjustment}
            >
              Cancel Adjustment
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
                children: adjustment?.documentNumber || "-",
              },
              {
                key: "adjustmentDate",
                label: "Adjustment Date",
                children: adjustment?.adjustmentDate
                  ? dayjs(adjustment.adjustmentDate).format("YYYY-MM-DD")
                  : "-",
              },
              {
                key: "reason",
                label: "Reason",
                children: adjustment?.reason ? (
                  <Tag>{adjustment.reason}</Tag>
                ) : (
                  "-"
                ),
              },
              {
                key: "status",
                label: "Status",
                children:
                  adjustment?.status === "POSTED" ? (
                    <Tag color="green">POSTED</Tag>
                  ) : (
                    <Tag color="red">CANCELLED</Tag>
                  ),
              },
              {
                key: "createdBy",
                label: "Created By",
                children:
                  adjustment?.createdBy?.fullName ||
                  adjustment?.createdBy?.username ||
                  "-",
              },
              {
                key: "notes",
                label: "Notes",
                children: adjustment?.notes || "-",
              },
              {
                key: "createdAt",
                label: "Created At",
                children: adjustment?.createdAt
                  ? dayjs(adjustment.createdAt).format("YYYY-MM-DD HH:mm:ss")
                  : "-",
              },
              {
                key: "postedAt",
                label: "Posted At",
                children: adjustment?.postedAt
                  ? dayjs(adjustment.postedAt).format("YYYY-MM-DD HH:mm:ss")
                  : "-",
              },
              {
                key: "cancelledAt",
                label: "Cancelled At",
                children: adjustment?.cancelledAt
                  ? dayjs(adjustment.cancelledAt).format("YYYY-MM-DD HH:mm:ss")
                  : "-",
              },
            ]}
          />
        )}

        <div className="mt-6 border-t border-slate-100 pt-5">
          <div className="mb-3">
            <div className="text-base font-bold text-slate-900">
              Adjustment Items
            </div>

            <div className="text-sm text-slate-500">
              List product yang terkena penyesuaian stock.
            </div>
          </div>

          <Table<AdjustmentDetail["items"][number]>
            rowKey="id"
            size="small"
            className="data-table-sm"
            columns={itemColumns}
            dataSource={adjustment?.items || []}
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
                  Semua perubahan yang berkaitan dengan stock adjustment ini.
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
