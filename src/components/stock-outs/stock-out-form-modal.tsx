"use client";

import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import {
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
} from "antd";
import dayjs from "dayjs";
import { useEffect } from "react";

const { TextArea } = Input;

type ProductOption = {
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

type WarehouseOption = {
  id: string;
  name: string;
  code: string;
};

type RackLocationOption = {
  id: string;
  warehouseId: string;
  name: string;
  code: string;
};

export type StockOutFormValues = {
  documentNumber?: string | null;
  stockOutDate: string;
  reason: string;
  notes?: string | null;
  items: {
    productId: string;
    warehouseId?: string | null;
    rackLocationId?: string | null;
    quantity: number;
    unitPrice: number;
    notes?: string | null;
  }[];
};

type StockOutFormModalProps = {
  open: boolean;
  loading?: boolean;
  products: ProductOption[];
  warehouses: WarehouseOption[];
  rackLocations: RackLocationOption[];
  onCancel: () => void;
  onSubmit: (values: StockOutFormValues) => void;
};

type InternalFormValues = Omit<StockOutFormValues, "stockOutDate"> & {
  stockOutDatePicker: dayjs.Dayjs;
};

const reasonOptions = [
  { label: "Internal Use", value: "INTERNAL_USE" },
  { label: "Damaged", value: "DAMAGED" },
  { label: "Lost", value: "LOST" },
  { label: "Return To Supplier", value: "RETURN_TO_SUPPLIER" },
  { label: "Other", value: "OTHER" },
];

export default function StockOutFormModal({
  open,
  loading,
  products,
  warehouses,
  rackLocations,
  onCancel,
  onSubmit,
}: StockOutFormModalProps) {
  const [form] = Form.useForm<InternalFormValues>();

  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        documentNumber: "",
        stockOutDatePicker: dayjs(),
        reason: "OTHER",
        notes: "",
        items: [
          {
            productId: undefined as unknown as string,
            warehouseId: undefined,
            rackLocationId: undefined,
            quantity: 1,
            unitPrice: 0,
            notes: "",
          },
        ],
      });
    }
  }, [open, form]);

  function getFilteredRackLocations(warehouseId?: string | null) {
    if (!warehouseId) return rackLocations;

    return rackLocations.filter(
      (rackLocation) => rackLocation.warehouseId === warehouseId,
    );
  }

  return (
    <Modal
      open={open}
      title="Create Stock Out"
      okText="Create"
      cancelText="Cancel"
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={loading}
      destroyOnHidden
      width={1100}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        className="form-compact text-sm"
        onFinish={(values) => {
          onSubmit({
            documentNumber: values.documentNumber || null,
            stockOutDate: values.stockOutDatePicker.format("YYYY-MM-DD"),
            reason: values.reason,
            notes: values.notes || null,
            items: values.items.map((item) => ({
              productId: item.productId,
              warehouseId: item.warehouseId || null,
              rackLocationId: item.rackLocationId || null,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              notes: item.notes || null,
            })),
          });
        }}
      >
        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-3">
          {/* <Form.Item label="Document Number" name="documentNumber">
            <Input
              size="small"
              placeholder="Auto generated if empty"
              autoComplete="off"
            />
          </Form.Item> */}

          <Form.Item
            label="Stock Out Date"
            name="stockOutDatePicker"
            rules={[{ required: true, message: "Tanggal wajib diisi" }]}
          >
            <DatePicker size="small" className="w-full" />
          </Form.Item>

          <Form.Item
            label="Reason"
            name="reason"
            rules={[{ required: true, message: "Reason wajib dipilih" }]}
          >
            <Select size="small" options={reasonOptions} />
          </Form.Item>
        </div>

        <Form.Item label="Notes" name="notes">
          <TextArea rows={2} placeholder="Optional notes" />
        </Form.Item>

        <div className="mb-2 text-sm font-semibold text-slate-700">Items</div>

        <Form.List name="items">
          {(fields, { add, remove }) => (
            <>
              <div className="space-y-3">
                {fields.map(({ key, name, ...restField }) => {
                  const warehouseId = form.getFieldValue([
                    "items",
                    name,
                    "warehouseId",
                  ]);

                  const productId = form.getFieldValue([
                    "items",
                    name,
                    "productId",
                  ]);

                  const selectedProduct = products.find(
                    (product) => product.id === productId,
                  );

                  return (
                    <div
                      key={key}
                      className="grid grid-cols-1 gap-3 border border-slate-100 bg-slate-50 p-3 md:grid-cols-12"
                    >
                      <Form.Item
                        {...restField}
                        label="Product"
                        name={[name, "productId"]}
                        className="md:col-span-4"
                        rules={[
                          { required: true, message: "Product wajib dipilih" },
                        ]}
                      >
                        <Select
                          size="small"
                          showSearch
                          placeholder="Select product"
                          optionFilterProp="label"
                          options={products.map((product) => ({
                            label: `${product.sku} - ${product.name} | Stock: ${product.currentStock}`,
                            value: product.id,
                          }))}
                        />
                      </Form.Item>

                      <Form.Item
                        {...restField}
                        label="Warehouse"
                        name={[name, "warehouseId"]}
                        className="md:col-span-2"
                      >
                        <Select
                          size="small"
                          allowClear
                          placeholder="Warehouse"
                          onChange={() => {
                            form.setFieldValue(
                              ["items", name, "rackLocationId"],
                              undefined,
                            );
                          }}
                          options={warehouses.map((warehouse) => ({
                            label: `${warehouse.name} (${warehouse.code})`,
                            value: warehouse.id,
                          }))}
                        />
                      </Form.Item>

                      <Form.Item
                        {...restField}
                        label="Rack"
                        name={[name, "rackLocationId"]}
                        className="md:col-span-2"
                      >
                        <Select
                          size="small"
                          allowClear
                          placeholder="Rack"
                          options={getFilteredRackLocations(warehouseId).map(
                            (rackLocation) => ({
                              label: `${rackLocation.name} (${rackLocation.code})`,
                              value: rackLocation.id,
                            }),
                          )}
                        />
                      </Form.Item>

                      <Form.Item
                        {...restField}
                        label={`Qty ${
                          selectedProduct?.unit?.shortName
                            ? `(${selectedProduct.unit.shortName})`
                            : ""
                        }`}
                        name={[name, "quantity"]}
                        className="md:col-span-1"
                        rules={[{ required: true, message: "Qty wajib diisi" }]}
                      >
                        <InputNumber
                          size="small"
                          min={1}
                          max={selectedProduct?.currentStock}
                          className="w-full"
                        />
                      </Form.Item>

                      <Form.Item
                        {...restField}
                        label="Unit Price"
                        name={[name, "unitPrice"]}
                        className="md:col-span-2"
                      >
                        <InputNumber size="small" min={0} className="w-full" />
                      </Form.Item>

                      <div className="flex items-center justify-center pt-5 md:col-span-1">
                        {fields.length > 1 && (
                          <Button
                            danger
                            type="link"
                            size="small"
                            icon={<MinusCircleOutlined />}
                            onClick={() => remove(name)}
                          />
                        )}
                      </div>

                      <Form.Item
                        {...restField}
                        label="Item Notes"
                        name={[name, "notes"]}
                        className="md:col-span-12"
                      >
                        <Input size="small" placeholder="Optional item notes" />
                      </Form.Item>
                    </div>
                  );
                })}
              </div>

              <Button
                type="dashed"
                size="small"
                icon={<PlusOutlined />}
                className="mt-3"
                onClick={() =>
                  add({
                    productId: undefined,
                    warehouseId: undefined,
                    rackLocationId: undefined,
                    quantity: 1,
                    unitPrice: 0,
                    notes: "",
                  })
                }
              >
                Add Item
              </Button>
            </>
          )}
        </Form.List>
      </Form>
    </Modal>
  );
}
