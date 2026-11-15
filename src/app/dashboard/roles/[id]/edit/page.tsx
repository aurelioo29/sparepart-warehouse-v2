import RoleEditPageClient from "@/components/roles/role-edit-page-client";

type RoleEditPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function RoleEditPage({ params }: RoleEditPageProps) {
  const { id } = await params;

  return <RoleEditPageClient id={id} />;
}
