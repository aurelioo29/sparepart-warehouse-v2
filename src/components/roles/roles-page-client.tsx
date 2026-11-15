"use client";

import { useEffect, useMemo, useState } from "react";
import { App, Button, Input, Modal, Select, Space, Tag, Tooltip } from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import type { SorterResult } from "antd/es/table/interface";
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";

import DataFilterCard from "@/components/shared/data-filter-card";
import DataTable from "@/components/shared/data-table";

type RoleItem = {
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
};

type RolesResponse = {
  items: RoleItem[];

  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export default function RolesPageClient() {
  const router = useRouter();
  const { message } = App.useApp();
  const [modal, contextHolder] = Modal.useModal();

  const [roles, setRoles] = useState<RoleItem[]>([]);

  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
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

  async function fetchRoles(params?: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }) {
    try {
      setLoading(true);

      const query = new URLSearchParams({
        page: String(params?.page ?? page),
        limit: String(params?.limit ?? limit),
        search: params?.search ?? search,
        isActive: params?.isActive ?? isActive,
        sortBy: params?.sortBy ?? sortBy,
        sortOrder: params?.sortOrder ?? sortOrder,
      });

      const response = await fetch(`/api/roles?${query.toString()}`);

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch roles");
      }

      const data = result.data as RolesResponse;

      setRoles(data.items || []);
      setMeta(data.meta);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal mengambil roles",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleSearch() {
    setPage(1);

    void fetchRoles({
      page: 1,
      search,
      isActive,
    });
  }

  function handleReset() {
    setSearch("");
    setIsActive("");
    setPage(1);

    void fetchRoles({
      page: 1,
      search: "",
      isActive: "",
    });
  }

  function handleDisable(role: RoleItem) {
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
        const response = await fetch(`/api/roles/${role.id}`, {
          method: "DELETE",
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Failed to disable role");
        }

        message.success(result.message || "Role disabled successfully");

        await fetchRoles();
      },
    });
  }

  function handleTableChange(
    pagination: TablePaginationConfig,
    _filters: Record<string, unknown>,
    sorter: SorterResult<RoleItem> | SorterResult<RoleItem>[],
  ) {
    const activeSorter = Array.isArray(sorter) ? sorter[0] : sorter;

    setPage(pagination.current || 1);
    setLimit(pagination.pageSize || 10);

    if (activeSorter?.field && activeSorter.order) {
      setSortBy(String(activeSorter.field));

      setSortOrder(activeSorter.order === "ascend" ? "asc" : "desc");

      return;
    }

    setSortBy("createdAt");
    setSortOrder("desc");
  }

  useEffect(() => {
    void fetchRoles({
      page,
      limit,
      sortBy,
      sortOrder,
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, sortBy, sortOrder]);

  const columns = useMemo<ColumnsType<RoleItem>>(
    () => [
      {
        title: "Role",
        dataIndex: "name",
        key: "name",
        sorter: true,
        width: 260,
        sortOrder:
          sortBy === "name"
            ? sortOrder === "asc"
              ? "ascend"
              : "descend"
            : null,

        render: (name: string, record) => (
          <button
            type="button"
            className="flex items-center gap-3 text-left"
            onClick={() => router.push(`/dashboard/roles/${record.id}`)}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-blue-50 text-blue-600">
              <SafetyCertificateOutlined />
            </div>

            <div>
              <div className="font-semibold text-blue-600 hover:underline">
                {name}
              </div>

              <div className="text-xs text-slate-400">{record.slug}</div>
            </div>
          </button>
        ),
      },
      {
        title: "Description",
        dataIndex: "description",
        key: "description",

        render: (value?: string | null) => (
          <span className="line-clamp-2 text-sm text-slate-600">
            {value || "No description"}
          </span>
        ),
      },
      {
        title: "Users",
        key: "users",
        width: 90,
        align: "center",

        render: (_, record) => record._count.users,
      },
      {
        title: "Permissions",
        key: "permissions",
        width: 120,
        align: "center",

        render: (_, record) => record._count.rolePermissions,
      },
      {
        title: "Status",
        dataIndex: "isActive",
        key: "isActive",
        width: 110,
        align: "center",
        sorter: true,

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
                onClick={() => router.push(`/dashboard/roles/${record.id}`)}
              />
            </Tooltip>

            <Tooltip title="Edit">
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() =>
                  router.push(`/dashboard/roles/${record.id}/edit`)
                }
              />
            </Tooltip>

            <Tooltip title="Nonaktifkan">
              <Button
                danger
                type="link"
                size="small"
                icon={<DeleteOutlined />}
                disabled={
                  !record.isActive ||
                  record.slug === "superadmin" ||
                  record._count.users > 0
                }
                onClick={() => handleDisable(record)}
              />
            </Tooltip>
          </Space>
        ),
      },
    ],

    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, sortBy, sortOrder],
  );

  return (
    <>
      {contextHolder}

      <DataFilterCard>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <div className="mb-1 font-medium text-slate-700">Search</div>

            <Input
              allowClear
              size="small"
              placeholder="Name, slug, description"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onPressEnter={handleSearch}
            />
          </div>

          <div>
            <div className="mb-1 font-medium text-slate-700">Status</div>

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
            <div className="mb-1 font-medium text-slate-700">Action</div>

            <Space>
              <Button
                type="primary"
                size="small"
                icon={<SearchOutlined />}
                onClick={handleSearch}
              >
                Search
              </Button>

              <Button size="small" onClick={handleReset}>
                Reset
              </Button>
            </Space>
          </div>
        </div>
      </DataFilterCard>

      <div className="mb-3 mt-4 flex items-center justify-between">
        <div className="text-sm text-slate-500">Total {meta.total} roles</div>

        <Space>
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => router.push("/dashboard/roles/create")}
          >
            Add New
          </Button>

          <Tooltip title="Refresh">
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => void fetchRoles()}
            />
          </Tooltip>
        </Space>
      </div>

      <DataTable<RoleItem>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={roles}
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
          x: 950,
        }}
      />
    </>
  );
}
