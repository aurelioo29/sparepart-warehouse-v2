"use client";

import { useEffect, useState } from "react";
import { Button, Form, Input, InputNumber, Select, Space, Switch } from "antd";

export type KngProductFormValues = {
  jenis: string;
  partNumber: string;
  hargaJkt: number;
  isActive: boolean;
};

type KngProductFormProps = {
  loading?: boolean;
  submitText?: string;
  initialValues?: Partial<KngProductFormValues>;
  onCancel: () => void;
  onSubmit: (values: KngProductFormValues) => void;
};

type CategoryItem = {
  id: string;
  name: string;
  slug?: string;
  isActive?: boolean;
};

type CategoryOption = {
  label: string;
  value: string;
};

function formatRupiahInput(value?: string | number) {
  if (value === undefined || value === null || value === "") return "";

  const numericValue = String(value).replace(/\D/g, "");

  return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function parseRupiahInput(value?: string) {
  if (!value) return 0;

  const numericValue = value.replace(/\./g, "").replace(/\D/g, "");

  return Number(numericValue || 0);
}

export default function KngProductForm({
  loading,
  submitText = "Simpan",
  initialValues,
  onCancel,
  onSubmit,
}: KngProductFormProps) {
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [categoryLoading, setCategoryLoading] = useState(false);

  async function fetchCategories() {
    try {
      setCategoryLoading(true);

      const query = new URLSearchParams({
        page: "1",
        limit: "100",
        isActive: "true",
        sortBy: "name",
        sortOrder: "asc",
      });

      const response = await fetch(`/api/categories?${query.toString()}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal mengambil categories");
      }

      const items: CategoryItem[] = result.data?.items || [];

      setCategoryOptions(
        items.map((item) => ({
          label: item.name,
          value: item.name,
        })),
      );
    } catch (error) {
      console.error(error);

      setCategoryOptions([]);
    } finally {
      setCategoryLoading(false);
    }
  }

  useEffect(() => {
    void fetchCategories();
  }, []);

  return (
    <Form<KngProductFormValues>
      layout="vertical"
      requiredMark={false}
      className="w-full text-sm"
      initialValues={{
        jenis: initialValues?.jenis || undefined,
        partNumber: initialValues?.partNumber || "",
        hargaJkt: initialValues?.hargaJkt ?? 0,
        isActive: initialValues?.isActive ?? true,
      }}
      onFinish={(values) => {
        onSubmit({
          jenis: values.jenis,
          partNumber: values.partNumber,
          hargaJkt: Number(values.hargaJkt || 0),
          isActive: values.isActive,
        });
      }}
    >
      <div className="w-full space-y-5">
        <Form.Item
          label="Jenis"
          name="jenis"
          rules={[
            {
              required: true,
              message: "Jenis wajib dipilih",
            },
          ]}
        >
          <Select
            showSearch
            allowClear
            loading={categoryLoading}
            className="w-full"
            placeholder="Pilih jenis dari categories"
            optionFilterProp="label"
            options={categoryOptions}
          />
        </Form.Item>

        <Form.Item
          label="Part Number"
          name="partNumber"
          rules={[
            {
              required: true,
              message: "Part number wajib diisi",
            },
            {
              min: 2,
              message: "Part number minimal 2 karakter",
            },
          ]}
        >
          <Input className="w-full" placeholder="Contoh: K35 - Vario 150" />
        </Form.Item>

        <Form.Item label="Harga JKT" required>
          <Space.Compact className="w-full">
            <Button disabled className="!w-[48px] !text-slate-700">
              Rp
            </Button>

            <Form.Item
              name="hargaJkt"
              noStyle
              rules={[
                {
                  required: true,
                  message: "Harga JKT wajib diisi",
                },
                {
                  type: "number",
                  min: 0,
                  message: "Harga JKT tidak valid",
                },
              ]}
            >
              <InputNumber<number>
                className="!w-full"
                min={0}
                precision={0}
                controls={false}
                placeholder="Contoh: 135.000"
                formatter={(value) => formatRupiahInput(value)}
                parser={(value) => parseRupiahInput(value)}
              />
            </Form.Item>
          </Space.Compact>
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
