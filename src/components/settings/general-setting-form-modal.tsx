"use client";

import { useEffect } from "react";
import { Form, Input, Modal, Select, Switch } from "antd";

const { TextArea } = Input;

export type GeneralSettingFormValues = {
  key: string;
  value: string;
  type: "string" | "number" | "boolean" | "json";
  group: string;
  description?: string | null;
  isPublic: boolean;
};

type GeneralSettingFormModalProps = {
  open: boolean;
  loading?: boolean;
  mode: "create" | "edit";
  initialValues?: Partial<GeneralSettingFormValues>;
  onCancel: () => void;
  onSubmit: (values: GeneralSettingFormValues) => void;
};

export default function GeneralSettingFormModal({
  open,
  loading,
  mode,
  initialValues,
  onCancel,
  onSubmit,
}: GeneralSettingFormModalProps) {
  const [form] = Form.useForm<GeneralSettingFormValues>();

  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        key: initialValues?.key || "",
        value: initialValues?.value || "",
        type: initialValues?.type || "string",
        group: initialValues?.group || "",
        description: initialValues?.description || "",
        isPublic: initialValues?.isPublic ?? false,
      });
    }
  }, [open, initialValues, form]);

  return (
    <Modal
      open={open}
      title={
        mode === "create" ? "Create General Setting" : "Edit General Setting"
      }
      okText={mode === "create" ? "Create" : "Save Changes"}
      cancelText="Cancel"
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={loading}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        onFinish={onSubmit}
        className="text-sm"
      >
        <Form.Item
          label="Key"
          name="key"
          rules={[{ required: true, message: "Key wajib diisi" }]}
        >
          <Input size="small" placeholder="stock_out_prefix" />
        </Form.Item>

        <Form.Item
          label="Group"
          name="group"
          rules={[{ required: true, message: "Group wajib diisi" }]}
        >
          <Input size="small" placeholder="numbering / finance / inventory" />
        </Form.Item>

        <Form.Item
          label="Type"
          name="type"
          rules={[{ required: true, message: "Type wajib dipilih" }]}
        >
          <Select
            size="small"
            options={[
              { label: "String", value: "string" },
              { label: "Number", value: "number" },
              { label: "Boolean", value: "boolean" },
              { label: "JSON", value: "json" },
            ]}
          />
        </Form.Item>

        <Form.Item
          label="Value"
          name="value"
          rules={[{ required: true, message: "Value wajib diisi" }]}
        >
          <TextArea
            rows={4}
            placeholder={`Contoh:
string: OUT
number: 10
boolean: true
json: {"prefix":"OUT","length":4}`}
          />
        </Form.Item>

        <Form.Item label="Description" name="description">
          <TextArea rows={3} placeholder="Setting description" />
        </Form.Item>

        <Form.Item label="Public" name="isPublic" valuePropName="checked">
          <Switch checkedChildren="Public" unCheckedChildren="Private" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
