"use client";

import { useEffect, useState } from "react";
import { App, Button, Space, Spin } from "antd";
import { EyeOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";

import RackLocationForm, {
  RackLocationFormValues,
  WarehouseOption,
} from "./rack-location-form";

type RackLocationItem = {
  id: string;
  warehouseId: string;
  name: string;
  code: string;
  barcodeValue?: string | null;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  warehouse: {
    id: string;
    name: string;
    code: string;
  };
};

type RackLocationEditPageClientProps = {
  id: string;
};

export default function RackLocationEditPageClient({
  id,
}: RackLocationEditPageClientProps) {
  const router = useRouter();
  const { message } = App.useApp();

  const [rackLocation, setRackLocation] = useState<RackLocationItem | null>(
    null,
  );
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);

  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  async function fetchWarehouses() {
    try {
      const response = await fetch("/api/warehouses/options");
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch warehouses");
      }

      setWarehouses(result.data || []);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error
          ? error.message
          : "Gagal mengambil warehouse options",
      );
    }
  }

  async function fetchRackLocation() {
    try {
      setLoading(true);

      const response = await fetch(`/api/rack-locations/${id}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal mengambil rack location");
      }

      setRackLocation(result.data);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error
          ? error.message
          : "Gagal mengambil rack location",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(values: RackLocationFormValues) {
    try {
      setSubmitLoading(true);

      const response = await fetch(`/api/rack-locations/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal memperbarui rack location");
      }

      message.success(result.message || "Rack location berhasil diperbarui");

      router.push(`/dashboard/rack-locations/${id}`);
      router.refresh();
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal update rack location",
      );
    } finally {
      setSubmitLoading(false);
    }
  }

  useEffect(() => {
    void fetchWarehouses();
    void fetchRackLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div className="text-sm">
      <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="m-0 text-lg font-bold text-slate-950">
            Edit Rack Location
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Perbarui lokasi rak dan barcode penyimpanan.
          </p>
        </div>

        <Space size={8}>
          <Button
            icon={<EyeOutlined />}
            disabled={!rackLocation}
            onClick={() => router.push(`/dashboard/rack-locations/${id}`)}
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
        <RackLocationForm
          warehouses={warehouses}
          loading={submitLoading}
          submitText="Simpan Perubahan"
          initialValues={{
            warehouseId: rackLocation?.warehouseId,
            name: rackLocation?.name || "",
            code: rackLocation?.code || "",
            barcodeValue: rackLocation?.barcodeValue || "",
            description: rackLocation?.description || "",
            isActive: rackLocation?.isActive ?? true,
          }}
          onCancel={() => router.push(`/dashboard/rack-locations/${id}`)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
