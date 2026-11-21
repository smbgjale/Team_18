import { db } from "./db";
import type { ProductDto } from "./api-types";
import { isCategory } from "./categories";
import { stylesFor, type DesignDirection } from "./styles";

export interface ProductRow {
  id: string;
  shop_id: string;
  name: string;
  description: string | null;
  category: string;
  price_minor: number;
  sale_price_minor: number | null;
  currency: string;
  product_url: string;
  image_url: string;
  brand: string | null;
  colors: string;
  dominant_color_hex: string | null;
  materials: string;
  style_tags: string;
  width_cm: number | null;
  depth_cm: number | null;
  height_cm: number | null;
  availability: string;
  shop_slug: string;
  shop_name: string;
  shop_is_demo: number;
}

const SELECT = `
  SELECT p.*, s.slug AS shop_slug, s.name AS shop_name, s.is_demo AS shop_is_demo
  FROM products p JOIN shops s ON s.id = p.shop_id
  WHERE p.is_active = 1 AND s.is_enabled = 1`;

export interface ProductFilters {
  categories?: string[];
  shop?: string;
  q?: string;
  minPriceMinor?: number;
  maxPriceMinor?: number;
  inStockOnly?: boolean;
  excludeOutOfStock?: boolean;
  style?: string;
  direction?: DesignDirection;
  limit?: number;
  offset?: number;
  sort?: "relevance" | "price_asc" | "price_desc";
}

export function effectivePrice(p: Pick<ProductRow, "price_minor" | "sale_price_minor">) {
  return p.sale_price_minor ?? p.price_minor;
}

export function queryProducts(f: ProductFilters): ProductRow[] {
  const where: string[] = [];
  const params: unknown[] = [];
  const cats = (f.categories ?? []).filter(isCategory);
  if (cats.length) {
    where.push(`p.category IN (${cats.map(() => "?").join(",")})`);
    params.push(...cats);
  }
  if (f.shop) { where.push("s.slug = ?"); params.push(f.shop); }
  if (f.q) { where.push("(p.name LIKE ? OR p.description LIKE ?)"); params.push(`%${f.q}%`, `%${f.q}%`); }
  if (f.minPriceMinor != null) { where.push("COALESCE(p.sale_price_minor, p.price_minor) >= ?"); params.push(f.minPriceMinor); }
  if (f.maxPriceMinor != null) { where.push("COALESCE(p.sale_price_minor, p.price_minor) <= ?"); params.push(f.maxPriceMinor); }
  if (f.inStockOnly) where.push("p.availability IN ('in_stock','low_stock')");
  else if (f.excludeOutOfStock) where.push("p.availability != 'out_of_stock'");
  if (f.style) { where.push("p.style_tags LIKE ?"); params.push(`%"${f.style}"%`); }
  if (f.direction) {
    const ids = stylesFor(f.direction).map((s) => s.id);
    where.push(`(${ids.map(() => "p.style_tags LIKE ?").join(" OR ")})`);
    params.push(...ids.map((id) => `%"${id}"%`));
  }
  const order =
    f.sort === "price_asc" ? "ORDER BY COALESCE(p.sale_price_minor, p.price_minor) ASC"
    : f.sort === "price_desc" ? "ORDER BY COALESCE(p.sale_price_minor, p.price_minor) DESC"
    : "ORDER BY p.name ASC";
  const sql = `${SELECT} ${where.length ? "AND " + where.join(" AND ") : ""} ${order} ${f.limit ? "LIMIT ? OFFSET ?" : ""}`;
  if (f.limit) params.push(f.limit, f.offset ?? 0);
  return db().prepare(sql).all(...params) as ProductRow[];
}

export function getProduct(id: string, opts: { includeInactive?: boolean } = {}): ProductRow | undefined {
  const sql = opts.includeInactive
    ? "SELECT p.*, s.slug AS shop_slug, s.name AS shop_name, s.is_demo AS shop_is_demo FROM products p JOIN shops s ON s.id = p.shop_id WHERE p.id = ?"
    : `${SELECT} AND p.id = ?`;
  return db().prepare(sql).get(id) as ProductRow | undefined;
}

export function toProductDto(p: ProductRow): ProductDto {
  const dims = p.width_cm || p.depth_cm || p.height_cm ? { width: p.width_cm, depth: p.depth_cm, height: p.height_cm } : null;
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    category: p.category,
    image_url: p.image_url,
    price: { amount_minor: p.price_minor, currency: p.currency },
    sale_price: p.sale_price_minor != null ? { amount_minor: p.sale_price_minor, currency: p.currency } : null,
    brand: p.brand,
    colors: JSON.parse(p.colors) as string[],
    materials: JSON.parse(p.materials) as string[],
    style_tags: JSON.parse(p.style_tags) as string[],
    dimensions_cm: dims,
    availability: p.availability as ProductDto["availability"],
    shop: { slug: p.shop_slug, name: p.shop_name, is_demo: !!p.shop_is_demo },
    dominant_color_hex: p.dominant_color_hex,
    product_url: `/r/${p.id}`,
  };
}
