import { BUDGET_WEIGHT, COMPATIBLE, isCategory, type Category } from "./categories";
import { colorNameToHex, colorScore } from "./color";
import { effectivePrice, queryProducts, toProductDto, type ProductRow } from "./products";
import { styleAffinity } from "./styles";

export const WEIGHTS = { keyword: 0.1, style: 0.35, color: 0.25, price: 0.2, availability: 0.1 };

export interface MatchItemInput {
  category: Category;
  label: string;
  colorHexes: string[];
  colorNames: string[];
}

export interface MatchContext {
  style: string;
  budgetMinor?: number | null;
  budgetCurrency?: string | null;
  allCategories: Category[];
  minPriceMinor?: number;
  maxPriceMinor?: number;
  inStockOnly?: boolean;
  shop?: string;
  perItem?: number;
}

const STOP = new Set(["a", "an", "the", "of", "and", "with", "in", "for", "set", "pair"]);
const tokens = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t && !STOP.has(t));

const AVAILABILITY_SCORE: Record<string, number> = { in_stock: 1, low_stock: 0.8, preorder: 0.5, unknown: 0.7, out_of_stock: 0 };

export function itemBudgetMinor(ctx: MatchContext, category: Category): number | null {
  if (!ctx.budgetMinor) return null;
  const cats = ctx.allCategories.length ? ctx.allCategories : [category];
  const total = cats.reduce((sum, c) => sum + BUDGET_WEIGHT[c], 0);
  return Math.round((ctx.budgetMinor * BUDGET_WEIGHT[category]) / total);
}

function priceScore(p: ProductRow, target: number | null, ctx: MatchContext): number {
  if (target == null || (ctx.budgetCurrency && ctx.budgetCurrency !== p.currency)) return 0.7;
  const price = effectivePrice(p);
  if (price <= target) return 1;
  return Math.max(0, 1 - (price - target) / (target * 0.5));
}

export function matchItem(item: MatchItemInput, ctx: MatchContext) {
  const cats = [item.category, ...(COMPATIBLE[item.category] ?? [])];
  const candidates = queryProducts({
    categories: cats,
    shop: ctx.shop,
    minPriceMinor: ctx.minPriceMinor,
    maxPriceMinor: ctx.maxPriceMinor,
    inStockOnly: ctx.inStockOnly,
    excludeOutOfStock: true,
  });
  const target = itemBudgetMinor(ctx, item.category);
  const itemTokens = new Set([...tokens(item.label), ...item.colorNames.map((c) => c.toLowerCase())]);
  const itemHexes = item.colorHexes.length ? item.colorHexes : item.colorNames.map(colorNameToHex).filter((h): h is string => !!h);

  const scored = candidates.map((p) => {
    const pTokens = new Set(tokens(`${p.name} ${p.description ?? ""} ${JSON.parse(p.colors).join(" ")} ${JSON.parse(p.materials).join(" ")}`));
    const overlap = itemTokens.size ? [...itemTokens].filter((t) => pTokens.has(t)).length / itemTokens.size : 0.5;
    const pHex = p.dominant_color_hex ? [p.dominant_color_hex] : [];
    const breakdown = {
      keyword: Math.min(1, overlap),
      style: styleAffinity(ctx.style, JSON.parse(p.style_tags)),
      color: colorScore(itemHexes, pHex),
      price: priceScore(p, target, ctx),
      availability: AVAILABILITY_SCORE[p.availability] ?? 0.7,
    };
    const exact = p.category === item.category ? 1 : 0.85;
    const score = exact * Object.entries(WEIGHTS).reduce((s, [k, w]) => s + w * breakdown[k as keyof typeof breakdown], 0);
    return { product: p, score, breakdown };
  });
  scored.sort((a, b) => b.score - a.score);

  const n = ctx.perItem ?? 5;
  const maxPerShop = 3;
  const perShop = new Map<string, number>();
  const picked: typeof scored = [];
  const skipped: typeof scored = [];
  for (const s of scored) {
    const c = perShop.get(s.product.shop_slug) ?? 0;
    if (c >= maxPerShop) { skipped.push(s); continue; }
    perShop.set(s.product.shop_slug, c + 1);
    picked.push(s);
    if (picked.length === n) break;
  }
  for (const s of skipped) if (picked.length < n) picked.push(s);

  return picked.map((m, i) => ({
    rank: i + 1,
    score: Math.round(m.score * 1000) / 1000,
    score_breakdown: Object.fromEntries(Object.entries(m.breakdown).map(([k, v]) => [k, Math.round(v * 100) / 100])),
    product: toProductDto(m.product),
  }));
}

export function parseCategories(v: string | null): Category[] {
  return (v ?? "").split(",").map((s) => s.trim()).filter(isCategory);
}
