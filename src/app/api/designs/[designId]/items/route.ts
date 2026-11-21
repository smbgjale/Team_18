import type { DesignDto, DesignProductDto, DesignProductsResponse } from "@/lib/api-types";
import { CATEGORY_LABELS } from "@/lib/categories";
import { getDesign, listDesignProducts, listItems } from "@/lib/designs";
import { jsonError } from "@/lib/http";
import { parseCategories } from "@/lib/matching";
import { alternativesFor, matchContextFor, matchesForItem } from "@/lib/pipeline";
import { effectivePrice, toProductDto } from "@/lib/products";
import { ensureCatalogue } from "@/lib/shops/sync";

function intParam(v: string | null) {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined;
}

export async function GET(request: Request, ctx: RouteContext<"/api/designs/[designId]/items">) {
  const { designId } = await ctx.params;
  const design = getDesign(designId);
  if (!design) return jsonError(404, "not_found", "Design not found.");
  await ensureCatalogue();

  const q = new URL(request.url).searchParams;
  const categories = parseCategories(q.get("categories"));
  const matchCtx = matchContextFor(designId, {
    minPriceMinor: intParam(q.get("min_price_minor")),
    maxPriceMinor: intParam(q.get("max_price_minor")),
    inStockOnly: q.get("in_stock_only") === "true",
    shop: q.get("shop") ?? undefined,
    perItem: Math.min(10, intParam(q.get("matches_per_item")) ?? 3),
  });
  const wanted = (c: string) => categories.length === 0 || (categories as string[]).includes(c);

  const chosen = listDesignProducts(designId);
  let items: DesignProductDto[];
  let total: { amount_minor: number; currency: string } | null = null;
  if (chosen.length) {
    items = chosen.filter((c) => wanted(c.category)).map((c) => ({
      id: c.id,
      category: c.category,
      label: CATEGORY_LABELS[c.category],
      quantity: c.quantity,
      in_render: c.in_render == null ? null : c.in_render === 1,
      replaced_after_render: c.replaced_after_render === 1,
      chosen: toProductDto(c.product),
      alternatives: alternativesFor(c, matchCtx),
    }));
    if (new Set(chosen.map((c) => c.product.currency)).size === 1) {
      total = { amount_minor: chosen.reduce((s, c) => s + effectivePrice(c.product) * c.quantity, 0), currency: chosen[0].product.currency };
    }
  } else {
    items = listItems(designId).filter((i) => wanted(i.category)).map((i) => ({
      id: i.id,
      category: i.category,
      label: i.label,
      quantity: 1,
      in_render: true,
      replaced_after_render: false,
      chosen: null,
      alternatives: matchesForItem(i, matchCtx),
    }));
  }

  const res: DesignProductsResponse = {
    design_id: designId,
    status: design.status as DesignDto["status"],
    mode: chosen.length ? "products" : "detected",
    items,
    budget_summary: {
      budget: design.budget_total_minor ? { amount_minor: design.budget_total_minor, currency: design.budget_currency ?? "USD" } : null,
      total,
      within_budget: design.budget_total_minor && total && total.currency === design.budget_currency ? total.amount_minor <= design.budget_total_minor : null,
    },
    notice: chosen.length
      ? "Each design is furnished with these real products from partner shops. The AI image may simplify small details; the shop page shows exactly what you buy. Prices and availability come from the shops and may change."
      : "Matches are similar products from integrated shops, not exact copies of what appears in the render. Prices and availability come from the shops and may change.",
  };
  return Response.json(res);
}
