"use client";

import { useEffect, useState } from "react";
import { App, Button, Space, Spin } from "antd";
import { EyeOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";

import CustomerForm, { CustomerFormValues } from "./customer-form";

type CustomerItem = {
  id: string;
  name: string;
  customerType: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  creditLimit?: number | string | null;
  paymentTermDays?: number | null;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type CustomerEditPageClientProps = {
  id: string;
};

function toNullableNumber(value?: number | string | null) {
  if (value === null || value === undefined || value === "") return null;

  return Number(value);
}

export default function CustomerEditPageClient({
  id,
}: CustomerEditPageClientProps) {
  const router = useRouter();
  const { message } = App.useApp();

  const [customer, setCustomer] = useState<CustomerItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  async function fetchCustomer() {
    try {
      setLoading(true);

      const response = await fetch(`/api/customers/${id}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal mengambil customer");
      }

      setCustomer(result.data);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal mengambil customer",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(values: CustomerFormValues) {
    try {
      setSubmitLoading(true);

      const response = await fetch(`/api/customers/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal memperbarui customer");
      }

      message.success(result.message || "Customer berhasil diperbarui");

      router.push(`/dashboard/customers/${id}`);
      router.refresh();
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal memperbarui customer",
      );
    } finally {
      setSubmitLoading(false);
    }
  }

  useEffect(() => {
    void fetchCustomer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div className="text-sm">
      <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="m-0 text-lg font-bold text-slate-950">
            Edit Customer
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Perbarui informasi customer.
          </p>
        </div>

        <Space size={8}>
          <Button
            icon={<EyeOutlined />}
            disabled={!customer}
            onClick={() => router.push(`/dashboard/customers/${id}`)}
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
        <CustomerForm
          loading={submitLoading}
          submitText="Simpan Perubahan"
          initialValues={{
            name: customer?.name || "",
            customerType: customer?.customerType || "INDIVIDUAL",
            phone: customer?.phone || "",
            email: customer?.email || "",
            address: customer?.address || "",
            creditLimit: toNullableNumber(customer?.creditLimit),
            paymentTermDays: customer?.paymentTermDays ?? null,
            description: customer?.description || "",
            isActive: customer?.isActive ?? true,
          }}
          onCancel={() => router.push(`/dashboard/customers/${id}`)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
