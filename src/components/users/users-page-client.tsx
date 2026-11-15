"use client";

import { useEffect, useMemo, useState } from "react";
import {
  App,
  Avatar,
  Button,
  Input,
  Modal,
  Select,
  Space,
  Tag,
  Tooltip,
} from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import type { SorterResult } from "antd/es/table/interface";
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  UserOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";

import DataFilterCard from "@/components/shared/data-filter-card";
import DataTable from "@/components/shared/data-table";

type RoleOption = {
  id: string;
  name: string;
  slug: string;
};

type UserItem = {
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

  role?: RoleOption | null;
};

type UsersResponse = {
  items: UserItem[];

  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    sortBy?: string;
    sortOrder?: string;
  };
};

function formatDateTime(value?: string | null) {
  if (!value) return "-";

  return dayjs(value).format("DD MMM YYYY, HH:mm");
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

export default function UsersPageClient() {
  const router = useRouter();
  const { message } = App.useApp();
  const [modal, contextHolder] = Modal.useModal();

  const [users, setUsers] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);

  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [roleId, setRoleId] = useState("");
  const [isActive, setIsActive] = useState("");

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [meta, setMeta] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  async function fetchRoles() {
    try {
      const response = await fetch("/api/roles/options");
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch roles");
      }

      setRoles(result.data || []);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal mengambil data role",
      );
    }
  }

  async function fetchUsers(params?: {
    page?: number;
    limit?: number;
    search?: string;
    roleId?: string;
    isActive?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }) {
    try {
      setLoading(true);

      const nextPage = params?.page ?? page;
      const nextLimit = params?.limit ?? limit;
      const nextSearch = params?.search ?? search;
      const nextRoleId = params?.roleId ?? roleId;
      const nextIsActive = params?.isActive ?? isActive;
      const nextSortBy = params?.sortBy ?? sortBy;
      const nextSortOrder = params?.sortOrder ?? sortOrder;

      const query = new URLSearchParams({
        page: String(nextPage),
        limit: String(nextLimit),
        search: nextSearch,
        roleId: nextRoleId,
        isActive: nextIsActive,
        sortBy: nextSortBy,
        sortOrder: nextSortOrder,
      });

      const response = await fetch(`/api/users?${query.toString()}`);

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch users");
      }

      const data = result.data as UsersResponse;

      setUsers(data.items || []);
      setMeta(data.meta);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal mengambil data users",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleApplyFilter() {
    setPage(1);

    void fetchUsers({
      page: 1,
      search,
      roleId,
      isActive,
    });
  }

  function handleResetFilter() {
    setSearch("");
    setRoleId("");
    setIsActive("");
    setPage(1);

    void fetchUsers({
      page: 1,
      search: "",
      roleId: "",
      isActive: "",
    });
  }

  function handleDisable(user: UserItem) {
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
          const response = await fetch(`/api/users/${user.id}`, {
            method: "DELETE",
          });

          const result = await response.json();

          if (!response.ok || !result.success) {
            throw new Error(result.message || "Failed to disable user");
          }

          message.success(result.message || "User disabled successfully");

          await fetchUsers();
        } catch (error) {
          console.error(error);

          message.error(
            error instanceof Error ? error.message : "Gagal menonaktifkan user",
          );
        }
      },
    });
  }

  function handleTableChange(
    pagination: TablePaginationConfig,
    _filters: Record<string, unknown>,
    sorter: SorterResult<UserItem> | SorterResult<UserItem>[],
  ) {
    const currentSorter = Array.isArray(sorter) ? sorter[0] : sorter;

    const nextPage = pagination.current || 1;
    const nextLimit = pagination.pageSize || 10;

    setPage(nextPage);
    setLimit(nextLimit);

    if (currentSorter?.field && currentSorter.order) {
      setSortBy(String(currentSorter.field));

      setSortOrder(currentSorter.order === "ascend" ? "asc" : "desc");

      return;
    }

    setSortBy("createdAt");
    setSortOrder("desc");
  }

  useEffect(() => {
    void fetchRoles();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void fetchUsers({
      page,
      limit,
      sortBy,
      sortOrder,
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, sortBy, sortOrder]);

  const columns: ColumnsType<UserItem> = useMemo(
    () => [
      {
        title: "User",
        dataIndex: "fullName",
        key: "fullName",
        width: 250,
        sorter: true,
        sortOrder:
          sortBy === "fullName"
            ? sortOrder === "asc"
              ? "ascend"
              : "descend"
            : null,
        render: (_value: string, record) => (
          <button
            type="button"
            className="flex items-center gap-3 text-left"
            onClick={() => router.push(`/dashboard/users/${record.id}`)}
          >
            <Avatar
              size={34}
              src={record.avatarUrl || undefined}
              icon={!record.avatarUrl ? <UserOutlined /> : undefined}
              className="shrink-0 !bg-blue-50 !text-blue-600"
            >
              {!record.avatarUrl ? getInitials(record.fullName) : undefined}
            </Avatar>

            <div className="min-w-0">
              <div className="truncate font-semibold text-blue-600 hover:underline">
                {record.fullName}
              </div>

              <div className="truncate text-xs text-slate-400">
                @{record.username}
              </div>
            </div>
          </button>
        ),
      },
      {
        title: "Contact",
        key: "contact",
        width: 260,
        render: (_, record) => (
          <div>
            <div className="text-sm text-slate-700">{record.email}</div>

            <div className="mt-0.5 text-xs text-slate-400">
              {record.phone || "No phone number"}
            </div>
          </div>
        ),
      },
      {
        title: "Role",
        dataIndex: "role",
        key: "role",
        width: 150,
        sorter: true,
        sortOrder:
          sortBy === "role"
            ? sortOrder === "asc"
              ? "ascend"
              : "descend"
            : null,
        render: (_, record) => (
          <Tag color="blue">{record.role?.name || "No Role"}</Tag>
        ),
      },
      {
        title: "Last Login",
        dataIndex: "lastLoginAt",
        key: "lastLoginAt",
        width: 180,
        sorter: true,
        sortOrder:
          sortBy === "lastLoginAt"
            ? sortOrder === "asc"
              ? "ascend"
              : "descend"
            : null,
        render: (value?: string | null) => (
          <span className="text-sm text-slate-600">
            {formatDateTime(value)}
          </span>
        ),
      },
      {
        title: "Status",
        dataIndex: "isActive",
        key: "isActive",
        width: 110,
        align: "center",
        sorter: true,
        sortOrder:
          sortBy === "isActive"
            ? sortOrder === "asc"
              ? "ascend"
              : "descend"
            : null,
        render: (value: boolean) =>
          value ? (
            <Tag color="green">ACTIVE</Tag>
          ) : (
            <Tag color="red">INACTIVE</Tag>
          ),
      },
      {
        title: "Action",
        key: "action",
        width: 120,
        fixed: "right",
        align: "center",
        render: (_, record) => (
          <Space size={0}>
            <Tooltip title="Detail">
              <Button
                type="link"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => router.push(`/dashboard/users/${record.id}`)}
              />
            </Tooltip>

            <Tooltip title="Edit">
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() =>
                  router.push(`/dashboard/users/${record.id}/edit`)
                }
              />
            </Tooltip>

            <Tooltip
              title={record.isActive ? "Nonaktifkan" : "User sudah nonaktif"}
            >
              <Button
                danger
                type="link"
                size="small"
                icon={<DeleteOutlined />}
                disabled={!record.isActive}
                onClick={() => handleDisable(record)}
              />
            </Tooltip>
          </Space>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sortBy, sortOrder, router],
  );

  return (
    <>
      {contextHolder}

      <DataFilterCard>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">
              Search
            </div>

            <Input
              allowClear
              size="small"
              placeholder="Name, username, email, phone"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onPressEnter={handleApplyFilter}
            />
          </div>

          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">Role</div>

            <Select
              allowClear
              size="small"
              className="w-full"
              placeholder="Select role"
              value={roleId || undefined}
              onChange={(value) => setRoleId(value || "")}
              options={roles.map((role) => ({
                value: role.id,
                label: role.name,
              }))}
            />
          </div>

          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">
              Status
            </div>

            <Select
              allowClear
              size="small"
              className="w-full"
              placeholder="Select status"
              value={isActive || undefined}
              onChange={(value) => setIsActive(value || "")}
              options={[
                {
                  value: "true",
                  label: "Active",
                },
                {
                  value: "false",
                  label: "Inactive",
                },
              ]}
            />
          </div>

          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">
              Action
            </div>

            <Space>
              <Button
                type="primary"
                size="small"
                icon={<SearchOutlined />}
                onClick={handleApplyFilter}
              >
                Search
              </Button>

              <Button size="small" onClick={handleResetFilter}>
                Reset
              </Button>
            </Space>
          </div>
        </div>
      </DataFilterCard>

      <div className="mb-3 mt-4 flex items-center justify-between">
        <div className="text-sm text-slate-500">Total {meta.total} users</div>

        <Space>
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => router.push("/dashboard/users/create")}
          >
            Add New
          </Button>

          <Tooltip title="Refresh">
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => void fetchUsers()}
            />
          </Tooltip>
        </Space>
      </div>

      <DataTable<UserItem>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={users}
        pagination={{
          current: meta.page,
          pageSize: meta.limit,
          total: meta.total,
          showSizeChanger: true,
          pageSizeOptions: [10, 25, 50, 100],
          showTotal: (total, range) =>
            `showing ${range[0]} to ${range[1]} of ${total} items`,
        }}
        onChange={handleTableChange}
        scroll={{
          x: 1050,
        }}
      />
    </>
  );
}
