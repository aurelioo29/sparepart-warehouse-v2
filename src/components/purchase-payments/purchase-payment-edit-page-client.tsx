"use client";

import { useEffect, useState } from "react";
import { App, Spin } from "antd";
import { useRouter } from "next/navigation";

import PurchasePaymentForm, {
  PayableOption,
  PurchasePaymentAttachment,
  PurchasePaymentFormValues,
} from "./purchase-payment-form";

type PurchasePaymentDetail = {
  id: string;
  stockInId: string;
  paymentDate: string;
  amount: number;
  method: string;
  referenceNumber?: string | null;
  notes?: string | null;
  attachments?: PurchasePaymentAttachment[];
  stockIn?: {
    id: string;
    documentNumber: string;
    invoiceNumber?: string | null;
    stockInDate: string;
    dueDate?: string | null;
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    paymentStatus: string;
    status: string;
    supplier?: {
      id: string;
      name: string;
    } | null;
  } | null;
};

type PurchasePaymentEditPageClientProps = {
  id: string;
};

export default function PurchasePaymentEditPageClient({
  id,
}: PurchasePaymentEditPageClientProps) {
  const router = useRouter();
  const { message } = App.useApp();

  const [payment, setPayment] = useState<PurchasePaymentDetail | null>(null);
  const [payables, setPayables] = useState<PayableOption[]>([]);

  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  async function fetchPayment() {
    try {
      setLoading(true);

      const response = await fetch(`/api/purchase-payments/${id}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch purchase payment");
      }

      setPayment(result.data);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error
          ? error.message
          : "Gagal mengambil purchase payment",
      );
    } finally {
      setLoading(false);
    }
  }

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
      setSubmitLoading(true);

      const formData = new FormData();

      formData.append("stockInId", values.stockInId);
      formData.append("paymentDate", values.paymentDate);
      formData.append("amount", String(values.amount || 0));
      formData.append("method", values.method);
      formData.append("referenceNumber", values.referenceNumber || "");
      formData.append("notes", values.notes || "");

      for (const attachmentId of values.removeAttachmentIds || []) {
        formData.append("removeAttachmentIds", attachmentId);
      }

      for (const file of values.proofFiles || []) {
        if (file.originFileObj) {
          formData.append("proofFiles", file.originFileObj);
        }
      }

      const response = await fetch(`/api/purchase-payments/${id}`, {
        method: "PUT",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to update purchase payment");
      }

      message.success(
        result.message || "Purchase payment updated successfully",
      );

      router.push(`/dashboard/purchase-payments/${id}`);
      router.refresh();
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error
          ? error.message
          : "Gagal update purchase payment",
      );
    } finally {
      setSubmitLoading(false);
    }
  }

  useEffect(() => {
    void fetchPayment();
    void fetchPayables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div className="text-sm">
      <div className="mb-5 border-b border-slate-100 pb-4">
        <h1 className="m-0 text-lg font-bold text-slate-950">
          Edit Purchase Payment
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Update pembayaran supplier, ganti nominal, dan kelola bukti
          pembayaran.
        </p>
      </div>

      {loading ? (
        <div className="flex min-h-[240px] items-center justify-center">
          <Spin />
        </div>
      ) : (
        <PurchasePaymentForm
          mode="edit"
          payables={payables}
          loading={submitLoading}
          submitText="Save Changes"
          initialStockInId={payment?.stockInId || payment?.stockIn?.id || null}
          initialValues={
            payment
              ? {
                  stockInId: payment.stockInId || payment.stockIn?.id || "",
                  paymentDate: payment.paymentDate,
                  amount: Number(payment.amount || 0),
                  method: payment.method || "CASH",
                  referenceNumber: payment.referenceNumber || null,
                  notes: payment.notes || null,
                  proofFiles: [],
                  removeAttachmentIds: [],
                }
              : undefined
          }
          existingAttachments={payment?.attachments || []}
          currentPaymentAmount={Number(payment?.amount || 0)}
          onCancel={() => router.push(`/dashboard/purchase-payments/${id}`)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
