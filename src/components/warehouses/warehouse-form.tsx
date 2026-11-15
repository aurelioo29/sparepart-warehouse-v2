"use client";

import { Button, Form, Input, Space, Switch } from "antd";

const { TextArea } = Input;

export type WarehouseFormValues = {
  name: string;
  code: string;
  address?: string | null;
  description?: string | null;
  isActive: boolean;
};

type WarehouseFormProps = {
  loading?: boolean;
  submitText?: string;
  initialValues?: Partial<WarehouseFormValues>;
  onCancel: () => void;
  onSubmit: (values: WarehouseFormValues) => void;
};

function generateWarehouseCode(value: string) {
  return value
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function WarehouseForm({
  loading,
  submitText = "Simpan",
  initialValues,
  onCancel,
  onSubmit,
}: WarehouseFormProps) {
  const [form] = Form.useForm<WarehouseFormValues>();

  return (
    <Form<WarehouseFormValues>
      form={form}
      layout="vertical"
      requiredMark={false}
      className="w-full text-sm"
      initialValues={{
        name: initialValues?.name || "",
        code: initialValues?.code || "",
        address: initialValues?.address || "",
        description: initialValues?.description || "",
        isActive: initialValues?.isActive ?? true,
      }}
      onFinish={(values) => {
        onSubmit({
          name: values.name,
          code: values.code.trim().toUpperCase(),
          address: values.address || null,
          description: values.description || null,
          isActive: values.isActive,
        });
      }}
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Form.Item
          label="Nama Warehouse"
          name="name"
          rules={[
            {
              required: true,
              message: "Nama warehouse wajib diisi",
            },
            {
              min: 2,
              message: "Nama warehouse minimal 2 karakter",
            },
          ]}
        >
          <Input
            className="w-full"
            placeholder="Contoh: Gudang Utama"
            onChange={(event) => {
              if (!initialValues?.code) {
                form.setFieldValue(
                  "code",
                  generateWarehouseCode(event.target.value),
                );
              }
            }}
          />
        </Form.Item>

        <Form.Item
          label="Kode Warehouse"
          name="code"
          rules={[
            {
              required: true,
              message: "Kode warehouse wajib diisi",
            },
          ]}
        >
          <Input className="w-full" placeholder="Contoh: GUDANG-UTAMA" />
        </Form.Item>
      </div>

      <Form.Item label="Alamat" name="address">
        <TextArea
          className="w-full"
          rows={3}
          placeholder="Tulis alamat warehouse"
        />
      </Form.Item>

      <Form.Item label="Deskripsi" name="description">
        <TextArea
          className="w-full"
          rows={3}
          placeholder="Tulis deskripsi warehouse jika diperlukan"
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
