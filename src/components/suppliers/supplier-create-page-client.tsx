"use client";

import { useState } from "react";
import { App } from "antd";
import { useRouter } from "next/navigation";

import SupplierForm, { SupplierFormValues } from "./supplier-form";

export default function SupplierCreatePageClient() {
  const router = useRouter();
  const { message } = App.useApp();

  const [loading, setLoading] = useState(false);

  async function handleSubmit(values: SupplierFormValues) {
    try {
      setLoading(true);

      const response = await fetch("/api/suppliers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal membuat supplier");
      }

      message.success(result.message || "Supplier berhasil dibuat");

      router.push(`/dashboard/suppliers/${result.data.id}`);
      router.refresh();
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal membuat supplier",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="text-sm">
      <div className="mb-5 border-b border-slate-100 pb-4">
        <h1 className="m-0 text-lg font-bold text-slate-950">
          Tambah Supplier
        </h1>

        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Buat data supplier baru untuk kebutuhan pembelian dan stok barang.
        </p>
      </div>

      <SupplierForm
        loading={loading}
        submitText="Simpan Supplier"
        initialValues={{
          isActive: true,
        }}
        onCancel={() => router.push("/dashboard/suppliers")}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
