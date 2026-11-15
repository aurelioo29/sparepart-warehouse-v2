"use client";

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
import { useEffect, useMemo } from "react";

const { TextArea } = Input;

export type UnpaidSaleOption = {
  id: string;
  invoiceNumber: string;
  saleDate: string;
  totalAmount: string | number;
  paidAmount: string | number;
  remainingAmount: string | number;
  paymentStatus: string;
  customer?: {
    id: string;
    name: string;
  } | null;
};

export type SalePaymentInitialValues = {
  id: string;
  saleId: string;
  paymentDate: string;
  amount: string | number;
  discountPercent?: string | number;
  discountAmount?: string | number;
  method: string;
  referenceNumber?: string | null;
  notes?: string | null;
  sale: UnpaidSaleOption;
};

export type SalePaymentFormValues = {
  saleId: string;
  paymentDate: string;
  amount: number;
  discountType: "NONE" | "PERCENT" | "AMOUNT";
  discountPercent: number;
  discountAmount: number;
  method: string;
  referenceNumber?: string | null;
  notes?: string | null;
};

type SalePaymentFormProps = {
  mode?: "create" | "edit";
  loading?: boolean;
  submitText?: string;
  sales: UnpaidSaleOption[];
  initialSaleId?: string | null;
  initialValues?: SalePaymentInitialValues | null;
  onCancel: () => void;
  onSubmit: (values: SalePaymentFormValues) => void;
};

type InternalFormValues = Omit<SalePaymentFormValues, "paymentDate"> & {
  paymentDatePicker: dayjs.Dayjs;
};

const paymentMethodOptions = [
  { label: "Cash", value: "CASH" },
  { label: "Transfer", value: "TRANSFER" },
  { label: "Debit", value: "DEBIT" },
  { label: "Credit", value: "CREDIT" },
  { label: "QRIS", value: "QRIS" },
  { label: "Other", value: "OTHER" },
];

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

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getDiscountAmount(baseAmount: number, discountPercent: number) {
  if (!baseAmount || baseAmount <= 0) return 0;
  if (!discountPercent || discountPercent <= 0) return 0;

  return Math.min(roundMoney((baseAmount * discountPercent) / 100), baseAmount);
}

function getExistingSettlementDiscount(sale: UnpaidSaleOption | undefined) {
  if (!sale) return 0;

  const totalAmount = Number(sale.totalAmount || 0);
  const paidAmount = Number(sale.paidAmount || 0);
  const remainingAmount = Number(sale.remainingAmount || 0);

  return Math.max(totalAmount - paidAmount - remainingAmount, 0);
}

export default function SalePaymentForm({
  mode = "create",
  loading,
  submitText,
  sales,
  initialSaleId,
  initialValues,
  onCancel,
  onSubmit,
}: SalePaymentFormProps) {
  const [form] = Form.useForm<InternalFormValues>();

  const saleId = Form.useWatch("saleId", form);
  const amountValue = Form.useWatch("amount", form);
  const discountTypeValue = Form.useWatch("discountType", form);
  const discountPercentValue = Form.useWatch("discountPercent", form);
  const discountAmountValue = Form.useWatch("discountAmount", form);

  const mergedSales = useMemo(() => {
    if (!initialValues?.sale) return sales;

    const exists = sales.some((sale) => sale.id === initialValues.sale.id);

    if (exists) return sales;

    return [initialValues.sale, ...sales];
  }, [initialValues?.sale, sales]);

  const selectedSale = mergedSales.find((sale) => sale.id === saleId);

  const suggestedAmount = useMemo(() => {
    if (!selectedSale) return 0;

    const remainingAmount = Number(selectedSale.remainingAmount || 0);

    if (mode === "edit" && initialValues?.saleId === selectedSale.id) {
      return (
        remainingAmount +
        Number(initialValues.amount || 0) +
        Number(initialValues.discountAmount || 0)
      );
    }

    return remainingAmount;
  }, [initialValues, mode, selectedSale]);

  const discountType = discountTypeValue || "NONE";
  const discountPercent = Number(discountPercentValue || 0);
  const discountAmount =
    discountType === "PERCENT"
      ? getDiscountAmount(suggestedAmount, discountPercent)
      : discountType === "AMOUNT"
        ? Math.min(Number(discountAmountValue || 0), suggestedAmount)
        : 0;
  const amount = Number(amountValue || 0);
  const settlementAmount = amount + discountAmount;
  const remainingAfterPayment = Math.max(suggestedAmount - settlementAmount, 0);
  const existingSettlementDiscount =
    getExistingSettlementDiscount(selectedSale);

  useEffect(() => {
    if (mode === "edit" && initialValues) {
      form.setFieldsValue({
        saleId: initialValues.saleId,
        paymentDatePicker: dayjs(initialValues.paymentDate),
        amount: Number(initialValues.amount || 0),
        discountType:
          Number(initialValues.discountPercent || 0) > 0
            ? "PERCENT"
            : Number(initialValues.discountAmount || 0) > 0
              ? "AMOUNT"
              : "NONE",
        discountPercent: Number(initialValues.discountPercent || 0),
        discountAmount: Number(initialValues.discountAmount || 0),
        method: initialValues.method || "CASH",
        referenceNumber: initialValues.referenceNumber || "",
        notes: initialValues.notes || "",
      });

      return;
    }

    form.setFieldsValue({
      saleId: initialSaleId || undefined,
      paymentDatePicker: dayjs(),
      amount: undefined as unknown as number,
      discountType: "NONE",
      discountPercent: 0,
      discountAmount: 0,
      method: "CASH",
      referenceNumber: "",
      notes: "",
    });
  }, [form, initialSaleId, initialValues, mode]);

  function setAmountPercent(percent: number) {
    if (!selectedSale) return;

    const newAmount = Math.floor(Number(suggestedAmount || 0) * percent);

    form.setFieldsValue({
      amount: newAmount,
      discountType: "NONE",
      discountPercent: 0,
      discountAmount: 0,
    });
  }

  function applyDiscountPercent(percent: number) {
    const safePercent = Math.min(Math.max(Number(percent || 0), 0), 100);
    const newDiscountAmount = getDiscountAmount(suggestedAmount, safePercent);
    const suggestedCashAmount = Math.max(
      suggestedAmount - newDiscountAmount,
      0,
    );

    form.setFieldsValue({
      discountType: "PERCENT",
      discountPercent: safePercent,
      discountAmount: 0,
      amount: suggestedCashAmount,
    });
  }

  function applyDiscountAmount(value: number) {
    const safeAmount = Math.min(
      Math.max(Number(value || 0), 0),
      suggestedAmount,
    );

    form.setFieldsValue({
      discountType: "AMOUNT",
      discountPercent: 0,
      discountAmount: safeAmount,
      amount: Math.max(suggestedAmount - safeAmount, 0),
    });
  }

  function roundPaymentToThousands() {
    if (!selectedSale || suggestedAmount <= 0) return;

    const roundedPayment = Math.floor(suggestedAmount / 1000) * 1000;
    const roundingDiscount = suggestedAmount - roundedPayment;

    form.setFieldsValue({
      amount: roundedPayment,
      discountType: roundingDiscount > 0 ? "AMOUNT" : "NONE",
      discountPercent: 0,
      discountAmount: roundingDiscount,
    });
  }

  return (
    <Form<InternalFormValues>
      form={form}
      layout="vertical"
      requiredMark={false}
      className="form-compact text-sm"
      onFinish={(values) => {
        onSubmit({
          saleId: values.saleId,
          paymentDate: values.paymentDatePicker.format("YYYY-MM-DD"),
          amount: Number(values.amount),
          discountType: values.discountType || "NONE",
          discountPercent: Number(values.discountPercent || 0),
          discountAmount: Number(values.discountAmount || 0),
          method: values.method,
          referenceNumber: values.referenceNumber || null,
          notes: values.notes || null,
        });
      }}
    >
      <div className="border border-slate-100 bg-white p-4">
        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <Form.Item
            label="Invoice"
            name="saleId"
            rules={[{ required: true, message: "Invoice wajib dipilih" }]}
          >
            <Select
              showSearch
              disabled={mode === "edit"}
              placeholder="Select unpaid invoice"
              optionFilterProp="label"
              className="dashboard-filter-control w-full"
              options={mergedSales.map((sale) => ({
                label: `${sale.invoiceNumber} - ${
                  sale.customer?.name || "-"
                } | Remaining: ${formatCurrency(sale.remainingAmount)}`,
                value: sale.id,
              }))}
              onChange={(value) => {
                const sale = mergedSales.find((item) => item.id === value);

                if (sale) {
                  form.setFieldsValue({
                    amount: Number(sale.remainingAmount),
                    discountType: "NONE",
                    discountPercent: 0,
                    discountAmount: 0,
                  });
                }
              }}
            />
          </Form.Item>

          <Form.Item
            label="Payment Date"
            name="paymentDatePicker"
            rules={[{ required: true, message: "Tanggal wajib diisi" }]}
          >
            <DatePicker className="dashboard-filter-control w-full" />
          </Form.Item>
        </div>

        {selectedSale ? (
          <div className="mb-4 border border-slate-100 bg-slate-50 p-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Total
                </div>
                <div className="mt-1 font-bold text-slate-900">
                  {formatCurrency(selectedSale.totalAmount)}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Paid
                </div>
                <div className="mt-1 font-bold text-green-600">
                  {formatCurrency(selectedSale.paidAmount)}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Discount Settled
                </div>
                <div className="mt-1 font-bold text-amber-600">
                  {formatCurrency(existingSettlementDiscount)}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Remaining
                </div>
                <div className="mt-1 font-bold text-red-600">
                  {formatCurrency(selectedSale.remainingAmount)}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Base This Payment
                </div>
                <div className="mt-1 font-bold text-blue-600">
                  {formatCurrency(suggestedAmount)}
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="small"
                className="dashboard-action-btn"
                onClick={() => setAmountPercent(0.5)}
              >
                50%
              </Button>

              <Button
                size="small"
                className="dashboard-action-btn"
                onClick={() => setAmountPercent(1)}
              >
                Isi Sisa
              </Button>

              <Button
                size="small"
                className="dashboard-action-btn"
                onClick={() => applyDiscountPercent(5)}
              >
                Diskon 5%
              </Button>

              <Button
                size="small"
                className="dashboard-action-btn"
                onClick={() => applyDiscountPercent(10)}
              >
                Diskon 10%
              </Button>

              <Button
                size="small"
                type="primary"
                className="dashboard-action-btn"
                onClick={roundPaymentToThousands}
              >
                Bulatkan ke Ribuan
              </Button>
            </div>

            <div className="mt-2 text-xs text-slate-500">
              Diskon persen dihitung dari base pembayaran ini. Jika ingin
              langsung lunas, sistem akan menyarankan cash = base - diskon.
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <Form.Item
            label="Discount Type"
            name="discountType"
            rules={[{ required: true, message: "Tipe diskon wajib dipilih" }]}
          >
            <Select
              options={[
                { label: "Tanpa Diskon", value: "NONE" },
                { label: "Diskon Persen", value: "PERCENT" },
                { label: "Diskon Nominal", value: "AMOUNT" },
              ]}
              onChange={(value) => {
                if (value === "NONE") {
                  form.setFieldsValue({
                    amount: suggestedAmount,
                    discountPercent: 0,
                    discountAmount: 0,
                  });
                } else if (value === "PERCENT") {
                  form.setFieldsValue({
                    discountAmount: 0,
                  });
                } else {
                  form.setFieldsValue({
                    discountPercent: 0,
                  });
                }
              }}
            />
          </Form.Item>

          {discountType === "PERCENT" ? (
            <Form.Item
              label="Discount Percent"
              name="discountPercent"
              rules={[
                {
                  validator: (_, value) => {
                    const percent = Number(value || 0);

                    if (Number.isNaN(percent) || percent < 0 || percent > 100) {
                      return Promise.reject(
                        new Error("Diskon persen harus di antara 0 - 100"),
                      );
                    }

                    return Promise.resolve();
                  },
                },
              ]}
            >
              <InputNumber<number>
                min={0}
                max={100}
                precision={2}
                className="dashboard-filter-control w-full"
                controls={false}
                placeholder="0"
                addonAfter="%"
                onChange={(value) => applyDiscountPercent(Number(value || 0))}
              />
            </Form.Item>
          ) : discountType === "AMOUNT" ? (
            <Form.Item
              label="Discount Amount"
              name="discountAmount"
              rules={[
                {
                  validator: (_, value) => {
                    const nominal = Number(value || 0);

                    if (Number.isNaN(nominal) || nominal < 0) {
                      return Promise.reject(
                        new Error("Diskon nominal harus minimal 0"),
                      );
                    }

                    if (nominal > suggestedAmount) {
                      return Promise.reject(
                        new Error("Diskon tidak boleh melebihi sisa tagihan"),
                      );
                    }

                    return Promise.resolve();
                  },
                },
              ]}
            >
              <InputNumber<number>
                min={0}
                max={suggestedAmount}
                className="money-input w-full"
                controls={false}
                placeholder="Rp 0"
                formatter={formatRupiahInput}
                parser={parseRupiahInput}
                onChange={(value) => applyDiscountAmount(Number(value || 0))}
              />
            </Form.Item>
          ) : (
            <div />
          )}

          <Form.Item
            label="Payment Amount"
            name="amount"
            rules={[
              { required: true, message: "Nominal wajib diisi" },
              {
                validator: (_, value) => {
                  const amount = Number(value);

                  if (Number.isNaN(amount) || amount <= 0) {
                    return Promise.reject(
                      new Error("Nominal harus lebih dari 0"),
                    );
                  }

                  return Promise.resolve();
                },
              },
            ]}
          >
            <InputNumber<number>
              min={1}
              className="money-input w-full"
              controls={false}
              placeholder="Rp 0"
              formatter={formatRupiahInput}
              parser={parseRupiahInput}
            />
          </Form.Item>

          <Form.Item
            label="Method"
            name="method"
            rules={[{ required: true, message: "Metode wajib dipilih" }]}
          >
            <Select options={paymentMethodOptions} />
          </Form.Item>

          <Form.Item label="Reference Number" name="referenceNumber">
            <Input placeholder="Transfer ref / QRIS ref / etc" />
          </Form.Item>
        </div>

        <div className="mb-4 border border-slate-100 bg-slate-50 p-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Discount Amount
              </div>
              <div className="mt-1 font-bold text-amber-600">
                {formatCurrency(discountAmount)}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Cash Payment
              </div>
              <div className="mt-1 font-bold text-blue-600">
                {formatCurrency(amount)}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Total Settlement
              </div>
              <div className="mt-1 font-bold text-green-600">
                {formatCurrency(settlementAmount)}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Remaining After
              </div>
              <div className="mt-1 font-bold text-red-600">
                {formatCurrency(remainingAfterPayment)}
              </div>
            </div>
          </div>
        </div>

        <Form.Item label="Notes" name="notes">
          <TextArea rows={3} placeholder="Optional notes" />
        </Form.Item>

        <div className="mt-4 flex justify-end border-t border-slate-100 pt-4">
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
              {submitText ||
                (mode === "edit" ? "Save Changes" : "Create Payment")}
            </Button>
          </Space>
        </div>
      </div>
    </Form>
  );
}
