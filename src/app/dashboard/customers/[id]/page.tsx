import CustomerDetailPageClient from "@/components/customers/customer-detail-page-client";

type CustomerDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function CustomerDetailPage({
  params,
}: CustomerDetailPageProps) {
  const { id } = await params;

  return <CustomerDetailPageClient id={id} />;
}
