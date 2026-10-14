import { analyticsFailure, receiveEvents } from "@/lib/analytics/server";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    return await receiveEvents(request);
  } catch (error) {
    return analyticsFailure(error);
  }
}
