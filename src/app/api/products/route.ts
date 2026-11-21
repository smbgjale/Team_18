import { queryProducts, toProductDto } from "@/lib/products";
import { parseCategories } from "@/lib/matching";
import { ensureCatalogue } from "@/lib/shops/sync";

const num = (v: string | null) => (v && Number.isFinite(Number(v)) ? Math.round(Number(v)) : undefined);

export async function GET(request: Request) {
  await ensureCatalogue();
  const q = new URL(request.url).searchParams;
  const limit = Math.min(60, num(q.get("limit")) ?? 24);
  const offset = num(q.get("offset")) ?? 0;
  const sort = q.get("sort");
  const rows = queryProducts({
    categories: parseCategories(q.get("category")),
    shop: q.get("shop") ?? undefined,
    q: q.get("q") ?? undefined,
    style: q.get("style") ?? undefined,
    minPriceMinor: num(q.get("min_price_minor")),
    maxPriceMinor: num(q.get("max_price_minor")),
    inStockOnly: q.get("in_stock_only") === "true",
    sort: sort === "price_asc" || sort === "price_desc" ? sort : "relevance",
    limit: limit + 1,
    offset,
  });
  return Response.json({ items: rows.slice(0, limit).map(toProductDto), next_offset: rows.length > limit ? offset + limit : null });
}
