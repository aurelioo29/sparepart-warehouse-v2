import SalePaymentDetailPageClient from "@/components/sale-payments/sale-payment-detail-page-client";

type SalePaymentDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function SalePaymentDetailPage({
  params,
}: SalePaymentDetailPageProps) {
  const { id } = await params;

  return <SalePaymentDetailPageClient id={id} />;
}
