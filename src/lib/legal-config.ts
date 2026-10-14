import "server-only";
import { validRuc, type Provider } from "./complaints/core";
export type LegalConfig = Provider & {
  privacyEmail: string; territory: string; payments: string; invoices: string;
  deliveries: string; personalized: string; voluntaryReturns: string; refunds: string;
  retention: string; processors: string; transfers: string; dataBanks: string;
  effectiveDate: string; approved: boolean; identityVerified: boolean;
};
export function legalConfig(): LegalConfig {
  const base: LegalConfig = { brand: "KILLAQ", ruc: "10714330573", legalName: "", address: "", email: "", bookCode: "WEB-01",
    privacyEmail: "", territory: "", payments: "", invoices: "", deliveries: "", personalized: "", voluntaryReturns: "", refunds: "",
    retention: "", processors: "", transfers: "", dataBanks: "", effectiveDate: "", approved: false, identityVerified: false };
  try {
    const value: unknown = JSON.parse(process.env.KILLAQ_LEGAL_CONFIG || "{}");
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const input = value as Record<string, unknown>;
      for (const key of Object.keys(base)) {
        if (typeof input[key] === typeof base[key as keyof LegalConfig]) Object.assign(base, { [key]: input[key] });
      }
    }
  } catch { /* Invalid configuration keeps publication closed. */ }
  return base;
}
export function identityReady(config = legalConfig()) {
  return config.identityVerified && validRuc(config.ruc) && Boolean(config.legalName.trim() && config.address.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.email));
}
export function policiesReady(config = legalConfig()) {
  return identityReady(config) && config.approved && [config.privacyEmail,config.territory,config.payments,config.invoices,config.deliveries,
    config.personalized,config.voluntaryReturns,config.refunds,config.retention,config.processors,config.transfers,config.dataBanks].every(value => value.trim()) && /^\d{4}-\d{2}-\d{2}$/.test(config.effectiveDate);
}
