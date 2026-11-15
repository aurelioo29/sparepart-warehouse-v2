"use client";

import { Button, Form, Input, Space, Switch } from "antd";

const { TextArea } = Input;

export type BrandFormValues = {
  name: string;
  description?: string | null;
  isActive: boolean;
};

type BrandFormProps = {
  loading?: boolean;
  submitText?: string;
  initialValues?: Partial<BrandFormValues>;
  onCancel: () => void;
  onSubmit: (values: BrandFormValues) => void;
};

export default function BrandForm({
  loading,
  submitText = "Simpan",
  initialValues,
  onCancel,
  onSubmit,
}: BrandFormProps) {
  return (
    <Form<BrandFormValues>
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
          label="Nama Brand"
          name="name"
          rules={[
            {
              required: true,
              message: "Nama brand wajib diisi",
            },
            {
              min: 2,
              message: "Nama brand minimal 2 karakter",
            },
          ]}
        >
          <Input className="w-full" placeholder="Contoh: Honda" />
        </Form.Item>

        <Form.Item label="Deskripsi" name="description">
          <TextArea
            className="w-full"
            rows={4}
            placeholder="Tulis deskripsi brand jika diperlukan"
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
