import CategoryDetailPageClient from "@/components/categories/category-detail-page-client";

type CategoryDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function CategoryDetailPage({
  params,
}: CategoryDetailPageProps) {
  const { id } = await params;

  return <CategoryDetailPageClient id={id} />;
}
