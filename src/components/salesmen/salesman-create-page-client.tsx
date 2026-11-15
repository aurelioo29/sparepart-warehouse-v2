"use client";

import { useEffect, useState } from "react";
import { App } from "antd";
import { useRouter } from "next/navigation";

import SalesmanForm, { SalesmanFormValues, UserOption } from "./salesman-form";

export default function SalesmanCreatePageClient() {
  const router = useRouter();
  const { message } = App.useApp();

  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);

  async function fetchUsers() {
    try {
      const response = await fetch("/api/users/options");
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch users");
      }

      setUsers(result.data || []);
    } catch (error) {
      console.error(error);
      message.error("Gagal mengambil user options");
    }
  }

  async function handleSubmit(values: SalesmanFormValues) {
    try {
      setLoading(true);

      const response = await fetch("/api/salesmen", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal membuat salesman");
      }

      message.success(result.message || "Salesman berhasil dibuat");

      router.push(`/dashboard/salesmen/${result.data.id}`);
      router.refresh();
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal membuat salesman",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="text-sm">
      <div className="mb-5 border-b border-slate-100 pb-4">
        <h1 className="m-0 text-lg font-bold text-slate-950">
          Tambah Salesman
        </h1>

        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Buat data salesman baru untuk kebutuhan penjualan dan komisi.
        </p>
      </div>

      <SalesmanForm
        users={users}
        loading={loading}
        submitText="Simpan Salesman"
        initialValues={{
          salesmanType: "FREELANCE",
          commissionType: "NONE",
          isActive: true,
        }}
        onCancel={() => router.push("/dashboard/salesmen")}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
