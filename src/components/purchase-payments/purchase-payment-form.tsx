"use client";

import { useMemo, useState } from "react";
import {
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Tag,
  Upload,
} from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import {
  DeleteOutlined,
  DownloadOutlined,
  EyeOutlined,
  InboxOutlined,
  PaperClipOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

const { TextArea } = Input;

export type PayableOption = {
  id: string;
  documentNumber: string;
  invoiceNumber?: string | null;
  stockInDate: string;
  dueDate?: string | null;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  supplier?: {
    id: string;
    name: string;
  } | null;
};

export type PurchasePaymentAttachment = {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  fileUrl: string;
  createdAt: string;
};

export type PurchasePaymentFormValues = {
  stockInId: string;
  paymentDate: string;
  amount: number;
  method: string;
  referenceNumber?: string | null;
  notes?: string | null;
  proofFiles?: UploadFile[];
  removeAttachmentIds?: string[];
};

type InternalFormValues = Omit<PurchasePaymentFormValues, "paymentDate"> & {
  paymentDatePicker: dayjs.Dayjs;
};

type PurchasePaymentFormProps = {
  loading?: boolean;
  submitText?: string;
  mode?: "create" | "edit";
  payables: PayableOption[];
  initialStockInId?: string | null;
  initialValues?: PurchasePaymentFormValues;
  existingAttachments?: PurchasePaymentAttachment[];
  currentPaymentAmount?: number;
  onCancel: () => void;
  onSubmit: (values: PurchasePaymentFormValues) => void;
};

function formatCurrency(value: string | number | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
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

function formatDate(value?: string | null) {
  if (!value) return "-";

  return dayjs(value).format("YYYY-MM-DD");
}

function formatFileSize(size: number) {
  if (!size) return "-";

  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

function isPdfFile(mimeType: string) {
  return mimeType === "application/pdf";
}

export default function PurchasePaymentForm({
  loading,
  submitText = "Save Payment",
  mode = "create",
  payables,
  initialStockInId,
  initialValues,
  existingAttachments = [],
  currentPaymentAmount = 0,
  onCancel,
  onSubmit,
}: PurchasePaymentFormProps) {
  const [form] = Form.useForm<InternalFormValues>();
  const [removeAttachmentIds, setRemoveAttachmentIds] = useState<string[]>([]);

  const selectedStockInId = Form.useWatch("stockInId", form);
  const watchedProofFiles = Form.useWatch("proofFiles", form) || [];

  const selectedPayable = useMemo(() => {
    return payables.find((item) => item.id === selectedStockInId) || null;
  }, [payables, selectedStockInId]);

  const visibleAttachments = existingAttachments.filter((attachment) => {
    return !removeAttachmentIds.includes(attachment.id);
  });

  const maxAmount = useMemo(() => {
    if (!selectedPayable) return undefined;

    if (mode === "edit" && selectedPayable.id === initialValues?.stockInId) {
      return (
        Number(selectedPayable.remainingAmount || 0) + currentPaymentAmount
      );
    }

    return Number(selectedPayable.remainingAmount || 0);
  }, [currentPaymentAmount, initialValues?.stockInId, mode, selectedPayable]);

  function handleToggleRemoveAttachment(id: string) {
    setRemoveAttachmentIds((current) => {
      if (current.includes(id)) {
        return current.filter((item) => item !== id);
      }

      return [...current, id];
    });
  }

  return (
    <Form<InternalFormValues>
      form={form}
      layout="vertical"
      requiredMark={false}
      className="form-compact bg-white p-5 text-sm"
      initialValues={{
        stockInId: initialValues?.stockInId || initialStockInId || undefined,
        paymentDatePicker: initialValues?.paymentDate
          ? dayjs(initialValues.paymentDate)
          : dayjs(),
        amount: initialValues?.amount || 0,
        method: initialValues?.method || "CASH",
        referenceNumber: initialValues?.referenceNumber || "",
        notes: initialValues?.notes || "",
        proofFiles: [],
      }}
      onFinish={(values) => {
        onSubmit({
          stockInId: values.stockInId,
          paymentDate: values.paymentDatePicker.format("YYYY-MM-DD"),
          amount: Number(values.amount || 0),
          method: values.method,
          referenceNumber: values.referenceNumber || null,
          notes: values.notes || null,
          proofFiles: values.proofFiles || [],
          removeAttachmentIds,
        });
      }}
    >
      <Form.Item
        label="Purchase Invoice / Stock In"
        name="stockInId"
        rules={[{ required: true, message: "Invoice pembelian wajib dipilih" }]}
      >
        <Select
          showSearch
          className="dashboard-filter-control w-full"
          placeholder="Select stock in invoice"
          optionFilterProp="label"
          popupMatchSelectWidth={720}
          options={payables.map((item) => ({
            label: `${item.documentNumber} ${
              item.invoiceNumber ? `| ${item.invoiceNumber}` : ""
            } - ${item.supplier?.name || "-"} - Sisa ${formatCurrency(
              item.remainingAmount,
            )}`,
            value: item.id,
          }))}
        />
      </Form.Item>

      {selectedPayable ? (
        <div className="mb-4 border border-slate-100 bg-slate-50 p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-800">
                {selectedPayable.documentNumber}
              </div>

              <div className="mt-0.5 text-xs text-slate-500">
                {selectedPayable.invoiceNumber || "-"} •{" "}
                {selectedPayable.supplier?.name || "-"} •{" "}
                {formatDate(selectedPayable.stockInDate)}
              </div>
            </div>

            <SafetyCertificateOutlined className="text-lg text-slate-400" />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="border border-slate-100 bg-white px-3 py-2">
              <div className="text-xs font-semibold text-slate-500">Total</div>

              <div className="mt-1 font-bold text-slate-800">
                {formatCurrency(selectedPayable.totalAmount)}
              </div>
            </div>

            <div className="border border-slate-100 bg-white px-3 py-2">
              <div className="text-xs font-semibold text-slate-500">Paid</div>

              <div className="mt-1 font-bold text-green-700">
                {formatCurrency(selectedPayable.paidAmount)}
              </div>
            </div>

            <div className="border border-slate-100 bg-white px-3 py-2">
              <div className="text-xs font-semibold text-slate-500">
                Remaining
              </div>

              <div className="mt-1 font-bold text-red-600">
                {formatCurrency(selectedPayable.remainingAmount)}
              </div>

              {mode === "edit" &&
              selectedPayable.id === initialValues?.stockInId ? (
                <div className="mt-1 text-xs text-slate-400">
                  Edit limit: {formatCurrency(maxAmount)}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-x-4 md:grid-cols-3">
        <Form.Item
          label="Payment Date"
          name="paymentDatePicker"
          rules={[
            { required: true, message: "Tanggal pembayaran wajib diisi" },
          ]}
        >
          <DatePicker className="dashboard-filter-control w-full" />
        </Form.Item>

        <Form.Item
          label="Amount"
          name="amount"
          rules={[{ required: true, message: "Amount wajib diisi" }]}
        >
          <InputNumber<number>
            min={0}
            max={maxAmount}
            className="dashboard-filter-control money-input w-full"
            controls={false}
            formatter={(value) => formatRupiahInput(value)}
            parser={(value) => parseNumberInput(value)}
            placeholder="Rp 0"
          />
        </Form.Item>

        <Form.Item
          label="Method"
          name="method"
          rules={[{ required: true, message: "Method wajib dipilih" }]}
        >
          <Select
            className="dashboard-filter-control w-full"
            options={[
              { label: "Cash", value: "CASH" },
              { label: "Transfer", value: "TRANSFER" },
              { label: "Debit", value: "DEBIT" },
              { label: "Credit", value: "CREDIT" },
              { label: "QRIS", value: "QRIS" },
              { label: "Other", value: "OTHER" },
            ]}
          />
        </Form.Item>
      </div>

      <Form.Item label="Reference Number" name="referenceNumber">
        <Input
          className="dashboard-filter-control w-full"
          placeholder="No bukti transfer / referensi"
        />
      </Form.Item>

      <Form.Item label="Notes" name="notes">
        <TextArea rows={3} placeholder="Optional notes" />
      </Form.Item>

      {mode === "edit" && existingAttachments.length > 0 ? (
        <div className="mb-4 border-t border-slate-100 pt-4">
          <div className="mb-2">
            <div className="text-sm font-semibold text-slate-700">
              Bukti Pembayaran Saat Ini
            </div>

            <div className="text-xs text-slate-500">
              Klik remove untuk menghapus file saat payment disimpan.
            </div>
          </div>

          <div className="space-y-2">
            {existingAttachments.map((attachment) => {
              const markedRemove = removeAttachmentIds.includes(attachment.id);

              return (
                <div
                  key={attachment.id}
                  className={`flex items-center justify-between gap-3 border px-3 py-2 ${
                    markedRemove
                      ? "border-red-100 bg-red-50"
                      : "border-slate-100 bg-slate-50"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-800">
                      {attachment.originalName}
                    </div>

                    <div className="text-xs text-slate-400">
                      {attachment.mimeType} • {formatFileSize(attachment.size)}
                    </div>
                  </div>

                  <Space size={4}>
                    <Button
                      size="small"
                      type="link"
                      icon={<EyeOutlined />}
                      className="dashboard-table-action-btn"
                      href={attachment.fileUrl}
                      target="_blank"
                    />

                    <Button
                      size="small"
                      type="link"
                      icon={<DownloadOutlined />}
                      className="dashboard-table-action-btn"
                      href={attachment.fileUrl}
                      download={attachment.originalName}
                    />

                    <Button
                      size="small"
                      type="link"
                      danger
                      icon={<DeleteOutlined />}
                      className="dashboard-table-action-btn"
                      onClick={() =>
                        handleToggleRemoveAttachment(attachment.id)
                      }
                    >
                      {markedRemove ? "Undo" : "Remove"}
                    </Button>
                  </Space>
                </div>
              );
            })}
          </div>

          {visibleAttachments.length !== existingAttachments.length ? (
            <div className="mt-2">
              <Tag color="red">
                {existingAttachments.length - visibleAttachments.length} file
                akan dihapus
              </Tag>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mb-2 border-t border-slate-100 pt-4">
        <div className="text-sm font-semibold text-slate-700">
          {mode === "edit" ? "Upload Bukti Baru" : "Bukti Pembayaran"}
        </div>

        <div className="text-xs text-slate-500">
          Upload foto transfer, screenshot QRIS, atau file PDF. Bisa lebih dari
          satu file.
        </div>
      </div>

      <Form.Item
        name="proofFiles"
        valuePropName="fileList"
        getValueFromEvent={(event) => {
          if (Array.isArray(event)) return event;
          return event?.fileList || [];
        }}
      >
        <Upload.Dragger
          multiple
          maxCount={10}
          beforeUpload={() => false}
          accept="image/*,.pdf"
          listType="picture"
        >
          <div className="py-4">
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>

            <p className="text-sm font-semibold text-slate-700">
              Click atau drag file bukti pembayaran ke sini
            </p>

            <p className="text-xs text-slate-500">
              Maksimal 10 file. Support JPG, PNG, WEBP, GIF, dan PDF.
            </p>
          </div>
        </Upload.Dragger>
      </Form.Item>

      {watchedProofFiles.length > 0 ? (
        <div className="mb-4 border border-slate-100 bg-slate-50 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <PaperClipOutlined />
            <span>{watchedProofFiles.length} file baru dipilih</span>
          </div>

          <div className="text-xs text-slate-500">
            File baru akan disimpan setelah tombol <b>{submitText}</b> ditekan.
          </div>
        </div>
      ) : null}

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
