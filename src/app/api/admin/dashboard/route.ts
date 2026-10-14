import {
  authorizeAdmin,
  adminResponse,
  adminFailure,
} from "@/lib/admin/server";
import { limaDate } from "@/lib/complaints/core";
export async function GET(request: Request) {
  try {
    const { db } = await authorizeAdmin(request);
    const today = limaDate(new Date());
    const week = limaDate(new Date(Date.now() + 7 * 86400000));
    const queries = [
      db
        .from("products")
        .select("id", { head: true, count: "exact" })
        .eq("is_active", true),
      db
        .from("products")
        .select("id", { head: true, count: "exact" })
        .eq("is_active", false),
      db
        .from("products")
        .select("id", { head: true, count: "exact" })
        .eq("is_active", true)
        .eq("stock", 0),
      db
        .from("products")
        .select("id", { head: true, count: "exact" })
        .eq("is_active", true)
        .gt("stock", 0)
        .lte("stock", 3),
      db
        .from("complaints_book")
        .select("id", { head: true, count: "exact" })
        .in("status", ["new", "in_review"]),
      db
        .from("products")
        .select("id,product_images()", { head: true, count: "exact" })
        .is("product_images", null),
      db
        .from("products")
        .select("id,name,updated_at,created_at,is_active")
        .order("updated_at", { ascending: false })
        .limit(6),
      db
        .from("complaints_book")
        .select("id,created_at,due_date,status")
        .in("status", ["new", "in_review"])
        .lte("due_date", week)
        .order("due_date")
        .limit(6),
      db
        .from("collections")
        .select("id", { head: true, count: "exact" })
        .eq("is_active", true),
      db
        .from("products")
        .select("id,product_images!inner(id)", { head: true, count: "exact" }),
      db
        .from("products")
        .select("id", { head: true, count: "exact" })
        .gt("price", 0)
        .gte("stock", 0),
      db
        .from("products")
        .select("id,collections!inner(is_active)", {
          head: true,
          count: "exact",
        })
        .eq("collections.is_active", true),
    ];
    const results = await Promise.all(queries);
    const metric = (i: number) => ({
      value: results[i].error ? null : results[i].count,
      error: results[i].error
        ? "No disponible; revisa Supabase y las migraciones."
        : null,
    });
    return adminResponse({
      published: metric(0),
      drafts: metric(1),
      soldOut: metric(2),
      lowStock: metric(3),
      complaints: metric(4),
      noImage: metric(5),
      collections: metric(8),
      withImage: metric(9),
      withInventory: metric(10),
      associated: metric(11),
      recent: results[6].error ? null : results[6].data,
      deadlines: results[7].error ? null : results[7].data,
      today,
      checkedAt: new Date().toISOString(),
      salesConfigured: false,
      ordersConfigured: false,
    });
  } catch (error) {
    return adminFailure(error);
  }
}
