import SaleDetailPageClient from "@/components/sales/sale-detail-page-client";

type SaleDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function SaleDetailPage({ params }: SaleDetailPageProps) {
  const { id } = await params;

  return <SaleDetailPageClient id={id} />;
}
