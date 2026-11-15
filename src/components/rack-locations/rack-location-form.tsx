"use client";

import { useEffect, useMemo, useRef } from "react";
import { Button, Form, Input, Select, Space, Switch } from "antd";
import JsBarcode from "jsbarcode";

const { TextArea } = Input;

export type WarehouseOption = {
  id: string;
  name: string;
  code: string;
};

export type RackLocationFormValues = {
  warehouseId: string;
  name: string;
  code?: string;
  barcodeValue?: string | null;
  description?: string | null;
  isActive: boolean;
};

type RackLocationFormProps = {
  loading?: boolean;
  submitText?: string;
  warehouses: WarehouseOption[];
  initialValues?: Partial<RackLocationFormValues>;
  onCancel: () => void;
  onSubmit: (values: RackLocationFormValues) => void;
};

function generateRackCode(value: string) {
  return value
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function generateRackBarcodeValue(warehouseCode?: string, rackCode?: string) {
  if (!warehouseCode || !rackCode) return "";

  return `RACK:${warehouseCode}:${rackCode}`;
}

export default function RackLocationForm({
  loading,
  submitText = "Simpan",
  warehouses,
  initialValues,
  onCancel,
  onSubmit,
}: RackLocationFormProps) {
  const [form] = Form.useForm<RackLocationFormValues>();
  const barcodeSvgRef = useRef<SVGSVGElement | null>(null);

  const watchedWarehouseId = Form.useWatch("warehouseId", form);
  const watchedName = Form.useWatch("name", form);

  const selectedWarehouse = useMemo(() => {
    return warehouses.find((warehouse) => warehouse.id === watchedWarehouseId);
  }, [warehouses, watchedWarehouseId]);

  const generatedRackCode = useMemo(() => {
    return generateRackCode(watchedName || "");
  }, [watchedName]);

  const barcodeValue = useMemo(() => {
    return generateRackBarcodeValue(selectedWarehouse?.code, generatedRackCode);
  }, [selectedWarehouse?.code, generatedRackCode]);

  useEffect(() => {
    form.setFieldsValue({
      warehouseId: initialValues?.warehouseId,
      name: initialValues?.name || "",
      code: initialValues?.code || "",
      barcodeValue: initialValues?.barcodeValue || "",
      description: initialValues?.description || "",
      isActive: initialValues?.isActive ?? true,
    });
  }, [initialValues, form]);

  useEffect(() => {
    form.setFieldValue("code", generatedRackCode || "");
    form.setFieldValue("barcodeValue", barcodeValue || "");
  }, [barcodeValue, generatedRackCode, form]);

  useEffect(() => {
    if (!barcodeSvgRef.current || !barcodeValue) return;

    JsBarcode(barcodeSvgRef.current, barcodeValue, {
      format: "CODE128",
      displayValue: true,
      fontSize: 12,
      height: 48,
      margin: 8,
    });
  }, [barcodeValue]);

  return (
    <Form<RackLocationFormValues>
      form={form}
      layout="vertical"
      requiredMark={false}
      className="w-full text-sm"
      onFinish={(values) => {
        const finalRackCode = generateRackCode(values.name || "");
        const finalBarcodeValue = generateRackBarcodeValue(
          selectedWarehouse?.code,
          finalRackCode,
        );

        onSubmit({
          warehouseId: values.warehouseId,
          name: values.name,
          code: finalRackCode,
          barcodeValue: finalBarcodeValue || null,
          description: values.description || null,
          isActive: values.isActive,
        });
      }}
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Form.Item
          label="Warehouse"
          name="warehouseId"
          rules={[
            {
              required: true,
              message: "Warehouse wajib dipilih",
            },
          ]}
        >
          <Select
            className="w-full"
            placeholder="Pilih warehouse"
            options={warehouses.map((warehouse) => ({
              label: `${warehouse.name} (${warehouse.code})`,
              value: warehouse.id,
            }))}
          />
        </Form.Item>

        <Form.Item
          label="Nama Rak"
          name="name"
          rules={[
            {
              required: true,
              message: "Nama rak wajib diisi",
            },
            {
              min: 2,
              message: "Nama rak minimal 2 karakter",
            },
          ]}
        >
          <Input className="w-full" placeholder="Contoh: Rak Oli" />
        </Form.Item>
      </div>

      <Form.Item name="code" hidden>
        <Input />
      </Form.Item>

      <Form.Item label="Barcode Value" name="barcodeValue">
        <Input
          readOnly
          className="w-full"
          placeholder="Auto generated setelah warehouse dan nama rak diisi"
        />
      </Form.Item>

      <div className="mb-5 border border-slate-200 bg-slate-50 p-3">
        <div className="mb-2 text-sm font-semibold text-slate-700">
          Barcode Preview
        </div>

        {barcodeValue ? (
          <div className="overflow-x-auto bg-white p-3">
            <svg ref={barcodeSvgRef} />
          </div>
        ) : (
          <div className="text-sm text-slate-400">
            Pilih warehouse dan isi nama rak untuk generate barcode.
          </div>
        )}
      </div>

      <Form.Item label="Deskripsi" name="description">
        <TextArea
          className="w-full"
          rows={3}
          placeholder="Tulis deskripsi rack location jika diperlukan"
        />
      </Form.Item>

      <Form.Item
        label="Status"
        name="isActive"
        valuePropName="checked"
        className="!mb-0"
      >
        <Switch checkedChildren="Aktif" unCheckedChildren="Nonaktif" />
      </Form.Item>

      <div className="mt-6 flex justify-end border-t border-slate-100 pt-4">
        <Space size={8}>
          <Button onClick={onCancel}>Batal</Button>

          <Button type="primary" htmlType="submit" loading={loading}>
            {submitText}
          </Button>
        </Space>
      </div>
    </Form>
  );
}
