"use client";

import { useEffect } from "react";
import { Form, Input, Modal } from "antd";

export type PermissionFormValues = {
  name: string;
  key: string;
  module: string;
};

type PermissionFormModalProps = {
  open: boolean;
  loading?: boolean;
  mode: "create" | "edit";
  initialValues?: Partial<PermissionFormValues>;
  onCancel: () => void;
  onSubmit: (values: PermissionFormValues) => void;
};

function generateKey(moduleName: string, name: string) {
  const action = name
    .toLowerCase()
    .replace(moduleName.toLowerCase(), "")
    .trim()
    .split(" ")[0];

  if (!moduleName || !action) return "";

  return `${moduleName.toLowerCase()}.${action}`;
}

export default function PermissionFormModal({
  open,
  loading,
  mode,
  initialValues,
  onCancel,
  onSubmit,
}: PermissionFormModalProps) {
  const [form] = Form.useForm<PermissionFormValues>();

  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        name: initialValues?.name || "",
        key: initialValues?.key || "",
        module: initialValues?.module || "",
      });
    }
  }, [open, initialValues, form]);

  return (
    <Modal
      open={open}
      title={mode === "create" ? "Create Permission" : "Edit Permission"}
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
          label="Name"
          name="name"
          rules={[{ required: true, message: "Name wajib diisi" }]}
        >
          <Input
            placeholder="View Users"
            onChange={(event) => {
              if (mode === "create") {
                const moduleName = form.getFieldValue("module");
                const key = generateKey(moduleName, event.target.value);
                form.setFieldValue("key", key);
              }
            }}
          />
        </Form.Item>

        <Form.Item
          label="Module"
          name="module"
          rules={[{ required: true, message: "Module wajib diisi" }]}
        >
          <Input
            placeholder="users"
            onChange={(event) => {
              if (mode === "create") {
                const name = form.getFieldValue("name");
                const key = generateKey(event.target.value, name);
                form.setFieldValue("key", key);
              }
            }}
          />
        </Form.Item>

        <Form.Item
          label="Key"
          name="key"
          rules={[{ required: true, message: "Key wajib diisi" }]}
        >
          <Input placeholder="users.view" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
