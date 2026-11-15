"use client";

import { useEffect, useState } from "react";
import { App } from "antd";
import { useRouter } from "next/navigation";

import SaleForm, {
  CustomerOption,
  ProductOption,
  RackLocationOption,
  SaleFormValues,
  SalesmanOption,
  WarehouseOption,
} from "./sale-form";

export default function SaleCreatePageClient() {
  const router = useRouter();
  const { message } = App.useApp();

  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [salesmen, setSalesmen] = useState<SalesmanOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [rackLocations, setRackLocations] = useState<RackLocationOption[]>([]);

  const [loading, setLoading] = useState(false);

  async function fetchOptions() {
    try {
      const [
        customersRes,
        salesmenRes,
        productsRes,
        warehousesRes,
        rackLocationsRes,
      ] = await Promise.all([
        fetch("/api/customers/options"),
        fetch("/api/salesmen/options"),
        fetch("/api/products/options"),
        fetch("/api/warehouses/options"),
        fetch("/api/rack-locations?limit=1000&isActive=true"),
      ]);

      const [
        customersJson,
        salesmenJson,
        productsJson,
        warehousesJson,
        rackLocationsJson,
      ] = await Promise.all([
        customersRes.json(),
        salesmenRes.json(),
        productsRes.json(),
        warehousesRes.json(),
        rackLocationsRes.json(),
      ]);

      if (customersJson.success) setCustomers(customersJson.data || []);
      if (salesmenJson.success) setSalesmen(salesmenJson.data || []);
      if (productsJson.success) setProducts(productsJson.data || []);
      if (warehousesJson.success) setWarehouses(warehousesJson.data || []);

      if (rackLocationsJson.success) {
        setRackLocations(rackLocationsJson.data.items || []);
      }
    } catch (error) {
      console.error(error);
      message.error("Gagal mengambil sales options");
    }
  }

  async function handleSubmit(values: SaleFormValues) {
    try {
      setLoading(true);

      const response = await fetch("/api/sales", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to create sale");
      }

      message.success(result.message || "Sale created successfully");

      router.push(`/dashboard/sales-invoices/${result.data.id}`);
      router.refresh();
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal membuat sale",
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
        <h1 className="m-0 text-lg font-bold text-slate-950">Create Sale</h1>

        <p className="mt-1 text-sm text-slate-500">
          Buat invoice penjualan, pilih customer, salesman, product, discount,
          dan pembayaran awal.
        </p>
      </div>

      <SaleForm
        mode="create"
        customers={customers}
        salesmen={salesmen}
        products={products}
        warehouses={warehouses}
        rackLocations={rackLocations}
        loading={loading}
        submitText="Create Sale"
        onCancel={() => router.push("/dashboard/sales-invoices")}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
