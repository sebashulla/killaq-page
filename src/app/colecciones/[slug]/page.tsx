import { redirect } from "next/navigation";

export default async function LegacyCollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/colecciones?search=${encodeURIComponent(slug.replace(/-/g, " "))}`);
}
