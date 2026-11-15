"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  Row,
  Typography,
  Upload,
  message,
} from "antd";
import type { UploadProps } from "antd";
import {
  DeleteOutlined,
  ReloadOutlined,
  SaveOutlined,
  ShopOutlined,
  UploadOutlined,
} from "@ant-design/icons";

import WarehouseBankAccountsField from "@/components/settings/warehouse-bank-accounts-field";

const { TextArea } = Input;
const { Title, Text } = Typography;

type WarehouseBankAccountFormValue = {
  id?: string;
  bankName: string;
  accountNumber: string;
  logoUrl?: string | null;
};

type WarehouseInfoFormValues = {
  storeName: string;
  ownerName?: string | null;
  logoUrl?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  invoiceFooter?: string | null;
  bankAccounts: WarehouseBankAccountFormValue[];
};

export default function WarehouseInfoPageClient() {
  const [form] = Form.useForm<WarehouseInfoFormValues>();

  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoVersion, setLogoVersion] = useState(Date.now());
  const [logoPreviewError, setLogoPreviewError] = useState(false);

  const previewLogoUrl = useMemo(() => {
    if (!logoUrl) {
      return "";
    }

    const separator = logoUrl.includes("?") ? "&" : "?";

    return `${logoUrl}${separator}v=${logoVersion}`;
  }, [logoUrl, logoVersion]);

  async function fetchWarehouseInfo() {
    try {
      setLoading(true);

      const response = await fetch("/api/settings/warehouse-info", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch warehouse info");
      }

      if (result.data) {
        form.setFieldsValue({
          storeName: result.data.storeName ?? "",
          ownerName: result.data.ownerName ?? null,
          logoUrl: result.data.logoUrl ?? null,
          phone: result.data.phone ?? null,
          email: result.data.email ?? null,
          address: result.data.address ?? null,
          city: result.data.city ?? null,
          province: result.data.province ?? null,
          postalCode: result.data.postalCode ?? null,
          invoiceFooter: result.data.invoiceFooter ?? null,
          bankAccounts: (result.data.bankAccounts ?? []).map(
            (account: WarehouseBankAccountFormValue) => ({
              id: account.id,
              bankName: account.bankName ?? "",
              accountNumber: account.accountNumber ?? "",
              logoUrl: account.logoUrl ?? null,
            }),
          ),
        });

        setLogoUrl(result.data.logoUrl || null);
        setLogoPreviewError(false);
        setLogoVersion(Date.now());
      } else {
        form.resetFields();

        form.setFieldsValue({
          storeName: "",
          bankAccounts: [],
        });

        setLogoUrl(null);
        setLogoPreviewError(false);
      }
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error
          ? error.message
          : "Gagal mengambil warehouse info",
      );
    } finally {
      setLoading(false);
    }
  }

  async function uploadLogo(file: File) {
    try {
      setUploadingLogo(true);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/uploads/warehouse-logo", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal upload logo");
      }

      const uploadedUrl = result.data.url as string;

      setLogoUrl(uploadedUrl);
      setLogoPreviewError(false);
      setLogoVersion(Date.now());

      form.setFieldValue("logoUrl", uploadedUrl);

      message.success("Logo berhasil diupload");
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal upload logo",
      );
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleSubmit(values: WarehouseInfoFormValues) {
    try {
      setSubmitLoading(true);

      const payload = {
        storeName: values.storeName,
        ownerName: values.ownerName || null,
        logoUrl,
        phone: values.phone || null,
        email: values.email || null,
        address: values.address || null,
        city: values.city || null,
        province: values.province || null,
        postalCode: values.postalCode || null,
        invoiceFooter: values.invoiceFooter || null,

        bankAccounts: (values.bankAccounts ?? []).map((account) => ({
          bankName: account.bankName,
          accountNumber: account.accountNumber,
          logoUrl: account.logoUrl || null,
        })),
      };

      const response = await fetch("/api/settings/warehouse-info", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to update warehouse info");
      }

      const savedData = result.data;

      form.setFieldsValue({
        storeName: savedData.storeName ?? "",
        ownerName: savedData.ownerName ?? null,
        logoUrl: savedData.logoUrl ?? null,
        phone: savedData.phone ?? null,
        email: savedData.email ?? null,
        address: savedData.address ?? null,
        city: savedData.city ?? null,
        province: savedData.province ?? null,
        postalCode: savedData.postalCode ?? null,
        invoiceFooter: savedData.invoiceFooter ?? null,
        bankAccounts: (savedData.bankAccounts ?? []).map(
          (account: WarehouseBankAccountFormValue) => ({
            id: account.id,
            bankName: account.bankName ?? "",
            accountNumber: account.accountNumber ?? "",
            logoUrl: account.logoUrl ?? null,
          }),
        ),
      });

      setLogoUrl(savedData.logoUrl || null);
      setLogoPreviewError(false);
      setLogoVersion(Date.now());

      message.success(result.message || "Warehouse info berhasil diperbarui");
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal update warehouse info",
      );
    } finally {
      setSubmitLoading(false);
    }
  }

  function handleRemoveWarehouseLogo() {
    setLogoUrl(null);
    setLogoPreviewError(false);
    form.setFieldValue("logoUrl", null);
  }

  const uploadProps: UploadProps = {
    showUploadList: false,
    accept: "image/png,image/jpeg,image/webp",

    beforeUpload: (file) => {
      const validTypes = ["image/png", "image/jpeg", "image/webp"];

      if (!validTypes.includes(file.type)) {
        message.error("Format logo harus JPG, PNG, atau WEBP");

        return Upload.LIST_IGNORE;
      }

      const isLessThan2MB = file.size / 1024 / 1024 < 2;

      if (!isLessThan2MB) {
        message.error("Ukuran logo maksimal 2MB");

        return Upload.LIST_IGNORE;
      }

      void uploadLogo(file);

      return false;
    },
  };

  useEffect(() => {
    void fetchWarehouseInfo();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-full">
      <div className="mb-6 flex flex-col gap-4 border border-slate-200 bg-white px-6 py-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center bg-blue-600 text-white shadow-sm shadow-blue-200">
            <ShopOutlined className="text-lg" />
          </div>

          <div>
            <Title level={4} className="!mb-0 !text-slate-950">
              Warehouse Info
            </Title>

            <Text className="!text-sm !text-slate-500">
              Kelola identitas, kontak, logo, rekening, dan informasi invoice
              warehouse.
            </Text>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              void fetchWarehouseInfo();
            }}
            loading={loading}
            disabled={submitLoading}
          >
            Refresh
          </Button>

          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={submitLoading}
            disabled={loading || uploadingLogo}
            onClick={() => {
              form.submit();
            }}
          >
            Save Changes
          </Button>
        </div>
      </div>

      <Form<WarehouseInfoFormValues>
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{
          storeName: "",
          ownerName: null,
          logoUrl: null,
          phone: null,
          email: null,
          address: null,
          city: null,
          province: null,
          postalCode: null,
          invoiceFooter: null,
          bankAccounts: [],
        }}
        onFinish={handleSubmit}
      >
        <Form.Item name="logoUrl" hidden>
          <Input />
        </Form.Item>

        <Row gutter={[24, 24]}>
          <Col xs={24} lg={8}>
            <Card className="settings-card h-full">
              <div className="mb-5">
                <div className="text-base font-semibold text-slate-950">
                  Brand Preview
                </div>

                <div className="mt-1 text-sm text-slate-500">
                  Logo yang digunakan untuk receipt, report, dan invoice.
                </div>
              </div>

              <div className="border border-slate-200 bg-slate-50 p-4">
                <div className="flex h-[180px] items-center justify-center bg-white shadow-inner">
                  {logoUrl && !logoPreviewError ? (
                    <img
                      src={previewLogoUrl}
                      alt="Warehouse logo"
                      className="max-h-[120px] w-auto max-w-[220px] object-contain"
                      onError={() => {
                        setLogoPreviewError(true);

                        message.warning(
                          "Logo tersimpan, tetapi preview tidak dapat dibaca. Periksa akses file.",
                        );
                      }}
                    />
                  ) : (
                    <div className="text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center bg-slate-100 text-slate-400">
                        <ShopOutlined className="text-2xl" />
                      </div>

                      <div className="mt-3 text-sm font-semibold text-slate-700">
                        {logoUrl && logoPreviewError
                          ? "Logo preview failed"
                          : "Belum ada logo"}
                      </div>

                      <div className="mt-1 text-xs text-slate-400">
                        PNG transparan direkomendasikan
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3">
                  <Upload {...uploadProps}>
                    <Button
                      block
                      icon={<UploadOutlined />}
                      loading={uploadingLogo}
                      disabled={loading || submitLoading}
                    >
                      Upload Logo
                    </Button>
                  </Upload>

                  {logoUrl ? (
                    <Button
                      block
                      danger
                      icon={<DeleteOutlined />}
                      disabled={loading || submitLoading || uploadingLogo}
                      onClick={handleRemoveWarehouseLogo}
                    >
                      Remove Logo
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-900">
                Gunakan JPG, PNG, atau WEBP dengan ukuran maksimal 2MB. PNG
                transparan biasanya lebih bersih untuk invoice.
              </div>
            </Card>
          </Col>

          <Col xs={24} lg={16}>
            <Card className="settings-card">
              <div className="mb-6">
                <div className="text-base font-semibold text-slate-950">
                  Business Information
                </div>

                <div className="mt-1 text-sm text-slate-500">
                  Informasi utama yang ditampilkan pada dokumen warehouse.
                </div>
              </div>

              <Row gutter={[18, 0]}>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="Warehouse Name"
                    name="storeName"
                    rules={[
                      {
                        required: true,
                        whitespace: true,
                        message: "Nama warehouse wajib diisi",
                      },
                      {
                        max: 100,
                        message: "Nama warehouse maksimal 100 karakter",
                      },
                    ]}
                  >
                    <Input
                      placeholder="Sparepart Warehouse"
                      disabled={loading}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item
                    label="Owner Name"
                    name="ownerName"
                    rules={[
                      {
                        max: 100,
                        message: "Nama owner maksimal 100 karakter",
                      },
                    ]}
                  >
                    <Input placeholder="Nama pemilik" disabled={loading} />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item
                    label="Phone Number"
                    name="phone"
                    rules={[
                      {
                        max: 30,
                        message: "Nomor telepon maksimal 30 karakter",
                      },
                    ]}
                  >
                    <Input placeholder="0812xxxxxxxx" disabled={loading} />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item
                    label="Email Address"
                    name="email"
                    rules={[
                      {
                        type: "email",
                        message: "Format email tidak valid",
                      },
                      {
                        max: 100,
                        message: "Email maksimal 100 karakter",
                      },
                    ]}
                  >
                    <Input placeholder="admin@example.com" disabled={loading} />
                  </Form.Item>
                </Col>
              </Row>

              <Divider className="!my-3" />

              <div className="mb-6 mt-6">
                <div className="text-base font-semibold text-slate-950">
                  Location
                </div>

                <div className="mt-1 text-sm text-slate-500">
                  Alamat warehouse yang digunakan pada dokumen cetak.
                </div>
              </div>

              <Row gutter={[18, 0]}>
                <Col xs={24} md={8}>
                  <Form.Item
                    label="City"
                    name="city"
                    rules={[
                      {
                        max: 100,
                        message: "Nama kota maksimal 100 karakter",
                      },
                    ]}
                  >
                    <Input placeholder="Medan" disabled={loading} />
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                  <Form.Item
                    label="Province"
                    name="province"
                    rules={[
                      {
                        max: 100,
                        message: "Nama provinsi maksimal 100 karakter",
                      },
                    ]}
                  >
                    <Input placeholder="Sumatera Utara" disabled={loading} />
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                  <Form.Item
                    label="Postal Code"
                    name="postalCode"
                    rules={[
                      {
                        max: 20,
                        message: "Kode pos maksimal 20 karakter",
                      },
                    ]}
                  >
                    <Input placeholder="20111" disabled={loading} />
                  </Form.Item>
                </Col>

                <Col xs={24}>
                  <Form.Item label="Full Address" name="address">
                    <TextArea
                      rows={4}
                      placeholder="Alamat lengkap warehouse atau toko"
                      disabled={loading}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Divider className="!my-3" />

              <div className="mb-6 mt-6">
                <WarehouseBankAccountsField
                  disabled={loading || submitLoading}
                />
              </div>

              <Divider className="!my-3" />

              <div className="mb-6 mt-6">
                <div className="text-base font-semibold text-slate-950">
                  Invoice Footer
                </div>

                <div className="mt-1 text-sm text-slate-500">
                  Catatan yang dicetak pada bagian bawah receipt dan invoice.
                </div>
              </div>

              <Form.Item label="Footer Text" name="invoiceFooter">
                <TextArea
                  rows={4}
                  placeholder="Terima kasih. Barang yang sudah keluar harap dicek kembali."
                  disabled={loading}
                />
              </Form.Item>

              <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-5">
                <Button
                  icon={<ReloadOutlined />}
                  loading={loading}
                  disabled={submitLoading}
                  onClick={() => {
                    void fetchWarehouseInfo();
                  }}
                >
                  Reset
                </Button>

                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  loading={submitLoading}
                  disabled={loading || uploadingLogo}
                  onClick={() => {
                    form.submit();
                  }}
                >
                  Save Information
                </Button>
              </div>
            </Card>
          </Col>
        </Row>
      </Form>
    </div>
  );
}
