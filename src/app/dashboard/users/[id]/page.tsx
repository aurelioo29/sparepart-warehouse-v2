import UserDetailPageClient from "@/components/users/user-detail-page-client";

type UserDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function UserDetailPage({ params }: UserDetailPageProps) {
  const { id } = await params;

  return <UserDetailPageClient id={id} />;
}
