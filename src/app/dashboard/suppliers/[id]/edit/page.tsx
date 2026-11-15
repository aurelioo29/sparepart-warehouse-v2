import SupplierEditPageClient from "@/components/suppliers/supplier-edit-page-client";

type SupplierEditPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function SupplierEditPage({
  params,
}: SupplierEditPageProps) {
  const { id } = await params;

  return <SupplierEditPageClient id={id} />;
}
