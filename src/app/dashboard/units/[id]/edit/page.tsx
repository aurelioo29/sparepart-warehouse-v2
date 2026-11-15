import UnitEditPageClient from "@/components/units/unit-edit-page-client";

type UnitEditPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function UnitEditPage({ params }: UnitEditPageProps) {
  const { id } = await params;

  return <UnitEditPageClient id={id} />;
}
