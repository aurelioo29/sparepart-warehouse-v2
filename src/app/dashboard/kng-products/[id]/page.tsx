import KngProductDetailPageClient from "@/components/kng-products/kng-product-detail-page-client";

type KngProductDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function KngProductDetailPage({
  params,
}: KngProductDetailPageProps) {
  const { id } = await params;

  return <KngProductDetailPageClient id={id} />;
}
