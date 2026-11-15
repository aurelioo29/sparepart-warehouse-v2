"use client";

import { useEffect, useState } from "react";
import { App, Spin } from "antd";
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

type ProductItem = {
  id: string;
  categoryId?: string | null;
  brandId?: string | null;
  unitId: string;
  supplierId?: string | null;
  warehouseId?: string | null;
  rackLocationId?: string | null;

  sku: string;
  barcode?: string | null;
  name: string;

  purchasePrice: string | number;
  sellingPrice: string | number;
  currentStock: number;
  minStock: number;

  imageUrl?: string | null;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type ProductEditPageClientProps = {
  id: string;
};

export default function ProductEditPageClient({
  id,
}: ProductEditPageClientProps) {
  const router = useRouter();
  const { message } = App.useApp();

  const [product, setProduct] = useState<ProductItem | null>(null);

  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [rackLocations, setRackLocations] = useState<RackLocationOption[]>([]);

  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

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

  async function fetchProduct() {
    try {
      setLoading(true);

      const response = await fetch(`/api/products/${id}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch product");
      }

      setProduct(result.data);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal mengambil product",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(values: ProductFormValues) {
    try {
      setSubmitLoading(true);

      const response = await fetch(`/api/products/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to update product");
      }

      message.success(result.message || "Product updated successfully");

      router.push(`/dashboard/products/${id}`);
      router.refresh();
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal update product",
      );
    } finally {
      setSubmitLoading(false);
    }
  }

  useEffect(() => {
    void fetchOptions();
    void fetchProduct();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div className="text-sm">
      <div className="mb-5 border-b border-slate-100 pb-4">
        <h1 className="m-0 text-lg font-bold text-slate-950">Edit Product</h1>

        <p className="mt-1 text-sm text-slate-500">
          Update data product, harga, stock minimum, dan lokasi penyimpanan.
        </p>
      </div>

      {loading ? (
        <div className="flex min-h-[240px] items-center justify-center">
          <Spin />
        </div>
      ) : (
        <ProductForm
          categories={categories}
          brands={brands}
          units={units}
          suppliers={suppliers}
          warehouses={warehouses}
          rackLocations={rackLocations}
          loading={submitLoading}
          submitText="Save Changes"
          initialValues={{
            categoryId: product?.categoryId || null,
            brandId: product?.brandId || null,
            unitId: product?.unitId,
            supplierId: product?.supplierId || null,
            warehouseId: product?.warehouseId || null,
            rackLocationId: product?.rackLocationId || null,

            sku: product?.sku || "",
            barcode: product?.barcode || "",
            name: product?.name || "",

            purchasePrice: Number(product?.purchasePrice || 0),
            sellingPrice: Number(product?.sellingPrice || 0),
            minStock: product?.minStock || 0,

            imageUrl: product?.imageUrl || "",
            description: product?.description || "",
            isActive: product?.isActive ?? true,
          }}
          onCancel={() => router.push(`/dashboard/products/${id}`)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
