"use client";

import { useEffect, useState } from "react";
import { App, Button, Space, Spin } from "antd";
import { EyeOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";

import KngProductForm, { KngProductFormValues } from "./kng-product-form";

type KngProductItem = {
  id: string;
  jenis: string;
  partNumber: string;
  hargaJkt: string | number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type KngProductEditPageClientProps = {
  id: string;
};

export default function KngProductEditPageClient({
  id,
}: KngProductEditPageClientProps) {
  const router = useRouter();
  const { message } = App.useApp();

  const [product, setProduct] = useState<KngProductItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  async function fetchProduct() {
    try {
      setLoading(true);

      const response = await fetch(`/api/kng-products/${id}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal mengambil product KNG");
      }

      setProduct(result.data);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal mengambil product KNG",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(values: KngProductFormValues) {
    try {
      setSubmitLoading(true);

      const response = await fetch(`/api/kng-products/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal memperbarui product KNG");
      }

      message.success(result.message || "Product KNG berhasil diperbarui");

      router.push(`/dashboard/kng-products/${id}`);
      router.refresh();
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error
          ? error.message
          : "Gagal memperbarui product KNG",
      );
    } finally {
      setSubmitLoading(false);
    }
  }

  useEffect(() => {
    void fetchProduct();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div className="text-sm">
      <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="m-0 text-lg font-bold text-slate-950">
            Edit Product KNG
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Perbarui master product KNG.
          </p>
        </div>

        <Space size={8}>
          <Button
            icon={<EyeOutlined />}
            disabled={!product}
            onClick={() => router.push(`/dashboard/kng-products/${id}`)}
          >
            Lihat Detail
          </Button>
        </Space>
      </div>

      {loading ? (
        <div className="flex min-h-[240px] items-center justify-center">
          <Spin />
        </div>
      ) : (
        <KngProductForm
          loading={submitLoading}
          submitText="Simpan Perubahan"
          initialValues={{
            jenis: product?.jenis || "",
            partNumber: product?.partNumber || "",
            hargaJkt: Number(product?.hargaJkt || 0),
            isActive: product?.isActive ?? true,
          }}
          onCancel={() => router.push(`/dashboard/kng-products/${id}`)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
