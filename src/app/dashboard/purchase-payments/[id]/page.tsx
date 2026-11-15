import PurchasePaymentDetailPageClient from "@/components/purchase-payments/purchase-payment-detail-page-client";

type PurchasePaymentDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function PurchasePaymentDetailPage({
  params,
}: PurchasePaymentDetailPageProps) {
  const { id } = await params;

  return <PurchasePaymentDetailPageClient id={id} />;
}
