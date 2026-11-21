import { writeFileSync } from "node:fs";
import { judgeProductImage } from "../src/lib/shops/image-quality";

const ORIGIN = "https://www.highfashionhome.com";
const UA = "HOMELY-AI/0.1 (catalogue sync; public product catalogue read)";
const PER_CATEGORY = 6;
const EXAMINE = 36;
const FLAT = new Set(["rug", "wall_art", "cushion"]);

const COLLECTIONS: { handle: string; category: string }[] = [
  { handle: "sofas", category: "sofa" },
  { handle: "accent-chairs", category: "armchair" },
  { handle: "coffee-tables", category: "coffee_table" },
  { handle: "dining-tables", category: "dining_table" },
  { handle: "dining-chairs", category: "chair" },
  { handle: "beds", category: "bed" },
  { handle: "nightstands", category: "side_table" },
  { handle: "side-tables", category: "side_table" },
  { handle: "desks", category: "desk" },
  { handle: "dressers-chests", category: "wardrobe" },
  { handle: "bookcases-shelves", category: "shelf" },
  { handle: "media-storage", category: "tv_unit" },
  { handle: "rugs", category: "rug" },
  { handle: "art", category: "wall_art" },
  { handle: "mirrors", category: "mirror" },
  { handle: "pillows", category: "cushion" },
  { handle: "plants-planters", category: "plant_pot" },
  { handle: "lighting", category: "lighting" },
];

interface ShopifyImage { src: string }
interface ShopifyProduct {
  title: string;
  handle: string;
  body_html: string | null;
  product_type: string;
  tags: string[] | string;
  vendor: string;
  images: ShopifyImage[];
  variants: { id: number; title: string; price: string; available?: boolean; sku: string | null }[];
}

const COLOR_WORDS = ["white", "black", "grey", "gray", "ivory", "beige", "oak", "walnut", "brass", "gold", "green", "navy", "brown", "blue", "cream", "charcoal", "natural", "terracotta"];

function decode(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#\d+;/g, " ").replace(/\s+/g, " ").trim();
}

function styleTags(text: string) {
  const t = text.toLowerCase();
  if (/rustic|farmhouse|reclaimed/.test(t)) return ["rustic"];
  if (/industrial|loft/.test(t)) return ["industrial"];
  if (/scandinavian|nordic/.test(t)) return ["scandinavian"];
  if (/bohemian|boho/.test(t)) return ["bohemian"];
  if (/classic|traditional|antique|heirloom|french/.test(t)) return ["classic"];
  return ["modern"];
}

function lightingCategory(title: string) {
  const t = title.toLowerCase();
  if (/floor lamp/.test(t)) return "floor_lamp";
  if (/pendant|chandelier|linear|flush|semi-flush|ceiling/.test(t)) return "ceiling_light";
  if (/table lamp|\blamp\b/.test(t)) return "table_lamp";
  return null;
}

function colorsIn(text: string) {
  const found = COLOR_WORDS.filter((c) => new RegExp(`\\b${c}\\b`, "i").test(text));
  return [...new Set(found.map((c) => (c === "gray" ? "grey" : c)))];
}

async function fetchJson(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(40_000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json() as Promise<{ products?: ShopifyProduct[] }>;
}

function showsWholeProduct(category: string, verdict: Awaited<ReturnType<typeof judgeProductImage>>) {
  if (!verdict.ok || !verdict.topClear) return false;
  const minInset = Math.min(verdict.insetTop, verdict.insetRight, verdict.insetBottom, verdict.insetLeft);
  // Lamps are rejected when the shade or base runs out of the frame, or when the photo is only a slice of the stem.
  if (category === "floor_lamp") {
    // A full floor lamp is a tall object with a lot of white around it. A close-up of the shade fills the frame.
    const cutOff = verdict.touchesTop || verdict.touchesBottom || verdict.touchesLeft || verdict.touchesRight;
    // topBand is the width of the shade. A photo of only the base has a narrow top.
    return !cutOff && minInset >= 0.012 && verdict.boxH >= 0.55 && verdict.whiteFraction >= 0.75 && verdict.topBand >= 0.18;
  }
  if (category === "table_lamp" || category === "ceiling_light") {
    return minInset >= 0.012 && verdict.boxW >= 0.22 && verdict.boxH >= 0.4;
  }
  // Cushions, rugs, art and mirrors need a visible margin, so a letterboxed room photo cannot pass.
  if (FLAT.has(category) || category === "mirror" || category === "plant_pot") return minInset >= 0.004;
  // Chairs are framed tighter than sofas; the back and feet only need a sliver of background.
  if (category === "chair" || category === "armchair") {
    return verdict.insetTop >= 0.008 && verdict.insetBottom >= 0.008 && verdict.boxH >= 0.4 && verdict.boxW >= 0.28;
  }
  // Case goods need space above and below, and enough height that a top-down slice of a tabletop is not kept.
  return verdict.insetTop >= 0.04 && verdict.insetBottom >= 0.04 && verdict.boxW >= 0.45 && verdict.boxH >= 0.26;
}

async function bestImage(images: ShopifyImage[], category: string) {
  let best: { url: string; verdict: Awaited<ReturnType<typeof judgeProductImage>> } | null = null;
  for (const image of images.slice(0, 6)) {
    const url = image.src + (image.src.includes("?") ? "&" : "?") + "width=1400";
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(40_000) });
    if (!res.ok) continue;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 8_000_000) continue;
    const verdict = await judgeProductImage(buf);
    if (!showsWholeProduct(category, verdict)) continue;
    const lamps = category === "floor_lamp" || category === "table_lamp" || category === "ceiling_light";
    const score = lamps ? verdict.boxW * verdict.boxH : verdict.whiteFraction;
    const bestScore = best ? (lamps ? best.verdict.boxW * best.verdict.boxH : best.verdict.whiteFraction) : -1;
    if (!best || score > bestScore) best = { url, verdict };
  }
  return best;
}

async function searchProducts(query: string, limit: number) {
  const url = `${ORIGIN}/search/suggest.json?q=${encodeURIComponent(query)}&resources[type]=product&resources[limit]=${limit}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(40_000) });
  if (!res.ok) return [];
  const body = await res.json() as { resources?: { results?: { products?: { handle: string }[] } } };
  const handles = body.resources?.results?.products?.map((p) => p.handle) ?? [];
  const products: ShopifyProduct[] = [];
  for (const handle of handles) {
    const full = await fetch(`${ORIGIN}/products/${handle}.json`, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(40_000) });
    if (!full.ok) continue;
    const json = await full.json() as { product?: ShopifyProduct };
    if (json.product) products.push(json.product);
  }
  return products;
}

async function main() {
  const kept = new Map<string, Record<string, unknown>>();
  const counts: Record<string, number> = {};
  let examined = 0;
  let rejected = 0;

  async function consider(product: ShopifyProduct, category: string | null) {
    examined++;
    const knowsStock = product.variants.some((v) => typeof v.available === "boolean");
    const variant = knowsStock ? product.variants.find((v) => v.available) : product.variants[0];
    if (!variant || !category) { rejected++; return; }
    const text = `${product.title} ${decode(product.body_html ?? "")}`;
    if (/outdoor|patio/.test(text.toLowerCase())) { rejected++; return; }
    if (category === "chair" && /set of \d+/i.test(product.title)) { rejected++; return; }
    if ((counts[category] ?? 0) >= PER_CATEGORY) return;
    if (kept.has(String(variant.id))) return;
    const image = await bestImage(product.images ?? [], category);
    if (!image) { rejected++; return; }
    const price = Number(variant.price);
    if (!Number.isFinite(price) || price <= 0) { rejected++; return; }
    counts[category] = (counts[category] ?? 0) + 1;
    kept.set(String(variant.id), {
      externalId: String(variant.id),
      name: product.title,
      description: decode(product.body_html ?? "").slice(0, 400),
      category,
      price,
      currency: "USD",
      productUrl: `${ORIGIN}/products/${product.handle}`,
      imageUrl: image.url,
      brand: product.vendor || "High Fashion Home",
      colors: colorsIn(product.title),
      materials: [],
      styleTags: styleTags(text),
      availability: "in_stock",
      image: {
        width: image.verdict.width,
        height: image.verdict.height,
        format: image.verdict.format,
        cleanEdges: image.verdict.cleanEdges,
        whiteFraction: Number(image.verdict.whiteFraction.toFixed(2)),
      },
    });
    process.stdout.write(`  ${category.padEnd(14)} ${image.verdict.width}x${image.verdict.height} white ${image.verdict.whiteFraction.toFixed(2)} ${product.title.slice(0, 56)}\n`);
  }

  for (const collection of COLLECTIONS) {
    const pages = collection.category === "lighting" || collection.handle === "dining-chairs" ? 2 : 1;
    for (let page = 1; page <= pages; page++) {
      const data = await fetchJson(`${ORIGIN}/collections/${collection.handle}/products.json?limit=${EXAMINE}&page=${page}`);
      for (const product of data.products ?? []) {
        const category = collection.category === "lighting" ? lightingCategory(product.title) : collection.category;
        await consider(product, category);
      }
      if ((data.products ?? []).length < EXAMINE) break;
    }
  }

  if ((counts.floor_lamp ?? 0) < PER_CATEGORY) {
    for (const product of await searchProducts("floor lamp", 12)) await consider(product, "floor_lamp");
  }
  if ((counts.ceiling_light ?? 0) < PER_CATEGORY) {
    for (const product of await searchProducts("chandelier", 8)) await consider(product, "ceiling_light");
  }
  if ((counts.chair ?? 0) < PER_CATEGORY) {
    for (const product of await searchProducts("dining chair", 12)) await consider(product, "chair");
  }

  const products = [...kept.values()].sort((a, b) => String(a.category).localeCompare(String(b.category)) || String(a.name).localeCompare(String(b.name)));
  const file = {
    source: ORIGIN,
    checked_at: new Date().toISOString(),
    rules: "Each image is JPEG, PNG, or WebP, at least 512 px on the short side, with the product isolated on a white or studio-light background.",
    products,
  };
  writeFileSync("data/catalogue/studio-furniture.json", JSON.stringify(file, null, 2) + "\n");
  console.log(`\nKept ${products.length}, rejected ${rejected}, examined ${examined}`);
  console.log(counts);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
