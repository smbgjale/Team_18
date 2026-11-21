// Generates the SAMPLE catalogue used for local development and demos:
// three fictional shops (CSV feeds in Google-Merchant-like columns), a shops.json
// registry, and simple SVG product illustrations. None of this is real shop data.
import { mkdirSync, writeFileSync } from "node:fs";

const COLORS = {
  white: "#f2efe8", ivory: "#e8dfc9", beige: "#d6c5a6", grey: "#b4b3af", charcoal: "#4b4b4f",
  black: "#26262a", navy: "#2f4468", green: "#728f78", terracotta: "#c4704f", brown: "#7a5538",
  oak: "#b98a56", walnut: "#6b4a2f", mustard: "#d1a02a", blush: "#e2b8ae", blue: "#6f93b8", brass: "#b8963e",
};

const CATEGORIES = {
  sofa: { nouns: ["3-Seater Sofa", "Corner Sofa", "Loveseat"], price: [450, 1800], colors: ["grey", "beige", "navy", "green", "charcoal", "terracotta", "ivory"], materials: ["linen", "velvet", "boucle", "leather"], dims: [190, 90, 80] },
  armchair: { nouns: ["Armchair", "Accent Chair", "Lounge Chair"], price: [180, 700], colors: ["mustard", "green", "grey", "terracotta", "navy", "beige"], materials: ["velvet", "boucle", "linen"], dims: [78, 80, 85] },
  bed: { nouns: ["Queen Bed Frame", "King Bed Frame", "Platform Bed"], price: [350, 1500], colors: ["oak", "walnut", "grey", "white", "beige", "black"], materials: ["solid wood", "upholstered fabric", "metal"], dims: [165, 215, 100] },
  coffee_table: { nouns: ["Coffee Table", "Round Coffee Table", "Nesting Coffee Tables"], price: [90, 450], colors: ["oak", "walnut", "black", "white", "brass"], materials: ["solid wood", "marble", "glass and metal"], dims: [100, 55, 40] },
  dining_table: { nouns: ["Dining Table", "Extendable Dining Table", "Round Dining Table"], price: [250, 1200], colors: ["oak", "walnut", "white", "black"], materials: ["solid wood", "veneer", "marble"], dims: [160, 90, 75] },
  side_table: { nouns: ["Side Table", "Bedside Table", "End Table"], price: [45, 220], colors: ["oak", "walnut", "black", "white", "brass"], materials: ["solid wood", "metal", "rattan"], dims: [45, 40, 55] },
  desk: { nouns: ["Writing Desk", "Home Office Desk", "Standing Desk"], price: [160, 700], colors: ["oak", "walnut", "white", "black"], materials: ["solid wood", "veneer", "steel frame"], dims: [140, 70, 75] },
  chair: { nouns: ["Dining Chair", "Wooden Chair", "Upholstered Chair"], price: [55, 260], colors: ["oak", "black", "grey", "green", "beige", "walnut"], materials: ["solid wood", "velvet", "metal"], dims: [45, 52, 85] },
  wardrobe: { nouns: ["Wardrobe", "Sliding Door Wardrobe", "Armoire"], price: [300, 1400], colors: ["white", "oak", "walnut", "grey", "black"], materials: ["engineered wood", "solid wood"], dims: [180, 60, 200] },
  tv_unit: { nouns: ["TV Stand", "Media Console", "TV Cabinet"], price: [140, 650], colors: ["oak", "walnut", "white", "black"], materials: ["solid wood", "veneer"], dims: [160, 40, 50] },
  shelf: { nouns: ["Bookshelf", "Wall Shelf Set", "Open Shelving Unit"], price: [60, 420], colors: ["oak", "black", "white", "walnut"], materials: ["solid wood", "metal and wood"], dims: [80, 30, 180] },
  rug: { nouns: ["Area Rug", "Wool Rug", "Round Rug"], price: [70, 520], colors: ["beige", "grey", "terracotta", "navy", "ivory", "green", "blush"], materials: ["wool", "jute", "cotton"], dims: [200, 290, 1] },
  curtains: { nouns: ["Curtain Panels (pair)", "Blackout Curtains (pair)", "Linen Curtains (pair)"], price: [30, 190], colors: ["white", "beige", "grey", "green", "navy", "blush", "terracotta"], materials: ["linen", "cotton", "velvet", "polyester blackout"], dims: [140, 1, 240] },
  ceiling_light: { nouns: ["Pendant Light", "Chandelier", "Ceiling Lamp"], price: [60, 480], colors: ["brass", "black", "white", "oak"], materials: ["metal", "rattan", "glass"], dims: [45, 45, 40] },
  floor_lamp: { nouns: ["Floor Lamp", "Arc Floor Lamp", "Tripod Floor Lamp"], price: [55, 320], colors: ["brass", "black", "white", "oak"], materials: ["metal", "wood", "fabric shade"], dims: [40, 40, 160] },
  table_lamp: { nouns: ["Table Lamp", "Ceramic Table Lamp", "Desk Lamp"], price: [25, 160], colors: ["white", "brass", "black", "terracotta", "green"], materials: ["ceramic", "metal", "glass"], dims: [25, 25, 45] },
  wall_art: { nouns: ["Framed Print", "Canvas Wall Art", "Gallery Wall Set"], price: [20, 220], colors: ["terracotta", "blue", "green", "beige", "black", "mustard"], materials: ["canvas", "framed paper", "wood frame"], dims: [60, 3, 80] },
  mirror: { nouns: ["Wall Mirror", "Round Mirror", "Full-Length Mirror"], price: [50, 380], colors: ["brass", "black", "oak", "white"], materials: ["metal frame", "wood frame"], dims: [60, 3, 120] },
  plant_pot: { nouns: ["Planter", "Ceramic Plant Pot", "Plant Stand and Pot"], price: [15, 120], colors: ["terracotta", "white", "grey", "black", "green"], materials: ["ceramic", "concrete", "rattan"], dims: [30, 30, 35] },
  cushion: { nouns: ["Cushion Cover Set", "Throw Pillow", "Velvet Cushion"], price: [12, 70], colors: ["mustard", "green", "terracotta", "navy", "blush", "grey", "ivory"], materials: ["velvet", "linen", "cotton"], dims: [45, 12, 45] },
};

const STYLES = ["modern", "scandinavian", "minimalist", "industrial", "bohemian", "classic"];
const STYLE_WORDS = {
  modern: ["Contemporary", "Sleek", "Studio"], scandinavian: ["Nordic", "Fjord", "Hygge"],
  minimalist: ["Pure", "Simple", "Essential"], industrial: ["Loft", "Foundry", "Forge"],
  bohemian: ["Boho", "Sahara", "Bazaar"], classic: ["Heritage", "Regent", "Manor"],
};
const STYLE_FOR_COLOR = (c) => ({ oak: ["scandinavian", "minimalist"], walnut: ["classic", "modern"], black: ["industrial", "modern"], charcoal: ["industrial", "modern"], terracotta: ["bohemian"], mustard: ["bohemian", "modern"], green: ["scandinavian", "bohemian"], navy: ["classic", "modern"], white: ["minimalist", "scandinavian"], ivory: ["classic", "minimalist"], beige: ["scandinavian", "minimalist"], grey: ["modern", "scandinavian"], blush: ["bohemian", "scandinavian"], blue: ["classic", "bohemian"], brass: ["classic", "modern"], brown: ["classic", "industrial"] }[c] ?? STYLES);

const SHOPS = [
  { slug: "nordhaus-living", name: "Nordhaus Living", website_url: "https://nordhaus.example", brand: "Nordhaus", typeFmt: (c) => `Furniture > ${c}`, priceMul: 1.0 },
  { slug: "casa-terra", name: "Casa Terra", website_url: "https://casaterra.example", brand: "Casa Terra", typeFmt: (c) => `Home & Living / ${c}`, priceMul: 0.85 },
  { slug: "loft-and-co", name: "Loft & Co", website_url: "https://loftandco.example", brand: "Loft & Co", typeFmt: (c) => c.toUpperCase(), priceMul: 1.2 },
];

let seed = 42;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const title = (s) => s.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
const shade = (hex, f) => {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * f))));
  return "#" + ch.map((v) => v.toString(16).padStart(2, "0")).join("");
};

const R = (x, y, w, h, f, rx = 0) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${f}"/>`;
const E = (cx, cy, rx, ry, f) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${f}"/>`;
const DRAW = {
  sofa: (c, d, l) => R(70, 120, 260, 90, c, 18) + R(60, 140, 50, 80, d, 16) + R(290, 140, 50, 80, d, 16) + R(95, 100, 100, 60, l, 12) + R(205, 100, 100, 60, l, 12) + R(85, 215, 12, 20, d) + R(303, 215, 12, 20, d),
  armchair: (c, d, l) => R(120, 100, 160, 100, c, 20) + R(105, 140, 40, 70, d, 14) + R(255, 140, 40, 70, d, 14) + R(150, 150, 100, 50, l, 10) + R(135, 210, 10, 25, d) + R(255, 210, 10, 25, d),
  bed: (c, d) => R(70, 90, 260, 70, d, 8) + R(80, 150, 240, 60, "#f1ede4", 8) + R(80, 165, 240, 45, c, 6) + R(95, 138, 70, 28, "#fff", 8) + R(235, 138, 70, 28, "#fff", 8) + R(70, 205, 14, 30, d) + R(316, 205, 14, 30, d),
  coffee_table: (c, d) => R(90, 150, 220, 18, c, 4) + R(105, 168, 12, 60, d) + R(283, 168, 12, 60, d) + R(150, 130, 40, 20, "#8aa", 4),
  dining_table: (c, d) => R(70, 130, 260, 18, c, 4) + R(90, 148, 14, 90, d) + R(296, 148, 14, 90, d),
  side_table: (c, d) => E(200, 150, 70, 16, c) + R(194, 160, 12, 70, d) + E(200, 232, 36, 8, d),
  desk: (c, d) => R(70, 130, 260, 16, c, 3) + R(80, 146, 12, 90, d) + R(308, 146, 12, 90, d) + R(220, 146, 80, 60, d, 4) + R(150, 100, 70, 30, "#2a2e36", 3),
  chair: (c, d) => R(150, 80, 100, 90, c, 10) + R(140, 160, 120, 22, d, 6) + R(148, 182, 12, 56, d) + R(240, 182, 12, 56, d),
  wardrobe: (c, d) => R(110, 40, 180, 200, c, 4) + R(198, 50, 4, 180, d) + R(184, 130, 8, 24, d, 3) + R(208, 130, 8, 24, d, 3),
  tv_unit: (c, d) => R(70, 165, 260, 55, c, 4) + R(80, 175, 70, 36, d, 3) + R(160, 175, 70, 36, d, 3) + R(240, 175, 80, 36, d, 3) + R(120, 80, 160, 80, "#20232a", 3),
  shelf: (c, d) => R(130, 40, 140, 200, d, 3) + R(138, 50, 124, 8, c) + R(138, 100, 124, 8, c) + R(138, 150, 124, 8, c) + R(138, 200, 124, 8, c) + R(150, 66, 20, 34, "#9b7", 2) + R(185, 76, 28, 24, "#c85", 2),
  rug: (c, d, l) => `<polygon points="90,150 310,150 350,220 50,220" fill="${c}"/><polygon points="115,165 285,165 315,208 85,208" fill="none" stroke="${l}" stroke-width="5"/>`,
  curtains: (c, d) => R(60, 36, 280, 8, d, 3) + R(80, 44, 90, 190, c, 6) + R(230, 44, 90, 190, c, 6) + [100, 120, 140, 250, 270, 290].map((x) => R(x, 44, 3, 190, d)).join("") + R(172, 44, 56, 190, "#cfe3f1", 2),
  ceiling_light: (c, d) => R(199, 20, 2, 80, d) + `<polygon points="150,160 250,160 225,100 175,100" fill="${c}"/>` + E(200, 162, 50, 7, d) + E(200, 172, 24, 6, "#ffe9a8"),
  floor_lamp: (c, d) => R(196, 90, 8, 140, d) + E(200, 232, 38, 8, d) + `<polygon points="150,100 250,100 230,40 170,40" fill="${c}"/>`,
  table_lamp: (c, d) => R(190, 150, 20, 60, d, 6) + E(200, 214, 40, 8, d) + `<polygon points="155,150 245,150 228,95 172,95" fill="${c}"/>`,
  wall_art: (c, d, l) => R(110, 40, 180, 200, d, 3) + R(122, 52, 156, 176, l, 2) + E(200, 120, 44, 44, c) + R(130, 180, 140, 36, c, 4),
  mirror: (c, d) => E(200, 140, 82, 100, d) + E(200, 140, 72, 90, "#cfe3ee") + `<polygon points="170,70 210,70 150,210 125,210" fill="#fff" opacity=".35"/>`,
  plant_pot: (c, d) => `<polygon points="150,170 250,170 235,235 165,235" fill="${c}"/>` + R(145, 160, 110, 14, d, 4) + E(175, 120, 22, 44, "#5f8f5a") + E(205, 105, 22, 56, "#4d7d4c") + E(232, 125, 20, 40, "#6a9b63"),
  cushion: (c, d, l) => R(120, 100, 160, 130, c, 22) + `<path d="M130 110 L270 220 M270 110 L130 220" stroke="${d}" stroke-width="3" opacity=".35"/>` + E(200, 165, 14, 14, l),
};

const svgFor = (cat, colorKey) => {
  const c = COLORS[colorKey], d = shade(c, 0.72), l = shade(c, 1.12 > 1 ? 1.15 : 1);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300"><defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6f3ee"/><stop offset="1" stop-color="#e7e2d9"/></linearGradient></defs><rect width="400" height="300" fill="url(#bg)"/><rect y="245" width="400" height="55" fill="#dcd6ca"/><ellipse cx="200" cy="246" rx="140" ry="9" fill="#000" opacity=".08"/>${DRAW[cat](c, d, l)}</svg>`;
};

mkdirSync("data/catalogue", { recursive: true });
mkdirSync("public/demo-products", { recursive: true });

const csvEscape = (v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const HEAD = ["id", "title", "description", "product_type", "price", "sale_price", "currency", "link", "image_link", "brand", "color", "material", "availability", "width_cm", "depth_cm", "height_cm", "style"];
const shopsJson = [];
const usedSvgs = new Set();

for (const shop of SHOPS) {
  const rows = [];
  const categoryMap = {};
  let n = 1;
  for (const [cat, spec] of Object.entries(CATEGORIES)) {
    const type = shop.typeFmt(title(cat) === "Tv Unit" ? "TV Units" : title(cat) + "s");
    categoryMap[type] = cat;
    const count = 3 + (rnd() < 0.5 ? 1 : 0);
    for (let i = 0; i < count; i++) {
      const color = pick(spec.colors);
      const style = pick(STYLE_FOR_COLOR(color).filter((s) => STYLES.includes(s)));
      const noun = pick(spec.nouns);
      const material = pick(spec.materials);
      const raw = (spec.price[0] + rnd() * (spec.price[1] - spec.price[0])) * shop.priceMul;
      const price = Math.round(raw / 5) * 5 - 0.01;
      const onSale = rnd() < 0.2;
      const avail = rnd();
      const sku = `${shop.slug.slice(0, 3).toUpperCase()}-${String(n++).padStart(4, "0")}`;
      const svg = `${cat}-${color}.svg`;
      usedSvgs.add(`${cat}|${color}`);
      rows.push({
        id: sku,
        title: `${pick(STYLE_WORDS[style])} ${title(color)} ${noun}`,
        description: `A ${style} ${noun.toLowerCase()} in ${color}, made with ${material}. Designed by ${shop.brand} for everyday comfort and a clean, cohesive look.`,
        product_type: type,
        price: price.toFixed(2),
        sale_price: onSale ? (Math.round(price * 0.85) - 0.01).toFixed(2) : "",
        currency: "USD",
        link: `/demo-shop/${shop.slug}/${sku}`,
        image_link: `/demo-products/${svg}`,
        brand: shop.brand,
        color,
        material,
        availability: avail < 0.65 ? "in stock" : avail < 0.78 ? "limited availability" : avail < 0.85 ? "out of stock" : avail < 0.9 ? "preorder" : "",
        width_cm: Math.round(spec.dims[0] * (0.9 + rnd() * 0.25)),
        depth_cm: Math.round(spec.dims[1] * (0.9 + rnd() * 0.25)),
        height_cm: Math.round(spec.dims[2] * (0.9 + rnd() * 0.25)),
        style,
      });
    }
  }
  writeFileSync(`data/catalogue/${shop.slug}.csv`, [HEAD.join(","), ...rows.map((r) => HEAD.map((h) => csvEscape(r[h])).join(","))].join("\n") + "\n");
  shopsJson.push({
    slug: shop.slug, name: shop.name, website_url: shop.website_url, currency: "USD",
    connector_type: "feed_csv", connector_config: { path: `data/catalogue/${shop.slug}.csv` },
    category_map: categoryMap, agreement_type: "demo", is_demo: true,
  });
}

for (const key of usedSvgs) {
  const [cat, color] = key.split("|");
  writeFileSync(`public/demo-products/${cat}-${color}.svg`, svgFor(cat, color));
}
writeFileSync("data/shops.json", JSON.stringify(shopsJson, null, 2) + "\n");
console.log(`Generated ${SHOPS.length} shops and ${usedSvgs.size} product images.`);
