import { ensureDb, persistDb } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { MeshError } from "@/lib/mesh/meshy";
import { ensureProductModel, refreshProductModel } from "@/lib/mesh/store";
import { clientIp, rateLimited } from "@/lib/rate-limit";
import { ensureCatalogue } from "@/lib/shops/sync";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(_request: Request, ctx: RouteContext<"/api/products/[productId]/model">) {
  await ensureDb();
  await ensureCatalogue();
  const { productId } = await ctx.params;
  try {
    const model = await refreshProductModel(productId);
    return model ? Response.json({ product_id: productId, model }) : jsonError(404, "not_found", "Product not found.");
  } catch (e) {
    const message = e instanceof MeshError ? e.message : "The 3D model could not be checked.";
    return jsonError(502, "model_failed", message);
  }
}

export async function POST(request: Request, ctx: RouteContext<"/api/products/[productId]/model">) {
  if (rateLimited(`mesh:${clientIp(request)}`, 20, 60 * 60 * 1000)) return jsonError(429, "rate_limited", "Too many 3D model requests. Please try again later.");
  await ensureDb();
  await ensureCatalogue();
  const { productId } = await ctx.params;
  try {
    const model = await ensureProductModel(productId);
    await persistDb();
    return Response.json({ product_id: productId, model });
  } catch (e) {
    if (e instanceof MeshError && e.code === "not_found") return jsonError(404, "not_found", e.message);
    if (e instanceof MeshError && e.code === "rate_limited") return jsonError(429, "rate_limited", e.message);
    const message = e instanceof MeshError ? e.message : "The 3D model could not be created.";
    return jsonError(e instanceof MeshError && e.code === "missing_key" ? 400 : 502, "model_failed", message);
  }
}
