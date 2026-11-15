import RoleDetailPageClient from "@/components/roles/role-detail-page-client";

type RoleDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function RoleDetailPage({ params }: RoleDetailPageProps) {
  const { id } = await params;

  return <RoleDetailPageClient id={id} />;
}
