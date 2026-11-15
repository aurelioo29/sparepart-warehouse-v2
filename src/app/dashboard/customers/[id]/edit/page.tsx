import CustomerEditPageClient from "@/components/customers/customer-edit-page-client";

type CustomerEditPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function CustomerEditPage({
  params,
}: CustomerEditPageProps) {
  const { id } = await params;

  return <CustomerEditPageClient id={id} />;
}
