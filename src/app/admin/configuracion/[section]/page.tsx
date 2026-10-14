import { notFound } from "next/navigation";
import ConfigurationPanel from "@/components/admin/ConfigurationPanel";
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!["negocio", "legal", "operativa"].includes(section)) notFound();
  return (
    <ConfigurationPanel mode={section as "negocio" | "legal" | "operativa"} />
  );
}
