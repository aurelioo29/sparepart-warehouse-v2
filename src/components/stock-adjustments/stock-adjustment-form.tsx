"use client";

import { useEffect } from "react";
import dayjs from "dayjs";
import {
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
} from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";

const { TextArea } = Input;

export type ProductOption = {
  id: string;
  sku: string;
  name: string;
  currentStock: number;
  unit?: {
    id: string;
    name: string;
    shortName: string;
  } | null;
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

export type StockAdjustmentFormItem = {
  productId?: string;
  warehouseId?: string | null;
  rackLocationId?: string | null;
  stockAfter?: number;
  notes?: string | null;
};

export type StockAdjustmentFormValues = {
  documentNumber?: string | null;
  adjustmentDate: string;
  reason: string;
  notes?: string | null;
  items: StockAdjustmentFormItem[];
};

type InternalFormValues = {
  documentNumber?: string;
  adjustmentDatePicker?: dayjs.Dayjs | null;
  reason: string;
  notes?: string;
  items: {
    productId?: string;
    warehouseId?: string | null;
    rackLocationId?: string | null;
    stockAfter?: number;
    notes?: string;
  }[];
};

type StockAdjustmentFormProps = {
  loading?: boolean;
  submitText?: string;
  mode: "create" | "edit";
  products: ProductOption[];
  warehouses: WarehouseOption[];
  rackLocations: RackLocationOption[];
  initialValues?: Partial<StockAdjustmentFormValues>;
  oldItems?: {
    productId?: string;
    warehouseId?: string | null;
    rackLocationId?: string | null;
    stockAfter?: number;
  }[];
  onCancel: () => void;
  onSubmit: (values: StockAdjustmentFormValues) => void;
};

export const reasonOptions = [
  { label: "Stock Opname", value: "STOCK_OPNAME" },
  { label: "Damaged", value: "DAMAGED" },
  { label: "Lost", value: "LOST" },
  { label: "Found", value: "FOUND" },
  { label: "Input Error", value: "INPUT_ERROR" },
  { label: "Other", value: "OTHER" },
];

function getDefaultItem() {
  return {
    productId: undefined,
    warehouseId: null,
    rackLocationId: null,
    stockAfter: 0,
    notes: "",
  };
}

export default function StockAdjustmentForm({
  loading,
  submitText = "Save",
  products,
  initialValues,
  onCancel,
  onSubmit,
}: StockAdjustmentFormProps) {
  const [form] = Form.useForm<InternalFormValues>();

  const watchedItems = Form.useWatch("items", form) || [];

  function findProduct(productId?: string) {
    if (!productId) return null;

    return products.find((product) => product.id === productId) || null;
  }

  useEffect(() => {
    form.setFieldsValue({
      documentNumber: initialValues?.documentNumber || "",
      adjustmentDatePicker: initialValues?.adjustmentDate
        ? dayjs(initialValues.adjustmentDate)
        : dayjs(),
      reason: initialValues?.reason || "STOCK_OPNAME",
      notes: initialValues?.notes || "",
      items:
        initialValues?.items && initialValues.items.length > 0
          ? initialValues.items.map((item) => ({
              productId: item.productId || undefined,
              warehouseId: item.warehouseId || null,
              rackLocationId: item.rackLocationId || null,
              stockAfter: Number(item.stockAfter || 0),
              notes: item.notes || "",
            }))
          : [getDefaultItem()],
    });
  }, [form, initialValues]);

  return (
    <Form<InternalFormValues>
      form={form}
      layout="vertical"
      requiredMark={false}
      className="form-compact bg-white p-5 text-sm"
      onFinish={(values) => {
        onSubmit({
          documentNumber: values.documentNumber || null,
          adjustmentDate: values.adjustmentDatePicker
            ? values.adjustmentDatePicker.format("YYYY-MM-DD")
            : dayjs().format("YYYY-MM-DD"),
          reason: values.reason,
          notes: values.notes || null,
          items: (values.items || []).map((item) => ({
            productId: item.productId,
            warehouseId: item.warehouseId || null,
            rackLocationId: item.rackLocationId || null,
            stockAfter: Number(item.stockAfter || 0),
            notes: item.notes || null,
          })),
        });
      }}
    >
      <Form.Item name="documentNumber" hidden>
        <Input />
      </Form.Item>

      <div className="grid grid-cols-1 gap-x-5 gap-y-1 md:grid-cols-2">
        <Form.Item
          label="Tanggal"
          name="adjustmentDatePicker"
          rules={[{ required: true, message: "Tanggal wajib dipilih" }]}
        >
          <DatePicker
            className="dashboard-filter-control w-full"
            format="YYYY-MM-DD"
            placeholder="Select date"
          />
        </Form.Item>

        <Form.Item
          label="Reason"
          name="reason"
          rules={[{ required: true, message: "Reason wajib dipilih" }]}
        >
          <Select
            className="dashboard-filter-control w-full"
            placeholder="Select reason"
            options={reasonOptions}
          />
        </Form.Item>
      </div>

      <Form.Item label="Keterangan" name="notes">
        <TextArea rows={3} className="text-sm" placeholder="Optional notes" />
      </Form.Item>

      <div className="mb-2 text-sm font-semibold text-slate-700">Items</div>

      <Form.List name="items">
        {(fields, { add, remove }) => (
          <div className="overflow-hidden border border-slate-200 bg-white">
            <div className="grid grid-cols-12 border-b border-slate-200 bg-slate-50 text-sm font-semibold text-slate-800">
              <div className="col-span-5 border-r border-slate-200 px-4 py-3 text-center">
                Item
              </div>

              <div className="col-span-2 border-r border-slate-200 px-4 py-3 text-center">
                Stok Fisik
              </div>

              <div className="col-span-2 border-r border-slate-200 px-4 py-3 text-center">
                Stok Saat Ini
              </div>

              <div className="col-span-2 border-r border-slate-200 px-4 py-3 text-center">
                Note
              </div>

              <div className="col-span-1 px-4 py-3 text-center">-</div>
            </div>

            <div>
              {fields.map(({ key, name, ...restField }) => {
                const item = watchedItems?.[name];
                const selectedProduct = findProduct(item?.productId);

                return (
                  <div
                    key={key}
                    className="grid grid-cols-12 border-b border-slate-200 bg-white last:border-b-0"
                  >
                    <div className="col-span-5 border-r border-slate-200 px-3 py-3">
                      <Form.Item
                        {...restField}
                        name={[name, "productId"]}
                        className="mb-0"
                        rules={[
                          {
                            required: true,
                            message: "Item wajib dipilih",
                          },
                        ]}
                      >
                        <Select
                          showSearch
                          optionFilterProp="label"
                          className="dashboard-filter-control w-full"
                          placeholder="Select item"
                          options={products.map((product) => ({
                            label: `${product.sku} - ${product.name}`,
                            value: product.id,
                          }))}
                        />
                      </Form.Item>

                      <Form.Item
                        {...restField}
                        name={[name, "warehouseId"]}
                        hidden
                      >
                        <Input />
                      </Form.Item>

                      <Form.Item
                        {...restField}
                        name={[name, "rackLocationId"]}
                        hidden
                      >
                        <Input />
                      </Form.Item>
                    </div>

                    <div className="col-span-2 border-r border-slate-200 px-3 py-3">
                      <Form.Item
                        {...restField}
                        name={[name, "stockAfter"]}
                        className="mb-0"
                        rules={[
                          {
                            required: true,
                            message: "Stok fisik wajib diisi",
                          },
                        ]}
                      >
                        <InputNumber
                          min={0}
                          controls={false}
                          className="dashboard-filter-control w-full text-center"
                          placeholder="0"
                        />
                      </Form.Item>
                    </div>

                    <div className="col-span-2 border-r border-slate-200 px-3 py-3">
                      <Input
                        disabled
                        className="dashboard-filter-control w-full text-center"
                        value={
                          selectedProduct
                            ? `Current: ${selectedProduct.currentStock}${
                                selectedProduct.unit?.shortName
                                  ? ` ${selectedProduct.unit.shortName}`
                                  : ""
                              }`
                            : "-"
                        }
                      />
                    </div>

                    <div className="col-span-2 border-r border-slate-200 px-3 py-3">
                      <Form.Item
                        {...restField}
                        name={[name, "notes"]}
                        className="mb-0"
                      >
                        <Input
                          className="dashboard-filter-control w-full"
                          placeholder="Note"
                        />
                      </Form.Item>
                    </div>

                    <div className="col-span-1 flex min-h-[56px] items-center justify-center px-3 py-3">
                      {fields.length > 1 ? (
                        <Button
                          type="link"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          onClick={() => remove(name)}
                          className="dashboard-table-action-btn !px-0"
                        />
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-dashed border-slate-200 bg-white p-3">
              <Button
                type="dashed"
                size="small"
                icon={<PlusOutlined />}
                className="dashboard-action-btn w-full"
                onClick={() => add(getDefaultItem())}
              >
                Add Item
              </Button>
            </div>
          </div>
        )}
      </Form.List>

      <div className="mt-5 border-t border-slate-200 pt-4">
        <div className="flex justify-end">
          <Space>
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
          </Space>
        </div>
      </div>
    </Form>
  );
}
