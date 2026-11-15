import UnitDetailPageClient from "@/components/units/unit-detail-page-client";

type UnitDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function UnitDetailPage({ params }: UnitDetailPageProps) {
  const { id } = await params;

  return <UnitDetailPageClient id={id} />;
}
