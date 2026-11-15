import SalePaymentEditPageClient from "@/components/sale-payments/sale-payment-edit-page-client";

type SalePaymentEditPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function SalePaymentEditPage({
  params,
}: SalePaymentEditPageProps) {
  const { id } = await params;

  return <SalePaymentEditPageClient id={id} />;
}
