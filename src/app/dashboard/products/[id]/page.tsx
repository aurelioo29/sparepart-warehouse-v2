import ProductDetailPageClient from "@/components/products/product-detail-page-client";

type ProductDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  const { id } = await params;

  return <ProductDetailPageClient id={id} />;
}
