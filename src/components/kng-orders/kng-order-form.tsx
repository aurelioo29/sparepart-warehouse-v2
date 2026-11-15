"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
} from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";

const { TextArea } = Input;

export type KngOrderFormValues = {
  orderDate: string;
  discountPercent: number;
  noteFranco?: string | null;
  noteTop?: string | null;
  notes?: string | null;
  items: {
    kngProductId: string;
    quantity: number;
    hargaNetto: number;
  }[];
};

type KngOrderFormInternalValues = {
  orderDate: Dayjs;
  discountPercent: number;
  noteFranco?: string | null;
  noteTop?: string | null;
  notes?: string | null;
  items: {
    jenis: string;
    kngProductId: string;
    quantity: number;
    hargaNetto: number;
  }[];
};

type KngOrderFormInitialItem = {
  jenis?: string;
  kngProductId?: string;
  quantity?: number;
  hargaNetto?: number;
};

type KngOrderFormInitialValues = Omit<Partial<KngOrderFormValues>, "items"> & {
  orderNumber?: string;
  items?: KngOrderFormInitialItem[];
};

type KngProductOption = {
  label: string;
  value: string;
  jenis: string;
  partNumber: string;
  hargaJkt: string | number;
};

type KngProductOptionsResponse = {
  jenisOptions: {
    label: string;
    value: string;
  }[];
  products: KngProductOption[];
};

type KngOrderFormProps = {
  loading?: boolean;
  submitText?: string;
  orderNumber?: string;
  initialValues?: KngOrderFormInitialValues;
  onCancel: () => void;
  onSubmit: (values: KngOrderFormValues) => void;
  onOrderDateChange?: (orderDate: string) => void;
};

function calculateHargaNetto(hargaJkt: number, discountPercent: number) {
  return Math.round(hargaJkt - (hargaJkt * discountPercent) / 100);
}

export default function KngOrderForm({
  loading = false,
  submitText = "Simpan",
  orderNumber,
  initialValues,
  onCancel,
  onSubmit,
  onOrderDateChange,
}: KngOrderFormProps) {
  const [form] = Form.useForm<KngOrderFormInternalValues>();

  const [jenisOptions, setJenisOptions] = useState<
    { label: string; value: string }[]
  >([]);

  const [productOptions, setProductOptions] = useState<KngProductOption[]>([]);

  const [productLoading, setProductLoading] = useState(true);
  const [productError, setProductError] = useState("");

  // Ambil nilai awal sekali agar perubahan nomor order tidak mereset input.
  const [formInitialValues] = useState<KngOrderFormInternalValues>(() => ({
    orderDate: initialValues?.orderDate
      ? dayjs(initialValues.orderDate)
      : dayjs(),

    discountPercent: initialValues?.discountPercent ?? 30,
    noteFranco: initialValues?.noteFranco ?? "Frangko Medan",
    noteTop: initialValues?.noteTop ?? "Top = 125 hari",
    notes: initialValues?.notes ?? "",

    items:
      initialValues?.items && initialValues.items.length > 0
        ? initialValues.items.map((item) => ({
            jenis: item.jenis ?? "",
            kngProductId: item.kngProductId ?? "",
            quantity: item.quantity ?? 1,
            hargaNetto: item.hargaNetto ?? 0,
          }))
        : [
            {
              jenis: "",
              kngProductId: "",
              quantity: 1,
              hargaNetto: 0,
            },
          ],
  }));

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function fetchProductOptions() {
      try {
        const response = await fetch("/api/kng-products/options", {
          signal: controller.signal,
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Gagal mengambil product KNG");
        }

        const data: KngProductOptionsResponse = result.data;

        if (!isMounted) return;

        setJenisOptions(data.jenisOptions || []);
        setProductOptions(data.products || []);
        setProductError("");
      } catch (error) {
        if (!isMounted || controller.signal.aborted) return;

        console.error(error);

        setJenisOptions([]);
        setProductOptions([]);
        setProductError(
          error instanceof Error
            ? error.message
            : "Gagal mengambil product KNG",
        );
      } finally {
        if (isMounted) {
          setProductLoading(false);
        }
      }
    }

    void fetchProductOptions();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  function getDefaultHargaNetto(productId?: string) {
    const product = productOptions.find((item) => item.value === productId);

    if (!product) return 0;

    const discountPercent = Number(form.getFieldValue("discountPercent") ?? 30);

    return calculateHargaNetto(Number(product.hargaJkt || 0), discountPercent);
  }

  function handleFinish(values: KngOrderFormInternalValues) {
    onSubmit({
      orderDate: values.orderDate.format("YYYY-MM-DD"),
      discountPercent: Number(values.discountPercent ?? 30),
      noteFranco: values.noteFranco || null,
      noteTop: values.noteTop || null,
      notes: values.notes || null,
      items: (values.items || []).map((item) => ({
        kngProductId: item.kngProductId || "",
        quantity: Number(item.quantity || 0),
        hargaNetto: Number(item.hargaNetto ?? 0),
      })),
    });
  }

  return (
    <Form<KngOrderFormInternalValues>
      form={form}
      layout="vertical"
      requiredMark={false}
      className="w-full text-sm"
      initialValues={formInitialValues}
      disabled={loading}
      onFinish={handleFinish}
    >
      {/* Nilai diskon tetap tersedia tanpa ditampilkan. */}
      <Form.Item name="discountPercent" hidden>
        <InputNumber<number> min={0} max={100} />
      </Form.Item>

      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Form.Item label="Nomor Order">
            <Input
              disabled
              value={orderNumber || initialValues?.orderNumber || "-"}
            />
          </Form.Item>

          <Form.Item
            label="Tanggal Order"
            name="orderDate"
            rules={[
              {
                required: true,
                message: "Tanggal order wajib diisi",
              },
            ]}
          >
            <DatePicker
              className="w-full"
              format="YYYY-MM-DD"
              onChange={(date) => {
                onOrderDateChange?.(date ? date.format("YYYY-MM-DD") : "");
              }}
            />
          </Form.Item>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Form.Item label="Keterangan 1" name="noteFranco">
            <Input placeholder="Contoh: Frangko Medan" />
          </Form.Item>

          <Form.Item label="Keterangan 2" name="noteTop">
            <Input placeholder="Contoh: Top = 125 hari" />
          </Form.Item>
        </div>

        <div className="border-t border-slate-100 pt-5">
          <div className="mb-3">
            <div className="text-base font-bold text-slate-950">Item Order</div>

            <div className="text-sm text-slate-500">
              Pilih jenis, pilih barang, lalu isi order/pc.
            </div>
          </div>

          {productError ? (
            <Alert
              type="error"
              showIcon
              title={productError}
              className="mb-3"
            />
          ) : null}

          <Form.List
            name="items"
            rules={[
              {
                validator: async (_, value) => {
                  if (!value || value.length < 1) {
                    throw new Error("Minimal 1 item wajib ditambahkan");
                  }
                },
              },
            ]}
          >
            {(fields, { add, remove }, { errors }) => (
              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div
                    key={field.key}
                    className="grid grid-cols-1 gap-3 border border-slate-100 bg-slate-50 p-3 lg:grid-cols-12 lg:items-end"
                  >
                    {/* Netto tetap terdaftar dan ikut dikirim ke API. */}
                    <Form.Item name={[field.name, "hargaNetto"]} hidden>
                      <InputNumber<number> min={0} />
                    </Form.Item>

                    <div className="lg:col-span-3">
                      <Form.Item
                        label={index === 0 ? "Jenis" : " "}
                        name={[field.name, "jenis"]}
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
                          loading={productLoading}
                          disabled={loading || productLoading}
                          placeholder="Pilih jenis"
                          optionFilterProp="label"
                          options={jenisOptions}
                          onChange={() => {
                            form.setFieldValue(
                              ["items", field.name, "kngProductId"],
                              "",
                            );

                            form.setFieldValue(
                              ["items", field.name, "hargaNetto"],
                              0,
                            );
                          }}
                        />
                      </Form.Item>
                    </div>

                    <div className="lg:col-span-6">
                      <Form.Item noStyle shouldUpdate>
                        {() => {
                          const selectedJenis = form.getFieldValue([
                            "items",
                            field.name,
                            "jenis",
                          ]);

                          const filteredProducts = productOptions
                            .filter((item) => {
                              if (!selectedJenis) return true;

                              return item.jenis === selectedJenis;
                            })
                            .map((item) => ({
                              label: item.partNumber,
                              value: item.value,
                            }));

                          return (
                            <Form.Item
                              label={index === 0 ? "Barang / Part Number" : " "}
                              name={[field.name, "kngProductId"]}
                              rules={[
                                {
                                  required: true,
                                  message: "Barang wajib dipilih",
                                },
                              ]}
                            >
                              <Select
                                showSearch
                                allowClear
                                loading={productLoading}
                                disabled={loading || productLoading}
                                placeholder="Pilih barang"
                                optionFilterProp="label"
                                options={filteredProducts}
                                onChange={(value?: string) => {
                                  form.setFieldValue(
                                    ["items", field.name, "hargaNetto"],
                                    getDefaultHargaNetto(value),
                                  );
                                }}
                              />
                            </Form.Item>
                          );
                        }}
                      </Form.Item>
                    </div>

                    <div className="lg:col-span-2">
                      <Form.Item
                        label={index === 0 ? "Order/pc" : " "}
                        name={[field.name, "quantity"]}
                        rules={[
                          {
                            required: true,
                            message: "Qty wajib diisi",
                          },
                          {
                            type: "integer",
                            min: 1,
                            message: "Qty harus bulat, minimal 1",
                          },
                        ]}
                      >
                        <InputNumber<number>
                          className="w-full"
                          min={1}
                          precision={0}
                          controls={false}
                          placeholder="Qty"
                        />
                      </Form.Item>
                    </div>

                    <div className="lg:col-span-1">
                      <Form.Item label=" ">
                        <Button
                          danger
                          block
                          icon={<DeleteOutlined />}
                          aria-label="Hapus item"
                          disabled={loading || fields.length === 1}
                          onClick={() => remove(field.name)}
                        />
                      </Form.Item>
                    </div>
                  </div>
                ))}

                <Form.ErrorList errors={errors} />

                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  disabled={loading}
                  onClick={() =>
                    add({
                      jenis: "",
                      kngProductId: "",
                      quantity: 1,
                      hargaNetto: 0,
                    })
                  }
                >
                  Tambah Item
                </Button>
              </div>
            )}
          </Form.List>
        </div>

        <Form.Item label="Catatan Lengkap" name="notes">
          <TextArea rows={3} placeholder="Tulis catatan tambahan jika ada" />
        </Form.Item>
      </div>

      <div className="mt-6 flex justify-end border-t border-slate-100 pt-4">
        <Space size={8}>
          <Button onClick={onCancel} disabled={loading}>
            Batal
          </Button>

          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            disabled={productLoading || Boolean(productError)}
          >
            {submitText}
          </Button>
        </Space>
      </div>
    </Form>
  );
}
