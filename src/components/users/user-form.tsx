"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  App,
  Button,
  Form,
  Input,
  Select,
  Space,
  Spin,
  Switch,
  Tree,
  Typography,
} from "antd";
import type { DataNode } from "antd/es/tree";
import {
  LockOutlined,
  MailOutlined,
  PhoneOutlined,
  UserOutlined,
} from "@ant-design/icons";

export type RoleOption = {
  id: string;
  name: string;
  slug: string;
};

export type PermissionOption = {
  id: string;
  name: string;
  key: string;
  module: string;
};

export type CustomPermissionValue = {
  permissionId: string;
  effect: "ALLOW" | "DENY";
  permission?: PermissionOption;
};

export type UserFormValues = {
  roleId: string;
  fullName: string;
  username: string;
  email: string;
  phone?: string;
  password?: string;
  isActive: boolean;
  customPermissions: CustomPermissionValue[];
};

export type UserFormInitialValues = Omit<UserFormValues, "password"> & {
  id?: string;
  password?: string;
};

type UserFormProps = {
  mode: "create" | "edit";
  roles: RoleOption[];
  initialValues?: Partial<UserFormInitialValues> | null;
  loading?: boolean;
  submitText?: string;
  onCancel: () => void;
  onSubmit: (values: UserFormValues) => void;
};

function moduleLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function buildOverrideMap(customPermissions?: CustomPermissionValue[]) {
  const result = new Map<string, "ALLOW" | "DENY">();

  for (const item of customPermissions || []) {
    result.set(item.permissionId, item.effect);
  }

  return result;
}

export default function UserForm({
  mode,
  roles,
  initialValues,
  loading = false,
  submitText,
  onCancel,
  onSubmit,
}: UserFormProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<UserFormValues>();

  const [permissions, setPermissions] = useState<PermissionOption[]>([]);
  const [rolePermissionIds, setRolePermissionIds] = useState<Set<string>>(
    new Set(),
  );
  const [checkedPermissionIds, setCheckedPermissionIds] = useState<string[]>(
    [],
  );
  const [permissionLoading, setPermissionLoading] = useState(false);

  const selectedRoleId = Form.useWatch("roleId", form);

  const treeData = useMemo<DataNode[]>(() => {
    const groupedPermissions = permissions.reduce<
      Record<string, PermissionOption[]>
    >((result, permission) => {
      const moduleName = permission.module || "other";

      if (!result[moduleName]) {
        result[moduleName] = [];
      }

      result[moduleName].push(permission);

      return result;
    }, {});

    return Object.entries(groupedPermissions).map(
      ([moduleName, modulePermissions]) => ({
        key: `module:${moduleName}`,
        selectable: false,
        title: (
          <span className="font-semibold text-slate-800">
            {moduleLabel(moduleName)}
          </span>
        ),
        children: modulePermissions.map((permission) => ({
          key: permission.id,
          selectable: false,
          title: (
            <div>
              <div className="font-medium text-slate-700">
                {permission.name}
              </div>

              <div className="text-xs text-slate-400">{permission.key}</div>
            </div>
          ),
        })),
      }),
    );
  }, [permissions]);

  const customPermissionCount = useMemo(() => {
    const checkedSet = new Set(checkedPermissionIds);

    return permissions.filter((permission) => {
      const includedByRole = rolePermissionIds.has(permission.id);
      const includedByUser = checkedSet.has(permission.id);

      return includedByRole !== includedByUser;
    }).length;
  }, [permissions, rolePermissionIds, checkedPermissionIds]);

  async function fetchPermissions() {
    try {
      setPermissionLoading(true);

      const response = await fetch("/api/permissions/options");
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch permission options");
      }

      setPermissions(result.data || []);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error
          ? error.message
          : "Gagal mengambil permission options",
      );
    } finally {
      setPermissionLoading(false);
    }
  }

  async function fetchRolePermissions(roleId: string) {
    try {
      setPermissionLoading(true);

      const response = await fetch(`/api/roles/${roleId}/permissions`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch role permissions");
      }

      const roleIds = new Set<string>(
        (result.data?.permissions || []).map(
          (permission: PermissionOption) => permission.id,
        ),
      );

      const overrideMap = buildOverrideMap(initialValues?.customPermissions);

      const nextCheckedIds = permissions
        .filter((permission) => {
          const override = overrideMap.get(permission.id);

          if (override === "ALLOW") {
            return true;
          }

          if (override === "DENY") {
            return false;
          }

          return roleIds.has(permission.id);
        })
        .map((permission) => permission.id);

      setRolePermissionIds(roleIds);
      setCheckedPermissionIds(nextCheckedIds);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error
          ? error.message
          : "Gagal mengambil role permissions",
      );
    } finally {
      setPermissionLoading(false);
    }
  }

  function getCustomPermissionsPayload(): CustomPermissionValue[] {
    const checkedSet = new Set(checkedPermissionIds);

    return permissions.flatMap<CustomPermissionValue>((permission) => {
      const roleHasPermission = rolePermissionIds.has(permission.id);
      const userHasPermission = checkedSet.has(permission.id);

      if (!roleHasPermission && userHasPermission) {
        return [
          {
            permissionId: permission.id,
            effect: "ALLOW",
          },
        ];
      }

      if (roleHasPermission && !userHasPermission) {
        return [
          {
            permissionId: permission.id,
            effect: "DENY",
          },
        ];
      }

      return [];
    });
  }

  useEffect(() => {
    form.setFieldsValue({
      roleId: initialValues?.roleId,
      fullName: initialValues?.fullName || "",
      username: initialValues?.username || "",
      email: initialValues?.email || "",
      phone: initialValues?.phone || "",
      password: "",
      isActive: initialValues?.isActive ?? true,
      customPermissions: initialValues?.customPermissions || [],
    });
  }, [form, initialValues]);

  useEffect(() => {
    void fetchPermissions();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedRoleId || permissions.length === 0) {
      setRolePermissionIds(new Set());
      setCheckedPermissionIds([]);
      return;
    }

    void fetchRolePermissions(selectedRoleId);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoleId, permissions]);

  return (
    <Form
      form={form}
      layout="vertical"
      requiredMark={false}
      className="form-compact text-sm"
      onFinish={(values) => {
        onSubmit({
          ...values,
          fullName: values.fullName.trim(),
          username: values.username.trim().toLowerCase(),
          email: values.email.trim().toLowerCase(),
          phone: values.phone?.trim() || "",
          password: values.password?.trim() || "",
          customPermissions: getCustomPermissionsPayload(),
        });
      }}
    >
      <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
        <Form.Item
          label="Role"
          name="roleId"
          rules={[
            {
              required: true,
              message: "Role wajib dipilih",
            },
          ]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Select role"
            options={roles.map((role) => ({
              value: role.id,
              label: role.name,
            }))}
          />
        </Form.Item>

        <Form.Item label="Status" name="isActive" valuePropName="checked">
          <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
        </Form.Item>

        <Form.Item
          label="Full Name"
          name="fullName"
          rules={[
            {
              required: true,
              message: "Full name wajib diisi",
            },
          ]}
        >
          <Input prefix={<UserOutlined />} placeholder="Full name" />
        </Form.Item>

        <Form.Item
          label="Username"
          name="username"
          rules={[
            {
              required: true,
              message: "Username wajib diisi",
            },
          ]}
        >
          <Input prefix={<UserOutlined />} placeholder="username" />
        </Form.Item>

        <Form.Item
          label="Email"
          name="email"
          rules={[
            {
              required: true,
              message: "Email wajib diisi",
            },
            {
              type: "email",
              message: "Format email tidak valid",
            },
          ]}
        >
          <Input prefix={<MailOutlined />} placeholder="email@example.com" />
        </Form.Item>

        <Form.Item label="Phone" name="phone">
          <Input prefix={<PhoneOutlined />} placeholder="08xxxxxxxxxx" />
        </Form.Item>

        <Form.Item
          label={mode === "create" ? "Password" : "New Password"}
          name="password"
          extra={
            mode === "edit"
              ? "Kosongkan jika tidak ingin mengganti password."
              : undefined
          }
          rules={[
            {
              required: mode === "create",
              message: "Password wajib diisi",
            },
            {
              min: 6,
              message: "Password minimal 6 karakter",
            },
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder={mode === "create" ? "Password" : "New password"}
          />
        </Form.Item>
      </div>

      <div className="mt-2">
        <Typography.Title level={5} className="!mb-1">
          Permissions
        </Typography.Title>

        <Typography.Text type="secondary" className="text-sm">
          Permission dari role otomatis tercentang. Anda dapat menambah atau
          mencabut permission khusus untuk user ini.
        </Typography.Text>

        <Alert
          showIcon
          type="info"
          className="mt-3"
          title={`${customPermissionCount} custom permission override aktif`}
        />

        <div className="mt-3 border border-slate-200 bg-white p-3">
          <Spin spinning={permissionLoading}>
            {treeData.length > 0 ? (
              <Tree
                checkable
                blockNode
                defaultExpandAll
                treeData={treeData}
                checkedKeys={checkedPermissionIds}
                onCheck={(checkedValue) => {
                  const keys = Array.isArray(checkedValue)
                    ? checkedValue
                    : checkedValue.checked;

                  setCheckedPermissionIds(
                    keys
                      .map(String)
                      .filter((key) => !key.startsWith("module:")),
                  );
                }}
              />
            ) : (
              <div className="py-6 text-center text-sm text-slate-400">
                Tidak ada permission ditemukan.
              </div>
            )}
          </Spin>
        </div>
      </div>

      <Form.Item className="!mb-0 !mt-5">
        <Space>
          <Button type="primary" htmlType="submit" loading={loading}>
            {submitText || (mode === "create" ? "Create User" : "Save Changes")}
          </Button>

          <Button onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
}
