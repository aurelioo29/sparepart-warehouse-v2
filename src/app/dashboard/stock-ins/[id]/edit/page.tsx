import StockInEditPageClient from "@/components/stock-ins/stock-in-edit-page-client";

type StockInEditPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function StockInEditPage({
  params,
}: StockInEditPageProps) {
  const { id } = await params;

  return <StockInEditPageClient id={id} />;
}
