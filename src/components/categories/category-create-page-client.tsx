"use client";

import { App } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";

import CategoryForm, { CategoryFormValues } from "./category-form";

export default function CategoryCreatePageClient() {
  const router = useRouter();
  const { message } = App.useApp();

  const [loading, setLoading] = useState(false);

  async function handleSubmit(values: CategoryFormValues) {
    try {
      setLoading(true);

      const response = await fetch("/api/categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal membuat kategori");
      }

      message.success(result.message || "Kategori berhasil dibuat");

      router.push(`/dashboard/categories/${result.data.id}`);
      router.refresh();
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal membuat kategori",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="text-sm">
      <div className="mb-5 border-b border-slate-100 pb-4">
        <h1 className="m-0 text-lg font-bold text-slate-950">
          Tambah Kategori
        </h1>

        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Buat kategori baru untuk mengelompokkan produk sparepart.
        </p>
      </div>

      <CategoryForm
        loading={loading}
        submitText="Simpan Kategori"
        initialValues={{
          isActive: true,
        }}
        onCancel={() => router.push("/dashboard/categories")}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
