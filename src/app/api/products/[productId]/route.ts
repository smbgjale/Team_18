import { ensureDb } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { getProduct, toProductDto } from "@/lib/products";
import { ensureCatalogue } from "@/lib/shops/sync";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: RouteContext<"/api/products/[productId]">) {
  await ensureDb();
  await ensureCatalogue();
  const { productId } = await ctx.params;
  const p = getProduct(productId);
  return p ? Response.json(toProductDto(p)) : jsonError(404, "not_found", "Product not found.");
}
