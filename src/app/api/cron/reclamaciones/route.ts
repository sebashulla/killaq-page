import { errorResponse, jsonResponse, processOutbox, verifyCron } from "@/lib/complaints/server";
export const maxDuration = 60;
// GET es exclusivo del scheduler Vercel, autenticado por secreto y nunca enlazado en la web.
export async function GET(request: Request) {
  try { verifyCron(request); const result = await processOutbox(); return jsonResponse(result,result.failed ? 503 : 200); } catch (error) { return errorResponse(error); }
}
