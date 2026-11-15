"use client";

import { useEffect, useState } from "react";
import { App } from "antd";
import { useRouter } from "next/navigation";

import RackLocationForm, {
  RackLocationFormValues,
  WarehouseOption,
} from "./rack-location-form";

export default function RackLocationCreatePageClient() {
  const router = useRouter();
  const { message } = App.useApp();

  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [loading, setLoading] = useState(false);

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

  async function handleSubmit(values: RackLocationFormValues) {
    try {
      setLoading(true);

      const response = await fetch("/api/rack-locations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal membuat rack location");
      }

      message.success(result.message || "Rack location berhasil dibuat");

      router.push(`/dashboard/rack-locations/${result.data.id}`);
      router.refresh();
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal membuat rack location",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchWarehouses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="text-sm">
      <div className="mb-5 border-b border-slate-100 pb-4">
        <h1 className="m-0 text-lg font-bold text-slate-950">
          Tambah Rack Location
        </h1>

        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Buat lokasi rak baru di dalam warehouse dan generate barcode untuk
          kebutuhan penyimpanan barang.
        </p>
      </div>

      <RackLocationForm
        warehouses={warehouses}
        loading={loading}
        submitText="Simpan Rack Location"
        initialValues={{
          isActive: true,
        }}
        onCancel={() => router.push("/dashboard/rack-locations")}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
