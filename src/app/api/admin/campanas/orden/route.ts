import {
  authorizeAdmin,
  adminResponse,
  adminFailure,
  dbFailure,
} from "@/lib/admin/server";
import { AdminError } from "@/lib/admin/validation";
import { readBody } from "@/lib/complaints/server";
export async function POST(request: Request) {
  try {
    const { db } = await authorizeAdmin(request);
    const body = await readBody(request);
    if (
      !Array.isArray(body.ids) ||
      body.ids.length > 1000 ||
      body.ids.some((id) => !Number.isInteger(id) || id <= 0) ||
      new Set(body.ids).size !== body.ids.length
    )
      throw new AdminError(422, "Orden inválido.");
    const result = await db.rpc("admin_reorder_campaigns", {
      p_ids: body.ids,
      p_expected: body.expected,
    });
    dbFailure(result.error);
    return adminResponse({ saved: true });
  } catch (error) {
    return adminFailure(error);
  }
}
