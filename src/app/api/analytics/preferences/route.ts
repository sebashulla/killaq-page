import {
  analyticsFailure,
  preference,
  savePreference,
} from "@/lib/analytics/server";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    return preference(request);
  } catch (error) {
    return analyticsFailure(error);
  }
}
export async function POST(request: Request) {
  try {
    return await savePreference(request);
  } catch (error) {
    return analyticsFailure(error);
  }
}
