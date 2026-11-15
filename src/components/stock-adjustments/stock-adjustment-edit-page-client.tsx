"use client";

import { useEffect, useState } from "react";
import { App, Spin } from "antd";
import { useRouter } from "next/navigation";

import StockAdjustmentForm, {
  ProductOption,
  RackLocationOption,
  StockAdjustmentFormValues,
  WarehouseOption,
} from "./stock-adjustment-form";

type AdjustmentDetail = {
  id: string;
  documentNumber: string;
  adjustmentDate: string;
  reason: string;
  status: string;
  notes?: string | null;
  items: {
    id: string;
    productId: string;
    warehouseId?: string | null;
    rackLocationId?: string | null;
    stockAfter: number;
    notes?: string | null;
  }[];
};

type StockAdjustmentEditPageClientProps = {
  id: string;
};

export default function StockAdjustmentEditPageClient({
  id,
}: StockAdjustmentEditPageClientProps) {
  const router = useRouter();
  const { message } = App.useApp();

  const [adjustment, setAdjustment] = useState<AdjustmentDetail | null>(null);

  const [products, setProducts] = useState<ProductOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [rackLocations, setRackLocations] = useState<RackLocationOption[]>([]);

  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

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

  async function fetchAdjustment() {
    try {
      setLoading(true);

      const response = await fetch(`/api/stock-adjustments/${id}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch stock adjustment");
      }

      setAdjustment(result.data);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error
          ? error.message
          : "Gagal mengambil stock adjustment",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(values: StockAdjustmentFormValues) {
    try {
      setSubmitLoading(true);

      const response = await fetch(`/api/stock-adjustments/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to update stock adjustment");
      }

      message.success(
        result.message || "Stock adjustment updated successfully",
      );

      router.push(`/dashboard/stock-adjustments/${id}`);
      router.refresh();
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error
          ? error.message
          : "Gagal update stock adjustment",
      );
    } finally {
      setSubmitLoading(false);
    }
  }

  useEffect(() => {
    void fetchOptions();
    void fetchAdjustment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div className="text-sm">
      <div className="mb-5 border-b border-slate-100 pb-4">
        <h1 className="m-0 text-lg font-bold text-slate-950">
          Edit Stock Adjustment
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Update dokumen stock adjustment sebelum dibatalkan atau dikunci.
        </p>
      </div>

      {loading ? (
        <div className="flex min-h-[240px] items-center justify-center">
          <Spin />
        </div>
      ) : adjustment?.status === "CANCELLED" ? (
        <div className="border border-red-100 bg-red-50 p-4 text-sm text-red-600">
          Stock adjustment ini sudah cancelled, jadi tidak bisa diedit.
        </div>
      ) : (
        <StockAdjustmentForm
          mode="edit"
          products={products}
          warehouses={warehouses}
          rackLocations={rackLocations}
          loading={submitLoading}
          submitText="Save Changes"
          initialValues={{
            documentNumber: adjustment?.documentNumber || "",
            adjustmentDate: adjustment?.adjustmentDate,
            reason: adjustment?.reason || "STOCK_OPNAME",
            notes: adjustment?.notes || "",
            items:
              adjustment?.items.map((item) => ({
                productId: item.productId,
                warehouseId: item.warehouseId || null,
                rackLocationId: item.rackLocationId || null,
                stockAfter: Number(item.stockAfter || 0),
                notes: item.notes || null,
              })) || [],
          }}
          oldItems={
            adjustment?.items.map((item) => ({
              productId: item.productId,
              warehouseId: item.warehouseId || null,
              rackLocationId: item.rackLocationId || null,
              stockAfter: Number(item.stockAfter || 0),
            })) || []
          }
          onCancel={() => router.push(`/dashboard/stock-adjustments/${id}`)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
