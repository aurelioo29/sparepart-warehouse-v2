import SalesmanEditPageClient from "@/components/salesmen/salesman-edit-page-client";

type SalesmanEditPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function SalesmanEditPage({
  params,
}: SalesmanEditPageProps) {
  const { id } = await params;

  return <SalesmanEditPageClient id={id} />;
}
