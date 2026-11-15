import SupplierDetailPageClient from "@/components/suppliers/supplier-detail-page-client";

type SupplierDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function SupplierDetailPage({
  params,
}: SupplierDetailPageProps) {
  const { id } = await params;

  return <SupplierDetailPageClient id={id} />;
}
