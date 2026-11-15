"use client";

import { useState } from "react";
import { App } from "antd";
import { useRouter } from "next/navigation";

import CustomerForm, { CustomerFormValues } from "./customer-form";

export default function CustomerCreatePageClient() {
  const router = useRouter();
  const { message } = App.useApp();

  const [loading, setLoading] = useState(false);

  async function handleSubmit(values: CustomerFormValues) {
    try {
      setLoading(true);

      const response = await fetch("/api/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal membuat customer");
      }

      message.success(result.message || "Customer berhasil dibuat");

      router.push(`/dashboard/customers/${result.data.id}`);
      router.refresh();
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal membuat customer",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="text-sm">
      <div className="mb-5 border-b border-slate-100 pb-4">
        <h1 className="m-0 text-lg font-bold text-slate-950">
          Tambah Customer
        </h1>

        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Buat data customer baru untuk kebutuhan transaksi penjualan dan
          pengelolaan pembayaran.
        </p>
      </div>

      <CustomerForm
        loading={loading}
        submitText="Simpan Customer"
        initialValues={{
          customerType: "INDIVIDUAL",
          isActive: true,
        }}
        onCancel={() => router.push("/dashboard/customers")}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
