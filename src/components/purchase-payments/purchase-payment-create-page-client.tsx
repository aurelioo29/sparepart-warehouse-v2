"use client";

import { useEffect, useState } from "react";
import { App } from "antd";
import { useRouter, useSearchParams } from "next/navigation";

import PurchasePaymentForm, {
  PayableOption,
  PurchasePaymentFormValues,
} from "./purchase-payment-form";

export default function PurchasePaymentCreatePageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { message } = App.useApp();

  const initialStockInId = searchParams.get("stockInId");

  const [payables, setPayables] = useState<PayableOption[]>([]);
  const [loading, setLoading] = useState(false);

  async function fetchPayables() {
    try {
      const response = await fetch("/api/payables");
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch payables");
      }

      setPayables(result.data.items || []);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal mengambil payables",
      );
    }
  }

  async function handleSubmit(values: PurchasePaymentFormValues) {
    try {
      setLoading(true);

      const formData = new FormData();

      formData.append("stockInId", values.stockInId);
      formData.append("paymentDate", values.paymentDate);
      formData.append("amount", String(values.amount || 0));
      formData.append("method", values.method);
      formData.append("referenceNumber", values.referenceNumber || "");
      formData.append("notes", values.notes || "");

      for (const file of values.proofFiles || []) {
        if (file.originFileObj) {
          formData.append("proofFiles", file.originFileObj);
        }
      }

      const response = await fetch("/api/purchase-payments", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to create purchase payment");
      }

      message.success(
        result.message || "Purchase payment created successfully",
      );

      router.push(`/dashboard/purchase-payments/${result.data.payment.id}`);
      router.refresh();
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error
          ? error.message
          : "Gagal membuat purchase payment",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchPayables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="text-sm">
      <div className="mb-5 border-b border-slate-100 pb-4">
        <h1 className="m-0 text-lg font-bold text-slate-950">
          Create Purchase Payment
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Catat pembayaran supplier, pilih invoice pembelian, dan upload bukti
          pembayaran.
        </p>
      </div>

      <PurchasePaymentForm
        payables={payables}
        loading={loading}
        submitText="Save Payment"
        initialStockInId={initialStockInId}
        onCancel={() => router.push("/dashboard/purchase-payments")}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
