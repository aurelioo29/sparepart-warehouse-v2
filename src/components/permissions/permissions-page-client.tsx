"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Checkbox,
  Input,
  Modal,
  Popover,
  Select,
  Space,
  Table,
  Tag,
  message,
} from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import type { SorterResult } from "antd/es/table/interface";
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

import PermissionFormModal, {
  PermissionFormValues,
} from "./permission-form-modal";

type PermissionItem = {
  id: string;
  name: string;
  key: string;
  module: string;
  createdAt: string;
  updatedAt: string;
  _count: {
    rolePermissions: number;
  };
};

type PermissionsResponse = {
  items: PermissionItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

const columnOptions = [
  { key: "name", label: "Name", disabled: true },
  { key: "key", label: "Key" },
  { key: "module", label: "Module" },
  { key: "roles", label: "Used Roles" },
  { key: "createdAt", label: "Created at" },
  { key: "updatedAt", label: "Updated at" },
  { key: "action", label: "Action", disabled: true },
];

export default function PermissionsPageClient() {
  const [modal, contextHolder] = Modal.useModal();

  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selectedPermission, setSelectedPermission] =
    useState<PermissionItem | null>(null);

  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [columnOpen, setColumnOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    columnOptions.map((item) => item.key),
  );

  const [meta, setMeta] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  async function fetchPermissions(params?: {
    page?: number;
    limit?: number;
    search?: string;
    module?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }) {
    try {
      setLoading(true);

      const query = new URLSearchParams({
        page: String(params?.page ?? page),
        limit: String(params?.limit ?? limit),
        search: params?.search ?? search,
        module: params?.module ?? moduleFilter,
        sortBy: params?.sortBy ?? sortBy,
        sortOrder: params?.sortOrder ?? sortOrder,
      });

      const response = await fetch(`/api/permissions?${query.toString()}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch permissions");
      }

      const data: PermissionsResponse = result.data;

      setPermissions(data.items);
      setMeta(data.meta);
    } catch (error) {
      console.error(error);
      message.error("Gagal mengambil permissions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPermissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, sortBy, sortOrder]);

  function handleCreate() {
    setSelectedPermission(null);
    setFormMode("create");
    setFormOpen(true);
  }

  function handleEdit(permission: PermissionItem) {
    setSelectedPermission(permission);
    setFormMode("edit");
    setFormOpen(true);
  }

  async function handleSubmit(values: PermissionFormValues) {
    try {
      setSubmitLoading(true);

      const url =
        formMode === "create"
          ? "/api/permissions"
          : `/api/permissions/${selectedPermission?.id}`;

      const method = formMode === "create" ? "POST" : "PATCH";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...values,
          key: values.key.trim().toLowerCase(),
          module: values.module.trim().toLowerCase(),
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to save permission");
      }

      message.success(result.message || "Permission saved successfully");
      setFormOpen(false);
      setSelectedPermission(null);
      fetchPermissions();
    } catch (error) {
      console.error(error);
      message.error(
        error instanceof Error ? error.message : "Gagal menyimpan permission",
      );
    } finally {
      setSubmitLoading(false);
    }
  }

  function handleDelete(permission: PermissionItem) {
    modal.confirm({
      title: "Hapus permission?",
      content: `Permission "${permission.key}" akan dihapus.`,
      okText: "Ya, Hapus",
      cancelText: "Batal",
      okButtonProps: {
        danger: true,
      },
      centered: true,
      async onOk() {
        try {
          const response = await fetch(`/api/permissions/${permission.id}`, {
            method: "DELETE",
          });

          const result = await response.json();

          if (!response.ok || !result.success) {
            throw new Error(result.message || "Failed to delete permission");
          }

          message.success(result.message || "Permission deleted successfully");
          fetchPermissions();
        } catch (error) {
          console.error(error);
          message.error(
            error instanceof Error
              ? error.message
              : "Gagal menghapus permission",
          );
        }
      },
    });
  }

  function handleTableChange(
    pagination: TablePaginationConfig,
    _filters: Record<string, unknown>,
    sorter: SorterResult<PermissionItem> | SorterResult<PermissionItem>[],
  ) {
    const singleSorter = Array.isArray(sorter) ? sorter[0] : sorter;

    setPage(pagination.current || 1);
    setLimit(pagination.pageSize || 10);

    if (singleSorter?.field && singleSorter.order) {
      setSortBy(String(singleSorter.field));
      setSortOrder(singleSorter.order === "ascend" ? "asc" : "desc");
      return;
    }

    setSortBy("createdAt");
    setSortOrder("desc");
  }

  function handleSearch() {
    setPage(1);
    fetchPermissions({
      page: 1,
      search,
      module: moduleFilter,
    });
  }

  function handleReset() {
    setSearch("");
    setModuleFilter("");
    setPage(1);

    fetchPermissions({
      page: 1,
      search: "",
      module: "",
    });
  }

  const allColumns: ColumnsType<PermissionItem> = useMemo(
    () => [
      {
        title: "Name",
        dataIndex: "name",
        key: "name",
        sorter: true,
        sortOrder:
          sortBy === "name"
            ? sortOrder === "asc"
              ? "ascend"
              : "descend"
            : null,
        render: (value: string) => (
          <span className="font-semibold text-blue-600">{value}</span>
        ),
      },
      {
        title: "Key",
        dataIndex: "key",
        key: "key",
        sorter: true,
        sortOrder:
          sortBy === "key"
            ? sortOrder === "asc"
              ? "ascend"
              : "descend"
            : null,
      },
      {
        title: "Module",
        dataIndex: "module",
        key: "module",
        sorter: true,
        sortOrder:
          sortBy === "module"
            ? sortOrder === "asc"
              ? "ascend"
              : "descend"
            : null,
        render: (value: string) => <Tag color="blue">{value}</Tag>,
      },
      {
        title: "Used Roles",
        key: "roles",
        render: (_, record) => record._count.rolePermissions,
      },
      {
        title: "Created at",
        dataIndex: "createdAt",
        key: "createdAt",
        sorter: true,
        sortOrder:
          sortBy === "createdAt"
            ? sortOrder === "asc"
              ? "ascend"
              : "descend"
            : null,
        render: (value: string) => dayjs(value).format("YYYY-MM-DD HH:mm:ss"),
      },
      {
        title: "Updated at",
        dataIndex: "updatedAt",
        key: "updatedAt",
        sorter: true,
        sortOrder:
          sortBy === "updatedAt"
            ? sortOrder === "asc"
              ? "ascend"
              : "descend"
            : null,
        render: (value: string) => dayjs(value).format("YYYY-MM-DD HH:mm:ss"),
      },
      {
        title: "Action",
        key: "action",
        width: 90,
        align: "center",
        render: (_, record) => (
          <Space size={6}>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
            <Button
              danger
              type="link"
              size="small"
              icon={<DeleteOutlined />}
              disabled={record._count.rolePermissions > 0}
              onClick={() => handleDelete(record)}
            />
          </Space>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sortBy, sortOrder],
  );

  const tableColumns = allColumns.filter((column) =>
    visibleColumns.includes(String(column.key)),
  );

  return (
    <>
      {contextHolder}

      <div className="text-sm">
        <div className="mb-3 bg-white p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">
                Search
              </div>
              <Input
                size="small"
                allowClear
                placeholder="Search permission"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onPressEnter={handleSearch}
              />
            </div>

            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">
                Module
              </div>
              <Input
                size="small"
                allowClear
                placeholder="users"
                value={moduleFilter}
                onChange={(event) => setModuleFilter(event.target.value)}
                onPressEnter={handleSearch}
              />
            </div>

            <div className="md:col-span-2">
              <div className="mb-1 text-sm font-medium text-slate-700">
                Action
              </div>
              <Space>
                <Button
                  size="small"
                  type="primary"
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
        </div>

        <div className="bg-white p-4">
          <div className="mb-4 text-sm text-slate-500">
            Parameter:{" "}
            {search || moduleFilter
              ? "search params applied"
              : "no search params found"}
          </div>

          <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div />

            <Space wrap>
              <Select
                size="small"
                disabled={selectedRowKeys.length === 0}
                placeholder="Bulk action"
                className="w-[130px]"
                options={[{ label: "Delete Selected", value: "delete" }]}
              />

              <Button
                size="small"
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleCreate}
              >
                Add New
              </Button>

              <Button
                size="small"
                icon={<ReloadOutlined />}
                onClick={() => fetchPermissions()}
              />

              <Popover
                open={columnOpen}
                onOpenChange={setColumnOpen}
                trigger="click"
                placement="bottomRight"
                content={
                  <div className="w-[180px]">
                    <div className="mb-2 text-sm font-semibold text-slate-700">
                      Column Display
                    </div>
                    <Checkbox.Group
                      value={visibleColumns}
                      onChange={(values) =>
                        setVisibleColumns(values as string[])
                      }
                      className="flex flex-col gap-2"
                    >
                      {columnOptions.map((column) => (
                        <Checkbox
                          key={column.key}
                          value={column.key}
                          disabled={column.disabled}
                          className="text-sm"
                        >
                          {column.label}
                        </Checkbox>
                      ))}
                    </Checkbox.Group>
                  </div>
                }
              >
                <Button size="small" icon={<SettingOutlined />} />
              </Popover>
            </Space>
          </div>

          <Table<PermissionItem>
            rowKey="id"
            size="small"
            className="data-table-sm"
            loading={loading}
            columns={tableColumns}
            dataSource={permissions}
            rowSelection={{
              selectedRowKeys,
              onChange: setSelectedRowKeys,
            }}
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
            scroll={{ x: 900 }}
          />
        </div>
      </div>

      <PermissionFormModal
        open={formOpen}
        loading={submitLoading}
        mode={formMode}
        initialValues={
          selectedPermission
            ? {
                name: selectedPermission.name,
                key: selectedPermission.key,
                module: selectedPermission.module,
              }
            : undefined
        }
        onCancel={() => {
          setFormOpen(false);
          setSelectedPermission(null);
        }}
        onSubmit={handleSubmit}
      />
    </>
  );
}
