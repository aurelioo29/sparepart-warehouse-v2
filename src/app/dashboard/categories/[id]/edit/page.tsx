import CategoryEditPageClient from "@/components/categories/category-edit-page-client";

type CategoryEditPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function CategoryEditPage({
  params,
}: CategoryEditPageProps) {
  const { id } = await params;

  return <CategoryEditPageClient id={id} />;
}
