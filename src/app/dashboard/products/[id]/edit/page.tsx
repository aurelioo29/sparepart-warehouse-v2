import ProductEditPageClient from "@/components/products/product-edit-page-client";

type ProductEditPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ProductEditPage({
  params,
}: ProductEditPageProps) {
  const { id } = await params;

  return <ProductEditPageClient id={id} />;
}
