"use client";

import { App } from "antd";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import dayjs from "dayjs";

import KngOrderForm, { KngOrderFormValues } from "./kng-order-form";

const defaultOrderDate = dayjs().format("YYYY-MM-DD");

export default function KngOrderCreatePageClient() {
  const router = useRouter();
  const { message } = App.useApp();

  const [loading, setLoading] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");

  async function fetchNextNumber(orderDate: string) {
    if (!orderDate) {
      setOrderNumber("");
      return;
    }

    try {
      const query = new URLSearchParams({
        orderDate,
      });

      const response = await fetch(
        `/api/kng-orders/next-number?${query.toString()}`,
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal membuat nomor order");
      }

      setOrderNumber(result.data?.orderNumber || "");
    } catch (error) {
      console.error(error);

      setOrderNumber("");
    }
  }

  async function handleSubmit(values: KngOrderFormValues) {
    try {
      setLoading(true);

      const response = await fetch("/api/kng-orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal membuat order KNG");
      }

      message.success(result.message || "Order KNG berhasil dibuat");

      router.push(`/dashboard/kng-orders/${result.data.id}`);
      router.refresh();
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal membuat order KNG",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchNextNumber(defaultOrderDate);
  }, []);

  return (
    <div className="text-sm">
      <div className="mb-5 border-b border-slate-100 pb-4">
        <h1 className="m-0 text-lg font-bold text-slate-950">
          Tambah Order KNG
        </h1>

        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Buat order KNG dengan nomor otomatis, pilih jenis, pilih barang, dan
          isi order/pc.
        </p>
      </div>

      <KngOrderForm
        loading={loading}
        submitText="Simpan Order"
        orderNumber={orderNumber}
        initialValues={{
          orderDate: defaultOrderDate,
          discountPercent: 30,
          noteFranco: "Frangko Medan",
          noteTop: "Top = 125 hari",
          notes: "",
          items: [
            {
              jenis: "",
              kngProductId: "",
              quantity: 1,
            },
          ],
        }}
        onOrderDateChange={(orderDate) => void fetchNextNumber(orderDate)}
        onCancel={() => router.push("/dashboard/kng-orders")}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
