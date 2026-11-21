import { DEFAULT_DIMS_CM, ROOM_ITEMS, itemQuantity, type Category, type RoomType } from "./categories";
import { colorNameToHex, colorScore } from "./color";
import { effectivePrice, queryProducts, type ProductRow } from "./products";
import { getStyle, matchesDirection, styleAffinity } from "./styles";

export interface FurnishPick {
  category: Category;
  quantity: number;
  product: ProductRow;
}

export interface FurnishOptions {
  roomType: RoomType;
  style: string;
  budgetMinor?: number | null;
  budgetCurrency?: string | null;
  room: { width: number; length: number };
}

const AVAILABILITY: Record<string, number> = { in_stock: 1, low_stock: 0.8, unknown: 0.6, preorder: 0.4 };
// Dropped first when the selection is over budget.
const OPTIONAL: Category[] = ["plant_pot", "wall_art", "mirror", "cushion", "table_lamp", "shelf", "side_table"];

export function fitsRoom(p: Pick<ProductRow, "category" | "width_cm" | "depth_cm">, room: { width: number; length: number }) {
  const [dw, dd] = DEFAULT_DIMS_CM[p.category as Category] ?? [50, 50];
  const a = p.width_cm ?? dw;
  const b = p.depth_cm ?? dd;
  const roomLong = Math.max(room.width, room.length) - 30;
  const roomShort = Math.min(room.width, room.length) - 30;
  return Math.max(a, b) <= roomLong && Math.min(a, b) <= roomShort;
}

function paletteScore(p: ProductRow, style: string) {
  const palette = (getStyle(style)?.colors ?? []).map(colorNameToHex).filter((h): h is string => !!h);
  return p.dominant_color_hex ? colorScore([p.dominant_color_hex], palette) : 0.5;
}

export function scoreForRoom(p: ProductRow, opts: Pick<FurnishOptions, "style">) {
  const style = styleAffinity(opts.style, JSON.parse(p.style_tags));
  return 0.55 * style + 0.3 * paletteScore(p, opts.style) + 0.15 * (AVAILABILITY[p.availability] ?? 0.5);
}

export const pickTotal = (picks: FurnishPick[]) => picks.reduce((s, x) => s + effectivePrice(x.product) * x.quantity, 0);

// Chooses one real catalogue product per furniture category for the room: the best match for the
// style and palette that fits the room, keeping to the style's direction (modern or traditional)
// unless a category has nothing in it. When that is over budget it repeatedly makes the swap that
// costs the least match quality per unit of money saved, and drops optional decor as a last resort.
export function furnishRoom(opts: FurnishOptions): { picks: FurnishPick[]; overBudget: boolean } {
  const ranked = new Map<Category, { product: ProductRow; score: number }[]>();
  const picks: FurnishPick[] = [];
  const direction = getStyle(opts.style)?.direction;

  for (const category of ROOM_ITEMS[opts.roomType]) {
    const fitting = queryProducts({ categories: [category], excludeOutOfStock: true })
      .filter((p) => fitsRoom(p, opts.room) && (!opts.budgetCurrency || p.currency === opts.budgetCurrency));
    const sameDirection = direction ? fitting.filter((p) => matchesDirection(JSON.parse(p.style_tags), direction)) : fitting;
    const candidates = (sameDirection.length ? sameDirection : fitting)
      .map((product) => ({ product, score: scoreForRoom(product, opts) }))
      // Equal scores prefer a real shop over the sample catalogue, then the lower price.
      .sort((a, b) => b.score - a.score || a.product.shop_is_demo - b.product.shop_is_demo || effectivePrice(a.product) - effectivePrice(b.product));
    if (!candidates.length) continue;
    ranked.set(category, candidates);
    picks.push({ category, quantity: itemQuantity(category, opts.roomType), product: candidates[0].product });
  }

  const budget = opts.budgetMinor;
  if (budget) {
    for (let guard = 0; guard < 200 && pickTotal(picks) > budget; guard++) {
      let best: { pick: FurnishPick; product: ProductRow; cost: number } | null = null;
      for (const pick of picks) {
        const list = ranked.get(pick.category) ?? [];
        const current = list.find((c) => c.product.id === pick.product.id)!;
        for (const c of list) {
          const saved = (effectivePrice(pick.product) - effectivePrice(c.product)) * pick.quantity;
          if (saved <= 0) continue;
          const cost = (current.score - c.score + 0.02) / saved;
          if (!best || cost < best.cost) best = { pick, product: c.product, cost };
        }
      }
      if (best) {
        best.pick.product = best.product;
        continue;
      }
      const drop = picks.findIndex((p) => OPTIONAL.includes(p.category));
      if (drop === -1) break;
      picks.splice(drop, 1);
    }
  }
  return { picks, overBudget: !!budget && pickTotal(picks) > budget };
}
