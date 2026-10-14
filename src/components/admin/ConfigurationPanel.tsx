"use client";
import { useEffect, useState } from "react";
import { adminApi } from "@/lib/admin/client";
import {
  Section,
  Notice,
  Loading,
  Status,
  ActionLink,
  adminStyles as s,
} from "./AdminUI";
export type Configuration = {
  checkedAt: string;
  identity: boolean;
  policies: boolean;
  reviewApproved: boolean;
  effectiveDate: string;
  identityFields: Record<string, string>;
  policyFields: Record<string, string>;
  dependencies: { label: string; available: boolean }[];
  backend: boolean;
  mailConfigured: boolean;
  cronConfigured: boolean;
};
const labels: Record<string, string> = {
  brand: "Marca",
  ruc: "RUC recibido",
  legalName: "Identificación legal",
  address: "Domicilio de atención",
  email: "Correo del negocio",
  privacyEmail: "Canal de privacidad",
  territory: "Destinos de venta",
  payments: "Medios de pago",
  invoices: "Comprobantes",
  deliveries: "Entregas",
  personalized: "Pedidos personalizados",
  voluntaryReturns: "Cambios voluntarios",
  refunds: "Reembolsos",
  retention: "Conservación de datos",
  processors: "Encargados de tratamiento",
  transfers: "Transferencias internacionales",
  dataBanks: "Bancos de datos personales",
};
export default function ConfigurationPanel({
  mode,
}: {
  mode: "negocio" | "legal" | "operativa";
}) {
  const [data, setData] = useState<Configuration | null>(null),
    [error, setError] = useState("");
  async function load() {
    try {
      setData(await adminApi<Configuration>("/api/admin/configuracion"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className={s.editor}>
      <div className={s.toolbar}>
        <p className={s.help}>
          Estado privado de la configuración actual del servidor. Guardar
          contenido de marca no aprueba documentos legales.
        </p>
        <button className={s.secondary} onClick={load}>
          Volver a verificar
        </button>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {!data && !error && <Loading />}
      {data && (
        <>
          {mode === "negocio" && (
            <>
              <Notice>
                La marca comercial no reemplaza la identificación exigible del
                proveedor. El nombre legal y domicilio siguen pendientes de
                resolución y revisión antes de activar documentos definitivos.
              </Notice>
              <Section title="Identificación empresarial">
                <dl className={s.definition}>
                  {Object.entries(data.identityFields).map(([k, v]) => (
                    <div key={k}>
                      <dt>{labels[k]}</dt>
                      <dd>
                        {v || "Pendiente de completar"}
                        {k === "ruc" && (
                          <small className={s.help}>
                            {" "}
                            · proporcionado por el responsable; validación SUNAT
                            pendiente
                          </small>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className={s.statusLine}>
                  Verificación empresarial:{" "}
                  {data.identity ? "configurada como verificada" : "pendiente"}.
                  No se consulta SUNAT automáticamente.
                </p>
              </Section>
              <Section title="Condiciones comerciales por confirmar">
                <dl className={s.definition}>
                  {Object.entries(data.policyFields)
                    .slice(0, 7)
                    .map(([k, v]) => (
                      <div key={k}>
                        <dt>{labels[k]}</dt>
                        <dd>{v || "Pendiente de aprobación comercial"}</dd>
                      </div>
                    ))}
                </dl>
              </Section>
            </>
          )}
          {mode === "legal" && (
            <>
              <Notice>
                Las páginas definitivas permanecen cerradas mientras falten
                identificación, condiciones comerciales y aprobación jurídica.
                Los borradores privados se revisan fuera del sitio público.
              </Notice>
              <Section title="Documentos y publicación">
                <ul className={s.list}>
                  {[
                    ["Términos y condiciones", "/terminos-y-condiciones"],
                    [
                      "Cambios, devoluciones y reembolsos",
                      "/cambios-y-devoluciones",
                    ],
                    ["Política de privacidad", "/politica-de-privacidad"],
                  ].map(([title, url]) => (
                    <li key={url}>
                      <div>
                        {title}
                        <small>
                          {data.policies
                            ? `Versión aprobada · vigencia ${data.effectiveDate}`
                            : "Estructura preparada; no es una política definitiva publicada."}
                        </small>
                      </div>
                      <Status active={data.policies}>
                        {data.policies
                          ? "Publicada"
                          : data.reviewApproved
                            ? "Aprobación declarada; faltan datos"
                            : Object.values(data.policyFields).every(Boolean)
                              ? "Pendiente de revisión"
                              : "Pendiente de completar"}
                      </Status>
                    </li>
                  ))}
                </ul>
                <div className={s.actions}>
                  <ActionLink href="/terminos-y-condiciones">
                    Ver estado público
                  </ActionLink>
                  <ActionLink href="/admin/configuracion/negocio">
                    Revisar datos del negocio
                  </ActionLink>
                </div>
              </Section>
              <Section title="Información jurídica pendiente">
                <dl className={s.definition}>
                  {Object.entries(data.policyFields).map(([k, v]) => (
                    <div key={k}>
                      <dt>{labels[k]}</dt>
                      <dd>
                        {v
                          ? "Información configurada; comprobar su aprobación y exactitud."
                          : "Pendiente de completar"}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Section>
            </>
          )}
          {mode !== "negocio" && (
            <Section
              title="Activación del Libro de Reclamaciones"
              description="La presencia de claves o tablas no demuestra entrega de correos, ejecución del scheduler ni pruebas satisfactorias en producción."
            >
              <ul className={s.list}>
                {[
                  [
                    "Identificación empresarial",
                    data.identity ? "Configurada como verificada" : "Pendiente",
                    data.identity,
                  ],
                  [
                    "Políticas revisadas",
                    data.policies
                      ? "Aprobación y datos configurados"
                      : "Pendiente",
                    data.policies,
                  ],
                  ...data.dependencies.map((d) => [
                    d.label,
                    d.available
                      ? "Estructura detectada"
                      : "Pendiente de aplicación o verificación",
                    d.available,
                  ]),
                  [
                    "Backend de registro",
                    data.backend
                      ? "Credenciales preparadas; verificar operación"
                      : "No habilitado",
                    data.backend,
                  ],
                  [
                    "Correo automático",
                    data.mailConfigured
                      ? "Configurado; entrega pendiente de verificar"
                      : "No configurado",
                    false,
                  ],
                  [
                    "Tareas preventivas",
                    data.cronConfigured
                      ? "Secreto configurado; ejecución pendiente de verificar"
                      : "Scheduler no habilitado",
                    false,
                  ],
                  [
                    "Pruebas de registro y constancia en producción",
                    "Pendientes de validación aislada por el responsable",
                    false,
                  ],
                ].map(([label, status, ready]) => (
                  <li key={String(label)}>
                    <div>
                      {String(label)}
                      <small>{String(status)}</small>
                    </div>
                    <Status active={Boolean(ready)}>
                      {ready ? "Preparado" : "Pendiente"}
                    </Status>
                  </li>
                ))}
              </ul>
              <ActionLink href="/admin/reclamaciones">
                Gestionar expedientes
              </ActionLink>
            </Section>
          )}
          {mode === "operativa" && (
            <Section title="Operación comercial">
              <p className={s.help}>
                Carrito y coordinación por WhatsApp implementados. Pasarela de
                pago, conciliación de ventas y administración de pedidos no
                configuradas.
              </p>
              <p className={s.help}>
                Las migraciones 002 (permisos) y 003 (base antigua del Libro) no
                se certifican solo por detectar una tabla. Revisa el SQL
                aplicado y realiza pruebas de RLS antes del lanzamiento.
              </p>
            </Section>
          )}
          <p className={s.statusLine}>
            Verificación de estructura:{" "}
            {new Date(data.checkedAt).toLocaleString("es-PE", {
              timeZone: "America/Lima",
            })}
            . Cambios jurídicos: revisión privada y configuración explícita de
            KILLAQ_LEGAL_CONFIG, sin autosave.
          </p>
        </>
      )}
    </div>
  );
}
