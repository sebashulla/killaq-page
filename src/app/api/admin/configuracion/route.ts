import {
  authorizeAdmin,
  adminResponse,
  adminFailure,
} from "@/lib/admin/server";
import { identityReady, policiesReady, legalConfig } from "@/lib/legal-config";
import { backendReady, mailReady } from "@/lib/complaints/server";
export async function GET(request: Request) {
  try {
    const { db } = await authorizeAdmin(request);
    const config = legalConfig();
    const probes = [
      ["001 · Multimedia", "social_videos", "id"],
      ["004 · Fondos de campaña", "hero_slides", "background_style"],
      ["005 · Clasificación", "site_settings", "value"],
      ["006 · Libro seguro", "complaint_events", "id"],
    ] as const;
    const results = await Promise.all(
      probes.map(([, table, field]) =>
        db.from(table).select(field, { count: "exact", head: true }).limit(1),
      ),
    );
    const rpc = await db.rpc("admin_capabilities");
    const storefront = await db
      .from("site_settings")
      .select("value")
      .eq("key", "storefront")
      .maybeSingle();
    return adminResponse({
      checkedAt: new Date().toISOString(),
      identity: identityReady(config),
      policies: policiesReady(config),
      reviewApproved: config.approved,
      effectiveDate: config.effectiveDate,
      identityFields: {
        brand: config.brand,
        ruc: config.ruc,
        legalName: config.legalName,
        address: config.address,
        email: config.email,
        privacyEmail: config.privacyEmail,
      },
      policyFields: {
        territory: config.territory,
        payments: config.payments,
        invoices: config.invoices,
        deliveries: config.deliveries,
        personalized: config.personalized,
        voluntaryReturns: config.voluntaryReturns,
        refunds: config.refunds,
        retention: config.retention,
        processors: config.processors,
        transfers: config.transfers,
        dataBanks: config.dataBanks,
      },
      dependencies: probes
        .map(([label], i) => ({
          label: String(label),
          available: !results[i].error,
          ...(i === 2
            ? {
                available:
                  !storefront.error &&
                  storefront.data?.value?.catalog_version === 5,
              }
            : {}),
        }))
        .concat([
          {
            label: "007 · Guardado atómico",
            available: !rpc.error && rpc.data?.version === 7,
          },
        ]),
      backend: backendReady(),
      mailConfigured: mailReady(),
      cronConfigured: (process.env.CRON_SECRET?.length || 0) >= 32,
      schedulerVerified: false,
      productionReceiptVerified: false,
      mailDeliveryVerified: false,
      ordersConfigured: false,
      salesConfigured: false,
    });
  } catch (error) {
    return adminFailure(error);
  }
}
