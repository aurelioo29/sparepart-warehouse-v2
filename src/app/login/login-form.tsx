"use client";

import Image from "next/image";
import { useState } from "react";
import { Button, Card, Form, Input, Typography, message } from "antd";
import { LockOutlined, UserOutlined } from "@ant-design/icons";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

const { Title, Text } = Typography;

type LoginFormValues = {
  username: string;
  password: string;
};

export default function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  async function onFinish(values: LoginFormValues) {
    if (loading) return;

    setLoading(true);

    try {
      const result = await signIn("credentials", {
        username: values.username.trim().toLowerCase(),
        password: values.password,
        redirect: false,
      });

      if (!result || result.error || !result.ok) {
        messageApi.error("Login gagal. Periksa username dan password.");
        return;
      }

      messageApi.success("Login berhasil");
      router.replace("/dashboard");
      router.refresh();
    } catch {
      messageApi.error("Tidak dapat memproses login. Silakan coba kembali.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {contextHolder}

      <main className="min-h-screen bg-slate-950">
        <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
          <section className="relative hidden overflow-hidden bg-slate-900 lg:block">
            <Image
              src="/assets/login-pages.png"
              alt="Warehouse login illustration"
              fill
              priority
              className="object-contain"
              sizes="(min-width: 1024px) 50vw, 100vw"
            />

            <div className="absolute inset-0 bg-linear-to-br from-slate-950/80 via-slate-950/45 to-blue-950/60" />

            <div className="absolute inset-x-0 bottom-0 p-10">
              <div className="max-w-7xl">
                <div className="mb-5 inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur">
                  Sparepart Warehouse Management
                </div>

                <h1 className="text-4xl font-bold leading-tight text-white">
                  Kelola stok sparepart lebih rapi, cepat, dan bisa diaudit.
                </h1>

                <p className="mt-4 max-w-lg text-base leading-7 text-slate-200">
                  Pantau barang masuk, barang keluar, bon gudang, activity log,
                  dan laporan penjualan tanpa drama stok hilang yang tiba-tiba
                  jadi cerita horor.
                </p>
              </div>
            </div>
          </section>

          <section className="flex items-center justify-center bg-slate-100 p-6 lg:p-10">
            <Card className="w-full max-w-md border-0 shadow-xl">
              <div className="mb-8">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-xl font-bold text-white shadow-sm">
                  SW
                </div>

                <Title level={3} className="mb-1!">
                  Login Dashboard
                </Title>

                <Text type="secondary">
                  Masuk untuk mengelola gudang sparepart.
                </Text>
              </div>

              <Form<LoginFormValues>
                layout="vertical"
                onFinish={onFinish}
                requiredMark={false}
                disabled={loading}
              >
                <Form.Item
                  label="Username"
                  name="username"
                  rules={[
                    {
                      required: true,
                      whitespace: true,
                      message: "Username wajib diisi",
                    },
                  ]}
                >
                  <Input
                    size="large"
                    prefix={<UserOutlined />}
                    placeholder="Input your username"
                    autoComplete="username"
                  />
                </Form.Item>

                <Form.Item
                  label="Password"
                  name="password"
                  rules={[
                    {
                      required: true,
                      message: "Password wajib diisi",
                    },
                  ]}
                >
                  <Input.Password
                    size="large"
                    prefix={<LockOutlined />}
                    placeholder="Input your password"
                    autoComplete="current-password"
                  />
                </Form.Item>

                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  block
                  loading={loading}
                  className="mt-2"
                >
                  Login
                </Button>
              </Form>
            </Card>
          </section>
        </div>
      </main>
    </>
  );
}
