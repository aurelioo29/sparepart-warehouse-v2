import StockInDetailPageClient from "@/components/stock-ins/stock-in-detail-page-client";

type StockInDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function StockInDetailPage({
  params,
}: StockInDetailPageProps) {
  const { id } = await params;

  return <StockInDetailPageClient id={id} />;
}
