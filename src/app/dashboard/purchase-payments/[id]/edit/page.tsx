import PurchasePaymentEditPageClient from "@/components/purchase-payments/purchase-payment-edit-page-client";

type PurchasePaymentEditPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function PurchasePaymentEditPage({
  params,
}: PurchasePaymentEditPageProps) {
  const { id } = await params;

  return <PurchasePaymentEditPageClient id={id} />;
}
