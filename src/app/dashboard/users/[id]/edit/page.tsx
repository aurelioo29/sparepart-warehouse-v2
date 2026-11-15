import UserEditPageClient from "@/components/users/user-edit-page-client";

type UserEditPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function UserEditPage({ params }: UserEditPageProps) {
  const { id } = await params;

  return <UserEditPageClient id={id} />;
}
