import KngOrderPrintPageClient from "@/components/kng-orders/kng-order-print-page-client";

type KngOrderPrintPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function KngOrderPrintPage({
  params,
}: KngOrderPrintPageProps) {
  const { id } = await params;

  return <KngOrderPrintPageClient id={id} />;
}
