"use client";

import { useEffect, useState } from "react";
import { App } from "antd";
import { useRouter } from "next/navigation";

import StockInForm, {
  ProductOption,
  RackLocationOption,
  StockInFormValues,
  SupplierOption,
  WarehouseOption,
} from "./stock-in-form";

export default function StockInCreatePageClient() {
  const router = useRouter();
  const { message } = App.useApp();

  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [rackLocations, setRackLocations] = useState<RackLocationOption[]>([]);

  const [loading, setLoading] = useState(false);

  async function fetchOptions() {
    try {
      const [suppliersRes, productsRes, warehousesRes, rackLocationsRes] =
        await Promise.all([
          fetch("/api/suppliers/options"),
          fetch("/api/products/options"),
          fetch("/api/warehouses/options"),
          fetch("/api/rack-locations?limit=1000&isActive=true"),
        ]);

      const [suppliersJson, productsJson, warehousesJson, rackLocationsJson] =
        await Promise.all([
          suppliersRes.json(),
          productsRes.json(),
          warehousesRes.json(),
          rackLocationsRes.json(),
        ]);

      if (suppliersJson.success) setSuppliers(suppliersJson.data || []);
      if (productsJson.success) setProducts(productsJson.data || []);
      if (warehousesJson.success) setWarehouses(warehousesJson.data || []);

      if (rackLocationsJson.success) {
        setRackLocations(rackLocationsJson.data.items || []);
      }
    } catch (error) {
      console.error(error);
      message.error("Gagal mengambil stock in options");
    }
  }

  async function handleSubmit(values: StockInFormValues) {
    try {
      setLoading(true);

      const response = await fetch("/api/stock-ins", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to create stock in");
      }

      message.success(result.message || "Stock in created successfully");

      router.push(`/dashboard/stock-ins/${result.data.id}`);
      router.refresh();
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal membuat stock in",
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
          Create Stock In
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Tambahkan dokumen barang masuk, supplier, item product, qty, dan harga
          beli.
        </p>
      </div>

      <StockInForm
        mode="create"
        suppliers={suppliers}
        products={products}
        warehouses={warehouses}
        rackLocations={rackLocations}
        loading={loading}
        submitText="Create Stock In"
        onCancel={() => router.push("/dashboard/stock-ins")}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
