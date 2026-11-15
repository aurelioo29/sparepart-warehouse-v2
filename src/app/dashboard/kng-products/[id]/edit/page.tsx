import KngProductEditPageClient from "@/components/kng-products/kng-product-edit-page-client";

type KngProductEditPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function KngProductEditPage({
  params,
}: KngProductEditPageProps) {
  const { id } = await params;

  return <KngProductEditPageClient id={id} />;
}
