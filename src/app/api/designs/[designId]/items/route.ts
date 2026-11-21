import { getDesign, listItems } from "@/lib/designs";
import { jsonError } from "@/lib/http";
import { parseCategories } from "@/lib/matching";
import { matchContextFor, matchesForItem } from "@/lib/pipeline";
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
    perItem: Math.min(10, intParam(q.get("matches_per_item")) ?? 5),
  });

  const all = listItems(designId);
  const items = all
    .filter((i) => categories.length === 0 || categories.includes(i.category))
    .map((i) => ({
      id: i.id,
      category: i.category,
      label: i.label,
      confidence: i.confidence,
      bbox: JSON.parse(i.bbox),
      dominant_colors: JSON.parse(i.dominant_colors),
      matches: matchesForItem(i, matchCtx),
    }));

  const top = items.map((i) => i.matches[0]?.product).filter(Boolean);
  const total = top.reduce((s, p) => s + (p!.sale_price?.amount_minor ?? p!.price.amount_minor), 0);
  const sameCurrency = new Set(top.map((p) => p!.price.currency)).size <= 1;
  return Response.json({
    design_id: designId,
    status: design.status,
    items,
    budget_summary: {
      budget: design.budget_total_minor ? { amount_minor: design.budget_total_minor, currency: design.budget_currency } : null,
      top_match_total: sameCurrency && top.length ? { amount_minor: total, currency: top[0]!.price.currency } : null,
      within_budget: design.budget_total_minor && sameCurrency && design.budget_currency === top[0]?.price.currency ? total <= design.budget_total_minor : null,
    },
    notice: "Matches are similar products from integrated shops, not exact copies of what appears in the render. Prices and availability come from the shops and may change.",
  });
}
