"use client";

import { Button, Form, Input, Space, Switch } from "antd";

const { TextArea } = Input;

export type SupplierFormValues = {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  contactPerson?: string | null;
  description?: string | null;
  isActive: boolean;
};

type SupplierFormProps = {
  loading?: boolean;
  submitText?: string;
  initialValues?: Partial<SupplierFormValues>;
  onCancel: () => void;
  onSubmit: (values: SupplierFormValues) => void;
};

export default function SupplierForm({
  loading,
  submitText = "Simpan",
  initialValues,
  onCancel,
  onSubmit,
}: SupplierFormProps) {
  return (
    <Form<SupplierFormValues>
      layout="vertical"
      requiredMark={false}
      className="w-full text-sm"
      initialValues={{
        name: initialValues?.name || "",
        phone: initialValues?.phone || "",
        email: initialValues?.email || "",
        address: initialValues?.address || "",
        contactPerson: initialValues?.contactPerson || "",
        description: initialValues?.description || "",
        isActive: initialValues?.isActive ?? true,
      }}
      onFinish={(values) => {
        onSubmit({
          name: values.name,
          phone: values.phone || null,
          email: values.email || null,
          address: values.address || null,
          contactPerson: values.contactPerson || null,
          description: values.description || null,
          isActive: values.isActive,
        });
      }}
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Form.Item
          label="Nama Supplier"
          name="name"
          rules={[
            {
              required: true,
              message: "Nama supplier wajib diisi",
            },
            {
              min: 2,
              message: "Nama supplier minimal 2 karakter",
            },
          ]}
        >
          <Input className="w-full" placeholder="Contoh: PT Sparepart Jaya" />
        </Form.Item>

        <Form.Item label="Contact Person" name="contactPerson">
          <Input className="w-full" placeholder="Contoh: Budi" />
        </Form.Item>

        <Form.Item label="No. Telepon" name="phone">
          <Input className="w-full" placeholder="Contoh: 0812xxxxxxxx" />
        </Form.Item>

        <Form.Item
          label="Email"
          name="email"
          rules={[
            {
              type: "email",
              message: "Format email tidak valid",
            },
          ]}
        >
          <Input className="w-full" placeholder="supplier@example.com" />
        </Form.Item>
      </div>

      <Form.Item label="Alamat" name="address">
        <TextArea
          className="w-full"
          rows={3}
          placeholder="Tulis alamat supplier"
        />
      </Form.Item>

      <Form.Item label="Deskripsi" name="description">
        <TextArea
          className="w-full"
          rows={3}
          placeholder="Tulis deskripsi supplier jika diperlukan"
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
