"use client";

import { Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ProductCard } from "@/components/product-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { DesignProductDto, DesignProductsResponse } from "@/lib/api-types";
import { CATEGORY_LABELS, type Category } from "@/lib/categories";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

function RenderBadge({ item }: { item: DesignProductDto }) {
  if (item.replaced_after_render) return <Badge variant="outline">Changed after the image was made</Badge>;
  if (item.in_render === true) return <Badge variant="secondary">In the image</Badge>;
  if (item.in_render === false) return <Badge variant="outline">May be missing from the image</Badge>;
  return null;
}

export function ShopThisLook({ designId, ready, onChanged }: { designId: string; ready: boolean; onChanged?: () => void }) {
  const [data, setData] = useState<DesignProductsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [category, setCategory] = useState("all");
  const [maxPrice, setMaxPrice] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [reload, setReload] = useState(0);
  const [swapping, setSwapping] = useState<string | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    const ctrl = new AbortController();
    const q = new URLSearchParams({ matches_per_item: "3" });
    if (category !== "all") q.set("categories", category);
    const max = Number(maxPrice);
    if (maxPrice && max > 0) q.set("max_price_minor", String(Math.round(max * 100)));
    if (inStockOnly) q.set("in_stock_only", "true");
    const t = setTimeout(() => {
      setLoading(true);
      fetch(`/api/designs/${designId}/items?${q}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((json: DesignProductsResponse) => {
          setData(json);
          setFailed(false);
          setCategories((prev) => (prev.length ? prev : json.items.map((i) => i.category)));
        })
        .catch((e) => e?.name !== "AbortError" && setFailed(true))
        .finally(() => !ctrl.signal.aborted && setLoading(false));
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [designId, ready, category, maxPrice, inStockOnly, reload]);

  const swap = async (itemId: string, productId: string) => {
    setSwapping(productId);
    setSwapError(null);
    try {
      const res = await fetch(`/api/designs/${designId}/products/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId }),
      });
      if (!res.ok) throw new Error((await res.json()).error?.message ?? "Could not change the product.");
      setReload((n) => n + 1);
      onChanged?.();
    } catch (e) {
      setSwapError(e instanceof Error ? e.message : "Could not change the product.");
    } finally {
      setSwapping(null);
    }
  };

  const unique = [...new Set(categories)];
  const productMode = data?.mode !== "detected";

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{productMode ? "Products in this design" : "Shop this look"}</h2>
        <p className="text-sm text-muted-foreground">
          {productMode
            ? "Your design is furnished with these real products from partner shops. Swap any of them for an alternative; the 3D view updates straight away."
            : "Real products from integrated shops that are similar to the furniture and decor in your design. They are close matches, not exact copies of the render."}
        </p>
      </div>

      {!ready ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">The product list appears once your design is ready.</p>
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
              <Label htmlFor="max-price">{productMode ? "Max price for alternatives (USD)" : "Max price per product (USD)"}</Label>
              <Input id="max-price" type="number" min={0} inputMode="numeric" placeholder="No limit" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="w-40" />
            </div>
            <label className="flex items-center gap-2 pb-1.5 text-sm">
              <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} className="size-4 accent-[var(--primary)]" />
              In stock only
            </label>
          </div>

          {data?.budget_summary.total && (
            <div className={cn(
              "rounded-lg border p-3 text-sm",
              data.budget_summary.within_budget === false ? "border-amber-400/50 bg-amber-50" : "border-primary/30 bg-primary/5",
            )}>
              The products in this design total <strong>{formatMoney(data.budget_summary.total)}</strong>
              {data.budget_summary.budget ? <> against your budget of <strong>{formatMoney(data.budget_summary.budget)}</strong></> : null}
              {data.budget_summary.within_budget === false ? ". That is over budget: swap a few pieces for cheaper alternatives." : "."}
            </div>
          )}

          {failed && <p className="text-sm text-destructive" role="alert">Could not load the products. Please try again.</p>}
          {swapError && <p className="text-sm text-destructive" role="alert">{swapError}</p>}
          {loading && !data && <Skeleton className="h-64 w-full" />}

          <div className={cn("space-y-8 transition-opacity", loading && data && "opacity-60")}>
            {data?.items.map((item) => (
              <div key={item.id} className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{CATEGORY_LABELS[item.category as Category] ?? item.category}</h3>
                  {item.quantity > 1 && <span className="text-sm text-muted-foreground">x {item.quantity}</span>}
                  {item.chosen ? <RenderBadge item={item} /> : <span className="text-sm text-muted-foreground">in your design: {item.label}</span>}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {item.chosen && (
                    <ProductCard
                      product={item.chosen}
                      href={`${item.chosen.product_url}?design=${designId}&item=${item.id}`}
                      matchLabel="In your design"
                      quantity={item.quantity}
                      highlight
                    />
                  )}
                  {item.alternatives.map((m) => (
                    <ProductCard
                      key={m.product.id}
                      product={m.product}
                      href={`${m.product.product_url}?design=${designId}&item=${item.id}`}
                      matchLabel={!item.chosen && m.rank === 1 ? "Best match" : undefined}
                      footer={item.chosen ? (
                        <Button variant="outline" size="sm" className="w-full" disabled={!!swapping} onClick={() => swap(item.id, m.product.id)}>
                          {swapping === m.product.id ? <Loader2 className="animate-spin" /> : <Check />} Use in design
                        </Button>
                      ) : undefined}
                    />
                  ))}
                  {item.alternatives.length === 0 && (
                    <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground sm:col-span-2">
                      No {item.chosen ? "alternatives" : "matching products"} with these filters. Try raising the price limit or switching off &quot;In stock only&quot;.
                    </p>
                  )}
                </div>
              </div>
            ))}
            {data && data.items.length === 0 && !loading && (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No products in this design match these filters.</p>
            )}
          </div>
          {data && <p className="text-xs text-muted-foreground">{data.notice}</p>}
        </>
      )}
    </section>
  );
}
