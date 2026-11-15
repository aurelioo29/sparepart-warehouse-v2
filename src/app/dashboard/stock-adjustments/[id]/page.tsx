import StockAdjustmentDetailPageClient from "@/components/stock-adjustments/stock-adjustment-detail-page-client";

type StockAdjustmentDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function StockAdjustmentDetailPage({
  params,
}: StockAdjustmentDetailPageProps) {
  const { id } = await params;

  return <StockAdjustmentDetailPageClient id={id} />;
}
