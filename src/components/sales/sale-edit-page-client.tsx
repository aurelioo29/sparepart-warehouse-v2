"use client";

import { useEffect, useState } from "react";
import { App, Spin } from "antd";
import { useRouter } from "next/navigation";

import SaleForm, {
  CustomerOption,
  ProductOption,
  RackLocationOption,
  SaleDetailInitialValues,
  SaleFormValues,
  SalesmanOption,
  WarehouseOption,
} from "./sale-form";

type SaleEditInitialValues = SaleDetailInitialValues & {
  status?: string | null;
};

type SaleEditPageClientProps = {
  id: string;
};

export default function SaleEditPageClient({ id }: SaleEditPageClientProps) {
  const router = useRouter();
  const { message } = App.useApp();

  const [sale, setSale] = useState<SaleEditInitialValues | null>(null);

  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [salesmen, setSalesmen] = useState<SalesmanOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [rackLocations, setRackLocations] = useState<RackLocationOption[]>([]);

  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

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

  async function fetchSale() {
    try {
      setLoading(true);

      const response = await fetch(`/api/sales/${id}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch sale detail");
      }

      setSale(result.data);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal mengambil sale",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(values: SaleFormValues) {
    try {
      setSubmitLoading(true);

      const response = await fetch(`/api/sales/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to update sale");
      }

      message.success(result.message || "Sale updated successfully");

      router.push(`/dashboard/sales-invoices/${id}`);
      router.refresh();
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal update sale",
      );
    } finally {
      setSubmitLoading(false);
    }
  }

  useEffect(() => {
    void fetchOptions();
    void fetchSale();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div className="text-sm">
      <div className="mb-5 border-b border-slate-100 pb-4">
        <h1 className="m-0 text-lg font-bold text-slate-950">Edit Sale</h1>

        <p className="mt-1 text-sm text-slate-500">
          Update invoice penjualan sebelum dokumen dibatalkan.
        </p>
      </div>

      {loading ? (
        <div className="flex min-h-[240px] items-center justify-center">
          <Spin />
        </div>
      ) : sale?.status === "CANCELLED" ? (
        <div className="border border-red-100 bg-red-50 p-4 text-sm text-red-600">
          Sale ini sudah cancelled, jadi tidak bisa diedit.
        </div>
      ) : (
        <SaleForm
          mode="edit"
          customers={customers}
          salesmen={salesmen}
          products={products}
          warehouses={warehouses}
          rackLocations={rackLocations}
          loading={submitLoading}
          submitText="Save Changes"
          initialValues={sale}
          onCancel={() => router.push(`/dashboard/sales-invoices/${id}`)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
