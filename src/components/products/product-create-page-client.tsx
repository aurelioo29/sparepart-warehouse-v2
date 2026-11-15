"use client";

import { useEffect, useState } from "react";
import { App } from "antd";
import { useRouter } from "next/navigation";

import ProductForm, {
  BrandOption,
  CategoryOption,
  ProductFormValues,
  RackLocationOption,
  SupplierOption,
  UnitOption,
  WarehouseOption,
} from "./product-form";

export default function ProductCreatePageClient() {
  const router = useRouter();
  const { message } = App.useApp();

  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [rackLocations, setRackLocations] = useState<RackLocationOption[]>([]);

  const [loading, setLoading] = useState(false);

  async function fetchOptions() {
    try {
      const [
        categoriesRes,
        brandsRes,
        unitsRes,
        suppliersRes,
        warehousesRes,
        rackLocationsRes,
      ] = await Promise.all([
        fetch("/api/categories/options"),
        fetch("/api/brands/options"),
        fetch("/api/units/options"),
        fetch("/api/suppliers/options"),
        fetch("/api/warehouses/options"),
        fetch("/api/rack-locations?limit=1000&isActive=true"),
      ]);

      const [
        categoriesJson,
        brandsJson,
        unitsJson,
        suppliersJson,
        warehousesJson,
        rackLocationsJson,
      ] = await Promise.all([
        categoriesRes.json(),
        brandsRes.json(),
        unitsRes.json(),
        suppliersRes.json(),
        warehousesRes.json(),
        rackLocationsRes.json(),
      ]);

      if (categoriesJson.success) setCategories(categoriesJson.data || []);
      if (brandsJson.success) setBrands(brandsJson.data || []);
      if (unitsJson.success) setUnits(unitsJson.data || []);
      if (suppliersJson.success) setSuppliers(suppliersJson.data || []);
      if (warehousesJson.success) setWarehouses(warehousesJson.data || []);

      if (rackLocationsJson.success) {
        setRackLocations(rackLocationsJson.data.items || []);
      }
    } catch (error) {
      console.error(error);
      message.error("Gagal mengambil product options");
    }
  }

  async function handleSubmit(values: ProductFormValues) {
    try {
      setLoading(true);

      const response = await fetch("/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to create product");
      }

      message.success(result.message || "Product created successfully");

      router.push(`/dashboard/products/${result.data.id}`);
      router.refresh();
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal membuat product",
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
        <h1 className="m-0 text-lg font-bold text-slate-950">Create Product</h1>

        <p className="mt-1 text-sm text-slate-500">
          Tambahkan data product baru, harga, stock minimum, dan lokasi
          penyimpanan.
        </p>
      </div>

      <ProductForm
        categories={categories}
        brands={brands}
        units={units}
        suppliers={suppliers}
        warehouses={warehouses}
        rackLocations={rackLocations}
        loading={loading}
        submitText="Create Product"
        initialValues={{
          purchasePrice: 0,
          sellingPrice: 0,
          minStock: 0,
          isActive: true,
        }}
        onCancel={() => router.push("/dashboard/products")}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
