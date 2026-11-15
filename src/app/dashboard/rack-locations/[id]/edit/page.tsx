import RackLocationEditPageClient from "@/components/rack-locations/rack-location-edit-page-client";

type RackLocationEditPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function RackLocationEditPage({
  params,
}: RackLocationEditPageProps) {
  const { id } = await params;

  return <RackLocationEditPageClient id={id} />;
}
