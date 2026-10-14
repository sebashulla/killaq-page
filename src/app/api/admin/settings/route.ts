import {
  authorizeAdmin,
  adminResponse,
  adminFailure,
  dbFailure,
} from "@/lib/admin/server";
import { validateSettings } from "@/lib/admin/validation";
import { AdminError } from "@/lib/admin/validation";
import { readBody } from "@/lib/complaints/server";
export async function GET(request: Request) {
  try {
    const { db } = await authorizeAdmin(request);
    const results = await Promise.all([
      db
        .from("site_settings")
        .select("value,updated_at")
        .eq("key", "storefront")
        .maybeSingle(),
      db.from("categories").select("id,name").order("sort_order"),
      db
        .from("subcategories")
        .select("id,name,category_id")
        .eq("is_active", true)
        .order("sort_order"),
      db.from("materials").select("id,name").order("sort_order"),
      db.from("collections").select("*").order("sort_order"),
    ]);
    for (const result of results) dbFailure(result.error);
    return adminResponse({
      settings: results[0].data,
      categories: results[1].data,
      subcategories: results[2].data,
      materials: results[3].data,
      collections: results[4].data,
    });
  } catch (error) {
    return adminFailure(error);
  }
}
export async function POST(request: Request) {
  try {
    const { db } = await authorizeAdmin(request);
    const body = await readBody(request);
    if (!body.data || typeof body.data !== "object" || Array.isArray(body.data))
      throw new AdminError(400, "Formulario inválido.");
    const data = validateSettings(
      body.section,
      body.data as Record<string, unknown>,
    );
    const result = await db.rpc("admin_merge_storefront", {
      p_section: body.section,
      p_patch: data,
      p_expected: body.expected || null,
    });
    dbFailure(result.error);
    return adminResponse({ saved: true });
  } catch (error) {
    return adminFailure(error);
  }
}
