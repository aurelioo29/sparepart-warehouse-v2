"use client";

import { useEffect, useState } from "react";
import { App, Spin } from "antd";
import { useRouter } from "next/navigation";

import RoleForm, { PermissionOption, RoleFormValues } from "./role-form";

type RoleDetail = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  isActive: boolean;

  rolePermissions: {
    permissionId: string;
    permission: PermissionOption;
  }[];
};

type RoleEditPageClientProps = {
  id: string;
};

export default function RoleEditPageClient({ id }: RoleEditPageClientProps) {
  const router = useRouter();
  const { message } = App.useApp();

  const [role, setRole] = useState<RoleDetail | null>(null);

  const [permissions, setPermissions] = useState<PermissionOption[]>([]);

  const [loading, setLoading] = useState(true);

  const [submitLoading, setSubmitLoading] = useState(false);

  async function fetchData() {
    try {
      setLoading(true);

      const [roleResponse, permissionResponse] = await Promise.all([
        fetch(`/api/roles/${id}`),
        fetch("/api/permissions/options"),
      ]);

      const [roleResult, permissionResult] = await Promise.all([
        roleResponse.json(),
        permissionResponse.json(),
      ]);

      if (!roleResponse.ok || !roleResult.success) {
        throw new Error(roleResult.message || "Failed to fetch role");
      }

      if (!permissionResponse.ok || !permissionResult.success) {
        throw new Error(
          permissionResult.message || "Failed to fetch permissions",
        );
      }

      setRole(roleResult.data);
      setPermissions(permissionResult.data || []);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal mengambil role",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(values: RoleFormValues) {
    try {
      setSubmitLoading(true);

      const response = await fetch(`/api/roles/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to update role");
      }

      message.success(result.message || "Role updated successfully");

      router.push(`/dashboard/roles/${id}`);
      router.refresh();
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal update role",
      );
    } finally {
      setSubmitLoading(false);
    }
  }

  useEffect(() => {
    void fetchData();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div className="text-sm">
      <div className="mb-5 border-b border-slate-100 pb-4">
        <h1 className="m-0 text-lg font-bold text-slate-950">Edit Role</h1>

        <p className="mt-1 text-sm text-slate-500">
          Update informasi dan permission role.
        </p>
      </div>

      {loading ? (
        <div className="flex min-h-[260px] items-center justify-center">
          <Spin />
        </div>
      ) : role ? (
        <RoleForm
          mode="edit"
          permissions={permissions}
          loading={submitLoading}
          initialValues={{
            name: role.name,
            slug: role.slug,
            description: role.description || "",
            isActive: role.isActive,
            permissionIds: role.rolePermissions.map(
              (item) => item.permissionId,
            ),
          }}
          onCancel={() => router.push(`/dashboard/roles/${id}`)}
          onSubmit={handleSubmit}
        />
      ) : (
        <div className="border border-red-100 bg-red-50 p-4 text-red-600">
          Role tidak ditemukan.
        </div>
      )}
    </div>
  );
}
