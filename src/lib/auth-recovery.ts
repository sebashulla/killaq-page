export function recoveryRedirect(origin: string) {
  const url = new URL(origin);
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    )
  )
    throw new Error("Utiliza una conexión segura para recuperar tu cuenta.");
  return new URL("/actualizar-contrasena", url.origin).href;
}
export function passwordProblem(password: string, confirmation: string) {
  if (password.length < 8) return "Utiliza al menos 8 caracteres.";
  if (password.length > 128)
    return "La contraseña admite hasta 128 caracteres.";
  if (password !== confirmation) return "Las contraseñas no coinciden.";
  return "";
}
export function recoveryProblem(error: { code?: string; status?: number }) {
  if (
    error.status === 429 ||
    ["over_email_send_rate_limit", "over_request_rate_limit"].includes(
      error.code || "",
    )
  )
    return "Se alcanzó el límite de solicitudes. Espera unos minutos antes de intentarlo de nuevo.";
  if (
    [
      "email_address_not_authorized",
      "unexpected_failure",
      "email_provider_disabled",
    ].includes(error.code || "")
  )
    return "El servicio de correo no pudo procesar la solicitud. Nuestro equipo debe revisar su configuración; vuelve a intentarlo más tarde.";
  return "No pudimos procesar la recuperación. Revisa la conexión y vuelve a intentarlo.";
}
