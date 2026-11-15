"use client";

import { useState } from "react";
import { App } from "antd";
import { useRouter } from "next/navigation";

import WarehouseForm, { WarehouseFormValues } from "./warehouse-form";

export default function WarehouseCreatePageClient() {
  const router = useRouter();
  const { message } = App.useApp();

  const [loading, setLoading] = useState(false);

  async function handleSubmit(values: WarehouseFormValues) {
    try {
      setLoading(true);

      const response = await fetch("/api/warehouses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal membuat warehouse");
      }

      message.success(result.message || "Warehouse berhasil dibuat");

      router.push(`/dashboard/warehouses/${result.data.id}`);
      router.refresh();
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal membuat warehouse",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="text-sm">
      <div className="mb-5 border-b border-slate-100 pb-4">
        <h1 className="m-0 text-lg font-bold text-slate-950">
          Tambah Warehouse
        </h1>

        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Buat data warehouse baru untuk mengatur lokasi penyimpanan barang.
        </p>
      </div>

      <WarehouseForm
        loading={loading}
        submitText="Simpan Warehouse"
        initialValues={{
          isActive: true,
        }}
        onCancel={() => router.push("/dashboard/warehouses")}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
