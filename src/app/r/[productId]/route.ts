import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { getProduct } from "@/lib/products";
import { ensureCatalogue } from "@/lib/shops/sync";

// Outbound redirect: records the click, then sends the user to the product page on the shop's site.
// The target always comes from the database, never from the query string.
export async function GET(request: Request, ctx: RouteContext<"/r/[productId]">) {
  await ensureCatalogue();
  const { productId } = await ctx.params;
  const product = getProduct(productId);
  if (!product) return jsonError(404, "not_found", "Product not found.");
  const q = new URL(request.url).searchParams;
  db().prepare("INSERT INTO click_events (id, product_id, design_id, design_item_id) VALUES (?,?,?,?)").run(nanoid(12), productId, q.get("design"), q.get("item"));

  const shop = db().prepare("SELECT affiliate_template FROM shops WHERE id = ?").get(product.shop_id) as { affiliate_template: string | null };
  const absolute = new URL(product.product_url, request.url).toString();
  const target = shop.affiliate_template ? shop.affiliate_template.replace("{url}", absolute) : absolute;
  return Response.redirect(target, 302);
}
