"use client";

import { useEffect, useState } from "react";
import { App, Button, Space, Spin } from "antd";
import { EyeOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";

import BrandForm, { BrandFormValues } from "./brand-form";

type BrandItem = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type BrandEditPageClientProps = {
  id: string;
};

export default function BrandEditPageClient({ id }: BrandEditPageClientProps) {
  const router = useRouter();
  const { message } = App.useApp();

  const [brand, setBrand] = useState<BrandItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  async function fetchBrand() {
    try {
      setLoading(true);

      const response = await fetch(`/api/brands/${id}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal mengambil brand");
      }

      setBrand(result.data);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal mengambil brand",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(values: BrandFormValues) {
    try {
      setSubmitLoading(true);

      const response = await fetch(`/api/brands/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal memperbarui brand");
      }

      message.success(result.message || "Brand berhasil diperbarui");

      router.push(`/dashboard/brands/${id}`);
      router.refresh();
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal memperbarui brand",
      );
    } finally {
      setSubmitLoading(false);
    }
  }

  useEffect(() => {
    void fetchBrand();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div className="text-sm">
      <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="m-0 text-lg font-bold text-slate-950">Edit Brand</h1>

          <p className="mt-1 text-sm text-slate-500">
            Perbarui informasi brand produk.
          </p>
        </div>

        <Space size={8}>
          <Button
            icon={<EyeOutlined />}
            disabled={!brand}
            onClick={() => router.push(`/dashboard/brands/${id}`)}
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
        <BrandForm
          loading={submitLoading}
          submitText="Simpan Perubahan"
          initialValues={{
            name: brand?.name || "",
            description: brand?.description || "",
            isActive: brand?.isActive ?? true,
          }}
          onCancel={() => router.push(`/dashboard/brands/${id}`)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
