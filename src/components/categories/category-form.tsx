"use client";

import { Button, Form, Input, Space, Switch } from "antd";

const { TextArea } = Input;

export type CategoryFormValues = {
  name: string;
  description?: string | null;
  isActive: boolean;
};

type CategoryFormProps = {
  loading?: boolean;
  submitText?: string;
  initialValues?: Partial<CategoryFormValues>;
  onCancel: () => void;
  onSubmit: (values: CategoryFormValues) => void;
};

export default function CategoryForm({
  loading,
  submitText = "Simpan",
  initialValues,
  onCancel,
  onSubmit,
}: CategoryFormProps) {
  return (
    <Form<CategoryFormValues>
      layout="vertical"
      requiredMark={false}
      className="w-full text-sm"
      initialValues={{
        name: initialValues?.name || "",
        description: initialValues?.description || "",
        isActive: initialValues?.isActive ?? true,
      }}
      onFinish={(values) => {
        onSubmit({
          name: values.name,
          description: values.description || null,
          isActive: values.isActive,
        });
      }}
    >
      <div className="w-full space-y-5">
        <Form.Item
          label="Nama Kategori"
          name="name"
          rules={[
            {
              required: true,
              message: "Nama kategori wajib diisi",
            },
            {
              min: 2,
              message: "Nama kategori minimal 2 karakter",
            },
          ]}
        >
          <Input className="w-full" placeholder="Contoh: Saringan Fuel Pump" />
        </Form.Item>

        <Form.Item label="Deskripsi" name="description">
          <TextArea
            className="w-full"
            rows={4}
            placeholder="Tulis deskripsi kategori jika diperlukan"
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
      </div>

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
