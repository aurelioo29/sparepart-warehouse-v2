"use client";

import { useEffect, useState } from "react";
import { App, Spin } from "antd";
import { useRouter } from "next/navigation";

import StockInForm, {
  ProductOption,
  RackLocationOption,
  StockInFormValues,
  SupplierOption,
  WarehouseOption,
} from "./stock-in-form";

type StockInDetail = {
  id: string;
  supplierId?: string | null;
  documentNumber: string;
  invoiceNumber?: string | null;
  stockInDate: string;
  dueDate?: string | null;
  status: string;
  notes?: string | null;
  supplier?: {
    id: string;
    name: string;
  } | null;
  items: {
    id: string;
    productId: string;
    warehouseId?: string | null;
    rackLocationId?: string | null;
    quantity: number | string;
    unitPrice: string | number;
  }[];
};

type StockInEditPageClientProps = {
  id: string;
};

export default function StockInEditPageClient({
  id,
}: StockInEditPageClientProps) {
  const router = useRouter();
  const { message } = App.useApp();

  const [stockIn, setStockIn] = useState<StockInDetail | null>(null);

  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [rackLocations, setRackLocations] = useState<RackLocationOption[]>([]);

  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

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

  async function fetchStockIn() {
    try {
      setLoading(true);

      const response = await fetch(`/api/stock-ins/${id}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch stock in");
      }

      setStockIn(result.data);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal mengambil stock in",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(values: StockInFormValues) {
    try {
      setSubmitLoading(true);

      const response = await fetch(`/api/stock-ins/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to update stock in");
      }

      message.success(result.message || "Stock in updated successfully");

      router.push(`/dashboard/stock-ins/${id}`);
      router.refresh();
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal update stock in",
      );
    } finally {
      setSubmitLoading(false);
    }
  }

  useEffect(() => {
    void fetchOptions();
    void fetchStockIn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const initialFormValues: StockInFormValues | null = stockIn
    ? {
        supplierId: stockIn.supplier?.id || stockIn.supplierId || null,
        documentNumber: stockIn.documentNumber,
        invoiceNumber: stockIn.invoiceNumber || null,
        stockInDate: stockIn.stockInDate,
        dueDate: stockIn.dueDate || null,
        notes: stockIn.notes || null,
        items: stockIn.items.map((item) => ({
          productId: item.productId,
          warehouseId: item.warehouseId || null,
          rackLocationId: item.rackLocationId || null,
          quantity: Number(item.quantity || 0),
          unitPrice: Number(item.unitPrice || 0),
        })),
      }
    : null;

  return (
    <div className="text-sm">
      <div className="mb-5 border-b border-slate-100 pb-4">
        <h1 className="m-0 text-lg font-bold text-slate-950">Edit Stock In</h1>

        <p className="mt-1 text-sm text-slate-500">
          Update data dokumen barang masuk sebelum dibatalkan.
        </p>
      </div>

      {loading ? (
        <div className="flex min-h-[240px] items-center justify-center">
          <Spin />
        </div>
      ) : stockIn?.status === "CANCELLED" ? (
        <div className="border border-red-100 bg-red-50 p-4 text-sm text-red-600">
          Stock in ini sudah cancelled, jadi tidak bisa diedit.
        </div>
      ) : (
        <StockInForm
          mode="edit"
          suppliers={suppliers}
          products={products}
          warehouses={warehouses}
          rackLocations={rackLocations}
          loading={submitLoading}
          submitText="Save Changes"
          initialValues={initialFormValues}
          onCancel={() => router.push(`/dashboard/stock-ins/${id}`)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
