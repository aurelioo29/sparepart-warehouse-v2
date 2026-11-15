"use client";

import { useEffect, useState } from "react";
import { App, Button, Space, Spin } from "antd";
import { EyeOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";

import SupplierForm, { SupplierFormValues } from "./supplier-form";

type SupplierItem = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  contactPerson?: string | null;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type SupplierEditPageClientProps = {
  id: string;
};

export default function SupplierEditPageClient({
  id,
}: SupplierEditPageClientProps) {
  const router = useRouter();
  const { message } = App.useApp();

  const [supplier, setSupplier] = useState<SupplierItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  async function fetchSupplier() {
    try {
      setLoading(true);

      const response = await fetch(`/api/suppliers/${id}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal mengambil supplier");
      }

      setSupplier(result.data);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal mengambil supplier",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(values: SupplierFormValues) {
    try {
      setSubmitLoading(true);

      const response = await fetch(`/api/suppliers/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal memperbarui supplier");
      }

      message.success(result.message || "Supplier berhasil diperbarui");

      router.push(`/dashboard/suppliers/${id}`);
      router.refresh();
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal memperbarui supplier",
      );
    } finally {
      setSubmitLoading(false);
    }
  }

  useEffect(() => {
    void fetchSupplier();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div className="text-sm">
      <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="m-0 text-lg font-bold text-slate-950">
            Edit Supplier
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Perbarui informasi supplier.
          </p>
        </div>

        <Space size={8}>
          <Button
            icon={<EyeOutlined />}
            disabled={!supplier}
            onClick={() => router.push(`/dashboard/suppliers/${id}`)}
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
        <SupplierForm
          loading={submitLoading}
          submitText="Simpan Perubahan"
          initialValues={{
            name: supplier?.name || "",
            phone: supplier?.phone || "",
            email: supplier?.email || "",
            address: supplier?.address || "",
            contactPerson: supplier?.contactPerson || "",
            description: supplier?.description || "",
            isActive: supplier?.isActive ?? true,
          }}
          onCancel={() => router.push(`/dashboard/suppliers/${id}`)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
