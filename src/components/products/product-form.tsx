"use client";

import { useEffect } from "react";
import { Button, Form, Input, InputNumber, Select, Space, Switch } from "antd";

const { TextArea } = Input;

export type CategoryOption = {
  id: string;
  name: string;
};

export type BrandOption = {
  id: string;
  name: string;
};

export type UnitOption = {
  id: string;
  name: string;
  shortName: string;
};

export type SupplierOption = {
  id: string;
  name: string;
};

export type WarehouseOption = {
  id: string;
  name: string;
  code: string;
};

export type RackLocationOption = {
  id: string;
  warehouseId: string;
  name: string;
  code: string;
};

export type ProductFormValues = {
  categoryId?: string | null;
  brandId?: string | null;
  unitId: string;
  supplierId?: string | null;
  warehouseId?: string | null;
  rackLocationId?: string | null;

  sku: string;
  barcode?: string | null;
  name: string;

  purchasePrice: number;
  sellingPrice: number;
  minStock: number;

  imageUrl?: string | null;
  description?: string | null;
  isActive: boolean;
};

type ProductFormProps = {
  loading?: boolean;
  submitText?: string;

  categories: CategoryOption[];
  brands: BrandOption[];
  units: UnitOption[];
  suppliers: SupplierOption[];
  warehouses: WarehouseOption[];
  rackLocations: RackLocationOption[];

  initialValues?: Partial<ProductFormValues>;
  onCancel: () => void;
  onSubmit: (values: ProductFormValues) => void;
};

function generateSku(value: string) {
  return value
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatNumberWithDots(value: string | number | undefined) {
  if (value === undefined || value === null || value === "") return "";

  const cleanValue = String(value).replace(/[^\d]/g, "");

  if (!cleanValue) return "";

  return cleanValue.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatRupiahInput(value: string | number | undefined) {
  const formattedValue = formatNumberWithDots(value);

  if (!formattedValue) return "";

  return `Rp ${formattedValue}`;
}

function parseNumberInput(value: string | undefined) {
  if (!value) return 0;

  const cleanValue = value.replace(/[^\d]/g, "");

  if (!cleanValue) return 0;

  return Number(cleanValue);
}

export default function ProductForm({
  loading,
  submitText = "Save",
  categories,
  brands,
  units,
  suppliers,
  warehouses,
  rackLocations,
  initialValues,
  onCancel,
  onSubmit,
}: ProductFormProps) {
  const [form] = Form.useForm<ProductFormValues>();

  const warehouseId = Form.useWatch("warehouseId", form);

  const filteredRackLocations = rackLocations.filter((rackLocation) => {
    if (!warehouseId) return true;

    return rackLocation.warehouseId === warehouseId;
  });

  useEffect(() => {
    form.setFieldsValue({
      categoryId: initialValues?.categoryId || undefined,
      brandId: initialValues?.brandId || undefined,
      unitId: initialValues?.unitId || undefined,
      supplierId: initialValues?.supplierId || undefined,
      warehouseId: initialValues?.warehouseId || undefined,
      rackLocationId: initialValues?.rackLocationId || undefined,

      sku: initialValues?.sku || "",
      barcode: initialValues?.barcode || "",
      name: initialValues?.name || "",

      purchasePrice: Number(initialValues?.purchasePrice ?? 0),
      sellingPrice: Number(initialValues?.sellingPrice ?? 0),
      minStock: Number(initialValues?.minStock ?? 0),

      imageUrl: initialValues?.imageUrl || "",
      description: initialValues?.description || "",
      isActive: initialValues?.isActive ?? true,
    });
  }, [initialValues, form]);

  return (
    <Form<ProductFormValues>
      form={form}
      layout="vertical"
      requiredMark={false}
      className="form-compact text-sm"
      onFinish={(values) => {
        onSubmit({
          ...values,
          sku: values.sku.trim().toUpperCase(),
          barcode: values.barcode || null,

          categoryId: values.categoryId || null,
          brandId: values.brandId || null,
          supplierId: values.supplierId || null,
          warehouseId: values.warehouseId || null,
          rackLocationId: values.rackLocationId || null,

          purchasePrice: Number(values.purchasePrice || 0),
          sellingPrice: Number(values.sellingPrice || 0),
          minStock: Number(values.minStock || 0),

          imageUrl: values.imageUrl || null,
          description: values.description || null,
          isActive: values.isActive,
        });
      }}
    >
      <div className="grid grid-cols-1 gap-x-5 gap-y-1 lg:grid-cols-3">
        <Form.Item
          label="Product Name"
          name="name"
          rules={[{ required: true, message: "Product name wajib diisi" }]}
        >
          <Input
            className="w-full text-sm"
            placeholder="Example: Oli Federal Matic 10W-30"
            onChange={(event) => {
              if (!initialValues?.sku) {
                form.setFieldValue("sku", generateSku(event.target.value));
              }
            }}
          />
        </Form.Item>

        <Form.Item
          label="SKU"
          name="sku"
          rules={[{ required: true, message: "SKU wajib diisi" }]}
        >
          <Input
            className="w-full text-sm"
            placeholder="Example: OLI-FEDERAL-MATIC"
          />
        </Form.Item>

        <Form.Item label="Barcode" name="barcode">
          <Input className="w-full text-sm" placeholder="Optional barcode" />
        </Form.Item>

        <Form.Item label="Category" name="categoryId">
          <Select
            allowClear
            showSearch
            className="w-full text-sm"
            placeholder="Select category"
            optionFilterProp="label"
            options={categories.map((category) => ({
              label: category.name,
              value: category.id,
            }))}
          />
        </Form.Item>

        <Form.Item label="Brand" name="brandId">
          <Select
            allowClear
            showSearch
            className="w-full text-sm"
            placeholder="Select brand"
            optionFilterProp="label"
            options={brands.map((brand) => ({
              label: brand.name,
              value: brand.id,
            }))}
          />
        </Form.Item>

        <Form.Item
          label="Unit"
          name="unitId"
          rules={[{ required: true, message: "Unit wajib dipilih" }]}
        >
          <Select
            showSearch
            className="w-full text-sm"
            placeholder="Select unit"
            optionFilterProp="label"
            options={units.map((unit) => ({
              label: `${unit.name} (${unit.shortName})`,
              value: unit.id,
            }))}
          />
        </Form.Item>

        <Form.Item label="Supplier" name="supplierId">
          <Select
            allowClear
            showSearch
            className="w-full text-sm"
            placeholder="Select supplier"
            optionFilterProp="label"
            options={suppliers.map((supplier) => ({
              label: supplier.name,
              value: supplier.id,
            }))}
          />
        </Form.Item>

        <Form.Item label="Warehouse" name="warehouseId">
          <Select
            allowClear
            showSearch
            className="w-full text-sm"
            placeholder="Select warehouse"
            optionFilterProp="label"
            onChange={() => {
              form.setFieldValue("rackLocationId", undefined);
            }}
            options={warehouses.map((warehouse) => ({
              label: `${warehouse.name} (${warehouse.code})`,
              value: warehouse.id,
            }))}
          />
        </Form.Item>

        <Form.Item label="Rack Location" name="rackLocationId">
          <Select
            allowClear
            showSearch
            className="w-full text-sm"
            placeholder="Select rack location"
            optionFilterProp="label"
            options={filteredRackLocations.map((rackLocation) => ({
              label: `${rackLocation.name} (${rackLocation.code})`,
              value: rackLocation.id,
            }))}
          />
        </Form.Item>

        <Form.Item label="Purchase Price" name="purchasePrice">
          <InputNumber<number>
            min={0}
            className="money-input w-full text-sm"
            controls={false}
            formatter={(value) => formatRupiahInput(value)}
            parser={(value) => parseNumberInput(value)}
            placeholder="Rp 0"
          />
        </Form.Item>

        <Form.Item label="Selling Price" name="sellingPrice">
          <InputNumber<number>
            min={0}
            className="money-input w-full text-sm"
            controls={false}
            formatter={(value) => formatRupiahInput(value)}
            parser={(value) => parseNumberInput(value)}
            placeholder="Rp 0"
          />
        </Form.Item>

        <Form.Item label="Minimum Stock" name="minStock">
          <InputNumber<number>
            min={0}
            className="stock-input w-full text-sm"
            controls={false}
            precision={0}
            formatter={(value) => formatNumberWithDots(value)}
            parser={(value) => parseNumberInput(value)}
            placeholder="0"
          />
        </Form.Item>
      </div>

      <Form.Item label="Image URL" name="imageUrl">
        <Input
          className="w-full text-sm"
          placeholder="Optional, nanti bisa kita ubah jadi upload image"
        />
      </Form.Item>

      <Form.Item label="Description" name="description">
        <TextArea
          rows={3}
          className="text-sm"
          placeholder="Product description"
        />
      </Form.Item>

      <Form.Item label="Active" name="isActive" valuePropName="checked">
        <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
      </Form.Item>

      <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Button
          size="small"
          className="dashboard-action-btn"
          onClick={onCancel}
        >
          Cancel
        </Button>

        <Button
          size="small"
          type="primary"
          htmlType="submit"
          loading={loading}
          className="dashboard-action-btn"
        >
          {submitText}
        </Button>
      </div>
    </Form>
  );
}
