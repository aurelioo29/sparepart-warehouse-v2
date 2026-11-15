"use client";

import { useEffect, useMemo, useState } from "react";
import {
  App,
  Avatar,
  Button,
  Descriptions,
  Empty,
  Modal,
  Space,
  Spin,
  Table,
  Tag,
} from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  HistoryOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";

type PermissionItem = {
  permissionId: string;

  permission: {
    id: string;
    name: string;
    key: string;
    module: string;
  };
};

type AssignedUser = {
  id: string;
  fullName: string;
  username: string;
  email: string;
  isActive: boolean;
};

type RoleDetail = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;

  _count: {
    users: number;
    rolePermissions: number;
  };

  users: AssignedUser[];
  rolePermissions: PermissionItem[];
};

type ChangelogItem = {
  id: string;
  action: string;
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

type RoleDetailPageClientProps = {
  id: string;
};

function formatDateTime(value?: string | null) {
  return value ? dayjs(value).format("DD MMMM YYYY, HH:mm:ss") : "-";
}

function formatModule(value?: string | null) {
  return (value || "-")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function actionTag(action: string) {
  if (action === "CREATE") {
    return <Tag color="green">CREATE</Tag>;
  }

  if (action === "UPDATE") {
    return <Tag color="blue">UPDATE</Tag>;
  }

  if (action === "DELETE") {
    return <Tag color="red">DISABLE</Tag>;
  }

  return <Tag>{action}</Tag>;
}

export default function RoleDetailPageClient({
  id,
}: RoleDetailPageClientProps) {
  const router = useRouter();
  const { message } = App.useApp();
  const [modal, contextHolder] = Modal.useModal();

  const [role, setRole] = useState<RoleDetail | null>(null);

  const [loading, setLoading] = useState(false);

  const [showChangelog, setShowChangelog] = useState(false);

  const [changelogs, setChangelogs] = useState<ChangelogItem[]>([]);

  const [changelogLoading, setChangelogLoading] = useState(false);

  const [changelogMeta, setChangelogMeta] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  async function fetchRole() {
    try {
      setLoading(true);

      const response = await fetch(`/api/roles/${id}`, {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch role");
      }

      setRole(result.data);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal mengambil role",
      );
    } finally {
      setLoading(false);
    }
  }

  async function fetchChangelogs(params?: { page?: number; limit?: number }) {
    try {
      setChangelogLoading(true);

      const nextPage = params?.page ?? changelogMeta.page;

      const nextLimit = params?.limit ?? changelogMeta.limit;

      const query = new URLSearchParams({
        page: String(nextPage),
        limit: String(nextLimit),
      });

      const response = await fetch(
        `/api/roles/${id}/changelogs?${query.toString()}`,
        {
          cache: "no-store",
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch changelogs");
      }

      setChangelogs(result.data.items || []);
      setChangelogMeta(result.data.meta);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal mengambil changelog",
      );
    } finally {
      setChangelogLoading(false);
    }
  }

  function handleDisable() {
    if (!role) return;

    modal.confirm({
      centered: true,
      title: "Nonaktifkan role?",
      content: `Role "${role.name}" akan dinonaktifkan.`,
      okText: "Ya, Nonaktifkan",
      cancelText: "Batal",
      okButtonProps: {
        danger: true,
      },

      async onOk() {
        const response = await fetch(`/api/roles/${id}`, {
          method: "DELETE",
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Failed to disable role");
        }

        message.success(result.message || "Role disabled successfully");

        await fetchRole();

        if (showChangelog) {
          await fetchChangelogs({
            page: 1,
          });
        }
      },
    });
  }

  function showChangeDetail(changelog: ChangelogItem) {
    modal.info({
      centered: true,
      width: 960,
      title: `Changelog Detail - ${changelog.action}`,
      okText: "Close",

      content: (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <div className="mb-2 font-semibold text-slate-700">Old Data</div>

            <pre className="max-h-[440px] overflow-auto bg-slate-950 p-3 text-xs leading-5 text-slate-100">
              {changelog.oldData
                ? JSON.stringify(changelog.oldData, null, 2)
                : "Tidak ada data sebelumnya"}
            </pre>
          </div>

          <div>
            <div className="mb-2 font-semibold text-slate-700">New Data</div>

            <pre className="max-h-[440px] overflow-auto bg-slate-950 p-3 text-xs leading-5 text-slate-100">
              {changelog.newData
                ? JSON.stringify(changelog.newData, null, 2)
                : "Tidak ada data baru"}
            </pre>
          </div>
        </div>
      ),
    });
  }

  useEffect(() => {
    void fetchRole();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const permissionColumns = useMemo<ColumnsType<PermissionItem>>(
    () => [
      {
        title: "Module",
        width: 180,

        render: (_, record) => formatModule(record.permission.module),
      },
      {
        title: "Permission",

        render: (_, record) => (
          <div>
            <div className="font-medium">{record.permission.name}</div>

            <div className="text-xs text-slate-400">
              {record.permission.key}
            </div>
          </div>
        ),
      },
    ],
    [],
  );

  const userColumns = useMemo<ColumnsType<AssignedUser>>(
    () => [
      {
        title: "User",

        render: (_, user) => (
          <div className="flex items-center gap-2">
            <Avatar size={30} icon={<UserOutlined />} />

            <div>
              <div className="font-medium">{user.fullName}</div>

              <div className="text-xs text-slate-400">@{user.username}</div>
            </div>
          </div>
        ),
      },
      {
        title: "Email",
        dataIndex: "email",
      },
      {
        title: "Status",
        width: 110,
        align: "center",

        render: (_, user) =>
          user.isActive ? (
            <Tag color="green">ACTIVE</Tag>
          ) : (
            <Tag color="red">INACTIVE</Tag>
          ),
      },
    ],
    [],
  );

  const changelogColumns = useMemo<ColumnsType<ChangelogItem>>(
    () => [
      {
        title: "Action",
        dataIndex: "action",
        width: 110,
        render: actionTag,
      },
      {
        title: "Changed By",

        render: (_, item) =>
          item.user?.fullName || item.user?.username || "System",
      },
      {
        title: "Date",
        dataIndex: "createdAt",
        width: 200,
        render: formatDateTime,
      },
      {
        title: "Detail",
        width: 80,
        align: "center",

        render: (_, item) => (
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => showChangeDetail(item)}
          />
        ),
      },
    ],

    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <div className="text-sm">
      {contextHolder}

      <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="m-0 text-lg font-bold">Role Detail</h1>

            <p className="mt-1 text-slate-500">
              Informasi, permission, user, dan riwayat perubahan role.
            </p>
          </div>
        </div>

        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={() => void fetchRole()} />

          <Button
            icon={<HistoryOutlined />}
            onClick={() => {
              const next = !showChangelog;

              setShowChangelog(next);

              if (next && changelogs.length === 0) {
                void fetchChangelogs({
                  page: 1,
                });
              }
            }}
          >
            {showChangelog ? "Hide Changelog" : "View Changelog"}
          </Button>

          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => router.push(`/dashboard/roles/${id}/edit`)}
          >
            Edit
          </Button>

          <Button
            danger
            icon={<DeleteOutlined />}
            disabled={
              !role?.isActive ||
              role.slug === "superadmin" ||
              role._count.users > 0
            }
            onClick={handleDisable}
          >
            Nonaktifkan
          </Button>
        </Space>
      </div>

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <Spin />
        </div>
      ) : role ? (
        <div className="space-y-5">
          <div className="border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center bg-blue-50 text-2xl text-blue-600">
                <SafetyCertificateOutlined />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="m-0 text-xl font-bold">{role.name}</h2>

                  {role.isActive ? (
                    <Tag color="green">ACTIVE</Tag>
                  ) : (
                    <Tag color="red">INACTIVE</Tag>
                  )}
                </div>

                <div className="mt-1 text-slate-500">{role.slug}</div>

                <div className="mt-2 flex gap-2">
                  <Tag>{role._count.users} users</Tag>

                  <Tag>{role._count.rolePermissions} permissions</Tag>
                </div>
              </div>
            </div>
          </div>

          <div className="border border-slate-200 bg-white p-4">
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Name">{role.name}</Descriptions.Item>

              <Descriptions.Item label="Slug">{role.slug}</Descriptions.Item>

              <Descriptions.Item label="Status">
                {role.isActive ? "Active" : "Inactive"}
              </Descriptions.Item>

              <Descriptions.Item label="Users">
                {role._count.users}
              </Descriptions.Item>

              <Descriptions.Item label="Created At">
                {formatDateTime(role.createdAt)}
              </Descriptions.Item>

              <Descriptions.Item label="Updated At">
                {formatDateTime(role.updatedAt)}
              </Descriptions.Item>

              <Descriptions.Item label="Description">
                {role.description || "-"}
              </Descriptions.Item>

              <Descriptions.Item label="Role ID">{role.id}</Descriptions.Item>
            </Descriptions>
          </div>

          <div className="border border-slate-200 bg-white">
            <div className="border-b p-3 font-bold">Permissions</div>

            <Table
              rowKey="permissionId"
              size="small"
              columns={permissionColumns}
              dataSource={role.rolePermissions}
              pagination={false}
            />
          </div>

          <div className="border border-slate-200 bg-white">
            <div className="border-b p-3 font-bold">Assigned Users</div>

            {role.users.length ? (
              <Table
                rowKey="id"
                size="small"
                columns={userColumns}
                dataSource={role.users}
                pagination={false}
              />
            ) : (
              <Empty className="py-6" description="Belum ada user" />
            )}
          </div>

          {showChangelog && (
            <div className="border border-slate-200 bg-white">
              <div className="border-b p-3 font-bold">Role Changelog</div>

              <Table
                rowKey="id"
                size="small"
                loading={changelogLoading}
                columns={changelogColumns}
                dataSource={changelogs}
                pagination={{
                  current: changelogMeta.page,
                  pageSize: changelogMeta.limit,
                  total: changelogMeta.total,
                  showSizeChanger: true,
                }}
                onChange={(pagination: TablePaginationConfig) => {
                  void fetchChangelogs({
                    page: pagination.current || 1,
                    limit: pagination.pageSize || 10,
                  });
                }}
              />
            </div>
          )}
        </div>
      ) : (
        <Empty description="Role tidak ditemukan" />
      )}
    </div>
  );
}
