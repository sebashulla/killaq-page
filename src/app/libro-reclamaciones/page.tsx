import LegalLayout from "@/components/LegalLayout";
import { backendReady, mailReady } from "@/lib/complaints/server";
import { identityReady, legalConfig, policiesReady } from "@/lib/legal-config";
import ComplaintForm from "./ComplaintForm";
export const dynamic = "force-dynamic";
export const metadata = { title: "Libro de Reclamaciones · KILLAQ", robots: { index: false, follow: true } };
export default function Page() {
  const config = legalConfig(); const identified = identityReady(config);
  const enabled = identified && policiesReady(config) && backendReady() && mailReady();
  return <LegalLayout title="Libro de Reclamaciones" intro="Tu disconformidad merece una atención clara. Presenta un reclamo o queja sin crear una cuenta, comprar o efectuar un pago." sections={[
    { id:"proveedor",title:"Identificación del proveedor",paragraphs:[`KILLAQ · RUC ${config.ruc}`, identified ? `${config.legalName}. Domicilio: ${config.address}. Contacto: ${config.email}. Código: ${config.bookCode}.` : "La identificación legal, el domicilio y el canal de atención están pendientes de habilitación. No existe actualmente una tienda física abierta al público."] },
    { id:"orientacion",title:"Reclamo o queja",paragraphs:["Reclamo: disconformidad relacionada con un producto o servicio. Queja: malestar por la atención u otros aspectos que no se relacionan directamente con el producto o servicio.","El plazo general de respuesta por escrito es de 15 días hábiles improrrogables. Presentar esta hoja no impide acudir a otras vías ni es requisito previo para denunciar ante INDECOPI."] },
    { id:"hoja",title:"Tu hoja de reclamación",paragraphs:["El número correlativo y la fecha y hora de recepción se asignan en el servidor al registrarse correctamente. Los campos adicionales ayudan a revisar el caso; indica un domicilio o correo para la respuesta. No compartas datos de tarjeta, contraseñas ni información sensible innecesaria."] },
  ]}>
    {!enabled && <p role="status">El registro virtual aún no está habilitado. No envíes datos personales en esta vista: ninguna solicitud se registrará hasta completar la identificación, la política de privacidad, la base de datos y el servicio de correo. Puedes consultar la orientación oficial de <a href="https://consumidor.gob.pe/libro-de-reclamaciones/" target="_blank" rel="noopener noreferrer">INDECOPI</a>.</p>}
    <ComplaintForm enabled={enabled} />
  </LegalLayout>;
}
