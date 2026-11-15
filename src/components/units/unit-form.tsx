"use client";

import { Button, Form, Input, Space, Switch } from "antd";

const { TextArea } = Input;

export type UnitFormValues = {
  name: string;
  shortName: string;
  description?: string | null;
  isActive: boolean;
};

type UnitFormProps = {
  loading?: boolean;
  submitText?: string;
  initialValues?: Partial<UnitFormValues>;
  onCancel: () => void;
  onSubmit: (values: UnitFormValues) => void;
};

export default function UnitForm({
  loading,
  submitText = "Simpan",
  initialValues,
  onCancel,
  onSubmit,
}: UnitFormProps) {
  return (
    <Form<UnitFormValues>
      layout="vertical"
      requiredMark={false}
      className="w-full text-sm"
      initialValues={{
        name: initialValues?.name || "",
        shortName: initialValues?.shortName || "",
        description: initialValues?.description || "",
        isActive: initialValues?.isActive ?? true,
      }}
      onFinish={(values) => {
        onSubmit({
          name: values.name,
          shortName: values.shortName,
          description: values.description || null,
          isActive: values.isActive,
        });
      }}
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Form.Item
          label="Nama Unit"
          name="name"
          rules={[
            {
              required: true,
              message: "Nama unit wajib diisi",
            },
            {
              min: 2,
              message: "Nama unit minimal 2 karakter",
            },
          ]}
        >
          <Input className="w-full" placeholder="Contoh: Pieces" />
        </Form.Item>

        <Form.Item
          label="Nama Singkat"
          name="shortName"
          rules={[
            {
              required: true,
              message: "Nama singkat wajib diisi",
            },
            {
              min: 1,
              message: "Nama singkat minimal 1 karakter",
            },
          ]}
        >
          <Input className="w-full" placeholder="Contoh: pcs" />
        </Form.Item>
      </div>

      <Form.Item label="Deskripsi" name="description">
        <TextArea
          className="w-full"
          rows={4}
          placeholder="Tulis deskripsi unit jika diperlukan"
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
