import WarehouseDetailPageClient from "@/components/warehouses/warehouse-detail-page-client";

type WarehouseDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function WarehouseDetailPage({
  params,
}: WarehouseDetailPageProps) {
  const { id } = await params;

  return <WarehouseDetailPageClient id={id} />;
}
