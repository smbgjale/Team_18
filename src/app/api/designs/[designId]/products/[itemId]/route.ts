import { z } from "zod";
import { COMPATIBLE, type Category } from "@/lib/categories";
import { db } from "@/lib/db";
import { getDesign, listDesignProducts } from "@/lib/designs";
import { jsonError } from "@/lib/http";
import { getProduct } from "@/lib/products";
import { clientIp, rateLimited } from "@/lib/rate-limit";

const body = z.object({ product_id: z.string().min(1).max(40) });

// Replaces the product used for one furniture slot of a design (e.g. "use this sofa instead").
export async function PATCH(request: Request, ctx: RouteContext<"/api/designs/[designId]/products/[itemId]">) {
  const { designId, itemId } = await ctx.params;
  if (rateLimited(`swap:${clientIp(request)}`, 120, 60 * 60 * 1000)) return jsonError(429, "rate_limited", "Too many changes. Please wait a moment.");
  const design = getDesign(designId);
  if (!design) return jsonError(404, "not_found", "Design not found.");
  const item = listDesignProducts(designId).find((i) => i.id === itemId);
  if (!item) return jsonError(404, "not_found", "This product is not part of the design.");
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "invalid_request", "product_id is required.");
  const product = getProduct(parsed.data.product_id);
  const allowed = [item.category, ...(COMPATIBLE[item.category] ?? [])] as Category[];
  if (!product || !allowed.includes(product.category as Category)) return jsonError(400, "invalid_product", "Choose a product from the same category.");
  if (product.availability === "out_of_stock") return jsonError(400, "out_of_stock", "That product is out of stock.");
  db().prepare("UPDATE design_products SET product_id = ?, replaced_after_render = 1 WHERE id = ?").run(product.id, item.id);
  return Response.json({ ok: true });
}
