import RackLocationDetailPageClient from "@/components/rack-locations/rack-location-detail-page-client";

type RackLocationDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function RackLocationDetailPage({
  params,
}: RackLocationDetailPageProps) {
  const { id } = await params;

  return <RackLocationDetailPageClient id={id} />;
}
