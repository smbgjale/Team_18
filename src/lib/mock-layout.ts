import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import path from "node:path";
import { ROOM_ITEMS, type Category, type RoomType } from "./categories";
import { NAMED_COLORS } from "./color";

export interface MockItem {
  category: Category;
  colorName: string;
  colorHex: string;
  bbox: { x: number; y: number; w: number; h: number };
  sprite: string;
}

const SLOT: Record<Category, [number, number, number, number]> = {
  sofa: [0.08, 0.5, 0.46, 0.34], armchair: [0.62, 0.52, 0.24, 0.3], bed: [0.2, 0.48, 0.5, 0.36],
  coffee_table: [0.28, 0.76, 0.26, 0.17], dining_table: [0.22, 0.55, 0.5, 0.3], side_table: [0.72, 0.62, 0.14, 0.2],
  desk: [0.15, 0.5, 0.5, 0.32], chair: [0.64, 0.58, 0.18, 0.28], wardrobe: [0.78, 0.18, 0.18, 0.52],
  tv_unit: [0.6, 0.6, 0.32, 0.22], shelf: [0.84, 0.22, 0.13, 0.45], rug: [0.12, 0.78, 0.55, 0.18],
  curtains: [0.07, 0.14, 0.32, 0.46], ceiling_light: [0.42, 0.02, 0.16, 0.2], floor_lamp: [0.58, 0.42, 0.1, 0.32],
  table_lamp: [0.78, 0.5, 0.09, 0.14], wall_art: [0.64, 0.1, 0.15, 0.22], mirror: [0.52, 0.08, 0.12, 0.28],
  plant_pot: [0.9, 0.62, 0.08, 0.2], cushion: [0.2, 0.52, 0.08, 0.1],
};

const STYLE_COLORS: Record<string, string[]> = {
  modern: ["grey", "charcoal", "black", "white", "brass"],
  scandinavian: ["oak", "white", "green", "beige", "grey"],
  minimalist: ["white", "beige", "ivory", "grey", "oak"],
  industrial: ["charcoal", "black", "walnut", "brass", "grey"],
  bohemian: ["terracotta", "mustard", "green", "blush", "beige"],
  classic: ["navy", "ivory", "walnut", "brass", "beige"],
};

const spriteDir = path.join(process.cwd(), "public", "demo-products");

function pickSprite(category: Category, style: string): { file: string; color: string } | null {
  const files = readdirSync(spriteDir).filter((f) => f.startsWith(category + "-"));
  if (files.length === 0) return null;
  for (const c of STYLE_COLORS[style] ?? []) {
    const f = `${category}-${c}.svg`;
    if (existsSync(path.join(spriteDir, f))) return { file: f, color: c };
  }
  const f = files[0];
  return { file: f, color: f.slice(category.length + 1, -4) };
}

export const WALL_MOUNTED: Category[] = ["curtains", "wall_art", "mirror", "ceiling_light"];

export async function loadSprite(file: string): Promise<{ png: Buffer; aspect: number }> {
  let svg = await readFile(file, "utf8");
  svg = svg
    .replace(/<rect width="400" height="300" fill="url\(#bg\)"\/>/, "")
    .replace(/<rect y="245"[^>]*\/>/, "")
    .replace(/<ellipse cx="200" cy="246"[^>]*\/>/, "");
  const png = await sharp(Buffer.from(svg), { density: 216 }).trim({ threshold: 1 }).png().toBuffer();
  const { width, height } = await sharp(png).metadata();
  return { png, aspect: width! / height! };
}

// Places each sample sprite inside its slot, keeping the sprite's aspect ratio and sitting it on
// the slot's bottom edge. The returned bbox is the sprite's actual footprint (normalised 0..1).
export async function mockLayout(roomType: RoomType, style: string, W: number, H: number): Promise<MockItem[]> {
  const items: MockItem[] = [];
  for (const category of ROOM_ITEMS[roomType]) {
    const pick = pickSprite(category, style);
    if (!pick) continue;
    const file = path.join(spriteDir, pick.file);
    const [x, y, w, h] = SLOT[category];
    const { aspect } = await loadSprite(file);
    const slotW = w * W;
    const slotH = h * H;
    let pw = slotW;
    let ph = pw / aspect;
    if (ph > slotH) {
      ph = slotH;
      pw = ph * aspect;
    }
    const left = x * W + (slotW - pw) / 2;
    const top = y * H + (slotH - ph);
    items.push({
      category,
      colorName: pick.color,
      colorHex: NAMED_COLORS[pick.color],
      bbox: { x: round(left / W), y: round(top / H), w: round(pw / W), h: round(ph / H) },
      sprite: file,
    });
  }
  return items;
}

const round = (n: number) => Math.round(n * 1000) / 1000;
