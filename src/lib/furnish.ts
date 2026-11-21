import { BUDGET_WEIGHT, DEFAULT_DIMS_CM, ROOM_ITEMS, itemQuantity, type Category, type RoomType } from "./categories";
import { colorNameToHex, colorScore } from "./color";
import { effectivePrice, queryProducts, type ProductRow } from "./products";
import { getStyle, styleAffinity } from "./styles";

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

function targets(opts: FurnishOptions, categories: Category[]) {
  const out = new Map<Category, number>();
  if (!opts.budgetMinor) return out;
  const total = categories.reduce((s, c) => s + BUDGET_WEIGHT[c], 0);
  for (const c of categories) out.set(c, (opts.budgetMinor * BUDGET_WEIGHT[c]) / total / itemQuantity(c, opts.roomType));
  return out;
}

export function scoreForRoom(p: ProductRow, opts: FurnishOptions, target: number | undefined) {
  const style = styleAffinity(opts.style, JSON.parse(p.style_tags));
  const palette = paletteScore(p, opts.style);
  let price = 0.7;
  if (target != null && (!opts.budgetCurrency || opts.budgetCurrency === p.currency)) {
    const amount = effectivePrice(p);
    price = amount <= target ? 1 : Math.max(0, 1 - (amount - target) / (target * 0.5));
  }
  return 0.45 * style + 0.25 * palette + 0.2 * price + 0.1 * (AVAILABILITY[p.availability] ?? 0.5);
}

export const pickTotal = (picks: FurnishPick[]) => picks.reduce((s, x) => s + effectivePrice(x.product) * x.quantity, 0);

// Chooses one real catalogue product per furniture category for the room: the best match for the
// style and palette that fits the room, then trades down (or drops optional decor) until the
// total is within budget.
export function furnishRoom(opts: FurnishOptions): { picks: FurnishPick[]; overBudget: boolean } {
  const categories = ROOM_ITEMS[opts.roomType];
  const budgetTargets = targets(opts, categories);
  const ranked = new Map<Category, ProductRow[]>();
  const picks: FurnishPick[] = [];

  for (const category of categories) {
    const candidates = queryProducts({ categories: [category], excludeOutOfStock: true }).filter((p) => fitsRoom(p, opts.room));
    if (!candidates.length) continue;
    const target = budgetTargets.get(category);
    candidates.sort((a, b) => scoreForRoom(b, opts, target) - scoreForRoom(a, opts, target));
    ranked.set(category, candidates);
    picks.push({ category, quantity: itemQuantity(category, opts.roomType), product: candidates[0] });
  }

  if (opts.budgetMinor) {
    const budget = opts.budgetMinor;
    for (let guard = 0; guard < 50 && pickTotal(picks) > budget; guard++) {
      const byCost = [...picks].sort((a, b) => effectivePrice(b.product) * b.quantity - effectivePrice(a.product) * a.quantity);
      let changed = false;
      for (const pick of byCost) {
        const current = effectivePrice(pick.product);
        const cheaper = (ranked.get(pick.category) ?? []).find(
          (p) => effectivePrice(p) < current && styleAffinity(opts.style, JSON.parse(p.style_tags)) >= 0.5,
        ) ?? (ranked.get(pick.category) ?? []).filter((p) => effectivePrice(p) < current).sort((a, b) => effectivePrice(a) - effectivePrice(b))[0];
        if (cheaper) {
          pick.product = cheaper;
          changed = true;
          break;
        }
      }
      if (!changed) {
        const drop = picks.findIndex((p) => OPTIONAL.includes(p.category));
        if (drop === -1) break;
        picks.splice(drop, 1);
      }
    }
  }
  return { picks, overBudget: !!opts.budgetMinor && pickTotal(picks) > opts.budgetMinor };
}
