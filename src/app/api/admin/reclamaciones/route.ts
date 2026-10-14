import { errorResponse, jsonResponse, listComplaints } from "@/lib/complaints/server";
export async function GET(request: Request) {
  try { return jsonResponse(await listComplaints(request)); } catch (error) { return errorResponse(error); }
}
