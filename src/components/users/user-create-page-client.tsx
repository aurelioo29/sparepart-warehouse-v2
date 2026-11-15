"use client";

import { useEffect, useState } from "react";
import { App } from "antd";
import { useRouter } from "next/navigation";

import UserForm, { RoleOption, UserFormValues } from "./user-form";

export default function UserCreatePageClient() {
  const router = useRouter();
  const { message } = App.useApp();

  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(false);

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
        error instanceof Error ? error.message : "Gagal mengambil role",
      );
    }
  }

  async function handleSubmit(values: UserFormValues) {
    try {
      setLoading(true);

      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to create user");
      }

      message.success(result.message || "User created successfully");

      router.push(`/dashboard/users/${result.data.id}`);
      router.refresh();
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal membuat user",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchRoles();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="text-sm">
      <div className="mb-5 border-b border-slate-100 pb-4">
        <h1 className="m-0 text-lg font-bold text-slate-950">Create User</h1>

        <p className="mt-1 text-sm text-slate-500">
          Buat akun baru, pilih role, status, dan permission user.
        </p>
      </div>

      <UserForm
        mode="create"
        roles={roles}
        loading={loading}
        submitText="Create User"
        initialValues={{
          isActive: true,
          customPermissions: [],
        }}
        onCancel={() => router.push("/dashboard/users")}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
