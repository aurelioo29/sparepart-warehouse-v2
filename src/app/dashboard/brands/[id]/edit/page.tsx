import BrandEditPageClient from "@/components/brands/brand-edit-page-client";

type BrandEditPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function BrandEditPage({ params }: BrandEditPageProps) {
  const { id } = await params;

  return <BrandEditPageClient id={id} />;
}
