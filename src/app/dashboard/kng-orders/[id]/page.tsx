import KngOrderDetailPageClient from "@/components/kng-orders/kng-order-detail-page-client";

type KngOrderDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function KngOrderDetailPage({
  params,
}: KngOrderDetailPageProps) {
  const { id } = await params;

  return <KngOrderDetailPageClient id={id} />;
}
