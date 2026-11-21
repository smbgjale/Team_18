import { z } from "zod";
import { ensureDb, persistDb } from "@/lib/db";
import { listDesignProducts, getDesign } from "@/lib/designs";
import type { ProductRow } from "@/lib/products";
import { jsonError } from "@/lib/http";
import { MeshError } from "@/lib/mesh/meshy";
import { ensureProductModel, refreshProductModel } from "@/lib/mesh/store";
import type { ProductModelDto } from "@/lib/api-types";
import { clientIp, rateLimited } from "@/lib/rate-limit";
import { ensureCatalogue } from "@/lib/shops/sync";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_MODELS = 12;

const bodySchema = z.object({
  product_ids: z.array(z.string().min(1).max(80)).max(MAX_MODELS).optional(),
});

async function chosen(designId: string) {
  const design = getDesign(designId);
  if (!design) return null;
  const seen = new Set<string>();
  const products: ProductRow[] = [];
  for (const row of listDesignProducts(designId)) {
    if (seen.has(row.product_id)) continue;
    seen.add(row.product_id);
    products.push(row.product);
  }
  return products;
}

export async function GET(_request: Request, ctx: RouteContext<"/api/designs/[designId]/models">) {
  await ensureDb();
  await ensureCatalogue();
  const { designId } = await ctx.params;
  const products = await chosen(designId);
  if (!products) return jsonError(404, "not_found", "Design not found.");
  const items: { product_id: string; model: ProductModelDto }[] = [];
  for (const product of products) {
    const model = await refreshProductModel(product.id);
    if (model) items.push({ product_id: product.id, model });
  }
  return Response.json({ items });
}

export async function POST(request: Request, ctx: RouteContext<"/api/designs/[designId]/models">) {
  if (rateLimited(`mesh:${clientIp(request)}`, 20, 60 * 60 * 1000)) return jsonError(429, "rate_limited", "Too many 3D model requests. Please try again later.");
  await ensureDb();
  await ensureCatalogue();
  const { designId } = await ctx.params;
  const products = await chosen(designId);
  if (!products) return jsonError(404, "not_found", "Design not found.");
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return jsonError(400, "invalid_request", "Invalid product list.");

  const allowed = new Set(products.map((p) => p.id));
  const requested = parsed.data.product_ids;
  if (requested?.some((id) => !allowed.has(id))) return jsonError(400, "invalid_request", "Choose products from this design.");
  const selected = requested ? products.filter((p) => requested.includes(p.id)) : products;
  if (!selected.length) return jsonError(400, "invalid_request", "This design has no products to convert.");
  const batch = selected.slice(0, MAX_MODELS);

  const items: { product_id: string; model: ProductModelDto }[] = [];
  for (const product of batch) {
    try {
      items.push({ product_id: product.id, model: await ensureProductModel(product.id) });
    } catch (e) {
      if (e instanceof MeshError && (e.code === "missing_key" || e.code === "rate_limited")) {
        return jsonError(e.code === "rate_limited" ? 429 : 400, e.code === "rate_limited" ? "rate_limited" : "model_failed", e.message);
      }
      items.push({
        product_id: product.id,
        model: { status: "failed", url: null, provider: null, preview: false, error: e instanceof MeshError ? e.message : "The 3D model could not be created." },
      });
    }
  }
  const notice = selected.length > batch.length ? `Only the first ${MAX_MODELS} products were converted. Create the rest from the product list.` : null;
  await persistDb();
  return Response.json({ items, notice });
}
