import KngOrderEditPageClient from "@/components/kng-orders/kng-order-edit-page-client";

type KngOrderEditPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function KngOrderEditPage({
  params,
}: KngOrderEditPageProps) {
  const { id } = await params;

  return <KngOrderEditPageClient id={id} />;
}
