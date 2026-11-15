"use client";

import { useEffect, useState } from "react";
import { App, Button, Space, Spin } from "antd";
import { EyeOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";

import SalesmanForm, { SalesmanFormValues, UserOption } from "./salesman-form";

type SalesmanItem = {
  id: string;
  userId?: string | null;
  code: string;
  name: string;
  salesmanType: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  commissionType: string;
  commissionValue?: string | number | null;
  joinDate?: string | null;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  user?: UserOption | null;
};

type SalesmanEditPageClientProps = {
  id: string;
};

function toNullableNumber(value?: number | string | null) {
  if (value === null || value === undefined || value === "") return null;

  return Number(value);
}

export default function SalesmanEditPageClient({
  id,
}: SalesmanEditPageClientProps) {
  const router = useRouter();
  const { message } = App.useApp();

  const [salesman, setSalesman] = useState<SalesmanItem | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);

  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  async function fetchUsers() {
    try {
      const response = await fetch("/api/users/options");
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch users");
      }

      setUsers(result.data || []);
    } catch (error) {
      console.error(error);
      message.error("Gagal mengambil user options");
    }
  }

  async function fetchSalesman() {
    try {
      setLoading(true);

      const response = await fetch(`/api/salesmen/${id}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal mengambil salesman");
      }

      setSalesman(result.data);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal mengambil salesman",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(values: SalesmanFormValues) {
    try {
      setSubmitLoading(true);

      const response = await fetch(`/api/salesmen/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal memperbarui salesman");
      }

      message.success(result.message || "Salesman berhasil diperbarui");

      router.push(`/dashboard/salesmen/${id}`);
      router.refresh();
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal memperbarui salesman",
      );
    } finally {
      setSubmitLoading(false);
    }
  }

  useEffect(() => {
    void fetchUsers();
    void fetchSalesman();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div className="text-sm">
      <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="m-0 text-lg font-bold text-slate-950">
            Edit Salesman
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Perbarui informasi salesman dan pengaturan komisi.
          </p>
        </div>

        <Space size={8}>
          <Button
            icon={<EyeOutlined />}
            disabled={!salesman}
            onClick={() => router.push(`/dashboard/salesmen/${id}`)}
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
        <SalesmanForm
          users={users}
          loading={submitLoading}
          submitText="Simpan Perubahan"
          initialValues={{
            userId: salesman?.userId || null,
            code: salesman?.code || "",
            name: salesman?.name || "",
            salesmanType: salesman?.salesmanType || "FREELANCE",
            phone: salesman?.phone || "",
            email: salesman?.email || "",
            address: salesman?.address || "",
            commissionType: salesman?.commissionType || "NONE",
            commissionValue: toNullableNumber(salesman?.commissionValue),
            joinDate: salesman?.joinDate
              ? dayjs(salesman.joinDate).format("YYYY-MM-DD")
              : null,
            description: salesman?.description || "",
            isActive: salesman?.isActive ?? true,
          }}
          onCancel={() => router.push(`/dashboard/salesmen/${id}`)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
