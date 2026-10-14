import { errorResponse, jsonResponse, processOutbox, requireAdmin } from "@/lib/complaints/server";
export const maxDuration = 60;
export async function POST(request: Request) {
  try { await requireAdmin(request); const result = await processOutbox(); return jsonResponse(result,result.failed ? 503 : 200); } catch (error) { return errorResponse(error); }
}
