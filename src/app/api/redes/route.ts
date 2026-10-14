import { getSocialFeed } from "@/lib/social-server";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function GET() {
  return Response.json(await getSocialFeed(), {
    headers: {
      "Cache-Control":
        "public, max-age=0, s-maxage=60, stale-while-revalidate=60",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
