"use client";

import { useEffect, useState } from "react";
import { App, Button, Space, Spin } from "antd";
import { EyeOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";

import WarehouseForm, { WarehouseFormValues } from "./warehouse-form";

type WarehouseItem = {
  id: string;
  name: string;
  code: string;
  address?: string | null;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    rackLocations: number;
  };
};

type WarehouseEditPageClientProps = {
  id: string;
};

export default function WarehouseEditPageClient({
  id,
}: WarehouseEditPageClientProps) {
  const router = useRouter();
  const { message } = App.useApp();

  const [warehouse, setWarehouse] = useState<WarehouseItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  async function fetchWarehouse() {
    try {
      setLoading(true);

      const response = await fetch(`/api/warehouses/${id}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal mengambil warehouse");
      }

      setWarehouse(result.data);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal mengambil warehouse",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(values: WarehouseFormValues) {
    try {
      setSubmitLoading(true);

      const response = await fetch(`/api/warehouses/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal memperbarui warehouse");
      }

      message.success(result.message || "Warehouse berhasil diperbarui");

      router.push(`/dashboard/warehouses/${id}`);
      router.refresh();
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal memperbarui warehouse",
      );
    } finally {
      setSubmitLoading(false);
    }
  }

  useEffect(() => {
    void fetchWarehouse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div className="text-sm">
      <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="m-0 text-lg font-bold text-slate-950">
            Edit Warehouse
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Perbarui informasi warehouse dan lokasi penyimpanan.
          </p>
        </div>

        <Space size={8}>
          <Button
            icon={<EyeOutlined />}
            disabled={!warehouse}
            onClick={() => router.push(`/dashboard/warehouses/${id}`)}
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
        <WarehouseForm
          loading={submitLoading}
          submitText="Simpan Perubahan"
          initialValues={{
            name: warehouse?.name || "",
            code: warehouse?.code || "",
            address: warehouse?.address || "",
            description: warehouse?.description || "",
            isActive: warehouse?.isActive ?? true,
          }}
          onCancel={() => router.push(`/dashboard/warehouses/${id}`)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
