// Reserved SKU prefix for explicitly labelled, noncommercial digital samples.
export function isDemoProduct(sku?: string | null) {
  return typeof sku === "string" && sku.startsWith("KILLAQ-DEMO-");
}
