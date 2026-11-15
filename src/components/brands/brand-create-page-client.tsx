"use client";

import { App } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";

import BrandForm, { BrandFormValues } from "./brand-form";

export default function BrandCreatePageClient() {
  const router = useRouter();
  const { message } = App.useApp();

  const [loading, setLoading] = useState(false);

  async function handleSubmit(values: BrandFormValues) {
    try {
      setLoading(true);

      const response = await fetch("/api/brands", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal membuat brand");
      }

      message.success(result.message || "Brand berhasil dibuat");

      router.push(`/dashboard/brands/${result.data.id}`);
      router.refresh();
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal membuat brand",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="text-sm">
      <div className="mb-5 border-b border-slate-100 pb-4">
        <h1 className="m-0 text-lg font-bold text-slate-950">Tambah Brand</h1>

        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Buat brand baru untuk mengelompokkan produk berdasarkan merek.
        </p>
      </div>

      <BrandForm
        loading={loading}
        submitText="Simpan Brand"
        initialValues={{
          isActive: true,
        }}
        onCancel={() => router.push("/dashboard/brands")}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
