"use client";

import { useEffect, useMemo } from "react";
import {
  Alert,
  Button,
  Checkbox,
  ConfigProvider,
  Form,
  Input,
  Space,
  Switch,
} from "antd";

export type PermissionOption = {
  id: string;
  name: string;
  key: string;
  module: string;
};

export type RoleFormValues = {
  name: string;
  slug: string;
  description?: string | null;
  isActive: boolean;
  permissionIds: string[];
};

type RoleFormProps = {
  loading?: boolean;
  mode: "create" | "edit";
  permissions: PermissionOption[];
  initialValues?: Partial<RoleFormValues> | null;
  onCancel: () => void;
  onSubmit: (values: RoleFormValues) => void;
};

// ============================================================
// HELPERS
// ============================================================

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatModule(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

// ============================================================
// COMPONENT
// ============================================================

export default function RoleForm({
  loading = false,
  mode,
  permissions,
  initialValues,
  onCancel,
  onSubmit,
}: RoleFormProps) {
  const [form] = Form.useForm<RoleFormValues>();

  const permissionIds = Form.useWatch("permissionIds", form) || [];

  const roleName = Form.useWatch("name", form) || "";

  const generatedSlug = Form.useWatch("slug", form) || "";

  const isSuperadmin = mode === "edit" && initialValues?.slug === "superadmin";

  // ============================================================
  // GROUP PERMISSIONS
  // ============================================================

  const groupedPermissions = useMemo(() => {
    return permissions.reduce<Record<string, PermissionOption[]>>(
      (result, permission) => {
        const moduleName = permission.module || "other";

        if (!result[moduleName]) {
          result[moduleName] = [];
        }

        result[moduleName].push(permission);

        return result;
      },
      {},
    );
  }, [permissions]);

  const sortedPermissionGroups = useMemo(() => {
    return Object.entries(groupedPermissions).sort(
      ([firstModule], [secondModule]) =>
        firstModule.localeCompare(secondModule),
    );
  }, [groupedPermissions]);

  // ============================================================
  // SET INITIAL VALUES
  // ============================================================

  useEffect(() => {
    form.setFieldsValue({
      name: initialValues?.name || "",
      slug: initialValues?.slug || slugify(initialValues?.name || ""),
      description: initialValues?.description || "",
      isActive: initialValues?.isActive ?? true,
      permissionIds: initialValues?.permissionIds || [],
    });
  }, [form, initialValues]);

  // ============================================================
  // AUTO GENERATE SLUG
  // ============================================================

  useEffect(() => {
    /**
     * Slug superadmin tidak boleh berubah.
     */
    if (isSuperadmin) {
      form.setFieldValue("slug", "superadmin");

      return;
    }

    form.setFieldValue("slug", slugify(roleName));
  }, [form, roleName, isSuperadmin]);

  // ============================================================
  // PERMISSION ACTIONS
  // ============================================================

  function toggleModulePermissions(
    modulePermissions: PermissionOption[],
    checked: boolean,
  ) {
    const currentIds: string[] = form.getFieldValue("permissionIds") || [];

    const moduleIds = modulePermissions.map((permission) => permission.id);

    if (checked) {
      form.setFieldValue(
        "permissionIds",
        Array.from(new Set([...currentIds, ...moduleIds])),
      );

      return;
    }

    form.setFieldValue(
      "permissionIds",
      currentIds.filter((id) => !moduleIds.includes(id)),
    );
  }

  function selectAllPermissions() {
    form.setFieldValue(
      "permissionIds",
      permissions.map((permission) => permission.id),
    );
  }

  function clearAllPermissions() {
    form.setFieldValue("permissionIds", []);
  }

  // ============================================================
  // SUBMIT
  // ============================================================

  function handleFinish(values: RoleFormValues) {
    const cleanName = values.name.trim();

    /**
     * Jangan percaya penuh pada state field.
     * Generate ulang slug ketika submit.
     */
    const finalSlug = isSuperadmin ? "superadmin" : slugify(cleanName);

    onSubmit({
      ...values,
      name: cleanName,
      slug: finalSlug,
      description: values.description?.trim() || null,
      isActive: isSuperadmin ? true : values.isActive,
      permissionIds: values.permissionIds || [],
    });
  }

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <ConfigProvider
      theme={{
        token: {
          borderRadius: 2,
          borderRadiusLG: 2,
          borderRadiusSM: 2,
        },
      }}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        className="form-compact text-sm"
        onFinish={handleFinish}
      >
        {/*
         * Slug tidak ditampilkan kepada user,
         * tetapi tetap masuk ke values ketika submit.
         */}
        <Form.Item
          name="slug"
          hidden
          rules={[
            {
              required: true,
              message: "Slug gagal dibuat dari role name",
            },
          ]}
        >
          <Input />
        </Form.Item>

        {/* BASIC INFORMATION */}
        <div className="border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="m-0 text-sm font-bold text-slate-900">
              Basic Information
            </h2>

            <p className="mb-0 mt-1 text-xs text-slate-500">
              Informasi utama untuk mengidentifikasi role.
            </p>
          </div>

          <div className="p-4">
            <Form.Item
              label="Role Name"
              name="name"
              rules={[
                {
                  required: true,
                  message: "Role name wajib diisi",
                },
                {
                  whitespace: true,
                  message: "Role name tidak boleh kosong",
                },
                {
                  min: 2,
                  message: "Role name minimal 2 karakter",
                },
                {
                  max: 100,
                  message: "Role name maksimal 100 karakter",
                },
              ]}
            >
              <Input placeholder="Contoh: Admin Gudang" autoComplete="off" />
            </Form.Item>

            {roleName.trim() && (
              <div className="-mt-4 mb-5 text-xs text-slate-500">
                Slug otomatis:{" "}
                <span className="font-mono font-medium text-slate-700">
                  {generatedSlug || "-"}
                </span>
              </div>
            )}

            <Form.Item label="Description" name="description">
              <Input.TextArea
                rows={3}
                maxLength={500}
                showCount
                placeholder="Jelaskan fungsi dan tanggung jawab role"
              />
            </Form.Item>

            <Form.Item
              label="Status"
              name="isActive"
              valuePropName="checked"
              className="!mb-0"
            >
              <Switch
                checkedChildren="Active"
                unCheckedChildren="Inactive"
                disabled={isSuperadmin}
              />
            </Form.Item>

            {isSuperadmin && (
              <div className="mt-2 text-xs text-amber-600">
                Role superadmin harus selalu aktif dan slug-nya tidak dapat
                diubah.
              </div>
            )}
          </div>
        </div>

        {/* PERMISSIONS */}
        <div className="mt-4 border border-slate-200 bg-white">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="m-0 text-sm font-bold text-slate-900">
                Permissions
              </h2>

              <p className="mb-0 mt-1 text-xs text-slate-500">
                Permission akan diberikan kepada seluruh user dengan role
                tersebut.
              </p>
            </div>

            <Space size="small">
              <Button
                size="small"
                onClick={selectAllPermissions}
                disabled={permissions.length === 0}
              >
                Select All
              </Button>

              <Button
                size="small"
                onClick={clearAllPermissions}
                disabled={permissionIds.length === 0}
              >
                Clear
              </Button>
            </Space>
          </div>

          <div className="p-4">
            <Alert
              showIcon
              type="info"
              className="!mb-4"
              title={`${permissionIds.length} permissions selected`}
            />

            <Form.Item name="permissionIds" className="!mb-0">
              <Checkbox.Group className="!block !w-full">
                <div className="grid w-full grid-cols-1 gap-3 lg:grid-cols-2">
                  {sortedPermissionGroups.map(
                    ([moduleName, modulePermissions]) => {
                      const moduleIds = modulePermissions.map(
                        (permission) => permission.id,
                      );

                      const selectedCount = moduleIds.filter((id) =>
                        permissionIds.includes(id),
                      ).length;

                      const allChecked =
                        moduleIds.length > 0 &&
                        selectedCount === moduleIds.length;

                      const indeterminate =
                        selectedCount > 0 && selectedCount < moduleIds.length;

                      return (
                        <div
                          key={moduleName}
                          className="w-full border border-slate-200 bg-white"
                        >
                          <div className="flex min-h-10 items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
                            <Checkbox
                              checked={allChecked}
                              indeterminate={indeterminate}
                              onChange={(event) => {
                                toggleModulePermissions(
                                  modulePermissions,
                                  event.target.checked,
                                );
                              }}
                            >
                              <span className="font-semibold text-slate-800">
                                {formatModule(moduleName)}
                              </span>
                            </Checkbox>

                            <span className="text-xs text-slate-400">
                              {selectedCount}/{moduleIds.length}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 gap-x-4 gap-y-2 p-3 sm:grid-cols-2">
                            {modulePermissions.map((permission) => (
                              <Checkbox
                                key={permission.id}
                                value={permission.id}
                                className="!ml-0 !items-start"
                              >
                                <div className="min-w-0">
                                  <div className="text-sm leading-5 text-slate-700">
                                    {permission.name}
                                  </div>

                                  <div className="break-all text-xs leading-4 text-slate-400">
                                    {permission.key}
                                  </div>
                                </div>
                              </Checkbox>
                            ))}
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
              </Checkbox.Group>
            </Form.Item>

            {sortedPermissionGroups.length === 0 && (
              <div className="border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-400">
                Tidak ada permission ditemukan.
              </div>
            )}
          </div>
        </div>

        {/* FORM ACTION */}
        <div className="mt-4 border-t border-slate-200 pt-4">
          <Space>
            <Button type="primary" htmlType="submit" loading={loading}>
              {mode === "create" ? "Create Role" : "Save Changes"}
            </Button>

            <Button onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
          </Space>
        </div>
      </Form>
    </ConfigProvider>
  );
}
