import { after } from "next/server";
import { errorResponse, jsonResponse, processOutbox, submitComplaint } from "@/lib/complaints/server";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try { const result = await submitComplaint(request); after(async () => { try { await processOutbox(result.receipt.id); } catch { /* Cola persistida: el scheduler reintenta. */ } }); return jsonResponse(result,201); }
  catch (error) { return errorResponse(error); }
}
