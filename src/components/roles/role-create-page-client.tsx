"use client";

import { useEffect, useState } from "react";
import { App } from "antd";
import { useRouter } from "next/navigation";

import RoleForm, { PermissionOption, RoleFormValues } from "./role-form";

export default function RoleCreatePageClient() {
  const router = useRouter();
  const { message } = App.useApp();

  const [permissions, setPermissions] = useState<PermissionOption[]>([]);

  const [loading, setLoading] = useState(false);

  async function fetchPermissions() {
    try {
      const response = await fetch("/api/permissions/options");

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch permissions");
      }

      setPermissions(result.data || []);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal mengambil permissions",
      );
    }
  }

  async function handleSubmit(values: RoleFormValues) {
    try {
      setLoading(true);

      const response = await fetch("/api/roles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to create role");
      }

      message.success(result.message || "Role created successfully");

      router.push(`/dashboard/roles/${result.data.id}`);

      router.refresh();
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal membuat role",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchPermissions();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="text-sm">
      <div className="mb-5 border-b border-slate-100 pb-4">
        <h1 className="m-0 text-lg font-bold text-slate-950">Create Role</h1>

        <p className="mt-1 text-sm text-slate-500">
          Buat role baru dan tentukan permission yang dapat digunakan.
        </p>
      </div>

      <RoleForm
        mode="create"
        permissions={permissions}
        loading={loading}
        initialValues={{
          isActive: true,
          permissionIds: [],
        }}
        onCancel={() => router.push("/dashboard/roles")}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
