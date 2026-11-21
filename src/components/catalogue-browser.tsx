"use client";

import { useEffect, useState } from "react";
import { ProductCard } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { CategoryDto, ProductDto, ShopDto } from "@/lib/api-types";
import { DIRECTIONS } from "@/lib/styles";

const selectCls = "h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

export function CatalogueBrowser() {
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [shops, setShops] = useState<ShopDto[]>([]);
  const [category, setCategory] = useState("");
  const [shop, setShop] = useState("");
  const [look, setLook] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState("relevance");
  const [inStock, setInStock] = useState(false);
  const [q, setQ] = useState("");
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then((j) => setCategories(j.items));
    fetch("/api/shops").then((r) => r.json()).then((j) => setShops(j.items));
  }, []);

  const params = (offset: number) => {
    const p = new URLSearchParams({ sort, offset: String(offset), limit: "24" });
    if (category) p.set("category", category);
    if (shop) p.set("shop", shop);
    if (look) p.set("direction", look);
    if (q.trim()) p.set("q", q.trim());
    if (inStock) p.set("in_stock_only", "true");
    if (Number(maxPrice) > 0) p.set("max_price_minor", String(Math.round(Number(maxPrice) * 100)));
    return p;
  };

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      fetch(`/api/products?${params(0)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((j) => { setProducts(j.items); setNext(j.next_offset); setError(false); })
        .catch((e) => e?.name !== "AbortError" && setError(true))
        .finally(() => !ctrl.signal.aborted && setLoading(false));
    }, 200);
    return () => { clearTimeout(t); ctrl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, shop, look, maxPrice, sort, inStock, q]);

  const loadMore = async () => {
    if (next == null) return;
    const j = await (await fetch(`/api/products?${params(next)}`)).json();
    setProducts((prev) => [...prev, ...j.items]);
    setNext(j.next_offset);
  };

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Shop catalogue</h1>
        <p className="text-sm text-muted-foreground">
          Products from {shops.length ? shops.map((s) => s.name).join(" and ") : "the connected shops"} only.
          Photos, prices and product pages come from those websites. They sell handwoven cushions and baskets, so a design uses those pieces.
        </p>
      </div>

      <div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-7">
        <div className="space-y-1.5 lg:col-span-2">
          <Label htmlFor="q">Search</Label>
          <Input id="q" placeholder="e.g. oak coffee table" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cat">Category</Label>
          <select id="cat" className={selectCls} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="shop">Shop</Label>
          <select id="shop" className={selectCls} value={shop} onChange={(e) => setShop(e.target.value)}>
            <option value="">All shops</option>
            {shops.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="look">Look</Label>
          <select id="look" className={selectCls} value={look} onChange={(e) => setLook(e.target.value)}>
            <option value="">Any look</option>
            {DIRECTIONS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="max">Max price (USD)</Label>
          <Input id="max" type="number" min={0} placeholder="No limit" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sort">Sort</Label>
          <select id="sort" className={selectCls} value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="relevance">Name</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2 lg:col-span-7">
          <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={inStock} onChange={(e) => setInStock(e.target.checked)} />
          In stock only (products with unknown stock are hidden)
        </label>
      </div>

      {error && <p role="alert" className="text-sm text-destructive">Could not load products. Please try again.</p>}
      {loading && products.length === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-72" />)}</div>
      ) : products.length === 0 ? (
        <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">No products match these filters.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
          {next != null && <div className="text-center"><Button variant="outline" onClick={loadMore}>Load more</Button></div>}
        </>
      )}
    </main>
  );
}
