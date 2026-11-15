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

import GeneralSettingFormModal, {
  GeneralSettingFormValues,
} from "./general-setting-form-modal";

type GeneralSettingItem = {
  id: string;
  key: string;
  value: unknown;
  type: string;
  group: string;
  description?: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
};

type GeneralSettingsResponse = {
  items: GeneralSettingItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

const columnOptions = [
  { key: "key", label: "Key", disabled: true },
  { key: "value", label: "Value" },
  { key: "type", label: "Type" },
  { key: "group", label: "Group" },
  { key: "isPublic", label: "Public" },
  { key: "createdAt", label: "Created at" },
  { key: "updatedAt", label: "Updated at" },
  { key: "action", label: "Action", disabled: true },
];

function stringifyValue(value: unknown) {
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function parseSettingValue(type: string, value: string) {
  if (type === "number") {
    const numberValue = Number(value);

    if (Number.isNaN(numberValue)) {
      throw new Error("Value harus berupa number");
    }

    return numberValue;
  }

  if (type === "boolean") {
    if (value !== "true" && value !== "false") {
      throw new Error("Value boolean harus true atau false");
    }

    return value === "true";
  }

  if (type === "json") {
    try {
      return JSON.parse(value);
    } catch {
      throw new Error("Value JSON tidak valid");
    }
  }

  return value;
}

export default function GeneralSettingsPageClient() {
  const [modal, contextHolder] = Modal.useModal();

  const [settings, setSettings] = useState<GeneralSettingItem[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selectedSetting, setSelectedSetting] =
    useState<GeneralSettingItem | null>(null);

  const [search, setSearch] = useState("");
  const [groupName, setGroupName] = useState("");
  const [type, setType] = useState("");

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

  async function fetchSettings(params?: {
    page?: number;
    limit?: number;
    search?: string;
    group?: string;
    type?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }) {
    try {
      setLoading(true);

      const query = new URLSearchParams({
        page: String(params?.page ?? page),
        limit: String(params?.limit ?? limit),
        search: params?.search ?? search,
        group: params?.group ?? groupName,
        type: params?.type ?? type,
        sortBy: params?.sortBy ?? sortBy,
        sortOrder: params?.sortOrder ?? sortOrder,
      });

      const response = await fetch(`/api/settings/general?${query.toString()}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch general settings");
      }

      const data: GeneralSettingsResponse = result.data;

      setSettings(data.items);
      setMeta(data.meta);
    } catch (error) {
      console.error(error);
      message.error("Gagal mengambil general settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, sortBy, sortOrder]);

  function handleCreate() {
    setSelectedSetting(null);
    setFormMode("create");
    setFormOpen(true);
  }

  function handleEdit(setting: GeneralSettingItem) {
    setSelectedSetting(setting);
    setFormMode("edit");
    setFormOpen(true);
  }

  async function handleSubmit(values: GeneralSettingFormValues) {
    try {
      setSubmitLoading(true);

      const parsedValue = parseSettingValue(values.type, values.value);

      const url =
        formMode === "create"
          ? "/api/settings/general"
          : `/api/settings/general/${selectedSetting?.id}`;

      const method = formMode === "create" ? "POST" : "PATCH";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...values,
          key: values.key.trim().toLowerCase(),
          group: values.group.trim().toLowerCase(),
          type: values.type.trim().toLowerCase(),
          value: parsedValue,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to save setting");
      }

      message.success(result.message || "General setting saved successfully");
      setFormOpen(false);
      setSelectedSetting(null);
      fetchSettings();
    } catch (error) {
      console.error(error);
      message.error(
        error instanceof Error ? error.message : "Gagal menyimpan setting",
      );
    } finally {
      setSubmitLoading(false);
    }
  }

  function handleDelete(setting: GeneralSettingItem) {
    modal.confirm({
      title: "Hapus setting?",
      content: `Setting "${setting.key}" akan dihapus.`,
      okText: "Ya, Hapus",
      cancelText: "Batal",
      okButtonProps: {
        danger: true,
      },
      centered: true,
      async onOk() {
        try {
          const response = await fetch(`/api/settings/general/${setting.id}`, {
            method: "DELETE",
          });

          const result = await response.json();

          if (!response.ok || !result.success) {
            throw new Error(result.message || "Failed to delete setting");
          }

          message.success(
            result.message || "General setting deleted successfully",
          );
          fetchSettings();
        } catch (error) {
          console.error(error);
          message.error(
            error instanceof Error ? error.message : "Gagal menghapus setting",
          );
        }
      },
    });
  }

  function handleTableChange(
    pagination: TablePaginationConfig,
    _filters: Record<string, unknown>,
    sorter:
      | SorterResult<GeneralSettingItem>
      | SorterResult<GeneralSettingItem>[],
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
    fetchSettings({
      page: 1,
      search,
      group: groupName,
      type,
    });
  }

  function handleReset() {
    setSearch("");
    setGroupName("");
    setType("");
    setPage(1);

    fetchSettings({
      page: 1,
      search: "",
      group: "",
      type: "",
    });
  }

  const allColumns: ColumnsType<GeneralSettingItem> = useMemo(
    () => [
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
        render: (value: string) => (
          <span className="font-semibold text-blue-600">{value}</span>
        ),
      },
      {
        title: "Value",
        dataIndex: "value",
        key: "value",
        render: (value: unknown) => (
          <span className="block max-w-[320px] truncate">
            {stringifyValue(value)}
          </span>
        ),
      },
      {
        title: "Type",
        dataIndex: "type",
        key: "type",
        sorter: true,
        sortOrder:
          sortBy === "type"
            ? sortOrder === "asc"
              ? "ascend"
              : "descend"
            : null,
        render: (value: string) => <Tag>{value}</Tag>,
      },
      {
        title: "Group",
        dataIndex: "group",
        key: "group",
        sorter: true,
        sortOrder:
          sortBy === "group"
            ? sortOrder === "asc"
              ? "ascend"
              : "descend"
            : null,
        render: (value: string) => <Tag color="blue">{value}</Tag>,
      },
      {
        title: "Public",
        dataIndex: "isPublic",
        key: "isPublic",
        sorter: true,
        sortOrder:
          sortBy === "isPublic"
            ? sortOrder === "asc"
              ? "ascend"
              : "descend"
            : null,
        render: (value: boolean) =>
          value ? <Tag color="green">Public</Tag> : <Tag>Private</Tag>,
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
                placeholder="Search key, group, description"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onPressEnter={handleSearch}
              />
            </div>

            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">
                Group
              </div>
              <Input
                size="small"
                allowClear
                placeholder="numbering"
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                onPressEnter={handleSearch}
              />
            </div>

            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">
                Type
              </div>
              <Select
                size="small"
                allowClear
                placeholder="Select type"
                value={type || undefined}
                onChange={(value) => setType(value || "")}
                className="w-full"
                options={[
                  { label: "String", value: "string" },
                  { label: "Number", value: "number" },
                  { label: "Boolean", value: "boolean" },
                  { label: "JSON", value: "json" },
                ]}
              />
            </div>

            <div>
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
            {search || groupName || type
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
                onClick={() => fetchSettings()}
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

          <Table<GeneralSettingItem>
            rowKey="id"
            size="small"
            className="data-table-sm"
            loading={loading}
            columns={tableColumns}
            dataSource={settings}
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
            scroll={{ x: 1000 }}
          />
        </div>
      </div>

      <GeneralSettingFormModal
        open={formOpen}
        loading={submitLoading}
        mode={formMode}
        initialValues={
          selectedSetting
            ? {
                key: selectedSetting.key,
                value: stringifyValue(selectedSetting.value),
                type: selectedSetting.type as GeneralSettingFormValues["type"],
                group: selectedSetting.group,
                description: selectedSetting.description || "",
                isPublic: selectedSetting.isPublic,
              }
            : {
                type: "string",
                isPublic: false,
              }
        }
        onCancel={() => {
          setFormOpen(false);
          setSelectedSetting(null);
        }}
        onSubmit={handleSubmit}
      />
    </>
  );
}
