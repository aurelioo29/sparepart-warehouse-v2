"use client";

import { useEffect, useState } from "react";
import { App, Spin } from "antd";
import { useRouter } from "next/navigation";

import SalePaymentForm, {
  SalePaymentFormValues,
  SalePaymentInitialValues,
  UnpaidSaleOption,
} from "./sale-payment-form";

type SalePaymentEditPageClientProps = {
  id: string;
};

function mapPaymentToInitialValues(data: any): SalePaymentInitialValues {
  return {
    id: data.id,
    saleId: data.saleId,
    paymentDate: data.paymentDate,
    amount: data.amount,
    discountPercent: data.discountPercent || 0,
    discountAmount: data.discountAmount || 0,
    method: data.method,
    referenceNumber: data.referenceNumber || null,
    notes: data.notes || null,
    sale: {
      id: data.sale.id,
      invoiceNumber: data.sale.invoiceNumber,
      saleDate: data.sale.saleDate,
      totalAmount: data.sale.totalAmount,
      paidAmount: data.sale.paidAmount,
      remainingAmount: data.sale.remainingAmount,
      paymentStatus: data.sale.paymentStatus,
      customer: data.sale.customer || null,
    },
  };
}

export default function SalePaymentEditPageClient({
  id,
}: SalePaymentEditPageClientProps) {
  const router = useRouter();
  const { message } = App.useApp();

  const [payment, setPayment] = useState<SalePaymentInitialValues | null>(null);
  const [sales, setSales] = useState<UnpaidSaleOption[]>([]);

  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  async function fetchPayment() {
    try {
      setLoading(true);

      const response = await fetch(`/api/sale-payments/${id}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch sale payment");
      }

      setPayment(mapPaymentToInitialValues(result.data));
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error
          ? error.message
          : "Gagal mengambil detail pembayaran",
      );
    } finally {
      setLoading(false);
    }
  }

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
      setSubmitLoading(true);

      const response = await fetch(`/api/sale-payments/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to update sale payment");
      }

      message.success(result.message || "Sale payment updated successfully");

      router.push(`/dashboard/sales-payments/${id}`);
      router.refresh();
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal update pembayaran",
      );
    } finally {
      setSubmitLoading(false);
    }
  }

  useEffect(() => {
    void fetchPayment();
    void fetchUnpaidSales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div className="text-sm">
      <div className="mb-5 border-b border-slate-100 pb-4">
        <h1 className="m-0 text-lg font-bold text-slate-950">
          Edit Sale Payment
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Update nominal, diskon persen, metode, tanggal, referensi, dan catatan
          pembayaran.
        </p>
      </div>

      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center border border-slate-100 bg-white">
          <Spin />
        </div>
      ) : (
        <SalePaymentForm
          mode="edit"
          sales={sales}
          loading={submitLoading}
          submitText="Save Changes"
          initialValues={payment}
          onCancel={() => router.push(`/dashboard/sales-payments/${id}`)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
