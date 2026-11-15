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
  HistoryOutlined,
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";

type WarehouseItem = {
  id: string;
  name: string;
  code: string;
  address?: string | null;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    rackLocations: number;
  };
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
  warehouse: {
    id: string;
    name: string;
    code: string;
  };
  items: ChangelogItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type WarehouseDetailPageClientProps = {
  id: string;
};

function getActionColor(value: string) {
  if (value === "CREATE") return "green";
  if (value === "UPDATE") return "blue";
  if (value === "INACTIVE") return "orange";
  return "red";
}

export default function WarehouseDetailPageClient({
  id,
}: WarehouseDetailPageClientProps) {
  const router = useRouter();
  const { message } = App.useApp();
  const [modal, contextHolder] = Modal.useModal();

  const [warehouse, setWarehouse] = useState<WarehouseItem | null>(null);
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

  async function fetchWarehouse() {
    try {
      setLoading(true);

      const response = await fetch(`/api/warehouses/${id}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch warehouse");
      }

      setWarehouse(result.data);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal mengambil warehouse",
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
        `/api/warehouses/${id}/changelogs?${query.toString()}`,
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
    void fetchWarehouse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function handleOpenChangelog() {
    setShowChangelog(true);

    void fetchChangelogs({
      page: 1,
      limit: changelogMeta.limit,
    });
  }

  function handleInactive() {
    if (!warehouse) return;

    modal.confirm({
      title: "Inactive warehouse?",
      content: `Warehouse "${warehouse.name}" akan dinonaktifkan. Data tetap ada dan bisa diaktifkan lagi lewat edit.`,
      okText: "Ya, Inactive",
      cancelText: "Batal",
      okButtonProps: {
        danger: true,
      },
      centered: true,
      async onOk() {
        try {
          const response = await fetch(`/api/warehouses/${warehouse.id}`, {
            method: "DELETE",
          });

          const result = await response.json();

          if (!response.ok || !result.success) {
            throw new Error(result.message || "Failed to inactive warehouse");
          }

          message.success(
            result.message || "Warehouse inactivated successfully",
          );

          await fetchWarehouse();

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
              : "Gagal menonaktifkan warehouse",
          );
        }
      },
    });
  }

  function handlePermanentDelete() {
    if (!warehouse) return;

    modal.confirm({
      title: "Delete permanent warehouse?",
      content: `Warehouse "${warehouse.name}" akan dihapus permanent dari database. Aksi ini tidak bisa dibatalkan.`,
      okText: "Ya, Delete Permanent",
      cancelText: "Batal",
      okButtonProps: {
        danger: true,
      },
      centered: true,
      async onOk() {
        try {
          const response = await fetch(
            `/api/warehouses/${warehouse.id}?permanent=true`,
            {
              method: "DELETE",
            },
          );

          const result = await response.json();

          if (!response.ok || !result.success) {
            throw new Error(
              result.message || "Failed to permanently delete warehouse",
            );
          }

          message.success(
            result.message || "Warehouse permanently deleted successfully",
          );

          router.push("/dashboard/warehouses");
          router.refresh();
        } catch (error) {
          console.error(error);

          message.error(
            error instanceof Error
              ? error.message
              : "Gagal menghapus permanent warehouse",
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
              Detail Warehouse
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Lihat informasi warehouse, lokasi rack, status, dan riwayat
              perubahan.
            </p>
          </div>

          <Space wrap size={8}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              className="dashboard-action-btn"
              onClick={() => router.push("/dashboard/warehouses/create")}
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
              disabled={!warehouse}
              onClick={() => router.push(`/dashboard/warehouses/${id}/edit`)}
            >
              Edit
            </Button>

            <Button
              size="small"
              danger
              icon={<StopOutlined />}
              className="dashboard-action-btn"
              disabled={!warehouse?.isActive}
              onClick={handleInactive}
            >
              Inactive
            </Button>

            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              className="dashboard-action-btn"
              disabled={!warehouse}
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
        ) : (
          <Descriptions
            bordered
            size="small"
            column={1}
            className="detail-descriptions"
            items={[
              {
                key: "name",
                label: "Warehouse Name",
                children: warehouse?.name || "-",
              },
              {
                key: "code",
                label: "Warehouse Code",
                children: warehouse?.code || "-",
              },
              {
                key: "rackLocations",
                label: "Rack Locations",
                children: warehouse?._count?.rackLocations ?? 0,
              },
              {
                key: "address",
                label: "Address",
                children: warehouse?.address || "-",
              },
              {
                key: "description",
                label: "Description",
                children: warehouse?.description || "-",
              },
              {
                key: "status",
                label: "Status",
                children: warehouse?.isActive ? (
                  <Tag color="green">Active</Tag>
                ) : (
                  <Tag color="red">Inactive</Tag>
                ),
              },
              {
                key: "createdAt",
                label: "Created at",
                children: warehouse?.createdAt
                  ? dayjs(warehouse.createdAt).format("YYYY-MM-DD HH:mm:ss")
                  : "-",
              },
              {
                key: "updatedAt",
                label: "Updated at",
                children: warehouse?.updatedAt
                  ? dayjs(warehouse.updatedAt).format("YYYY-MM-DD HH:mm:ss")
                  : "-",
              },
            ]}
          />
        )}

        {showChangelog ? (
          <div className="mt-6 border-t border-slate-100 pt-5">
            <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-base font-bold text-slate-900">
                  Changelogs
                </div>

                <div className="text-sm text-slate-500">
                  Semua perubahan yang berkaitan dengan warehouse ini.
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
