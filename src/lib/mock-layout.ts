import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { Category } from "./categories";
import { loadProductImage } from "./product-images";

const SLOT: Record<Category, [number, number, number, number]> = {
  sofa: [0.08, 0.5, 0.46, 0.34], armchair: [0.62, 0.52, 0.24, 0.3], bed: [0.2, 0.48, 0.5, 0.36],
  coffee_table: [0.28, 0.76, 0.26, 0.17], dining_table: [0.22, 0.55, 0.5, 0.3], side_table: [0.72, 0.62, 0.14, 0.2],
  desk: [0.15, 0.5, 0.5, 0.32], chair: [0.64, 0.58, 0.18, 0.28], wardrobe: [0.78, 0.18, 0.18, 0.52],
  tv_unit: [0.6, 0.6, 0.32, 0.22], shelf: [0.84, 0.22, 0.13, 0.45], rug: [0.12, 0.78, 0.55, 0.18],
  curtains: [0.07, 0.14, 0.32, 0.46], ceiling_light: [0.42, 0.02, 0.16, 0.2], floor_lamp: [0.58, 0.42, 0.1, 0.32],
  table_lamp: [0.78, 0.5, 0.09, 0.14], wall_art: [0.64, 0.1, 0.15, 0.22], mirror: [0.52, 0.08, 0.12, 0.28],
  plant_pot: [0.9, 0.62, 0.08, 0.2], cushion: [0.2, 0.52, 0.08, 0.1],
};

const publicDir = path.join(process.cwd(), "public");

export interface SpritePlacement {
  category: Category;
  png: Buffer;
  bbox: { x: number; y: number; w: number; h: number };
}

// Demo product images are flat SVG illustrations: strip their backdrop so they can be composited.
async function productSprite(imageUrl: string): Promise<Buffer | null> {
  if (imageUrl.startsWith("/demo-products/") && imageUrl.endsWith(".svg")) {
    const file = path.resolve(publicDir, "." + imageUrl);
    if (!file.startsWith(publicDir + path.sep)) return null;
    const svg = (await readFile(file, "utf8"))
      .replace(/<rect width="400" height="300" fill="url\(#bg\)"\/>/, "")
      .replace(/<rect y="245"[^>]*\/>/, "")
      .replace(/<ellipse cx="200" cy="246"[^>]*\/>/, "");
    return sharp(Buffer.from(svg), { density: 216 }).trim({ threshold: 1 }).png().toBuffer();
  }
  return loadProductImage(imageUrl);
}

// Places each product image inside its category's slot, keeping its aspect ratio and sitting it on
// the slot's bottom edge. Returned boxes are normalised to the image size.
export async function placeProducts(products: { category: Category; imageUrl: string }[], W: number, H: number): Promise<SpritePlacement[]> {
  const out: SpritePlacement[] = [];
  for (const p of products) {
    const png = await productSprite(p.imageUrl);
    if (!png) continue;
    const { width, height } = await sharp(png).metadata();
    const aspect = width! / height!;
    const [x, y, w, h] = SLOT[p.category];
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
    out.push({ category: p.category, png, bbox: { x: left / W, y: top / H, w: pw / W, h: ph / H } });
  }
  return out;
}
