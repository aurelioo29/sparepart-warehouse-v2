import SaleEditPageClient from "@/components/sales/sale-edit-page-client";

type SaleEditPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function SaleEditPage({ params }: SaleEditPageProps) {
  const { id } = await params;

  return <SaleEditPageClient id={id} />;
}
