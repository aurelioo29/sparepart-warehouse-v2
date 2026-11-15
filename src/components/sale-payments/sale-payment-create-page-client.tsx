"use client";

import { useEffect, useState } from "react";
import { App } from "antd";
import { useRouter, useSearchParams } from "next/navigation";

import SalePaymentForm, {
  SalePaymentFormValues,
  UnpaidSaleOption,
} from "./sale-payment-form";

export default function SalePaymentCreatePageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { message } = App.useApp();

  const initialSaleId = searchParams.get("saleId");

  const [sales, setSales] = useState<UnpaidSaleOption[]>([]);
  const [loading, setLoading] = useState(false);

  async function fetchUnpaidSales() {
    try {
      const response = await fetch("/api/sales/unpaid-options");
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch unpaid sales");
      }

      setSales(result.data || []);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error
          ? error.message
          : "Gagal mengambil invoice belum lunas",
      );
    }
  }

  async function handleSubmit(values: SalePaymentFormValues) {
    try {
      setLoading(true);

      const response = await fetch("/api/sale-payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to create sale payment");
      }

      message.success(result.message || "Sale payment created successfully");

      router.push(`/dashboard/sales-payments/${result.data.id}`);
      router.refresh();
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal membuat pembayaran",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchUnpaidSales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="text-sm">
      <div className="mb-5 border-b border-slate-100 pb-4">
        <h1 className="m-0 text-lg font-bold text-slate-950">
          Create Sale Payment
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Tambahkan pembayaran invoice. Diskon persen bisa dipakai untuk
          pelunasan cepat sebelum deadline.
        </p>
      </div>

      <SalePaymentForm
        mode="create"
        sales={sales}
        loading={loading}
        submitText="Create Payment"
        initialSaleId={initialSaleId}
        onCancel={() => router.push("/dashboard/sales-payments")}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
