import { authorizeAdmin } from "@/lib/admin/server";
import { analyticsReport } from "@/lib/analytics/report";
import { analyticsFailure, analyticsResponse } from "@/lib/analytics/server";
import { AdminError } from "@/lib/admin/validation";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  try {
    const admin = await authorizeAdmin(request);
    return analyticsResponse(await analyticsReport(request, admin));
  } catch (error) {
    if (error instanceof AdminError)
      return analyticsResponse({ error: error.message }, error.status);
    return analyticsFailure(error);
  }
}
