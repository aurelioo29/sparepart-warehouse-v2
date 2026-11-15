import SalesmanDetailPageClient from "@/components/salesmen/salesman-detail-page-client";

type SalesmanDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function SalesmanDetailPage({
  params,
}: SalesmanDetailPageProps) {
  const { id } = await params;

  return <SalesmanDetailPageClient id={id} />;
}
