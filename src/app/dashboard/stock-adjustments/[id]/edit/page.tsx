import StockAdjustmentEditPageClient from "@/components/stock-adjustments/stock-adjustment-edit-page-client";

type StockAdjustmentEditPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function StockAdjustmentEditPage({
  params,
}: StockAdjustmentEditPageProps) {
  const { id } = await params;

  return <StockAdjustmentEditPageClient id={id} />;
}
