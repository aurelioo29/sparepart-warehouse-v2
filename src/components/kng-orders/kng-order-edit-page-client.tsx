"use client";

import { useEffect, useState } from "react";
import { App, Button, Space, Spin } from "antd";
import { EyeOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";

import KngOrderForm, { KngOrderFormValues } from "./kng-order-form";

type KngOrderDetailItem = {
  id: string;
  kngProductId: string;
  jenisSnapshot: string;
  partNumberSnapshot: string;
  hargaJkt: string | number;
  hargaNetto: string | number;
  quantity: number;
  totalAmount: string | number;
};

type KngOrderDetail = {
  id: string;
  orderNumber: string;
  orderDate: string;
  discountPercent: string | number;
  totalQty: number;
  totalAmount: string | number;
  status: string;
  noteFranco?: string | null;
  noteTop?: string | null;
  notes?: string | null;
  items: KngOrderDetailItem[];
};

type KngOrderEditPageClientProps = {
  id: string;
};

export default function KngOrderEditPageClient({
  id,
}: KngOrderEditPageClientProps) {
  const router = useRouter();
  const { message } = App.useApp();

  const [order, setOrder] = useState<KngOrderDetail | null>(null);
  const [orderNumber, setOrderNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  async function fetchOrder() {
    try {
      setLoading(true);

      const response = await fetch(`/api/kng-orders/${id}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal mengambil order KNG");
      }

      const data: KngOrderDetail = result.data;

      setOrder(data);
      setOrderNumber(data.orderNumber);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal mengambil order KNG",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(values: KngOrderFormValues) {
    try {
      setSubmitLoading(true);

      const response = await fetch(`/api/kng-orders/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal memperbarui order KNG");
      }

      message.success(result.message || "Order KNG berhasil diperbarui");

      router.push(`/dashboard/kng-orders/${id}`);
      router.refresh();
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal memperbarui order KNG",
      );
    } finally {
      setSubmitLoading(false);
    }
  }

  useEffect(() => {
    void fetchOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div className="text-sm">
      <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="m-0 text-lg font-bold text-slate-950">
            Edit Order KNG
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Perbarui order KNG dan item order.
          </p>
        </div>

        <Space size={8}>
          <Button
            icon={<EyeOutlined />}
            disabled={!order}
            onClick={() => router.push(`/dashboard/kng-orders/${id}`)}
          >
            Lihat Detail
          </Button>
        </Space>
      </div>

      {loading ? (
        <div className="flex min-h-[240px] items-center justify-center">
          <Spin />
        </div>
      ) : order ? (
        <KngOrderForm
          loading={submitLoading}
          submitText="Simpan Perubahan"
          orderNumber={orderNumber}
          initialValues={{
            orderNumber: order.orderNumber,
            orderDate: dayjs(order.orderDate).format("YYYY-MM-DD"),
            discountPercent: Number(order.discountPercent || 30),
            noteFranco: order.noteFranco || "Frangko Medan",
            noteTop: order.noteTop || "Top = 125 hari",
            notes: order.notes || "",
            items: order.items.map((item) => ({
              jenis: item.jenisSnapshot,
              kngProductId: item.kngProductId,
              quantity: item.quantity,
              hargaNetto: Number(item.hargaNetto || 0),
            })),
          }}
          onCancel={() => router.push(`/dashboard/kng-orders/${id}`)}
          onSubmit={handleSubmit}
        />
      ) : null}
    </div>
  );
}
