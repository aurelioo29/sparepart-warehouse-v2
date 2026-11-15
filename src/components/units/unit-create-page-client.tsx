"use client";

import { App } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";

import UnitForm, { UnitFormValues } from "./unit-form";

export default function UnitCreatePageClient() {
  const router = useRouter();
  const { message } = App.useApp();

  const [loading, setLoading] = useState(false);

  async function handleSubmit(values: UnitFormValues) {
    try {
      setLoading(true);

      const response = await fetch("/api/units", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal membuat unit");
      }

      message.success(result.message || "Unit berhasil dibuat");

      router.push(`/dashboard/units/${result.data.id}`);
      router.refresh();
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal membuat unit",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="text-sm">
      <div className="mb-5 border-b border-slate-100 pb-4">
        <h1 className="m-0 text-lg font-bold text-slate-950">Tambah Unit</h1>

        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Buat unit baru untuk menentukan satuan produk, seperti pcs, box, atau
          set.
        </p>
      </div>

      <UnitForm
        loading={loading}
        submitText="Simpan Unit"
        initialValues={{
          isActive: true,
        }}
        onCancel={() => router.push("/dashboard/units")}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
