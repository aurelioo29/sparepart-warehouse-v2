"use client";

import { useEffect, useState } from "react";
import { App } from "antd";
import { useRouter } from "next/navigation";

import StockAdjustmentForm, {
  ProductOption,
  RackLocationOption,
  StockAdjustmentFormValues,
  WarehouseOption,
} from "./stock-adjustment-form";

export default function StockAdjustmentCreatePageClient() {
  const router = useRouter();
  const { message } = App.useApp();

  const [products, setProducts] = useState<ProductOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [rackLocations, setRackLocations] = useState<RackLocationOption[]>([]);

  const [loading, setLoading] = useState(false);

  async function fetchOptions() {
    try {
      const [productsRes, warehousesRes, rackLocationsRes] = await Promise.all([
        fetch("/api/products/options"),
        fetch("/api/warehouses/options"),
        fetch("/api/rack-locations?limit=1000&isActive=true"),
      ]);

      const [productsJson, warehousesJson, rackLocationsJson] =
        await Promise.all([
          productsRes.json(),
          warehousesRes.json(),
          rackLocationsRes.json(),
        ]);

      if (productsJson.success) setProducts(productsJson.data || []);
      if (warehousesJson.success) setWarehouses(warehousesJson.data || []);

      if (rackLocationsJson.success) {
        setRackLocations(rackLocationsJson.data.items || []);
      }
    } catch (error) {
      console.error(error);
      message.error("Gagal mengambil adjustment options");
    }
  }

  async function handleSubmit(values: StockAdjustmentFormValues) {
    try {
      setLoading(true);

      const response = await fetch("/api/stock-adjustments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to create stock adjustment");
      }

      message.success(
        result.message || "Stock adjustment created successfully",
      );

      router.push(`/dashboard/stock-adjustments/${result.data.id}`);
      router.refresh();
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error
          ? error.message
          : "Gagal membuat stock adjustment",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="text-sm">
      <div className="mb-5 border-b border-slate-100 pb-4">
        <h1 className="m-0 text-lg font-bold text-slate-950">
          Create Stock Adjustment
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Buat penyesuaian stock untuk hasil opname, barang rusak, hilang,
          ditemukan, atau koreksi input.
        </p>
      </div>

      <StockAdjustmentForm
        mode="create"
        products={products}
        warehouses={warehouses}
        rackLocations={rackLocations}
        loading={loading}
        submitText="Create Adjustment"
        initialValues={{
          reason: "STOCK_OPNAME",
        }}
        onCancel={() => router.push("/dashboard/stock-adjustments")}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
