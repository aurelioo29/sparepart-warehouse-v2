"use client";

import { useState } from "react";
import {
  BankOutlined,
  DeleteOutlined,
  PlusOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { Button, Col, Form, Image, Input, Row, Upload, message } from "antd";
import type { FormInstance, FormListFieldData, UploadProps } from "antd";

type BankAccountFormValue = {
  bankName?: string;
  accountNumber?: string;
  logoUrl?: string | null;
};

type WarehouseInfoFormValues = {
  bankAccounts?: BankAccountFormValue[];
};

type WarehouseBankAccountsFieldProps = {
  disabled?: boolean;
};

type BankAccountItemProps = {
  field: FormListFieldData;
  index: number;
  form: FormInstance<WarehouseInfoFormValues>;
  disabled: boolean;
  uploadingIndex: number | null;
  onRemove: () => void;
  onUpload: (file: File, index: number) => Promise<void>;
};

function BankAccountItem({
  field,
  index,
  form,
  disabled,
  uploadingIndex,
  onRemove,
  onUpload,
}: BankAccountItemProps) {
  const logoUrl = Form.useWatch(["bankAccounts", field.name, "logoUrl"], form);

  const uploadProps: UploadProps = {
    showUploadList: false,
    accept: "image/png,image/jpeg,image/webp",
    disabled: disabled || (uploadingIndex !== null && uploadingIndex !== index),

    beforeUpload: (file) => {
      const validTypes = ["image/png", "image/jpeg", "image/webp"];

      if (!validTypes.includes(file.type)) {
        message.error("Format logo harus JPG, PNG, atau WEBP");

        return Upload.LIST_IGNORE;
      }

      const isLessThan2MB = file.size / 1024 / 1024 < 2;

      if (!isLessThan2MB) {
        message.error("Ukuran logo maksimal 2MB");

        return Upload.LIST_IGNORE;
      }

      void onUpload(file, index);

      return false;
    },
  };

  return (
    <div className="border border-slate-200 bg-slate-50 p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="font-semibold text-slate-900">
            Rekening {index + 1}
          </div>

          <div className="mt-1 text-xs text-slate-500">
            Informasi rekening tujuan pembayaran.
          </div>
        </div>

        <Button
          danger
          type="text"
          icon={<DeleteOutlined />}
          disabled={disabled}
          onClick={onRemove}
        >
          Hapus
        </Button>
      </div>

      <Row gutter={[16, 0]}>
        <Col xs={24} md={5}>
          <div className="mb-2 text-sm font-medium text-slate-700">
            Logo Bank
          </div>

          <div className="flex h-[96px] items-center justify-center border border-slate-200 bg-white p-3">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt={`Logo rekening ${index + 1}`}
                preview={false}
                fallback=""
                className="!max-h-[68px] !w-auto !max-w-full object-contain"
              />
            ) : (
              <div className="text-center text-slate-300">
                <BankOutlined className="text-3xl" />

                <div className="mt-1 text-xs">Belum ada logo</div>
              </div>
            )}
          </div>

          <Form.Item name={[field.name, "logoUrl"]} hidden>
            <Input />
          </Form.Item>

          <Upload {...uploadProps}>
            <Button
              block
              className="mt-2"
              icon={<UploadOutlined />}
              loading={uploadingIndex === index}
            >
              Upload Logo
            </Button>
          </Upload>

          {logoUrl ? (
            <Button
              block
              danger
              type="text"
              className="mt-1"
              disabled={disabled}
              onClick={() => {
                const bankAccounts = form.getFieldValue("bankAccounts") ?? [];

                const updatedBankAccounts = [...bankAccounts];

                updatedBankAccounts[index] = {
                  ...updatedBankAccounts[index],
                  logoUrl: null,
                };

                form.setFieldValue("bankAccounts", updatedBankAccounts);
              }}
            >
              Hapus Logo
            </Button>
          ) : null}
        </Col>

        <Col xs={24} md={8}>
          <Form.Item
            label="Nama Bank"
            name={[field.name, "bankName"]}
            rules={[
              {
                required: true,
                whitespace: true,
                message: "Nama bank wajib diisi",
              },
              {
                max: 100,
                message: "Nama bank maksimal 100 karakter",
              },
            ]}
          >
            <Input placeholder="Contoh: BCA" disabled={disabled} />
          </Form.Item>
        </Col>

        <Col xs={24} md={11}>
          <Form.Item
            label="Nomor Rekening"
            name={[field.name, "accountNumber"]}
            rules={[
              {
                required: true,
                whitespace: true,
                message: "Nomor rekening wajib diisi",
              },
              {
                max: 100,
                message: "Nomor rekening maksimal 100 karakter",
              },
            ]}
          >
            <Input placeholder="Contoh: 1234567890" disabled={disabled} />
          </Form.Item>
        </Col>
      </Row>
    </div>
  );
}

export default function WarehouseBankAccountsField({
  disabled = false,
}: WarehouseBankAccountsFieldProps) {
  const form = Form.useFormInstance<WarehouseInfoFormValues>();

  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  async function uploadBankLogo(file: File, index: number) {
    try {
      setUploadingIndex(index);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/uploads/bank-account-logo", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal upload logo rekening");
      }

      const uploadedUrl = result.data?.url;

      if (!uploadedUrl || typeof uploadedUrl !== "string") {
        throw new Error("URL logo hasil upload tidak valid");
      }

      const bankAccounts = form.getFieldValue("bankAccounts") ?? [];

      const updatedBankAccounts = [...bankAccounts];

      updatedBankAccounts[index] = {
        ...updatedBankAccounts[index],
        logoUrl: uploadedUrl,
      };

      form.setFieldValue("bankAccounts", updatedBankAccounts);

      message.success("Logo rekening berhasil diupload");
    } catch (error) {
      console.error("Upload bank account logo error:", error);

      message.error(
        error instanceof Error ? error.message : "Gagal upload logo rekening",
      );
    } finally {
      setUploadingIndex(null);
    }
  }

  return (
    <Form.List name="bankAccounts">
      {(fields, { add, remove }) => (
        <div>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-base font-semibold text-slate-950">
                Daftar Rekening
              </div>

              <div className="mt-1 text-sm text-slate-500">
                Rekening pembayaran yang ditampilkan pada invoice.
              </div>
            </div>

            <Button
              icon={<PlusOutlined />}
              disabled={disabled}
              onClick={() => {
                add({
                  bankName: "",
                  accountNumber: "",
                  logoUrl: null,
                });
              }}
            >
              Tambah Rekening
            </Button>
          </div>

          {fields.length === 0 ? (
            <div className="border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
              <BankOutlined className="text-3xl text-slate-400" />

              <div className="mt-3 text-sm font-semibold text-slate-700">
                Belum ada rekening
              </div>

              <div className="mt-1 text-xs text-slate-500">
                Klik Tambah Rekening untuk memasukkan rekening pembayaran.
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {fields.map((field, index) => (
                <BankAccountItem
                  key={field.key}
                  field={field}
                  index={index}
                  form={form}
                  disabled={disabled}
                  uploadingIndex={uploadingIndex}
                  onRemove={() => {
                    remove(field.name);
                  }}
                  onUpload={uploadBankLogo}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </Form.List>
  );
}
