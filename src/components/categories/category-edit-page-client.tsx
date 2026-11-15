"use client";

import { useEffect, useState } from "react";
import { App, Spin } from "antd";
import { useRouter } from "next/navigation";

import CategoryForm, { CategoryFormValues } from "./category-form";

type CategoryItem = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type CategoryEditPageClientProps = {
  id: string;
};

export default function CategoryEditPageClient({
  id,
}: CategoryEditPageClientProps) {
  const router = useRouter();
  const { message } = App.useApp();

  const [category, setCategory] = useState<CategoryItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  async function fetchCategory() {
    try {
      setLoading(true);

      const response = await fetch(`/api/categories/${id}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal mengambil kategori");
      }

      setCategory(result.data);
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal mengambil kategori",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(values: CategoryFormValues) {
    try {
      setSubmitLoading(true);

      const response = await fetch(`/api/categories/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal memperbarui kategori");
      }

      message.success(result.message || "Kategori berhasil diperbarui");

      router.push(`/dashboard/categories/${id}`);
      router.refresh();
    } catch (error) {
      console.error(error);

      message.error(
        error instanceof Error ? error.message : "Gagal memperbarui kategori",
      );
    } finally {
      setSubmitLoading(false);
    }
  }

  useEffect(() => {
    void fetchCategory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div className="text-sm">
      <div className="mb-5 border-b border-slate-100 pb-4">
        <h1 className="m-0 text-lg font-bold text-slate-950">Edit Kategori</h1>

        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Perbarui informasi kategori produk.
        </p>
      </div>

      {loading ? (
        <div className="flex min-h-[240px] items-center justify-center">
          <Spin />
        </div>
      ) : (
        <CategoryForm
          loading={submitLoading}
          submitText="Simpan Perubahan"
          initialValues={{
            name: category?.name || "",
            description: category?.description || "",
            isActive: category?.isActive ?? true,
          }}
          onCancel={() => router.push(`/dashboard/categories/${id}`)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
