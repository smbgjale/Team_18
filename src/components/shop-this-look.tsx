"use client";

import { useEffect, useState } from "react";
import { ProductCard } from "@/components/product-card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { DesignItemDto, Money } from "@/lib/api-types";
import { CATEGORY_LABELS, type Category } from "@/lib/categories";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ItemsResponse {
  items: DesignItemDto[];
  budget_summary: { budget: Money | null; top_match_total: Money | null; within_budget: boolean | null };
  notice: string;
}

export function ShopThisLook({ designId, ready }: { designId: string; ready: boolean }) {
  const [data, setData] = useState<ItemsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [category, setCategory] = useState("all");
  const [maxPrice, setMaxPrice] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    if (!ready) return;
    const ctrl = new AbortController();
    const q = new URLSearchParams({ matches_per_item: "4" });
    if (category !== "all") q.set("categories", category);
    const max = Number(maxPrice);
    if (maxPrice && max > 0) q.set("max_price_minor", String(Math.round(max * 100)));
    if (inStockOnly) q.set("in_stock_only", "true");
    const t = setTimeout(() => {
      setLoading(true);
      fetch(`/api/designs/${designId}/items?${q}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((json: ItemsResponse) => {
          setData(json);
          setFailed(false);
          setCategories((prev) => (prev.length ? prev : json.items.map((i) => i.category)));
        })
        .catch((e) => e?.name !== "AbortError" && setFailed(true))
        .finally(() => !ctrl.signal.aborted && setLoading(false));
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [designId, ready, category, maxPrice, inStockOnly]);

  const unique = [...new Set(categories)];

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Shop this look</h2>
        <p className="text-sm text-muted-foreground">
          Real products from integrated shops that are similar to the furniture and decor in your design. They are close matches, not exact copies of the render.
        </p>
      </div>

      {!ready ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Product suggestions appear once your design is ready.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-4 rounded-xl border bg-card p-4">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <div className="flex flex-wrap gap-1.5">
                {["all", ...unique].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      category === c ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                    )}
                  >
                    {c === "all" ? "All items" : CATEGORY_LABELS[c as Category] ?? c}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="max-price">Max price per product (USD)</Label>
              <Input id="max-price" type="number" min={0} inputMode="numeric" placeholder="No limit" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="w-40" />
            </div>
            <label className="flex items-center gap-2 pb-1.5 text-sm">
              <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} className="size-4 accent-[var(--primary)]" />
              In stock only
            </label>
          </div>

          {data?.budget_summary.budget && data.budget_summary.top_match_total && (
            <div className={cn("rounded-lg border p-3 text-sm", data.budget_summary.within_budget ? "border-primary/30 bg-primary/5" : "border-amber-400/50 bg-amber-50")}>
              Top picks total <strong>{formatMoney(data.budget_summary.top_match_total)}</strong> against your budget of{" "}
              <strong>{formatMoney(data.budget_summary.budget)}</strong>
              {data.budget_summary.within_budget ? "." : ". Over budget: try a lower price limit or fewer items."}
            </div>
          )}

          {failed && <p className="text-sm text-destructive" role="alert">Could not load product suggestions. Please try again.</p>}
          {loading && !data && <Skeleton className="h-64 w-full" />}

          <div className={cn("space-y-8 transition-opacity", loading && data && "opacity-60")}>
            {data?.items.map((item) => (
              <div key={item.id} className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="size-4 rounded-full border" style={{ background: item.dominant_colors[0]?.hex }} aria-hidden />
                  <h3 className="font-semibold">{CATEGORY_LABELS[item.category as Category] ?? item.category}</h3>
                  <span className="text-sm text-muted-foreground">in your design: {item.label}</span>
                  <Badge variant="outline">{Math.round(item.confidence * 100)}% detected</Badge>
                </div>
                {item.matches.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    No matching products with these filters. Try raising the price limit or switching off &quot;In stock only&quot;.
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {item.matches.map((m) => (
                      <ProductCard
                        key={m.product.id}
                        product={m.product}
                        href={`${m.product.product_url}?design=${designId}&item=${item.id}`}
                        matchLabel={m.rank === 1 ? "Best match" : undefined}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
            {data && data.items.length === 0 && !loading && (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No furniture was detected in this design.</p>
            )}
          </div>
          {data && <p className="text-xs text-muted-foreground">{data.notice}</p>}
        </>
      )}
    </section>
  );
}
