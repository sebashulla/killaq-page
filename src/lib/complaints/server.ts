import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { identityReady, legalConfig, policiesReady } from "../legal-config";
import { ComplaintError, escapeHtml, receiptHtml, validateComplaint, type ComplaintReceipt } from "./core";

const options = { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, signal: AbortSignal.timeout(12000) }) } };
function serverKey() { return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY; }
export function backendReady() { return Boolean(serverKey() && process.env.NEXT_PUBLIC_SUPABASE_URL && (process.env.COMPLAINTS_HASH_SECRET?.length || 0) >= 32 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.COMPLAINTS_TEAM_EMAIL || "")); }
export function mailReady() { return Boolean(process.env.RESEND_API_KEY && process.env.COMPLAINTS_FROM_EMAIL); }
function database() {
  if (!serverKey() || !process.env.NEXT_PUBLIC_SUPABASE_URL) throw new ComplaintError(503, "El registro virtual aún no está habilitado. No se ha registrado ninguna solicitud.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serverKey()!, options);
}
export function jsonResponse(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" } });
}
export function errorResponse(error: unknown) {
  return jsonResponse({ error: error instanceof ComplaintError ? error.message : "No se pudo completar la operación. Conserva tus datos e inténtalo de nuevo." }, error instanceof ComplaintError ? error.status : 503);
}
export async function readBody(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new ComplaintError(415, "Utiliza el formulario de la página.");
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new ComplaintError(403, "Origen de solicitud no permitido.");
  if (Number(request.headers.get("content-length") || 0) > 24000) throw new ComplaintError(413, "El formulario excede el tamaño permitido.");
  // Limitar mientras se lee; no confiar únicamente en Content-Length.
  const reader = request.body?.getReader();
  if (!reader) throw new ComplaintError(400, "Formulario vacío.");
  let bytes = 0; const chunks: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    bytes += value.length; if (bytes > 24000) { await reader.cancel(); throw new ComplaintError(413, "El formulario excede el tamaño permitido."); }
    chunks.push(value);
  }
  try { const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8")); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(); return parsed as Record<string, unknown>; }
  catch { throw new ComplaintError(400, "Formulario inválido."); }
}
export async function submitComplaint(request: Request) {
  const body = await readBody(request);
  const data = validateComplaint(body.form);
  if (body.website) throw new ComplaintError(400, "No se pudo validar el envío.");
  if (typeof body.submission_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.submission_id)) throw new ComplaintError(400, "Identificador de envío inválido.");
  if (!identityReady() || !policiesReady() || !backendReady() || !mailReady()) throw new ComplaintError(503, "El Libro virtual necesita completar su habilitación. Esta solicitud no se ha registrado.");
  const config = legalConfig();
  const provider = { brand: config.brand, ruc: config.ruc, legalName: config.legalName, address: config.address, email: config.email, bookCode: config.bookCode };
  const hash = (value: string) => createHmac("sha256", process.env.COMPLAINTS_HASH_SECRET!).update(value).digest("hex");
  // Vercel sobrescribe este encabezado. En otros proxies se debe configurar una fuente confiable.
  const ip = process.env.VERCEL ? request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || "unknown" : "local";
  const db = database();
  const { data: receipt, error } = await db.rpc("register_complaint", { p_data: data, p_provider: provider,
    p_submission: body.submission_id, p_hash: createHash("sha256").update(JSON.stringify(data)).digest("hex"),
    p_ip_hash: hash(ip), p_document_hash: hash(data.document_type + ":" + data.document_number), p_team: process.env.COMPLAINTS_TEAM_EMAIL });
  if (error || !receipt?.id || !receipt?.created_at) {
    if (error?.message.includes("IDEMPOTENCY_CONFLICT")) throw new ComplaintError(409, "Este envío ya existe con otros datos. Inicia una nueva hoja.");
    if (error?.message.includes("RATE_LIMIT")) throw new ComplaintError(429, "Se recibieron varios envíos recientes. Conserva tu información e inténtalo más tarde o solicita asistencia.");
    throw new ComplaintError(503, "No pudimos confirmar el registro en la base de datos. Conserva tus datos y reintenta con la misma hoja.");
  }
  // La cola se creó en la misma transacción. No presentar aceptación de correo como entrega.
  return { receipt, mailConfigured: mailReady(), notice: receipt.email_status === "accepted"
    ? "Constancia aceptada por el servicio de correo; la entrega no está confirmada."
    : receipt.email_status === "not_requested" ? "Conserva tu constancia. La respuesta se realizará por carta, según tu elección."
      : "La hoja está registrada. El correo de constancia sigue pendiente de envío; descarga o imprime tu copia." };
}
export async function requireAdmin(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) throw new ComplaintError(401, "Inicia sesión para acceder al panel.");
  const db = database();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new ComplaintError(401, "La sesión no es válida.");
  const { data: profile, error: profileError } = await db.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  if (profileError || profile?.role !== "admin") throw new ComplaintError(403, "Acceso reservado al equipo autorizado.");
  return { db, user: data.user };
}
export const detailColumns = "id,full_name,document_number,email,phone,address,claim_type,order_reference,detail,request,status,response,created_at,updated_at,provider_snapshot,document_type,is_minor,representative_name,representative_address,representative_phone,representative_email,item_type,item_description,amount,response_channel,due_date,calendar_version,retained_until";
export function withSheet<T extends { id: number; created_at: string }>(row: T) {
  return { ...row, sheet_number: `KQ-${new Intl.DateTimeFormat("en", { timeZone: "America/Lima", year: "numeric" }).format(new Date(row.created_at))}-${String(row.id).padStart(9,"0")}` };
}
export async function listComplaints(request: Request) {
  const { db } = await requireAdmin(request);
  const params = new URL(request.url).searchParams;
  let query = db.from("complaints_book").select("id,full_name,claim_type,status,created_at,due_date").order("id", { ascending: false }).limit(200);
  const before = params.get("before");
  if (before && /^\d{1,15}$/.test(before)) query = query.lt("id",before);
  const state = params.get("status"); const type = params.get("type");
  if (state && ["new","in_review","answered","closed"].includes(state)) query = query.eq("status",state);
  if (type && ["reclamo","queja"].includes(type)) query = query.eq("claim_type",type);
  for (const [key, operator] of [["from","gte"],["to","lte"]] as const) {
    const value = params.get(key);
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) query = query[operator]("created_at",value + (key === "from" ? "T00:00:00-05:00" : "T23:59:59.999-05:00"));
  }
  const { data, error } = await query;
  if (error) throw new ComplaintError(503, "Reclamaciones no disponibles. Comprueba la migración 006 y la configuración del servidor.");
  return { records: (data || []).map(withSheet), limit: 200, nextCursor: data?.length === 200 ? String(data[data.length-1].id) : null, mailConfigured: mailReady(), cronConfigured: (process.env.CRON_SECRET?.length || 0)>=32, identityConfigured: identityReady(), policiesApproved: policiesReady() };
}
export async function complaintDetail(request: Request, id: string) {
  if (!/^\d{1,15}$/.test(id)) throw new ComplaintError(400, "Referencia inválida.");
  const { db } = await requireAdmin(request);
  const [{ data, error }, events, outbox] = await Promise.all([
    db.from("complaints_book").select(detailColumns).eq("id",id).maybeSingle(),
    db.from("complaint_events").select("id,actor_id,kind,body,evidence,created_at").eq("complaint_id",id).order("id"),
    db.from("complaint_outbox").select("id,event_id,kind,status,attempts,provider_id,last_error,sent_at,next_attempt_at").eq("complaint_id",id).order("id"),
  ]);
  if (error || events.error || outbox.error) throw new ComplaintError(503, "No se pudo consultar el expediente.");
  if (!data) throw new ComplaintError(404, "Hoja no encontrada.");
  return { receipt: withSheet(data), events: events.data || [], outbox: outbox.data || [] };
}
export async function recordAction(request: Request, id: string) {
  if (!/^\d{1,15}$/.test(id)) throw new ComplaintError(400, "Referencia inválida.");
  const body = await readBody(request);
  const { db, user } = await requireAdmin(request);
  if (typeof body.kind !== "string" || typeof body.body !== "string" || !body.body.trim() || body.body.length > 10000 || (body.evidence !== undefined && typeof body.evidence !== "string") || String(body.evidence || "").length>2000) throw new ComplaintError(400, "Completa una actuación válida.");
  if (body.kind === "response" && !mailReady()) throw new ComplaintError(503, "Correo no configurado. No se ha enviado ninguna respuesta.");
  const communicated = body.communicatedAt;
  if (communicated !== undefined && (typeof communicated !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?([+-]\d{2}:\d{2}|Z)$/.test(communicated) || !Number.isFinite(Date.parse(communicated)) || Date.parse(communicated)>Date.now())) throw new ComplaintError(400, "Indica una fecha real de comunicación, con su zona horaria.");
  const { error } = await db.rpc("record_complaint_action", { p_id: Number(id), p_actor: user.id, p_kind: body.kind, p_body: body.body.trim(), p_evidence: JSON.stringify({ reference:String(body.evidence || "").trim(), communicated_at:communicated || null }) });
  if (error) throw new ComplaintError(409, "La actuación no pudo registrarse. Revisa el canal elegido, el estado y la evidencia requerida.");
  return { saved: true, notice: body.kind === "response" ? "Respuesta registrada en la cola. Pendiente de aceptación por el servicio de correo." : "Actuación incorporada al historial." };
}
type Mail = { id: number; complaint_id: number; kind: string; to_email: string; payload: Record<string, unknown>; dedupe_key: string; attempts: number };
export async function sendMail(mail: Mail) {
  if (!mailReady()) throw new ComplaintError(503, "MAIL_NOT_CONFIGURED");
  const sheet = String(mail.payload.sheet_number || mail.complaint_id);
  const html = mail.kind === "receipt" ? receiptHtml(mail.payload as unknown as ComplaintReceipt)
    : mail.kind === "response" ? `<h1>Respuesta a la hoja ${escapeHtml(sheet)}</h1><p style="white-space:pre-wrap">${escapeHtml(mail.payload.body)}</p><p>Puedes manifestar tu disconformidad y acudir a INDECOPI. Esta respuesta no supone tu aceptación de un acuerdo.</p>`
      : `<p>KILLAQ: ${mail.kind === "reminder" ? "atención próxima a vencer o vencida" : "nueva hoja recibida"} ${escapeHtml(sheet)}.</p><p>Fecha límite: ${escapeHtml(mail.payload.due_date || "revisar expediente antiguo")}.</p><p>Consulta el panel administrativo para atenderla. No respondas a este aviso como si fuera el consumidor.</p>`;
  const response = await fetch("https://api.resend.com/emails", { method: "POST", signal: AbortSignal.timeout(10000), headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `killaq-${mail.dedupe_key}` },
    body: JSON.stringify({ from: process.env.COMPLAINTS_FROM_EMAIL, to: [mail.to_email], reply_to: legalConfig().email, subject: `KILLAQ · ${mail.kind === "receipt" ? "Constancia" : mail.kind === "response" ? "Respuesta" : "Atención requerida"} · ${sheet}`, html,
      ...(mail.kind === "receipt" ? { attachments: [{ filename: `hoja-${sheet}.html`, content: Buffer.from(html).toString("base64") }] } : {}) }) });
  if (!response.ok) throw new ComplaintError(503, `MAIL_HTTP_${response.status}`);
  const result = await response.json();
  if (typeof result.id !== "string" || !result.id) throw new ComplaintError(503, "MAIL_INVALID_ACK");
  return result.id as string;
}
export async function processOutbox(caseId?: number) {
  if (!mailReady() || !backendReady()) throw new ComplaintError(503, "Configura el correo y el backend antes de procesar notificaciones.");
  const db = database();
  const reminders = await db.rpc("enqueue_complaint_reminders",{ p_team: process.env.COMPLAINTS_TEAM_EMAIL });
  if (reminders.error) throw new ComplaintError(503, "No se pudieron generar avisos de vencimiento.");
  const { data, error } = await db.rpc("lease_complaint_mail", { p_limit: 5, p_case: caseId || null });
  if (error) throw new ComplaintError(503, "No se pudo procesar la cola.");
  const results = await Promise.all(((data || []) as Mail[]).map(async mail => {
    let providerId: string | null = null; let sendError: string | null = null;
    try { providerId = await sendMail(mail); }
    catch (error) { sendError = error instanceof ComplaintError ? error.message : "MAIL_REQUEST_FAILED"; }
    const result = await db.rpc("complete_complaint_mail", { p_id: mail.id, p_attempt: mail.attempts, p_provider_id: providerId, p_error: sendError });
    return !result.error && !sendError;
  }));
  const accepted = results.filter(Boolean).length; const failed = results.length - accepted;
  return { accepted, failed, reminders: reminders.data, deliveryConfirmed: false };
}
export function verifyCron(request: Request) {
  const expected = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!expected || !provided || expected.length < 32 || Buffer.byteLength(expected) !== Buffer.byteLength(provided) || !timingSafeEqual(Buffer.from(expected),Buffer.from(provided))) throw new ComplaintError(401, "Acceso no autorizado.");
}
