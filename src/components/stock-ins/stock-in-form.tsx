"use client";

import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import {
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
} from "antd";
import dayjs from "dayjs";
import { useMemo } from "react";

const { TextArea } = Input;

export type SupplierOption = {
  id: string;
  name: string;
};

export type ProductOption = {
  id: string;
  sku: string;
  name: string;
  currentStock: number;
  sellingPrice: string | number;
  unit: {
    id: string;
    name: string;
    shortName: string;
  };
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

export type StockInFormValues = {
  supplierId?: string | null;
  documentNumber?: string | null;
  invoiceNumber?: string | null;
  stockInDate: string;
  dueDate?: string | null;
  notes?: string | null;
  items: {
    productId: string;
    warehouseId?: string | null;
    rackLocationId?: string | null;
    quantity: number;
    unitPrice: number;
  }[];
};

type InternalFormValues = Omit<StockInFormValues, "stockInDate" | "dueDate"> & {
  stockInDatePicker: dayjs.Dayjs;
  dueDatePicker?: dayjs.Dayjs | null;
};

type StockInFormProps = {
  loading?: boolean;
  submitText?: string;
  mode: "create" | "edit";
  initialValues?: StockInFormValues | null;
  suppliers: SupplierOption[];
  products: ProductOption[];
  warehouses: WarehouseOption[];
  rackLocations: RackLocationOption[];
  onCancel: () => void;
  onSubmit: (values: StockInFormValues) => void;
};

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

function formatCurrency(value: string | number | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function getDefaultItem() {
  return {
    productId: undefined as unknown as string,
    warehouseId: null,
    rackLocationId: null,
    quantity: 1,
    unitPrice: 0,
  };
}

export default function StockInForm({
  loading,
  submitText = "Save",
  mode,
  initialValues,
  suppliers,
  products,
  onCancel,
  onSubmit,
}: StockInFormProps) {
  const [form] = Form.useForm<InternalFormValues>();

  const watchedItems = Form.useWatch("items", form) || [];

  const totalAmount = useMemo(() => {
    return (watchedItems || []).reduce((total, item) => {
      const quantity = Number(item?.quantity || 0);
      const unitPrice = Number(item?.unitPrice || 0);

      return total + quantity * unitPrice;
    }, 0);
  }, [watchedItems]);

  function getProductById(productId?: string | null) {
    if (!productId) return null;

    return products.find((product) => product.id === productId) || null;
  }

  return (
    <Form<InternalFormValues>
      form={form}
      layout="vertical"
      requiredMark={false}
      className="form-compact w-full bg-white p-5 text-sm"
      initialValues={{
        supplierId: initialValues?.supplierId || undefined,
        documentNumber: initialValues?.documentNumber || "",
        invoiceNumber: initialValues?.invoiceNumber || "",
        stockInDatePicker: initialValues?.stockInDate
          ? dayjs(initialValues.stockInDate)
          : dayjs(),
        dueDatePicker: initialValues?.dueDate
          ? dayjs(initialValues.dueDate)
          : null,
        notes: initialValues?.notes || "",
        items:
          initialValues?.items && initialValues.items.length > 0
            ? initialValues.items.map((item) => ({
                productId: item.productId,
                warehouseId: null,
                rackLocationId: null,
                quantity: Number(item.quantity || 1),
                unitPrice: Number(item.unitPrice || 0),
              }))
            : [getDefaultItem()],
      }}
      onFinish={(values) => {
        onSubmit({
          supplierId: values.supplierId || null,
          documentNumber: values.documentNumber || null,
          invoiceNumber: values.invoiceNumber || null,
          stockInDate: values.stockInDatePicker.format("YYYY-MM-DD"),
          dueDate: values.dueDatePicker
            ? values.dueDatePicker.format("YYYY-MM-DD")
            : null,
          notes: values.notes || null,
          items: (values.items || []).map((item) => ({
            productId: item.productId,
            warehouseId: null,
            rackLocationId: null,
            quantity: Number(item.quantity || 0),
            unitPrice: Number(item.unitPrice || 0),
          })),
        });
      }}
    >
      {mode === "edit" ? (
        <Form.Item label="Document Number" name="documentNumber">
          <Input className="dashboard-filter-control w-full" disabled />
        </Form.Item>
      ) : (
        <Form.Item name="documentNumber" hidden>
          <Input />
        </Form.Item>
      )}

      <div className="grid grid-cols-1 gap-x-5 gap-y-1 md:grid-cols-4">
        <Form.Item label="Supplier" name="supplierId">
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            className="dashboard-filter-control w-full"
            placeholder="Select supplier"
            popupMatchSelectWidth={false}
            options={suppliers.map((supplier) => ({
              label: supplier.name,
              value: supplier.id,
            }))}
          />
        </Form.Item>

        <Form.Item label="No Faktur" name="invoiceNumber">
          <Input
            className="dashboard-filter-control w-full"
            placeholder="Example: 000952"
          />
        </Form.Item>

        <Form.Item
          label="Stock In Date"
          name="stockInDatePicker"
          rules={[{ required: true, message: "Tanggal wajib diisi" }]}
        >
          <DatePicker className="dashboard-filter-control w-full" />
        </Form.Item>

        <Form.Item label="Due Date" name="dueDatePicker">
          <DatePicker
            className="dashboard-filter-control w-full"
            placeholder="Optional due date"
          />
        </Form.Item>
      </div>

      <Form.Item label="Notes" name="notes">
        <TextArea rows={2} className="text-sm" placeholder="Optional notes" />
      </Form.Item>

      <div className="mb-2 flex flex-col gap-2 border-t border-slate-100 pt-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-700">Items</div>

          <div className="text-xs text-slate-500">
            Pilih product, qty, dan harga barang masuk.
          </div>
        </div>

        <div className="border border-slate-100 bg-slate-50 px-4 py-2 text-right">
          <div className="text-xs text-slate-500">Total</div>

          <div className="text-base font-bold text-slate-900">
            {formatCurrency(totalAmount)}
          </div>
        </div>
      </div>

      <Form.List name="items">
        {(fields, { add, remove }) => (
          <div className="overflow-hidden border border-slate-200 bg-white">
            <div className="grid grid-cols-12 border-b border-slate-200 bg-slate-50 text-sm font-semibold text-slate-800">
              <div className="col-span-5 border-r border-slate-200 px-3 py-3 text-center">
                Product
              </div>

              <div className="col-span-2 border-r border-slate-200 px-3 py-3 text-center">
                Qty
              </div>

              <div className="col-span-2 border-r border-slate-200 px-3 py-3 text-center">
                Unit Price
              </div>

              <div className="col-span-2 border-r border-slate-200 px-3 py-3 text-center">
                Total
              </div>

              <div className="col-span-1 px-3 py-3 text-center">-</div>
            </div>

            <div>
              {fields.map(({ key, name, ...restField }) => {
                const item = watchedItems?.[name];

                const productId = item?.productId;
                const quantity = Number(item?.quantity || 0);
                const unitPrice = Number(item?.unitPrice || 0);

                const selectedProduct = getProductById(productId);
                const itemTotal = quantity * unitPrice;

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
                            message: "Product wajib dipilih",
                          },
                        ]}
                      >
                        <Select
                          showSearch
                          optionFilterProp="label"
                          className="dashboard-filter-control w-full"
                          placeholder="Select product"
                          popupMatchSelectWidth={480}
                          onChange={(value) => {
                            const product = products.find(
                              (productItem) => productItem.id === value,
                            );

                            if (product) {
                              form.setFieldValue(
                                ["items", name, "unitPrice"],
                                Number(product.sellingPrice || 0),
                              );
                            }

                            form.setFieldValue(
                              ["items", name, "warehouseId"],
                              null,
                            );
                            form.setFieldValue(
                              ["items", name, "rackLocationId"],
                              null,
                            );
                          }}
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

                      {selectedProduct ? (
                        <div className="mt-1 text-xs text-slate-400">
                          Current: {selectedProduct.currentStock}{" "}
                          {selectedProduct.unit.shortName}
                        </div>
                      ) : null}
                    </div>

                    <div className="col-span-2 border-r border-slate-200 px-3 py-3">
                      <Form.Item
                        {...restField}
                        name={[name, "quantity"]}
                        className="mb-0"
                        rules={[
                          {
                            required: true,
                            message: "Qty wajib diisi",
                          },
                        ]}
                      >
                        <InputNumber<number>
                          min={1}
                          controls={false}
                          className="dashboard-filter-control w-full text-center"
                          placeholder="1"
                        />
                      </Form.Item>

                      {selectedProduct?.unit?.shortName ? (
                        <div className="mt-1 text-center text-xs text-slate-400">
                          {selectedProduct.unit.shortName}
                        </div>
                      ) : null}
                    </div>

                    <div className="col-span-2 border-r border-slate-200 px-3 py-3">
                      <Form.Item
                        {...restField}
                        name={[name, "unitPrice"]}
                        className="mb-0"
                        rules={[
                          {
                            required: true,
                            message: "Harga wajib diisi",
                          },
                        ]}
                      >
                        <InputNumber<number>
                          min={0}
                          className="dashboard-filter-control money-input w-full"
                          controls={false}
                          formatter={(value) => formatRupiahInput(value)}
                          parser={(value) => parseNumberInput(value)}
                          placeholder="Rp 0"
                        />
                      </Form.Item>
                    </div>

                    <div className="col-span-2 border-r border-slate-200 px-3 py-3">
                      <div className="whitespace-nowrap text-right text-sm font-semibold text-slate-900">
                        {formatCurrency(itemTotal)}
                      </div>
                    </div>

                    <div className="col-span-1 flex min-h-[56px] items-center justify-center px-3 py-3">
                      {fields.length > 1 ? (
                        <Button
                          type="link"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          className="dashboard-table-action-btn !px-0"
                          onClick={() => remove(name)}
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
