import WarehouseEditPageClient from "@/components/warehouses/warehouse-edit-page-client";

type WarehouseEditPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function WarehouseEditPage({
  params,
}: WarehouseEditPageProps) {
  const { id } = await params;

  return <WarehouseEditPageClient id={id} />;
}
