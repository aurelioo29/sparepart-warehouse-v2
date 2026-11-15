"use client";

import { Button, Form, Input, InputNumber, Select, Space, Switch } from "antd";

const { TextArea } = Input;

export type CustomerFormValues = {
  name: string;
  customerType: string;
  phone: string;
  email?: string | null;
  address: string;
  creditLimit?: number | null;
  paymentTermDays?: number | null;
  description?: string | null;
  isActive: boolean;
};

type CustomerFormProps = {
  loading?: boolean;
  submitText?: string;
  initialValues?: Partial<CustomerFormValues>;
  onCancel: () => void;
  onSubmit: (values: CustomerFormValues) => void;
};

const customerTypeOptions = [
  {
    label: "Individual",
    value: "INDIVIDUAL",
  },
  {
    label: "Workshop / Bengkel",
    value: "WORKSHOP",
  },
  {
    label: "Store / Toko",
    value: "STORE",
  },
  {
    label: "Reseller",
    value: "RESELLER",
  },
  {
    label: "Company",
    value: "COMPANY",
  },
  {
    label: "Other",
    value: "OTHER",
  },
];

export { customerTypeOptions };

export default function CustomerForm({
  loading = false,
  submitText = "Simpan",
  initialValues,
  onCancel,
  onSubmit,
}: CustomerFormProps) {
  return (
    <Form<CustomerFormValues>
      layout="vertical"
      requiredMark
      className="w-full text-sm"
      initialValues={{
        name: initialValues?.name ?? "",
        customerType: initialValues?.customerType ?? "INDIVIDUAL",
        phone: initialValues?.phone ?? "",
        email: initialValues?.email ?? "",
        address: initialValues?.address ?? "",
        creditLimit: initialValues?.creditLimit ?? null,
        paymentTermDays: initialValues?.paymentTermDays ?? null,
        description: initialValues?.description ?? "",
        isActive: initialValues?.isActive ?? true,
      }}
      onFinish={(values) => {
        onSubmit({
          name: values.name.trim(),
          customerType: values.customerType,
          phone: values.phone.trim(),
          email: values.email?.trim() || null,
          address: values.address.trim(),
          creditLimit: values.creditLimit ?? null,
          paymentTermDays: values.paymentTermDays ?? null,
          description: values.description?.trim() || null,
          isActive: values.isActive,
        });
      }}
    >
      <div className="grid grid-cols-1 gap-x-5 md:grid-cols-2">
        <Form.Item
          label="Nama Customer"
          name="name"
          rules={[
            {
              required: true,
              whitespace: true,
              message: "Nama customer wajib diisi",
            },
            {
              min: 2,
              message: "Nama customer minimal 2 karakter",
            },
            {
              max: 150,
              message: "Nama customer maksimal 150 karakter",
            },
          ]}
        >
          <Input
            className="w-full"
            placeholder="Contoh: Toko Maju Motor"
            maxLength={150}
          />
        </Form.Item>

        <Form.Item
          label="Tipe Customer"
          name="customerType"
          rules={[
            {
              required: true,
              message: "Tipe customer wajib dipilih",
            },
          ]}
        >
          <Select
            className="w-full"
            placeholder="Pilih tipe customer"
            options={customerTypeOptions}
          />
        </Form.Item>

        <Form.Item
          label="No. Telepon"
          name="phone"
          rules={[
            {
              pattern: /^[0-9+\-\s()]+$/,
              message: "Format nomor telepon tidak valid",
            },
          ]}
        >
          <Input
            className="w-full"
            placeholder="Contoh: 0812xxxxxxxx"
            maxLength={20}
          />
        </Form.Item>

        <Form.Item
          label="Email"
          name="email"
          rules={[
            {
              type: "email",
              message: "Format email tidak valid",
            },
            {
              max: 150,
              message: "Email maksimal 150 karakter",
            },
          ]}
        >
          <Input
            className="w-full"
            type="email"
            placeholder="customer@example.com"
            maxLength={150}
          />
        </Form.Item>

        <Form.Item label="Limit Kredit" name="creditLimit">
          <InputNumber<number>
            min={0}
            precision={0}
            className="w-full"
            placeholder="Contoh: 5000000"
            formatter={(value) =>
              value ? `Rp ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : ""
            }
            parser={(value) => Number(value?.replace(/[^\d]/g, "") || 0)}
          />
        </Form.Item>

        <Form.Item
          label="Termin Pembayaran (Hari)"
          name="paymentTermDays"
          rules={[
            {
              required: true,
              message: "Termin pembayaran wajib diisi",
            },
            {
              type: "number",
              min: 0,
              message: "Termin pembayaran tidak boleh kurang dari 0 hari",
            },
          ]}
        >
          <InputNumber
            min={0}
            max={3650}
            precision={0}
            className="w-full"
            placeholder="Contoh: 30"
          />
        </Form.Item>
      </div>

      <Form.Item
        label="Alamat"
        name="address"
        rules={[
          {
            required: true,
            whitespace: true,
            message: "Alamat customer wajib diisi",
          },
          {
            min: 5,
            message: "Alamat customer minimal 5 karakter",
          },
          {
            max: 500,
            message: "Alamat customer maksimal 500 karakter",
          },
        ]}
      >
        <TextArea
          className="w-full"
          rows={3}
          placeholder="Tulis alamat lengkap customer"
          maxLength={500}
          showCount
        />
      </Form.Item>

      <Form.Item
        label="Deskripsi"
        name="description"
        rules={[
          {
            max: 500,
            message: "Deskripsi maksimal 500 karakter",
          },
        ]}
      >
        <TextArea
          className="w-full"
          rows={3}
          placeholder="Tulis deskripsi customer jika diperlukan"
          maxLength={500}
          showCount
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
          <Button disabled={loading} onClick={onCancel}>
            Batal
          </Button>

          <Button type="primary" htmlType="submit" loading={loading}>
            {submitText}
          </Button>
        </Space>
      </div>
    </Form>
  );
}
