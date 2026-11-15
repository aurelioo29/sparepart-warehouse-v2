"use client";

import { useEffect, useState } from "react";
import { App, Spin } from "antd";
import { useRouter } from "next/navigation";

import UserForm, {
  RoleOption,
  UserFormInitialValues,
  UserFormValues,
} from "./user-form";

type UserEditPageClientProps = {
  id: string;
};

export default function UserEditPageClient({ id }: UserEditPageClientProps) {
  const router = useRouter();
  const { message } = App.useApp();

  const [user, setUser] = useState<UserFormInitialValues | null>(null);

  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);

  async function fetchData() {
    try {
      setLoading(true);

      const [userResponse, rolesResponse] = await Promise.all([
        fetch(`/api/users/${id}`),
        fetch("/api/roles/options"),
      ]);

      const [userResult, rolesResult] = await Promise.all([
        userResponse.json(),
        rolesResponse.json(),
      ]);

      if (!userResponse.ok || !userResult.success) {
        throw new Error(userResult.message || "Failed to fetch user");
      }

      if (!rolesResponse.ok || !rolesResult.success) {
        throw new Error(rolesResult.message || "Failed to fetch roles");
      }

      setUser(userResult.data);
      setRoles(rolesResult.data || []);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal mengambil user",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(values: UserFormValues) {
    try {
      setSubmitLoading(true);

      const payload: Partial<UserFormValues> = {
        ...values,
      };

      if (!values.password) {
        delete payload.password;
      }

      const response = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to update user");
      }

      message.success(result.message || "User updated successfully");

      router.push(`/dashboard/users/${id}`);
      router.refresh();
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal update user",
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
        <h1 className="m-0 text-lg font-bold text-slate-950">Edit User</h1>

        <p className="mt-1 text-sm text-slate-500">
          Update identitas, role, status, password, dan permission.
        </p>
      </div>

      {loading ? (
        <div className="flex min-h-[260px] items-center justify-center">
          <Spin />
        </div>
      ) : user ? (
        <UserForm
          mode="edit"
          roles={roles}
          initialValues={user}
          loading={submitLoading}
          submitText="Save Changes"
          onCancel={() => router.push(`/dashboard/users/${id}`)}
          onSubmit={handleSubmit}
        />
      ) : (
        <div className="border border-red-100 bg-red-50 p-4 text-red-600">
          User tidak ditemukan.
        </div>
      )}
    </div>
  );
}
