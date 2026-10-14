import LegalDocumentPage from "@/components/LegalDocumentPage";
import { policiesReady } from "@/lib/legal-config";
export const dynamic = "force-dynamic";
export function generateMetadata() { return { title: "Cambios, devoluciones y reembolsos · KILLAQ", robots: { index: policiesReady(), follow: true } }; }
export default function Page() { return <LegalDocumentPage document="returns" />; }
