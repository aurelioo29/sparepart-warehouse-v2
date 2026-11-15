import BrandDetailPageClient from "@/components/brands/brand-detail-page-client";

type BrandDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function BrandDetailPage({
  params,
}: BrandDetailPageProps) {
  const { id } = await params;

  return <BrandDetailPageClient id={id} />;
}
