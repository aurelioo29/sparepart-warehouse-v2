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
  Tooltip,
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

// ============================================================
// TYPES
// ============================================================

type UserPermissionItem = {
  id: string;
  permissionId: string;
  effect: "ALLOW" | "DENY";

  permission: {
    id: string;
    name: string;
    key: string;
    module: string;
  };
};

type UserDetail = {
  id: string;
  roleId: string;
  fullName: string;
  username: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;

  role?: {
    id: string;
    name: string;
    slug: string;
  } | null;

  customPermissions: UserPermissionItem[];
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

type ChangelogResponse = {
  items: ChangelogItem[];

  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type UserDetailPageClientProps = {
  id: string;
};

// ============================================================
// HELPERS
// ============================================================

function formatDateTime(value?: string | null) {
  if (!value) return "-";

  return dayjs(value).format("DD MMMM YYYY, HH:mm:ss");
}

function getInitials(fullName?: string | null) {
  if (!fullName) return "U";

  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

function formatModule(value?: string | null) {
  if (!value) return "-";

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getActionTag(action?: string | null) {
  switch (action) {
    case "CREATE":
      return <Tag color="green">CREATE</Tag>;

    case "UPDATE":
      return <Tag color="blue">UPDATE</Tag>;

    case "DELETE":
      return <Tag color="red">DISABLE</Tag>;

    default:
      return <Tag>{action || "UNKNOWN"}</Tag>;
  }
}

function hasJsonData(value: unknown) {
  return value !== null && value !== undefined;
}

function formatJsonData(value: unknown) {
  if (!hasJsonData(value)) {
    return "Tidak ada data";
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

// ============================================================
// COMPONENT
// ============================================================

export default function UserDetailPageClient({
  id,
}: UserDetailPageClientProps) {
  const router = useRouter();
  const { message } = App.useApp();
  const [modal, contextHolder] = Modal.useModal();

  // ============================================================
  // USER STATE
  // ============================================================

  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(false);

  // ============================================================
  // CHANGELOG STATE
  // ============================================================

  const [changelogs, setChangelogs] = useState<ChangelogItem[]>([]);

  const [changelogLoading, setChangelogLoading] = useState(false);

  const [showChangelog, setShowChangelog] = useState(false);

  const [changelogMeta, setChangelogMeta] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  // ============================================================
  // FETCH USER
  // ============================================================

  async function fetchUser() {
    try {
      setLoading(true);

      const response = await fetch(`/api/users/${id}`, {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch user detail");
      }

      setUser({
        ...result.data,
        customPermissions: result.data.customPermissions || [],
      });
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal mengambil detail user",
      );
    } finally {
      setLoading(false);
    }
  }

  // ============================================================
  // FETCH CHANGELOGS
  // ============================================================

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
        `/api/users/${id}/changelogs?${query.toString()}`,
        {
          cache: "no-store",
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch user changelogs");
      }

      const data = result.data as ChangelogResponse;

      setChangelogs(data.items || []);
      setChangelogMeta(data.meta);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error
          ? error.message
          : "Gagal mengambil changelog user",
      );
    } finally {
      setChangelogLoading(false);
    }
  }

  // ============================================================
  // DISABLE USER
  // ============================================================

  function handleDisable() {
    if (!user) return;

    modal.confirm({
      centered: true,
      title: "Nonaktifkan user?",
      content: (
        <div className="text-sm text-slate-600">
          User <strong>{user.fullName}</strong> akan dinonaktifkan dan tidak
          dapat login.
        </div>
      ),
      okText: "Ya, Nonaktifkan",
      cancelText: "Batal",
      okButtonProps: {
        danger: true,
      },

      async onOk() {
        try {
          const response = await fetch(`/api/users/${id}`, {
            method: "DELETE",
          });

          const result = await response.json();

          if (!response.ok || !result.success) {
            throw new Error(result.message || "Failed to disable user");
          }

          message.success(result.message || "User disabled successfully");

          await fetchUser();

          if (showChangelog) {
            await fetchChangelogs({
              page: 1,
              limit: changelogMeta.limit,
            });
          }
        } catch (error) {
          console.error(error);

          message.error(
            error instanceof Error ? error.message : "Gagal menonaktifkan user",
          );

          throw error;
        }
      },
    });
  }

  // ============================================================
  // SHOW CHANGE DETAIL
  // ============================================================

  function showChangeDetail(changelog: ChangelogItem) {
    modal.info({
      centered: true,
      width: 960,
      title: (
        <div className="flex items-center gap-2">
          <span>Changelog Detail</span>

          {getActionTag(changelog.action)}
        </div>
      ),
      okText: "Close",

      content: (
        <div className="mt-4">
          <div className="mb-4 grid grid-cols-1 gap-3 border border-slate-200 bg-slate-50 p-3 text-sm md:grid-cols-2">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Changed By
              </div>

              <div className="mt-1 font-medium text-slate-800">
                {changelog.user?.fullName ||
                  changelog.user?.username ||
                  "System"}
              </div>

              <div className="text-xs text-slate-500">
                {changelog.user?.email || "-"}
              </div>
            </div>

            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Changed At
              </div>

              <div className="mt-1 font-medium text-slate-800">
                {formatDateTime(changelog.createdAt)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <div className="mb-2 text-sm font-semibold text-slate-700">
                Old Data
              </div>

              <pre className="max-h-[440px] overflow-auto border border-slate-200 bg-slate-950 p-3 text-xs leading-5 text-slate-100">
                {hasJsonData(changelog.oldData)
                  ? formatJsonData(changelog.oldData)
                  : "Tidak ada data sebelumnya"}
              </pre>
            </div>

            <div>
              <div className="mb-2 text-sm font-semibold text-slate-700">
                New Data
              </div>

              <pre className="max-h-[440px] overflow-auto border border-slate-200 bg-slate-950 p-3 text-xs leading-5 text-slate-100">
                {hasJsonData(changelog.newData)
                  ? formatJsonData(changelog.newData)
                  : "Tidak ada data baru"}
              </pre>
            </div>
          </div>
        </div>
      ),
    });
  }

  // ============================================================
  // CHANGELOG PAGINATION
  // ============================================================

  function handleChangelogTableChange(pagination: TablePaginationConfig) {
    const nextPage = pagination.current || 1;
    const nextLimit = pagination.pageSize || 10;

    setChangelogMeta((current) => ({
      ...current,
      page: nextPage,
      limit: nextLimit,
    }));

    void fetchChangelogs({
      page: nextPage,
      limit: nextLimit,
    });
  }

  // ============================================================
  // TOGGLE CHANGELOG
  // ============================================================

  function handleToggleChangelog() {
    const nextShowChangelog = !showChangelog;

    setShowChangelog(nextShowChangelog);

    if (nextShowChangelog && changelogs.length === 0) {
      void fetchChangelogs({
        page: 1,
        limit: 10,
      });
    }
  }

  // ============================================================
  // INITIAL FETCH
  // ============================================================

  useEffect(() => {
    void fetchUser();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ============================================================
  // CUSTOM PERMISSION COLUMNS
  // ============================================================

  const permissionColumns = useMemo<ColumnsType<UserPermissionItem>>(
    () => [
      {
        title: "Module",
        key: "module",
        width: 170,

        render: (_, record) => (
          <span className="font-medium text-slate-700">
            {formatModule(record.permission?.module)}
          </span>
        ),
      },
      {
        title: "Permission",
        key: "permission",

        render: (_, record) => (
          <div>
            <div className="font-medium text-slate-800">
              {record.permission?.name || "-"}
            </div>

            <div className="mt-0.5 text-xs text-slate-400">
              {record.permission?.key || "-"}
            </div>
          </div>
        ),
      },
      {
        title: "Effect",
        dataIndex: "effect",
        key: "effect",
        width: 110,
        align: "center",

        render: (effect: "ALLOW" | "DENY") => (
          <Tag color={effect === "ALLOW" ? "green" : "red"}>{effect}</Tag>
        ),
      },
    ],
    [],
  );

  // ============================================================
  // CHANGELOG COLUMNS
  // ============================================================

  const changelogColumns = useMemo<ColumnsType<ChangelogItem>>(
    () => [
      {
        title: "Action",
        dataIndex: "action",
        key: "action",
        width: 115,

        render: (action: string) => getActionTag(action),
      },
      {
        title: "Changed By",
        key: "changedBy",
        width: 240,

        render: (_, record) => (
          <div className="flex items-center gap-2">
            <Avatar
              size={30}
              icon={<UserOutlined />}
              className="shrink-0 !bg-slate-100 !text-slate-600"
            />

            <div className="min-w-0">
              <div className="truncate font-medium text-slate-800">
                {record.user?.fullName || record.user?.username || "System"}
              </div>

              <div className="truncate text-xs text-slate-400">
                {record.user?.email || "-"}
              </div>
            </div>
          </div>
        ),
      },
      {
        title: "Date",
        dataIndex: "createdAt",
        key: "createdAt",
        width: 210,

        render: (value: string) => (
          <span className="text-sm text-slate-600">
            {formatDateTime(value)}
          </span>
        ),
      },
      {
        title: "Detail",
        key: "detail",
        width: 80,
        align: "center",

        render: (_, record) => (
          <Tooltip title="View Changes">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => showChangeDetail(record)}
            />
          </Tooltip>
        ),
      },
    ],

    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="text-sm">
      {contextHolder}

      {/* PAGE HEADER */}
      <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Tooltip title="Back to Users">
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => router.push("/dashboard/users")}
            />
          </Tooltip>

          <div>
            <h1 className="m-0 text-lg font-bold text-slate-950">
              User Detail
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Detail akun, role, status, permission, dan riwayat perubahan user.
            </p>
          </div>
        </div>

        <Space wrap>
          <Tooltip title="Refresh">
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                void fetchUser();

                if (showChangelog) {
                  void fetchChangelogs();
                }
              }}
            />
          </Tooltip>

          <Button icon={<HistoryOutlined />} onClick={handleToggleChangelog}>
            {showChangelog ? "Hide Changelog" : "View Changelog"}
          </Button>

          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => router.push(`/dashboard/users/${id}/edit`)}
          >
            Edit
          </Button>

          <Button
            danger
            icon={<DeleteOutlined />}
            disabled={!user?.isActive}
            onClick={handleDisable}
          >
            Nonaktifkan
          </Button>
        </Space>
      </div>

      {/* LOADING */}
      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <Spin />
        </div>
      ) : user ? (
        <div className="space-y-5">
          {/* PROFILE SUMMARY */}
          <div className="border border-slate-200 bg-white p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Avatar
                size={72}
                src={user.avatarUrl || undefined}
                icon={!user.avatarUrl ? <UserOutlined /> : undefined}
                className="shrink-0 !bg-blue-50 !text-xl !font-bold !text-blue-600"
              >
                {!user.avatarUrl ? getInitials(user.fullName) : undefined}
              </Avatar>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="m-0 text-xl font-bold text-slate-900">
                    {user.fullName}
                  </h2>

                  {user.isActive ? (
                    <Tag color="green">ACTIVE</Tag>
                  ) : (
                    <Tag color="red">INACTIVE</Tag>
                  )}
                </div>

                <div className="mt-1 text-sm text-slate-500">
                  @{user.username}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Tag color="blue" icon={<SafetyCertificateOutlined />}>
                    {user.role?.name || "No Role"}
                  </Tag>

                  <span className="text-sm text-slate-500">{user.email}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ACCOUNT INFORMATION */}
          <div className="border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="m-0 text-base font-bold text-slate-900">
                Account Information
              </h2>

              <p className="mb-0 mt-1 text-xs text-slate-500">
                Informasi utama dan aktivitas akun.
              </p>
            </div>

            <div className="p-4">
              <Descriptions
                bordered
                size="small"
                column={2}
                className="user-detail-descriptions"
              >
                <Descriptions.Item label="Full Name">
                  {user.fullName}
                </Descriptions.Item>

                <Descriptions.Item label="Username">
                  @{user.username}
                </Descriptions.Item>

                <Descriptions.Item label="Email">
                  {user.email}
                </Descriptions.Item>

                <Descriptions.Item label="Phone">
                  {user.phone || "-"}
                </Descriptions.Item>

                <Descriptions.Item label="Role">
                  {user.role?.name || "-"}
                </Descriptions.Item>

                <Descriptions.Item label="Status">
                  {user.isActive ? (
                    <Tag color="green">ACTIVE</Tag>
                  ) : (
                    <Tag color="red">INACTIVE</Tag>
                  )}
                </Descriptions.Item>

                <Descriptions.Item label="Last Login">
                  {formatDateTime(user.lastLoginAt)}
                </Descriptions.Item>

                <Descriptions.Item label="Created At">
                  {formatDateTime(user.createdAt)}
                </Descriptions.Item>

                <Descriptions.Item label="Updated At">
                  {formatDateTime(user.updatedAt)}
                </Descriptions.Item>

                <Descriptions.Item label="User ID">
                  <span className="break-all font-mono text-xs text-slate-500">
                    {user.id}
                  </span>
                </Descriptions.Item>
              </Descriptions>
            </div>
          </div>

          {/* CUSTOM PERMISSION OVERRIDES */}
          <div className="border border-slate-200 bg-white">
            <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="m-0 text-base font-bold text-slate-900">
                  Custom Permission Overrides
                </h2>

                <p className="mb-0 mt-1 text-xs text-slate-500">
                  Permission tambahan atau pencabutan akses di luar role utama.
                </p>
              </div>

              <Tag>{user.customPermissions.length} overrides</Tag>
            </div>

            {user.customPermissions.length > 0 ? (
              <Table<UserPermissionItem>
                rowKey={(record) => record.id || record.permissionId}
                size="small"
                columns={permissionColumns}
                dataSource={user.customPermissions}
                pagination={false}
                scroll={{
                  x: 600,
                }}
              />
            ) : (
              <Empty
                className="py-6"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Tidak ada custom permission override"
              />
            )}
          </div>

          {/* USER CHANGELOG */}
          {showChangelog && (
            <div className="border border-slate-200 bg-white">
              <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="m-0 text-base font-bold text-slate-900">
                    User Changelog
                  </h2>

                  <p className="mb-0 mt-1 text-xs text-slate-500">
                    Riwayat pembuatan, perubahan, dan penonaktifan akun.
                  </p>
                </div>

                <Tag>{changelogMeta.total} changes</Tag>
              </div>

              <Table<ChangelogItem>
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
                  pageSizeOptions: [10, 25, 50],
                  showTotal: (total, range) =>
                    `showing ${range[0]} to ${range[1]} of ${total} changes`,
                }}
                onChange={handleChangelogTableChange}
                scroll={{
                  x: 650,
                }}
              />
            </div>
          )}
        </div>
      ) : (
        <Empty className="py-16" description="User tidak ditemukan" />
      )}
    </div>
  );
}
