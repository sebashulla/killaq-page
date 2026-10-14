"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import {
  escapeHtml,
  limaDate,
  receiptHtml,
  type ComplaintReceipt,
} from "@/lib/complaints/core";
import Link from "next/link";
import {
  Section,
  Notice,
  Empty,
  Field,
  Status,
  useDirtyGuard,
  adminStyles as s,
} from "@/components/admin/AdminUI";
type RecordRow = {
  id: number;
  sheet_number: string;
  full_name: string;
  status: string;
  claim_type: string;
  due_date: string | null;
  created_at: string;
};
type EventRow = {
  id: number;
  kind: string;
  body: string;
  evidence: Record<string, unknown>;
  created_at: string;
};
type OutboxRow = {
  id: number;
  event_id: number | null;
  kind: string;
  status: string;
  attempts: number;
  provider_id: string | null;
  last_error: string | null;
  sent_at: string | null;
};
type Case = {
  receipt: ComplaintReceipt;
  events: EventRow[];
  outbox: OutboxRow[];
};
const labels: Record<string, string> = {
  new: "Recibida",
  in_review: "En revisión",
  answered: "Respondida",
  closed: "Cerrada",
};
const fields: Record<string, string> = {
  full_name: "Consumidor",
  document_type: "Tipo de documento",
  document_number: "Documento",
  email: "Correo",
  phone: "Teléfono",
  address: "Domicilio",
  claim_type: "Tipo de solicitud",
  order_reference: "Referencia del pedido",
  detail: "Descripción original",
  request: "Pedido original",
  response: "Respuesta antigua conservada",
  created_at: "Recepción",
  provider_snapshot: "Proveedor al presentar la hoja",
  is_minor: "Menor de edad",
  representative_name: "Representante",
  representative_address: "Domicilio del representante",
  representative_phone: "Teléfono del representante",
  representative_email: "Correo del representante",
  item_type: "Producto o servicio",
  item_description: "Descripción del bien",
  amount: "Monto reclamado (S/)",
  response_channel: "Canal elegido",
  due_date: "Vencimiento general",
  retained_until: "Conservación mínima hasta",
};
const events: Record<string, string> = {
  received: "Recepción",
  note: "Nota interna",
  review: "Revisión",
  response: "Respuesta por correo",
  postal_response: "Respuesta por carta",
  delivery_evidence: "Evidencia de recepción",
  close: "Cierre",
  mail_accepted: "Aceptación del servicio de correo",
  mail_failed: "Correo pendiente de reintento",
};
async function api(path: string, body?: unknown) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Inicia sesión para acceder al expediente.");
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "No se pudo completar la operación.");
  return result;
}
function download(data: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export default function Page() {
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [selected, setSelected] = useState<Case | null>(null);
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [before, setBefore] = useState("");
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [configuration, setConfiguration] = useState({
    mailConfigured: false,
    cronConfigured: false,
    identityConfigured: false,
    policiesApproved: false,
  });
  const loadGeneration = useRef(0);
  const [kind, setKind] = useState("note");
  const [body, setBody] = useState("");
  const [evidence, setEvidence] = useState("");
  const [communicatedAt, setCommunicatedAt] = useState("");
  const load = useCallback(async () => {
    const generation = ++loadGeneration.current;
    try {
      const result = await api(
        `/api/admin/reclamaciones?${new URLSearchParams({ status, type, from, to, before })}`,
      );
      if (generation !== loadGeneration.current) return;
      setRecords(result.records);
      setNext(result.nextCursor);
      setConfiguration(result);
      setError("");
    } catch (error) {
      if (generation === loadGeneration.current)
        setError(
          error instanceof Error
            ? error.message
            : "No se pudo cargar el Libro.",
        );
    }
  }, [status, type, from, to, before]);
  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);
  async function open(id: number) {
    setBusy(true);
    try {
      setSelected(await api(`/api/admin/reclamaciones/${id}`));
      setError("");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "No se pudo abrir la hoja.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function action(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || busy) return;
    if (
      ["response", "postal_response", "close"].includes(kind) &&
      !confirm(
        kind === "close"
          ? "¿Cerrar el expediente tras la respuesta registrada?"
          : "¿Registrar esta respuesta escrita para el consumidor? Revisa el contenido y el canal.",
      )
    )
      return;
    setBusy(true);
    setNotice("");
    try {
      const result = await api(
        `/api/admin/reclamaciones/${selected.receipt.id}`,
        {
          kind,
          body,
          evidence,
          ...(communicatedAt
            ? { communicatedAt: communicatedAt + "-05:00" }
            : {}),
        },
      );
      setNotice(result.notice);
      setBody("");
      setEvidence("");
      setCommunicatedAt("");
      await open(selected.receipt.id);
      await load();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "No se pudo registrar la actuación.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function process() {
    setBusy(true);
    try {
      const result = await api("/api/admin/reclamaciones/procesar", {});
      setNotice(
        `${result.accepted} correos aceptados; ${result.failed} pendientes. La aceptación no certifica entrega ni lectura.`,
      );
      if (selected) await open(selected.receipt.id);
      await load();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Procesamiento pendiente.",
      );
    } finally {
      setBusy(false);
    }
  }
  function exportSheet() {
    if (!selected?.receipt.provider_snapshot) return;
    const events = selected.events
      .map(
        (event) =>
          `<h3>${escapeHtml(event.kind)} · ${escapeHtml(event.created_at)}</h3><p style="white-space:pre-wrap">${escapeHtml(event.body)}</p><p>Evidencia: ${escapeHtml(JSON.stringify(event.evidence))}</p>`,
      )
      .join("");
    const response = selected.events
      .filter(
        (event) =>
          event.kind === "response" || event.kind === "postal_response",
      )
      .at(-1);
    const mail =
      response &&
      selected.outbox.find(
        (mail) => mail.event_id === response.id && mail.status === "sent",
      );
    const communication =
      response?.kind === "postal_response"
        ? String(response.evidence.communicated_at || "")
        : mail?.sent_at;
    const html = receiptHtml(
      selected.receipt,
      "Proveedor / INDECOPI, cuando sea requerido",
      response
        ? {
            body: response.body,
            communicatedAt: communication || null,
            emailAccepted: Boolean(mail),
          }
        : undefined,
    ).replace(
      "</body>",
      `<h2>Historial de actuaciones del proveedor</h2>${events}</body>`,
    );
    download(
      html,
      `expediente-${selected.receipt.sheet_number}.html`,
      "text/html;charset=utf-8",
    );
  }
  const [tab, setTab] = useState("original");
  useDirtyGuard(Boolean(selected && (body || evidence || communicatedAt)));
  const today = limaDate(new Date());
  const back = () => {
    if (
      (body || evidence || communicatedAt) &&
      !confirm("¿Descartar la actuación sin guardar?")
    )
      return;
    setSelected(null);
    setBody("");
    setEvidence("");
    setCommunicatedAt("");
    setTab("original");
  };
  return (
    <div>
      <div className={s.toolbar}>
        <p className={s.help}>
          Hojas originales, respuestas escritas y seguimiento de cada
          expediente.
        </p>
        <Link className={s.secondary} href="/admin/configuracion/legal">
          Estado de activación
        </Link>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {notice && <Notice tone="success">{notice}</Notice>}
      <Section
        title="Habilitación y seguimiento"
        description="Estos indicadores representan configuración, no pruebas de entrega ni de operación en producción."
      >
        <div className={s.grid}>
          <p className={s.help}>
            Identificación:{" "}
            {configuration.identityConfigured ? "configurada" : "pendiente"}.
            Políticas:{" "}
            {configuration.policiesApproved ? "aprobadas" : "pendientes"}.
          </p>
          <p className={s.help}>
            Correo:{" "}
            {configuration.mailConfigured
              ? "configurado; verificar envíos"
              : "no configurado"}
            . Scheduler:{" "}
            {configuration.cronConfigured
              ? "secreto preparado; verificar ejecuciones en Vercel"
              : "no habilitado"}
            .
          </p>
        </div>
        <p className={s.statusLine}>
          El cron procesa avisos desde siete días calendario antes del
          vencimiento. Revisa también las fallas cada día. Un caso antiguo sin
          fecha límite exige revisión manual.
        </p>
        <button
          className={s.secondary}
          type="button"
          disabled={busy || !configuration.mailConfigured}
          onClick={process}
        >
          Procesar correos y avisos pendientes
        </button>
      </Section>
      {!selected ? (
        <>
          <form
            className={s.filters}
            onSubmit={(event) => {
              event.preventDefault();
              void load();
            }}
          >
            <Field label="Estado">
              {(id) => (
                <select
                  id={id}
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value);
                    setBefore("");
                  }}
                >
                  <option value="">Todos</option>
                  {Object.entries(labels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Tipo">
              {(id) => (
                <select
                  id={id}
                  value={type}
                  onChange={(event) => {
                    setType(event.target.value);
                    setBefore("");
                  }}
                >
                  <option value="">Todos</option>
                  <option value="reclamo">Reclamo</option>
                  <option value="queja">Queja</option>
                </select>
              )}
            </Field>
            <Field label="Desde">
              {(id) => (
                <input
                  id={id}
                  type="date"
                  value={from}
                  onChange={(event) => {
                    setFrom(event.target.value);
                    setBefore("");
                  }}
                />
              )}
            </Field>
            <Field label="Hasta">
              {(id) => (
                <input
                  id={id}
                  type="date"
                  value={to}
                  onChange={(event) => {
                    setTo(event.target.value);
                    setBefore("");
                  }}
                />
              )}
            </Field>
            <button className={s.secondary} type="submit">
              Actualizar solicitudes
            </button>
          </form>
          {records.length > 0 ? (
            <div
              className={s.tableWrap}
              tabIndex={0}
              role="region"
              aria-label="Solicitudes recibidas"
            >
              <table className={s.table}>
                <caption className={s.statusLine}>
                  Hojas de reclamación · hasta 200 por página
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Hoja / consumidor</th>
                    <th scope="col">Recepción</th>
                    <th scope="col">Tipo</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Límite de respuesta</th>
                    <th scope="col">Expediente</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id}>
                      <td>
                        <strong>{record.sheet_number}</strong>
                        <small>{record.full_name}</small>
                      </td>
                      <td>
                        {new Date(record.created_at).toLocaleDateString(
                          "es-PE",
                          { timeZone: "America/Lima" },
                        )}
                      </td>
                      <td>{record.claim_type}</td>
                      <td>
                        <Status
                          active={
                            record.status === "closed" ||
                            record.status === "answered"
                          }
                        >
                          {labels[record.status]}
                        </Status>
                      </td>
                      <td
                        className={
                          record.due_date &&
                          record.due_date < today &&
                          ["new", "in_review"].includes(record.status)
                            ? s.overdue
                            : undefined
                        }
                      >
                        {record.due_date || "Revisar hoja antigua"}
                        {record.due_date &&
                        record.due_date < today &&
                        ["new", "in_review"].includes(record.status)
                          ? " · vencida"
                          : ""}
                      </td>
                      <td>
                        <button
                          className={s.secondary}
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setTab("original");
                            void open(record.id);
                          }}
                        >
                          Abrir {record.id}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title={
                error
                  ? "Las solicitudes no están disponibles."
                  : "Sin solicitudes cargadas."
              }
              action={
                <Link
                  className={s.secondary}
                  href="/admin/configuracion/operativa"
                >
                  Revisar habilitación
                </Link>
              }
            >
              {error
                ? "La consulta falló. Esto no significa que el Libro esté vacío; conserva el seguimiento por los canales vigentes."
                : "Si el Libro está habilitado, aquí aparecerán las hojas recibidas. Ajusta los filtros para consultar otro periodo."}
            </Empty>
          )}
          <div className={s.pagination}>
            {before && (
              <button
                className={s.secondary}
                type="button"
                onClick={() => setBefore("")}
              >
                Volver a las recientes
              </button>
            )}
            {next && (
              <button
                className={s.secondary}
                type="button"
                onClick={() => setBefore(next)}
              >
                Ver hojas anteriores
              </button>
            )}
          </div>
        </>
      ) : (
        <div className={s.editor}>
          <div className={s.toolbar}>
            <div>
              <p className={s.eyebrow}>Expediente privado</p>
              <h2 className={s.contentTitle}>
                {selected.receipt.sheet_number}
              </h2>
              <p className={s.help}>
                {labels[selected.receipt.status]} · límite general{" "}
                {selected.receipt.due_date || "pendiente de revisar"}
              </p>
            </div>
            <button
              type="button"
              className={s.secondary}
              disabled={busy}
              onClick={back}
            >
              Volver a solicitudes
            </button>
          </div>
          <div className={s.actions}>
            <button
              className={s.secondary}
              type="button"
              disabled={!selected.receipt.provider_snapshot}
              onClick={exportSheet}
            >
              Descargar hoja e historial
            </button>
            <button
              className={s.secondary}
              type="button"
              onClick={() =>
                download(
                  JSON.stringify(selected, null, 2),
                  `${selected.receipt.sheet_number}.json`,
                  "application/json",
                )
              }
            >
              Exportar expediente JSON
            </button>
          </div>
          <p className={s.statusLine}>
            Datos personales de acceso restringido. Conserva las exportaciones
            en almacenamiento privado autorizado.
          </p>
          <div className={s.tabs} aria-label="Secciones del expediente">
            {[
              ["original", "Solicitud original"],
              ["history", "Línea de tiempo"],
              ["mail", "Evidencia de envío"],
              ["action", "Registrar actuación"],
            ].map(([value, label]) => (
              <button
                type="button"
                key={value}
                className={s.secondary}
                aria-pressed={tab === value}
                onClick={() => setTab(value)}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === "original" && (
            <Section title="Información original · inmutable">
              <dl className={s.definition}>
                {Object.entries(selected.receipt)
                  .filter(([key]) => fields[key])
                  .map(([key, value]) => (
                    <div key={key}>
                      <dt>{fields[key]}</dt>
                      <dd style={{ whiteSpace: "pre-wrap" }}>
                        {typeof value === "boolean"
                          ? value
                            ? "Sí"
                            : "No"
                          : typeof value === "object" && value
                            ? Object.values(value).join(" · ")
                            : String(value ?? "No consignado")}
                      </dd>
                    </div>
                  ))}
              </dl>
            </Section>
          )}
          {tab === "history" && (
            <Section title="Actuaciones, respuestas y estados">
              <ol className={s.timeline}>
                {selected.events.map((event) => (
                  <li key={event.id}>
                    <strong>{events[event.kind] || event.kind}</strong>
                    <time>
                      {new Date(event.created_at).toLocaleString("es-PE", {
                        timeZone: "America/Lima",
                      })}
                    </time>
                    <p>{event.body}</p>
                    <small>
                      Referencia de evidencia: {JSON.stringify(event.evidence)}
                    </small>
                  </li>
                ))}
              </ol>
            </Section>
          )}
          {tab === "mail" && (
            <Section title="Evidencia de envío">
              <Notice>
                La aceptación del proveedor de correo no certifica entrega ni
                lectura. Registra evidencia adicional cuando corresponda.
              </Notice>
              {selected.outbox.length ? (
                <ul className={s.list}>
                  {selected.outbox.map((mail) => (
                    <li key={mail.id}>
                      <div>
                        {mail.kind} · {mail.status}
                        <small>
                          Intentos: {mail.attempts} · referencia{" "}
                          {mail.provider_id || "pendiente"}
                          {mail.sent_at ? ` · aceptado ${mail.sent_at}` : ""}
                          {mail.last_error ? ` · ${mail.last_error}` : ""}
                        </small>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={s.help}>
                  No hay registros de correo en este expediente.
                </p>
              )}
            </Section>
          )}
          {tab === "action" && (
            <Section title="Nueva actuación">
              <form onSubmit={action}>
                <Field label="Tipo de actuación">
                  {(id) => (
                    <select
                      id={id}
                      value={kind}
                      onChange={(event) => setKind(event.target.value)}
                    >
                      <option value="note">
                        Nota interna · no se envía al consumidor
                      </option>
                      <option value="review">Iniciar revisión</option>
                      <option value="response">
                        Respuesta escrita por correo · encolar envío
                      </option>
                      <option value="postal_response">
                        Respuesta por carta · requiere evidencia
                      </option>
                      <option value="delivery_evidence">
                        Evidencia de entrega / recepción
                      </option>
                      <option value="close">Cerrar tras la respuesta</option>
                    </select>
                  )}
                </Field>
                <Notice>
                  {kind === "response"
                    ? "Este contenido se incorporará a la respuesta escrita que recibirá el consumidor por correo."
                    : kind === "postal_response"
                      ? "Registra la carta realmente comunicada, su referencia privada y fecha. No genera un envío postal."
                      : "Actuación interna del expediente. Una nota no equivale a responder al consumidor."}
                </Notice>
                <Field
                  label={
                    kind === "response" || kind === "postal_response"
                      ? "Respuesta escrita al consumidor"
                      : "Contenido de la actuación"
                  }
                >
                  {(id) => (
                    <textarea
                      id={id}
                      required
                      maxLength={10000}
                      rows={6}
                      value={body}
                      onChange={(event) => setBody(event.target.value)}
                    />
                  )}
                </Field>
                <div className={s.grid}>
                  <Field
                    label="Referencia privada de evidencia"
                    help="No pegues enlaces públicos que expongan documentos personales."
                  >
                    {(id) => (
                      <input
                        id={id}
                        maxLength={2000}
                        required={
                          kind === "postal_response" ||
                          kind === "delivery_evidence"
                        }
                        value={evidence}
                        onChange={(event) => setEvidence(event.target.value)}
                      />
                    )}
                  </Field>
                  {kind === "postal_response" && (
                    <Field label="Fecha y hora real de comunicación (Perú)">
                      {(id) => (
                        <input
                          id={id}
                          type="datetime-local"
                          required
                          value={communicatedAt}
                          onChange={(event) =>
                            setCommunicatedAt(event.target.value)
                          }
                        />
                      )}
                    </Field>
                  )}
                </div>
                <p className={s.statusLine}>
                  Una propuesta no representa aceptación del consumidor ni
                  amplía automáticamente el plazo. Las actuaciones conservan la
                  solicitud original.
                </p>
                <button className={s.primary} type="submit" disabled={busy}>
                  {busy ? "Registrando…" : "Registrar actuación"}
                </button>
              </form>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}
