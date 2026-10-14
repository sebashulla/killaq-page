import LegalLayout from "./LegalLayout";
import { legalConfig, policiesReady } from "@/lib/legal-config";
import { documentContent, type LegalDocument } from "@/lib/legal-documents";
export default function LegalDocumentPage({ document }: { document: LegalDocument }) {
  const config = legalConfig(); const ready = policiesReady(config); const content = documentContent(document,config);
  if (!ready && process.env.NODE_ENV !== "development") return <LegalLayout title={content.title} intro="Este documento aún no está publicado como política definitiva." sections={[{ id:"publicacion",title:"Información en preparación",paragraphs:["Estamos completando la validación de la información comercial y jurídica necesaria. No se presenta un borrador como condición contractual vigente.","La preparación de esta información no limita los derechos reconocidos por la legislación peruana."] }]} />;
  return <LegalLayout {...content} draft={!ready} date={ready ? config.effectiveDate : "2026-10-09"} />;
}
