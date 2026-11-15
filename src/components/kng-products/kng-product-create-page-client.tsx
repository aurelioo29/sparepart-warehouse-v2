"use client";

import { App } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";

import KngProductForm, { KngProductFormValues } from "./kng-product-form";

export default function KngProductCreatePageClient() {
  const router = useRouter();
  const { message } = App.useApp();

  const [loading, setLoading] = useState(false);

  async function handleSubmit(values: KngProductFormValues) {
    try {
      setLoading(true);

      const response = await fetch("/api/kng-products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal membuat product KNG");
      }

      message.success(result.message || "Product KNG berhasil dibuat");

      router.push(`/dashboard/kng-products/${result.data.id}`);
      router.refresh();
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal membuat product KNG",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="text-sm">
      <div className="mb-5 border-b border-slate-100 pb-4">
        <h1 className="m-0 text-lg font-bold text-slate-950">
          Tambah Product KNG
        </h1>

        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Buat master product KNG untuk kebutuhan order berdasarkan jenis, part
          number, dan harga JKT.
        </p>
      </div>

      <KngProductForm
        loading={loading}
        submitText="Simpan Product"
        initialValues={{
          isActive: true,
        }}
        onCancel={() => router.push("/dashboard/kng-products")}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
