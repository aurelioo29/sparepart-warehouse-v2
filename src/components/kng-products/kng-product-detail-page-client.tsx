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

type KngProductItem = {
  id: string;
  jenis: string;
  partNumber: string;
  hargaJkt: string | number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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
  product: {
    id: string;
    jenis: string;
    partNumber: string;
  };
  items: ChangelogItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type KngProductDetailPageClientProps = {
  id: string;
};

function getActionColor(value: string) {
  if (value === "CREATE") return "green";
  if (value === "UPDATE") return "blue";
  if (value === "INACTIVE") return "orange";
  return "red";
}

function formatRupiah(value?: string | number | null) {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function KngProductDetailPageClient({
  id,
}: KngProductDetailPageClientProps) {
  const router = useRouter();
  const { message } = App.useApp();
  const [modal, contextHolder] = Modal.useModal();

  const [product, setProduct] = useState<KngProductItem | null>(null);
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

  async function fetchProduct() {
    try {
      setLoading(true);

      const response = await fetch(`/api/kng-products/${id}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch KNG product");
      }

      setProduct(result.data);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal mengambil product KNG",
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
        `/api/kng-products/${id}/changelogs?${query.toString()}`,
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
    void fetchProduct();
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
    if (!product) return;

    modal.confirm({
      title: "Inactive product KNG?",
      content: `Product "${product.partNumber}" akan dinonaktifkan. Data tetap ada dan bisa diaktifkan lagi lewat edit.`,
      okText: "Ya, Inactive",
      cancelText: "Batal",
      okButtonProps: {
        danger: true,
      },
      centered: true,
      async onOk() {
        try {
          const response = await fetch(`/api/kng-products/${product.id}`, {
            method: "DELETE",
          });

          const result = await response.json();

          if (!response.ok || !result.success) {
            throw new Error(result.message || "Failed to inactive KNG product");
          }

          message.success(
            result.message || "KNG product inactivated successfully",
          );

          await fetchProduct();

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
              : "Gagal menonaktifkan product KNG",
          );
        }
      },
    });
  }

  function handlePermanentDelete() {
    if (!product) return;

    modal.confirm({
      title: "Delete permanent product KNG?",
      content: `Product "${product.partNumber}" akan dihapus permanent dari database. Aksi ini tidak bisa dibatalkan.`,
      okText: "Ya, Delete Permanent",
      cancelText: "Batal",
      okButtonProps: {
        danger: true,
      },
      centered: true,
      async onOk() {
        try {
          const response = await fetch(
            `/api/kng-products/${product.id}?permanent=true`,
            {
              method: "DELETE",
            },
          );

          const result = await response.json();

          if (!response.ok || !result.success) {
            throw new Error(
              result.message || "Failed to permanently delete KNG product",
            );
          }

          message.success(
            result.message || "KNG product permanently deleted successfully",
          );

          router.push("/dashboard/kng-products");
          router.refresh();
        } catch (error) {
          console.error(error);

          message.error(
            error instanceof Error
              ? error.message
              : "Gagal menghapus permanent product KNG",
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
              Detail Product KNG
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Lihat informasi master product KNG, status, dan riwayat perubahan.
            </p>
          </div>

          <Space wrap size={8}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              className="dashboard-action-btn"
              onClick={() => router.push("/dashboard/kng-products/create")}
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
              disabled={!product}
              onClick={() => router.push(`/dashboard/kng-products/${id}/edit`)}
            >
              Edit
            </Button>

            <Button
              size="small"
              danger
              icon={<StopOutlined />}
              className="dashboard-action-btn"
              disabled={!product?.isActive}
              onClick={handleInactive}
            >
              Inactive
            </Button>

            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              className="dashboard-action-btn"
              disabled={!product}
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
                key: "jenis",
                label: "Jenis",
                children: product?.jenis || "-",
              },
              {
                key: "partNumber",
                label: "Part Number",
                children: product?.partNumber || "-",
              },
              {
                key: "hargaJkt",
                label: "Harga JKT",
                children: formatRupiah(product?.hargaJkt),
              },
              {
                key: "status",
                label: "Status",
                children: product?.isActive ? (
                  <Tag color="green">Active</Tag>
                ) : (
                  <Tag color="red">Inactive</Tag>
                ),
              },
              {
                key: "createdAt",
                label: "Created at",
                children: product?.createdAt
                  ? dayjs(product.createdAt).format("YYYY-MM-DD HH:mm:ss")
                  : "-",
              },
              {
                key: "updatedAt",
                label: "Updated at",
                children: product?.updatedAt
                  ? dayjs(product.updatedAt).format("YYYY-MM-DD HH:mm:ss")
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
                  Semua perubahan yang berkaitan dengan product KNG ini.
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
