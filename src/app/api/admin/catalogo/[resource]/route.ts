import {
  authorizeAdmin,
  adminResponse,
  adminFailure,
  dbFailure,
} from "@/lib/admin/server";
import { AdminError, validateResource } from "@/lib/admin/validation";
import { readBody } from "@/lib/complaints/server";
const tables: Record<string, string> = {
  productos: "products",
  colecciones: "collections",
  campanas: "hero_slides",
  videos: "social_videos",
};
function table(resource: string) {
  if (!tables[resource]) throw new AdminError(404, "Sección no disponible.");
  return tables[resource];
}
export async function GET(
  request: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  try {
    const { resource } = await params;
    const { db } = await authorizeAdmin(request);
    const target = table(resource);
    const p = new URL(request.url).searchParams;
    const page = Math.floor(
      Math.max(0, Math.min(100000, Number(p.get("page")) || 0)),
    );
    let query = db
      .from(target)
      .select(
        resource === "productos"
          ? "*,categories(name),collections(name,is_active),materials(name),product_images(id,url,alt_text,sort_order)"
          : "*",
        { count: "exact" },
      );
    const search = (p.get("q") || "").slice(0, 100).replace(/[%,_()]/g, "");
    if (search)
      query = query.ilike(
        resource === "productos" || resource === "colecciones"
          ? "name"
          : "title",
        `%${search}%`,
      );
    if (["true", "false"].includes(p.get("active") || ""))
      query = query.eq("is_active", p.get("active") === "true");
    if (resource === "productos") {
      if (/^\d+$/.test(p.get("category") || ""))
        query = query.eq("category_id", p.get("category"));
      if (p.get("stock") === "empty") query = query.eq("stock", 0);
      if (p.get("stock") === "low")
        query = query.gt("stock", 0).lte("stock", 3);
      if (p.get("stock") === "noimage") {
        query = query.is("product_images", null);
      }
    }
    const sort = p.get("sort");
    const order =
      resource === "productos"
        ? sort === "name"
          ? "name"
          : sort === "price"
            ? "price"
            : "updated_at"
        : "sort_order";
    const result = await query
      .order(order, { ascending: order !== "updated_at" })
      .order("id", { ascending: true })
      .range(page * 20, page * 20 + 19);
    dbFailure(result.error);
    let rows = (result.data || []) as unknown as (Record<string, unknown> & {
      id: string | number;
    })[];
    let videoError = "";
    if (resource === "productos" && rows.length) {
      const videos = await db
        .from("product_videos")
        .select("*")
        .in(
          "product_id",
          rows.map((x) => x.id),
        )
        .order("sort_order");
      if (videos.error)
        videoError =
          "Videos de producto no disponibles: revisa 001_restore_media.sql.";
      rows = rows.map((x) => ({
        ...x,
        product_videos: videos.data?.filter((v) => v.product_id === x.id) || [],
      }));
    }
    return adminResponse({ rows, total: result.count, page, videoError });
  } catch (error) {
    return adminFailure(error);
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  try {
    const { resource } = await params;
    const target = table(resource);
    const { db } = await authorizeAdmin(request);
    const body = await readBody(request);
    if (!body.data || typeof body.data !== "object" || Array.isArray(body.data))
      throw new AdminError(400, "Formulario inválido.");
    const data = validateResource(
      resource,
      body.data as Record<string, unknown>,
    );
    const id = body.id ?? null;
    if (
      id !== null &&
      (resource === "productos"
        ? !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(String(id))
        : !/^\d+$/.test(String(id)))
    )
      throw new AdminError(400, "Identificador inválido.");
    if (resource === "productos") {
      const result = await db.rpc("admin_save_product", {
        p_id: id,
        p_data: data,
        p_expected: body.expected || null,
      });
      dbFailure(result.error);
      return adminResponse({ id: result.data });
    }
    const result = id
      ? await db.from(target).update(data).eq("id", id).select("id").single()
      : await db.from(target).insert(data).select("id").single();
    dbFailure(result.error);
    if (!result.data)
      throw new AdminError(409, "El registro ya no está disponible.");
    return adminResponse(result.data);
  } catch (error) {
    return adminFailure(error);
  }
}
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  try {
    const { resource } = await params;
    const { db } = await authorizeAdmin(request);
    const body = await readBody(request);
    if (!body.id) throw new AdminError(400, "Identificador requerido.");
    const result = await db
      .from(table(resource))
      .delete()
      .eq("id", body.id)
      .select("id")
      .single();
    dbFailure(result.error);
    return adminResponse({ deleted: true });
  } catch (error) {
    return adminFailure(error);
  }
}
