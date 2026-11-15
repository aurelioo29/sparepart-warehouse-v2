"use client";

import {
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Switch,
} from "antd";
import dayjs from "dayjs";

const { TextArea } = Input;

export type UserOption = {
  id: string;
  fullName: string;
  username: string;
  email: string;
};

export type SalesmanFormValues = {
  userId?: string | null;
  code: string;
  name: string;
  salesmanType: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  commissionType: string;
  commissionValue?: number | null;
  joinDate?: string | null;
  description?: string | null;
  isActive: boolean;
};

type SalesmanFormProps = {
  loading?: boolean;
  submitText?: string;
  users: UserOption[];
  initialValues?: Partial<SalesmanFormValues>;
  onCancel: () => void;
  onSubmit: (values: SalesmanFormValues) => void;
};

export const salesmanTypeOptions = [
  { label: "Internal", value: "INTERNAL" },
  { label: "Freelance", value: "FREELANCE" },
  { label: "Reseller", value: "RESELLER" },
  { label: "Agent", value: "AGENT" },
];

export const commissionTypeOptions = [
  { label: "None", value: "NONE" },
  { label: "Percentage", value: "PERCENTAGE" },
  { label: "Fixed", value: "FIXED" },
];

function generateSalesmanCode(value: string) {
  return value
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function SalesmanForm({
  loading,
  submitText = "Simpan",
  users,
  initialValues,
  onCancel,
  onSubmit,
}: SalesmanFormProps) {
  const [form] = Form.useForm<
    SalesmanFormValues & { joinDatePicker?: dayjs.Dayjs | null }
  >();

  const commissionType = Form.useWatch("commissionType", form);

  return (
    <Form<SalesmanFormValues & { joinDatePicker?: dayjs.Dayjs | null }>
      form={form}
      layout="vertical"
      requiredMark={false}
      className="w-full text-sm"
      initialValues={{
        userId: initialValues?.userId || undefined,
        code: initialValues?.code || "",
        name: initialValues?.name || "",
        salesmanType: initialValues?.salesmanType || "FREELANCE",
        phone: initialValues?.phone || "",
        email: initialValues?.email || "",
        address: initialValues?.address || "",
        commissionType: initialValues?.commissionType || "NONE",
        commissionValue: initialValues?.commissionValue ?? null,
        joinDate: initialValues?.joinDate || null,
        joinDatePicker: initialValues?.joinDate
          ? dayjs(initialValues.joinDate)
          : null,
        description: initialValues?.description || "",
        isActive: initialValues?.isActive ?? true,
      }}
      onFinish={(values) => {
        onSubmit({
          userId: values.userId || null,
          code: values.code.trim().toUpperCase(),
          name: values.name,
          salesmanType: values.salesmanType,
          phone: values.phone || null,
          email: values.email || null,
          address: values.address || null,
          commissionType: values.commissionType,
          commissionValue:
            values.commissionType === "NONE"
              ? null
              : (values.commissionValue ?? null),
          joinDate: values.joinDatePicker
            ? values.joinDatePicker.format("YYYY-MM-DD")
            : null,
          description: values.description || null,
          isActive: values.isActive,
        });
      }}
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Form.Item label="User Account" name="userId">
          <Select
            allowClear
            className="w-full"
            placeholder="Opsional, pilih akun user"
            options={users.map((user) => ({
              label: `${user.fullName} (@${user.username})`,
              value: user.id,
            }))}
          />
        </Form.Item>

        <Form.Item
          label="Tipe Salesman"
          name="salesmanType"
          rules={[
            {
              required: true,
              message: "Tipe salesman wajib dipilih",
            },
          ]}
        >
          <Select className="w-full" options={salesmanTypeOptions} />
        </Form.Item>

        <Form.Item
          label="Nama Salesman"
          name="name"
          rules={[
            {
              required: true,
              message: "Nama salesman wajib diisi",
            },
            {
              min: 2,
              message: "Nama salesman minimal 2 karakter",
            },
          ]}
        >
          <Input
            className="w-full"
            placeholder="Contoh: Budi Sales"
            onChange={(event) => {
              if (!initialValues?.code) {
                form.setFieldValue(
                  "code",
                  generateSalesmanCode(event.target.value),
                );
              }
            }}
          />
        </Form.Item>

        <Form.Item
          label="Kode Salesman"
          name="code"
          rules={[
            {
              required: true,
              message: "Kode salesman wajib diisi",
            },
          ]}
        >
          <Input className="w-full" placeholder="Contoh: BUDI-SALES" />
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
          <Input className="w-full" placeholder="sales@example.com" />
        </Form.Item>

        <Form.Item
          label="Tipe Komisi"
          name="commissionType"
          rules={[
            {
              required: true,
              message: "Tipe komisi wajib dipilih",
            },
          ]}
        >
          <Select className="w-full" options={commissionTypeOptions} />
        </Form.Item>

        <Form.Item label="Nilai Komisi" name="commissionValue">
          <InputNumber
            min={0}
            className="w-full"
            disabled={commissionType === "NONE"}
            placeholder={
              commissionType === "PERCENTAGE" ? "Contoh: 5" : "Contoh: 50000"
            }
          />
        </Form.Item>

        <Form.Item label="Tanggal Bergabung" name="joinDatePicker">
          <DatePicker className="w-full" />
        </Form.Item>
      </div>

      <Form.Item label="Alamat" name="address">
        <TextArea
          className="w-full"
          rows={3}
          placeholder="Tulis alamat salesman"
        />
      </Form.Item>

      <Form.Item label="Deskripsi" name="description">
        <TextArea
          className="w-full"
          rows={3}
          placeholder="Tulis deskripsi salesman jika diperlukan"
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
