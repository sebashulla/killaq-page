export type ClaimType = "reclamo" | "queja";
export type ComplaintInput = {
  full_name: string; document_type: string; document_number: string;
  email: string; phone: string; address: string; is_minor: boolean;
  representative_name: string; representative_address: string;
  representative_phone: string; representative_email: string;
  item_type: "producto" | "servicio"; item_description: string;
  amount: string; claim_type: ClaimType; order_reference: string;
  detail: string; request: string; response_channel: "email" | "carta";
};
export type Provider = { brand: string; ruc: string; legalName: string; address: string; email: string; bookCode: string };
export type ComplaintReceipt = ComplaintInput & {
  id: number; sheet_number: string; created_at: string; due_date: string;
  provider_snapshot: Provider; status: string; email_status?: string;
};
export const emptyComplaint: ComplaintInput = {
  full_name: "", document_type: "dni", document_number: "", email: "", phone: "", address: "",
  is_minor: false, representative_name: "", representative_address: "", representative_phone: "",
  representative_email: "", item_type: "producto", item_description: "", amount: "",
  claim_type: "reclamo", order_reference: "", detail: "", request: "", response_channel: "email",
};
export class ComplaintError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function validateComplaint(value: unknown): ComplaintInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ComplaintError(400, "Formulario inválido.");
  const raw = value as Record<string, unknown>;
  const input = { ...emptyComplaint };
  const limits: Record<string, number> = { full_name: 150, document_type: 30, document_number: 20,
    email: 254, phone: 30, address: 500, representative_name: 150, representative_address: 500,
    representative_phone: 30, representative_email: 254, item_type: 10, item_description: 1000,
    amount: 20, claim_type: 10, order_reference: 120, detail: 5000, request: 3000, response_channel: 10 };
  for (const [key, limit] of Object.entries(limits)) {
    if (raw[key] !== undefined && typeof raw[key] !== "string") throw new ComplaintError(400, "Revisa los campos del formulario.");
    const text = typeof raw[key] === "string" ? (raw[key] as string).trim() : input[key as keyof ComplaintInput];
    if (typeof text !== "string" || text.length > limit || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) throw new ComplaintError(400, "Un campo excede el tamaño permitido.");
    Object.assign(input, { [key]: text });
  }
  if (raw.is_minor !== undefined && typeof raw.is_minor !== "boolean") throw new ComplaintError(400, "Revisa la representación.");
  input.is_minor = raw.is_minor === true;
  if (!input.full_name || !input.document_number || !input.detail) throw new ComplaintError(400, "Completa nombre, documento y descripción de los hechos.");
  if (!["dni", "ce", "pasaporte", "otro"].includes(input.document_type) || (input.document_type === "dni" && !/^\d{8}$/.test(input.document_number))) throw new ComplaintError(400, "Revisa el tipo y número de documento.");
  if (!["reclamo", "queja"].includes(input.claim_type) || !["producto", "servicio"].includes(input.item_type) || !["email", "carta"].includes(input.response_channel)) throw new ComplaintError(400, "Selecciona un tipo y canal válidos.");
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if ((input.email && !email.test(input.email)) || (input.representative_email && !email.test(input.representative_email))) throw new ComplaintError(400, "Revisa el correo electrónico.");
  if (!input.address && !input.email) throw new ComplaintError(400, "Indica un domicilio o correo para la respuesta.");
  if (input.response_channel === "email" && !input.email) throw new ComplaintError(400, "Indica el correo al que deseas recibir la respuesta.");
  if (input.response_channel === "carta" && !input.address) throw new ComplaintError(400, "Indica el domicilio al que deseas recibir la carta.");
  if (input.amount && !/^\d{1,10}(\.\d{1,2})?$/.test(input.amount)) throw new ComplaintError(400, "El monto debe ser un importe en soles, sin símbolos.");
  if (input.is_minor && (!input.representative_name || (!input.representative_email && !input.representative_address))) throw new ComplaintError(400, "Indica el nombre y domicilio o correo del padre, madre o representante.");
  if (!input.is_minor) Object.assign(input, { representative_name: "", representative_address: "", representative_phone: "", representative_email: "" });
  return input;
}
export function validRuc(ruc: string) {
  if (!/^(10|15|17|20)\d{9}$/.test(ruc)) return false;
  const total = [5,4,3,2,7,6,5,4,3,2].reduce((sum, weight, index) => sum + Number(ruc[index]) * weight, 0);
  const digit = 11 - total % 11;
  return Number(ruc[10]) === (digit === 10 ? 0 : digit === 11 ? 1 : digit);
}
export const calendarVersion = "PE-2026-2027-v1";
const fixedHolidays = ["01-01","05-01","06-07","06-29","07-23","07-28","07-29","08-06","08-30","10-08","11-01","12-08","12-09","12-25"];
export function holidays(year: number) {
  if (year !== 2026 && year !== 2027) throw new ComplaintError(503, "El calendario de atención necesita actualización.");
  return new Set([...fixedHolidays.map(day => `${year}-${day}`), ...(year === 2026 ? ["2026-04-02","2026-04-03"] : ["2027-03-25","2027-03-26"])]);
}
export function limaDate(date: Date) { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" }).format(date); }
export function dueDate(received: Date) {
  const date = new Date(`${limaDate(received)}T12:00:00Z`);
  let count = 0;
  while (count < 15) {
    date.setUTCDate(date.getUTCDate() + 1);
    const day = date.toISOString().slice(0,10);
    if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6 && !holidays(date.getUTCFullYear()).has(day)) count++;
  }
  return date.toISOString().slice(0,10);
}
export function escapeHtml(value: unknown) { return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]!)); }
export function receiptHtml(receipt: ComplaintReceipt, destination = "Consumidor", response?: { body: string; communicatedAt: string | null; emailAccepted: boolean }) {
  const row = (label: string, value: unknown) => `<div class="row"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value === "" || value == null ? "No consignado" : value)}</span></div>`;
  const provider = receipt.provider_snapshot;
  const providerActions = response ? row("Respuesta escrita",response.body)+row("Fecha de comunicación de respuesta",response.communicatedAt ? new Date(response.communicatedAt).toLocaleString("es-PE",{timeZone:"America/Lima"}) + " (Perú)" : "Pendiente de comunicación")+(response.emailAccepted ? "<p>Fecha de aceptación por el servicio de correo. La entrega o lectura no está certificada; consultar la evidencia del expediente.</p>" : "") : "<p>Recepción registrada. Respuesta pendiente de atención.</p>"+row("Fecha de comunicación de respuesta","Pendiente");
  return `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Hoja ${escapeHtml(receipt.sheet_number)} · KILLAQ</title><style>body{max-width:850px;margin:40px auto;padding:0 24px;font:15px/1.6 Arial,sans-serif;color:#222}h1,h2{font-family:Georgia,serif;font-weight:400}h2{border-bottom:1px solid #94702d;margin-top:28px}.row{display:grid;grid-template-columns:190px 1fr;gap:12px;padding:5px 0}.row span{white-space:pre-wrap;overflow-wrap:anywhere}small{display:block;margin-top:25px}@media(max-width:500px){.row{grid-template-columns:1fr;gap:0}}@media print{body{margin:0;font-size:11pt}h2{break-after:avoid}.row{break-inside:avoid}button{display:none}}</style><body><h1>LIBRO DE RECLAMACIONES</h1><h2>Hoja de reclamación ${escapeHtml(receipt.sheet_number)}</h2>${row("Proveedor", `${provider.brand} · ${provider.legalName}`)}${row("RUC",provider.ruc)}${row("Domicilio / código",`${provider.address} / ${provider.bookCode}`)}${row("Fecha y hora de recepción",new Date(receipt.created_at).toLocaleString("es-PE",{timeZone:"America/Lima"}) + " (Perú)")}<h2>1. Identificación del consumidor reclamante</h2>${row("Nombre",receipt.full_name)}${row("Documento",`${receipt.document_type.toUpperCase()} ${receipt.document_number}`)}${row("Domicilio",receipt.address)}${row("Teléfono / correo",`${receipt.phone} / ${receipt.email}`)}${receipt.is_minor ? row("Padre, madre o representante",receipt.representative_name)+row("Domicilio del representante",receipt.representative_address)+row("Contacto del representante",`${receipt.representative_phone} / ${receipt.representative_email}`) : ""}<h2>2. Identificación del bien contratado</h2>${row("Producto / servicio",receipt.item_type)}${row("Descripción",receipt.item_description)}${row("Monto reclamado (S/)",receipt.amount)}${row("Pedido / referencia",receipt.order_reference)}<h2>3. Detalle de la reclamación y pedido</h2>${row("Tipo",receipt.claim_type)}${row("Detalle",receipt.detail)}${row("Pedido del consumidor",receipt.request)}<h2>4. Observaciones y acciones adoptadas por el proveedor</h2>${providerActions}${row("Canal de respuesta",receipt.response_channel === "email" ? receipt.email : receipt.address)}${row("Fecha límite general",receipt.due_date)}<p>Reclamo: disconformidad relacionada con un producto o servicio. Queja: malestar por la atención u otros aspectos ajenos directamente al producto o servicio.</p><small>El proveedor debe responder en un máximo de 15 días hábiles improrrogables. Esta presentación no impide utilizar otras vías ni es requisito previo para denunciar ante INDECOPI. Registro virtual: no requiere firma manuscrita. Destinatario: ${escapeHtml(destination)}.</small></body></html>`;
}
