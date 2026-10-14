import { after } from "next/server";
import { complaintDetail, errorResponse, jsonResponse, recordAction, processOutbox } from "@/lib/complaints/server";
export const runtime = "nodejs";
export const maxDuration = 60;
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  try { return jsonResponse(await complaintDetail(request,(await context.params).id)); } catch (error) { return errorResponse(error); }
}
export async function POST(request: Request, context: Context) {
  try { const id = (await context.params).id; const result = await recordAction(request,id); after(async () => { try { await processOutbox(Number(id)); } catch { /* Persistent queue; cron and administrators can retry. */ } }); return jsonResponse(result); } catch (error) { return errorResponse(error); }
}
