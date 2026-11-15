"use client";

import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import {
  App,
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
} from "antd";
import dayjs from "dayjs";
import { useEffect, useMemo, useRef, useState } from "react";

const { TextArea } = Input;

export type CustomerOption = {
  id: string;
  name: string;
  address?: string | null;
  customerType: string;
  paymentTermDays?: number | null;
};

export type SalesmanOption = {
  id: string;
  code: string;
  name: string;
  salesmanType: string;
};

export type ProductOption = {
  id: string;
  sku: string;
  name: string;
  currentStock: number;
  minimumStock?: number | null;
  sellingPrice: string | number;
  warehouseId?: string | null;
  rackLocationId?: string | null;
  unit: {
    id: string;
    name: string;
    shortName: string;
  };
  warehouse?: {
    id: string;
    name: string;
    code: string;
  } | null;
  rackLocation?: {
    id: string;
    warehouseId: string;
    name: string;
    code: string;
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

export type SaleFormValues = {
  customerId?: string | null;
  salesmanId?: string | null;
  invoiceNumber?: string | null;
  saleDate: string;
  dueDate?: string | null;
  paidAmount?: number;
  notes?: string | null;
  items: {
    productId: string;
    warehouseId?: string | null;
    rackLocationId?: string | null;
    quantity: number;
    unitPrice: number;
    discountPercent?: number;
    additionalDiscountPercent?: number;
    additionalDiscountPercent2?: number;
  }[];
};

export type SaleDetailInitialValues = {
  id: string;
  customerId?: string | null;
  salesmanId?: string | null;
  invoiceNumber?: string | null;
  saleDate: string;
  dueDate?: string | null;
  subtotal?: string | number;
  discountAmount?: string | number;
  paidAmount?: string | number;
  notes?: string | null;
  items: {
    id: string;
    productId: string;
    warehouseId?: string | null;
    rackLocationId?: string | null;
    quantity: number;
    unitPrice: string | number;
    discountPercent?: string | number | null;
    additionalDiscountPercent?: string | number | null;
    additionalDiscountPercent2?: string | number | null;
    discountAmount?: string | number | null;
  }[];
};

type SaleFormProps = {
  loading?: boolean;
  submitText?: string;
  mode?: "create" | "edit";
  initialValues?: SaleDetailInitialValues | null;
  customers: CustomerOption[];
  salesmen: SalesmanOption[];
  products: ProductOption[];
  warehouses: WarehouseOption[];
  rackLocations: RackLocationOption[];
  onCancel: () => void;
  onSubmit: (values: SaleFormValues) => void;
};

type InternalSaleFormValues = Omit<SaleFormValues, "saleDate" | "dueDate"> & {
  saleDatePicker: dayjs.Dayjs;
  dueDatePicker?: dayjs.Dayjs | null;
};

function toNumber(value: unknown) {
  const numberValue = Number(value || 0);

  return Number.isNaN(numberValue) ? 0 : numberValue;
}

function formatCurrency(value: string | number | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatRupiahInput(value: string | number | undefined) {
  if (value === undefined || value === null || value === "") return "";

  const cleanValue = String(value).replace(/[^\d]/g, "");
  const numberValue = Number(cleanValue);

  if (!cleanValue || Number.isNaN(numberValue)) return "";

  return `Rp ${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(numberValue)}`;
}

function parseRupiahInput(value: string | undefined) {
  const cleanValue = String(value || "").replace(/[^\d]/g, "");
  const numberValue = Number(cleanValue);

  return Number.isNaN(numberValue) ? 0 : numberValue;
}

function getCustomerLabel(customer: CustomerOption) {
  const address = customer.address?.trim() || "-";

  return `${customer.name} - ${address}`;
}

function getProductStockStatus(product: ProductOption) {
  const currentStock = toNumber(product.currentStock);
  const minimumStock =
    product.minimumStock === null || product.minimumStock === undefined
      ? 5
      : Math.max(toNumber(product.minimumStock), 0);

  if (currentStock <= 0) {
    return {
      label: "Out of Stock",
      className: "font-semibold text-red-600",
    };
  }

  if (currentStock <= minimumStock) {
    return {
      label: "Low Stock",
      className: "font-semibold text-orange-500",
    };
  }

  return {
    label: "Available",
    className: "font-semibold text-green-600",
  };
}

function calculateItemDiscount(item?: {
  quantity?: number;
  unitPrice?: number;
  discountPercent?: number;
  additionalDiscountPercent?: number;
  additionalDiscountPercent2?: number;
}) {
  const quantity = toNumber(item?.quantity);
  const unitPrice = toNumber(item?.unitPrice);
  const discountPercent = toNumber(item?.discountPercent);
  const additionalDiscountPercent = toNumber(item?.additionalDiscountPercent);
  const additionalDiscountPercent2 = toNumber(item?.additionalDiscountPercent2);

  const subtotal = quantity * unitPrice;

  // Diskon utama otomatis berlaku ke seluruh Qty.
  const mainDiscountAmount = subtotal * (discountPercent / 100);
  const afterMainDiscount = subtotal - mainDiscountAmount;

  // Extra 1 dihitung dari nilai setelah diskon utama.
  const additionalDiscountAmount =
    afterMainDiscount * (additionalDiscountPercent / 100);
  const afterAdditionalDiscount = afterMainDiscount - additionalDiscountAmount;

  // Extra 2 dihitung dari nilai setelah Extra 1.
  const additionalDiscountAmount2 =
    afterAdditionalDiscount * (additionalDiscountPercent2 / 100);

  const discountAmount =
    mainDiscountAmount + additionalDiscountAmount + additionalDiscountAmount2;

  const total = Math.max(subtotal - discountAmount, 0);

  return {
    subtotal,
    mainDiscountAmount,
    additionalDiscountAmount,
    additionalDiscountAmount2,
    discountAmount,
    total,
  };
}

function getDefaultItem() {
  return {
    productId: undefined as unknown as string,
    warehouseId: undefined,
    rackLocationId: undefined,
    quantity: 1,
    unitPrice: 0,
    discountPercent: 0,
    additionalDiscountPercent: 0,
    additionalDiscountPercent2: 0,
  };
}

export default function SaleForm({
  loading,
  submitText = "Save",
  mode = "create",
  initialValues,
  customers,
  salesmen,
  products,
  onCancel,
  onSubmit,
}: SaleFormProps) {
  const [form] = Form.useForm<InternalSaleFormValues>();
  const { message } = App.useApp();

  const [salesmanLoading, setSalesmanLoading] = useState(false);
  const salesmanRequestIdRef = useRef(0);

  const watchedItems = Form.useWatch("items", form) || [];
  const watchedPaidAmount = Form.useWatch("paidAmount", form);
  const watchedCustomerId = Form.useWatch("customerId", form);

  useEffect(() => {
    if (mode === "edit" && initialValues) {
      form.setFieldsValue({
        customerId: initialValues.customerId || undefined,
        salesmanId: initialValues.salesmanId || undefined,
        invoiceNumber: initialValues.invoiceNumber || "",
        saleDatePicker: initialValues.saleDate
          ? dayjs(initialValues.saleDate)
          : dayjs(),
        dueDatePicker: initialValues.dueDate
          ? dayjs(initialValues.dueDate)
          : null,
        paidAmount: toNumber(initialValues.paidAmount),
        notes: initialValues.notes || "",
        items: initialValues.items.map((item) => ({
          productId: item.productId,
          warehouseId: item.warehouseId || undefined,
          rackLocationId: item.rackLocationId || undefined,
          quantity: toNumber(item.quantity),
          unitPrice: toNumber(item.unitPrice),
          discountPercent: toNumber(item.discountPercent),
          additionalDiscountPercent: toNumber(item.additionalDiscountPercent),
          additionalDiscountPercent2: toNumber(item.additionalDiscountPercent2),
        })),
      });

      return;
    }

    form.setFieldsValue({
      customerId: undefined,
      salesmanId: undefined,
      invoiceNumber: "",
      saleDatePicker: dayjs(),
      dueDatePicker: null,
      paidAmount: 0,
      notes: "",
      items: [getDefaultItem()],
    });
  }, [mode, initialValues, form]);

  useEffect(() => {
    if (!watchedCustomerId) return;

    const selectedCustomer = customers.find(
      (customer) => customer.id === watchedCustomerId,
    );

    const saleDate = form.getFieldValue("saleDatePicker") || dayjs();

    if (selectedCustomer?.paymentTermDays) {
      form.setFieldValue(
        "dueDatePicker",
        saleDate.add(selectedCustomer.paymentTermDays, "day"),
      );
    }
  }, [watchedCustomerId, customers, form]);

  function getProductById(productId?: string | null) {
    if (!productId) return null;

    return products.find((product) => product.id === productId) || null;
  }

  function fillProductDefaults(name: number, product: ProductOption) {
    form.setFieldValue(
      ["items", name, "unitPrice"],
      Number(product.sellingPrice || 0),
    );

    form.setFieldValue(
      ["items", name, "warehouseId"],
      product.warehouseId || product.warehouse?.id || undefined,
    );

    form.setFieldValue(
      ["items", name, "rackLocationId"],
      product.rackLocationId || product.rackLocation?.id || undefined,
    );
  }

  async function handleCustomerChange(customerId?: string) {
    const requestId = salesmanRequestIdRef.current + 1;
    salesmanRequestIdRef.current = requestId;

    if (!customerId) {
      form.setFieldValue("salesmanId", undefined);
      setSalesmanLoading(false);
      return;
    }

    try {
      setSalesmanLoading(true);

      const response = await fetch(
        `/api/customers/${customerId}/last-salesman`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Gagal mengambil riwayat salesman customer",
        );
      }

      if (requestId !== salesmanRequestIdRef.current) return;

      form.setFieldValue("salesmanId", result.data?.salesman?.id || undefined);
    } catch (error) {
      if (requestId !== salesmanRequestIdRef.current) return;

      console.error(error);
      form.setFieldValue("salesmanId", undefined);

      message.warning(
        error instanceof Error
          ? error.message
          : "Gagal mengambil riwayat salesman customer",
      );
    } finally {
      if (requestId === salesmanRequestIdRef.current) {
        setSalesmanLoading(false);
      }
    }
  }

  const totals = useMemo(() => {
    const subtotal = watchedItems.reduce(
      (sum, item) => sum + calculateItemDiscount(item).subtotal,
      0,
    );

    const discountTotal = watchedItems.reduce(
      (sum, item) => sum + calculateItemDiscount(item).discountAmount,
      0,
    );

    const total = Math.max(subtotal - discountTotal, 0);
    const paidAmount = toNumber(watchedPaidAmount);
    const remaining = Math.max(total - paidAmount, 0);

    let paymentStatus = "UNPAID";

    if (paidAmount >= total && total > 0) {
      paymentStatus = "PAID";
    } else if (paidAmount > 0) {
      paymentStatus = "PARTIAL";
    }

    return {
      subtotal,
      discountTotal,
      total,
      paidAmount,
      remaining,
      paymentStatus,
    };
  }, [watchedItems, watchedPaidAmount]);

  const itemSummary = useMemo(() => {
    const totalRows = watchedItems.length;

    const totalQty = watchedItems.reduce((sum, item) => {
      return sum + toNumber(item?.quantity);
    }, 0);

    const selectedProductIds = watchedItems
      .map((item) => item?.productId)
      .filter(Boolean);

    const uniqueProductCount = new Set(selectedProductIds).size;

    return {
      totalRows,
      totalQty,
      uniqueProductCount,
    };
  }, [watchedItems]);

  return (
    <Form<InternalSaleFormValues>
      form={form}
      layout="vertical"
      requiredMark={false}
      className="form-compact w-full bg-white p-5 text-sm"
      onFinish={(values) => {
        onSubmit({
          customerId: values.customerId || null,
          salesmanId: values.salesmanId || null,
          invoiceNumber: values.invoiceNumber
            ? values.invoiceNumber.trim().toUpperCase()
            : null,
          saleDate: values.saleDatePicker.format("YYYY-MM-DD"),
          dueDate: values.dueDatePicker
            ? values.dueDatePicker.format("YYYY-MM-DD")
            : null,
          paidAmount: Number(values.paidAmount || 0),
          notes: values.notes || null,
          items: values.items.map((item) => ({
            productId: item.productId,
            warehouseId: item.warehouseId || null,
            rackLocationId: item.rackLocationId || null,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            discountPercent: Number(item.discountPercent || 0),
            additionalDiscountPercent: Number(
              item.additionalDiscountPercent || 0,
            ),
            additionalDiscountPercent2: Number(
              item.additionalDiscountPercent2 || 0,
            ),
          })),
        });
      }}
    >
      <div className="grid grid-cols-1 gap-x-5 gap-y-1 md:grid-cols-3 xl:grid-cols-6">
        <Form.Item label="Customer" name="customerId">
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            className="dashboard-filter-control w-full"
            placeholder="Select customer"
            popupMatchSelectWidth={360}
            options={customers.map((customer) => ({
              label: getCustomerLabel(customer),
              value: customer.id,
            }))}
            onChange={(value) => {
              void handleCustomerChange(value || undefined);
            }}
          />
        </Form.Item>

        <Form.Item label="Salesman" name="salesmanId">
          <Select
            allowClear
            showSearch
            loading={salesmanLoading}
            disabled={salesmanLoading}
            optionFilterProp="label"
            className="dashboard-filter-control w-full"
            placeholder="Select salesman"
            popupMatchSelectWidth={360}
            options={salesmen.map((salesman) => ({
              label: `${salesman.name}`,
              value: salesman.id,
            }))}
          />
        </Form.Item>

        <Form.Item
          label="Invoice Number"
          name="invoiceNumber"
          extra={
            mode === "create"
              ? "Kosongkan untuk generate invoice otomatis."
              : undefined
          }
        >
          <Input
            className="dashboard-filter-control w-full"
            placeholder={mode === "edit" ? "Invoice number" : "Auto generate"}
            disabled={mode === "edit"}
          />
        </Form.Item>

        <Form.Item
          label="Sale Date"
          name="saleDatePicker"
          rules={[{ required: true, message: "Sale date wajib diisi" }]}
        >
          <DatePicker
            className="dashboard-filter-control w-full"
            onChange={(value) => {
              const customerId = form.getFieldValue("customerId");
              const selectedCustomer = customers.find(
                (customer) => customer.id === customerId,
              );

              if (value && selectedCustomer?.paymentTermDays) {
                form.setFieldValue(
                  "dueDatePicker",
                  value.add(selectedCustomer.paymentTermDays, "day"),
                );
              }
            }}
          />
        </Form.Item>

        <Form.Item label="Due Date" name="dueDatePicker">
          <DatePicker className="dashboard-filter-control w-full" />
        </Form.Item>

        <Form.Item
          label="Paid Amount"
          name="paidAmount"
          rules={[
            {
              validator: (_, value) => {
                const paidAmount = Number(value || 0);

                if (paidAmount < 0) {
                  return Promise.reject(
                    new Error("Paid amount tidak boleh minus"),
                  );
                }

                if (paidAmount > totals.total) {
                  return Promise.reject(
                    new Error(
                      `Paid amount tidak boleh lebih dari total ${formatCurrency(
                        totals.total,
                      )}`,
                    ),
                  );
                }

                return Promise.resolve();
              },
            },
          ]}
        >
          <InputNumber<number>
            min={0}
            max={totals.total}
            className="dashboard-filter-control money-input w-full"
            controls={false}
            placeholder="Rp 0"
            formatter={formatRupiahInput}
            parser={parseRupiahInput}
          />
        </Form.Item>
      </div>

      <Form.Item label="Notes" name="notes">
        <TextArea rows={2} placeholder="Optional notes" />
      </Form.Item>

      <div className="mb-3 flex flex-col gap-3 border-t border-slate-100 pt-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-700">Sale Items</div>

          {/* <div className="text-xs text-slate-500">
            Pilih product. Warehouse dan rack otomatis mengikuti lokasi default
            product.
          </div> */}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="border border-slate-100 bg-slate-50 px-3 py-2">
            <div className="font-semibold text-slate-800">
              {itemSummary.totalRows} Rows
            </div>
          </div>

          <div className="border border-slate-100 bg-slate-50 px-3 py-2">
            <div className="font-semibold text-blue-600">
              {itemSummary.totalQty} Qty
            </div>
          </div>

          <div className="border border-slate-100 bg-slate-50 px-3 py-2">
            <div className="font-semibold text-slate-800">
              {itemSummary.uniqueProductCount} Products
            </div>
          </div>
        </div>
      </div>

      <Form.List name="items">
        {(fields, { add, remove }) => (
          <div className="overflow-hidden border border-slate-200 bg-white">
            <div className="grid min-w-[1100px] grid-cols-12 border-b border-slate-200 bg-slate-50 text-sm font-semibold text-slate-800">
              <div className="col-span-5 border-r border-slate-200 px-3 py-3 text-center">
                Product
              </div>
              <div className="col-span-1 border-r border-slate-200 px-3 py-3 text-center">
                Qty
              </div>
              <div className="col-span-1 border-r border-slate-200 px-3 py-3 text-center">
                Disc %
              </div>
              <div className="col-span-1 border-r border-slate-200 px-3 py-3 text-center">
                Extra 1 %
              </div>
              <div className="col-span-1 border-r border-slate-200 px-3 py-3 text-center">
                Extra 2 %
              </div>
              <div className="col-span-2 border-r border-slate-200 px-3 py-3 text-center">
                Total
              </div>
              <div className="col-span-1 px-3 py-3 text-center">-</div>
            </div>

            <div className="overflow-x-auto">
              {fields.map(({ key, name, ...restField }) => {
                const currentItem = watchedItems?.[name];
                const productId = currentItem?.productId;
                const selectedProduct = getProductById(productId);
                const stockStatus = selectedProduct
                  ? getProductStockStatus(selectedProduct)
                  : null;
                const itemCalculation = calculateItemDiscount(currentItem);

                return (
                  <div
                    key={key}
                    className="grid min-w-[1100px] grid-cols-12 border-b border-slate-200 bg-white last:border-b-0"
                  >
                    <Form.Item name={[name, "warehouseId"]} hidden>
                      <Input />
                    </Form.Item>

                    <Form.Item name={[name, "rackLocationId"]} hidden>
                      <Input />
                    </Form.Item>

                    <Form.Item {...restField} name={[name, "unitPrice"]} hidden>
                      <InputNumber />
                    </Form.Item>

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
                          virtual={false}
                          optionFilterProp="label"
                          className="dashboard-filter-control w-full"
                          placeholder="Select product"
                          popupMatchSelectWidth={560}
                          onChange={(value) => {
                            const product = products.find(
                              (item) => item.id === value,
                            );

                            if (product) {
                              fillProductDefaults(name, product);
                            }
                          }}
                          options={products.map((product) => ({
                            label: `${product.sku} - ${product.name}`,
                            value: product.id,
                          }))}
                        />
                      </Form.Item>

                      {selectedProduct ? (
                        <div className="mt-1 flex flex-wrap items-center gap-x-1 text-xs text-slate-400">
                          <span className={stockStatus?.className}>
                            Stock: {selectedProduct.currentStock}{" "}
                            {selectedProduct.unit.shortName} (
                            {stockStatus?.label})
                          </span>

                          <span>|</span>

                          <span>
                            Unit Price:{" "}
                            {formatCurrency(
                              currentItem?.unitPrice ??
                                selectedProduct.sellingPrice,
                            )}
                          </span>
                        </div>
                      ) : null}
                    </div>

                    <div className="col-span-1 border-r border-slate-200 px-3 py-3">
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
                          className="dashboard-filter-control w-full text-center"
                          controls={false}
                        />
                      </Form.Item>

                      {selectedProduct?.unit?.shortName ? (
                        <div className="mt-1 text-center text-xs text-slate-400">
                          {selectedProduct.unit.shortName}
                        </div>
                      ) : null}
                    </div>

                    <div className="col-span-1 border-r border-slate-200 px-3 py-3">
                      <Form.Item
                        {...restField}
                        name={[name, "discountPercent"]}
                        className="mb-0"
                      >
                        <InputNumber<number>
                          min={0}
                          max={100}
                          className="dashboard-filter-control w-full"
                          controls={false}
                        />
                      </Form.Item>
                    </div>

                    <div className="col-span-1 border-r border-slate-200 px-3 py-3">
                      <Form.Item
                        {...restField}
                        name={[name, "additionalDiscountPercent"]}
                        className="mb-0"
                      >
                        <InputNumber<number>
                          min={0}
                          max={100}
                          className="dashboard-filter-control w-full"
                          controls={false}
                        />
                      </Form.Item>
                    </div>

                    <div className="col-span-1 border-r border-slate-200 px-3 py-3">
                      <Form.Item
                        {...restField}
                        name={[name, "additionalDiscountPercent2"]}
                        className="mb-0"
                      >
                        <InputNumber<number>
                          min={0}
                          max={100}
                          className="dashboard-filter-control w-full"
                          controls={false}
                        />
                      </Form.Item>
                    </div>

                    <div className="col-span-2 border-r border-slate-200 px-3 py-3">
                      <div className="whitespace-nowrap text-right text-sm font-semibold text-slate-900">
                        {formatCurrency(itemCalculation.total)}
                      </div>

                      <div className="mt-1 text-right text-xs text-red-500">
                        -{formatCurrency(itemCalculation.discountAmount)}
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
          </div>
        )}
      </Form.List>

      <div className="mt-4 grid grid-cols-1 gap-3 border border-slate-200 bg-slate-50 p-4 md:grid-cols-5">
        <div>
          <div className="text-xs text-slate-500">Subtotal</div>
          <div className="font-bold text-slate-800">
            {formatCurrency(totals.subtotal)}
          </div>
        </div>

        <div>
          <div className="text-xs text-slate-500">Discount</div>
          <div className="font-bold text-red-600">
            {formatCurrency(totals.discountTotal)}
          </div>
        </div>

        <div>
          <div className="text-xs text-slate-500">Total</div>
          <div className="font-bold text-blue-600">
            {formatCurrency(totals.total)}
          </div>
        </div>

        <div>
          <div className="text-xs text-slate-500">Paid</div>
          <div className="font-bold text-green-700">
            {formatCurrency(totals.paidAmount)}
          </div>
        </div>

        <div>
          <div className="text-xs text-slate-500">Remaining</div>
          <div className="font-bold text-red-600">
            {formatCurrency(totals.remaining)}
          </div>
        </div>
      </div>

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
