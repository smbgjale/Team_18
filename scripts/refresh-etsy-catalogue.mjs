// Builds data/catalogue/etsy-ethiopian.json from public Internet Archive snapshots of
// Etsy market pages. Etsy blocks unauthenticated fetches, and the Open API needs a key
// this app does not have, so the snapshot is taken from archived public pages.
// Image files stay on i.etsystatic.com. Nothing is copied into the repo except URLs.
//
// Usage: node scripts/refresh-etsy-catalogue.mjs

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "data/catalogue/etsy-ethiopian.json");
const UA = "HOMELY-AI/0.1 (catalogue sync; public archive read)";

const MARKETS = [
  {
    id: "ethiopian_pillow",
    label: "Ethiopian Pillow",
    archive: "https://web.archive.org/web/20251005031746id_/https://www.etsy.com/market/ethiopian_pillow",
  },
  {
    id: "ethiopian_sefed",
    label: "Ethiopian Sefed",
    archive: "https://web.archive.org/web/20251125112322id_/https://www.etsy.com/market/ethiopian_sefed",
  },
];

// Wall-decor listings linked from an archived MesobCrafts painting, plus one wall basket
// that the Austrian basket market priced in euros. The US listing page, when archived,
// supplies the dollar price and the Etsy breadcrumb.
// Timestamps are public Wayback captures. The availability API often times out,
// so these listings are read from the capture directly.
const SEED_LISTINGS = [
  ["1331092534", "various-designs-traditional-leather", "20251118073522"],
  ["1600744486", "traditional-leather-painting-coptic", "20250826050433"],
  ["1317658220", "king-haile-selassie-african-traditional", "20250915143431"],
  ["1573646643", "ethiopian-masinqo-wall-art-traditional", "20251117224959"],
  ["4345441356", "antique-ethiopian-decorative-triangle", "20260116064904"],
].map(([id, slug, timestamp]) => ({
  url: `https://www.etsy.com/listing/${id}/${slug}`,
  archive: `https://web.archive.org/web/${timestamp}id_/https://www.etsy.com/listing/${id}/${slug}`,
}));

const CAPS = { cushion: 8, wall_art: 10, rug: 4, coffee_table: 2 };
const MIN_EDGE = 512;

const SKIP =
  /\b(diy|needlepoint kit|embroidery kit|digital download|instant download|\bsvg\b|png file|t-shirts?|\btees?\b|\bdresses?\b|kemis|earrings?|necklaces?|pendants?|\bopal\b|gemstones?|headrests?|head rests?|napkins?|placemats?|coasters?|table runners?|tablecloths?|sweatshirts?|hoodies?|\bscarves?\b|\bshawls?\b|netelas?|\bbaby\b|christening|backdrops?|jebena|kirar|shower curtains?|stickers?|tumblers?)\b/i;

function decode(value) {
  return String(value ?? "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function listingId(url) {
  return url?.match(/\/listing\/(\d+)/)?.[1] ?? null;
}

function canonicalUrl(url, name) {
  const id = listingId(url);
  const slug =
    url?.match(/\/listing\/\d+\/([a-z0-9-]+)/i)?.[1] ??
    decode(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80);
  return id ? `https://www.etsy.com/listing/${id}/${slug}` : url;
}

async function get(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Encoding": "identity" }, redirect: "follow" });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const body = buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf) : buf;
  return { body, type: res.headers.get("content-type") ?? "" };
}

function jsonLd(html) {
  const blocks = [];
  const re = /<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/gis;
  for (const match of html.matchAll(re)) {
    try {
      blocks.push(JSON.parse(match[1]));
    } catch {
      // Archived pages sometimes contain a second, broken block.
    }
  }
  return blocks;
}

function productsFromMarket(html, market) {
  const found = [];
  for (const block of jsonLd(html)) {
    if (block["@type"] !== "ItemList") continue;
    for (const entry of block.itemListElement ?? []) {
      const item = entry.item ?? entry;
      if (item["@type"] !== "Product") continue;
      const offers = Array.isArray(item.offers) ? item.offers[0] : item.offers ?? {};
      const brand = typeof item.brand === "object" ? item.brand?.name : item.brand;
      let image = item.image;
      if (Array.isArray(image)) image = image[0];
      if (image && typeof image === "object") image = image.contentURL || image.url;
      const id = listingId(item.url);
      if (!id || !image) continue;
      found.push({
        externalId: id,
        name: decode(item.name),
        productUrl: canonicalUrl(item.url, item.name),
        imageUrl: String(image).replace(/il_\d+x\d+/, "il_fullxfull").replace(/il_\d+xN/, "il_fullxfull"),
        price: Number(offers.price),
        currency: offers.priceCurrency ?? "",
        availability: String(offers.availability ?? "").endsWith("InStock") ? "in_stock" : "unknown",
        brand: decode(brand),
        market,
      });
    }
  }
  return found;
}

function isEthiopian(name) {
  return /ethiopia|ethiopian|habesha|eritrean|amharic|geez|mesob|sefed|sefet|injera|tilet|tibeb|adey|harar|axum|lalibela|addis/i.test(name);
}

function quality(name) {
  const n = name.toLowerCase();
  let score = 0;
  if (/handwoven|hand-woven|hand woven|handmade|hand made|embroidered/.test(n)) score += 3;
  if (/cotton|leather|wool|straw|palm/.test(n)) score += 1;
  if (/polyester|spun polyester|faux|sublimation|digital/.test(n)) score -= 4;
  if (/\bprint\b/.test(n) && !/wall|canvas|painting/.test(n)) score -= 4;
  if (/\bmap\b|flag pillow|rasta girl/.test(n)) score -= 2;
  return score;
}

function slotFor(name, breadcrumb) {
  const title = name.toLowerCase();
  const filed = breadcrumb.toLowerCase();
  if (SKIP.test(name) || /digital download|instant download|digital print/.test(`${filed} ${title}`)) return null;
  if (/\bfabric piece\b|\bmap panel\b/.test(title)) return null;
  if (/\bmap\b/.test(title) && !/pillow|cushion|rug|canvas|painting/.test(title)) return null;
  if (/jewelry|jewellery|clothing|shoes|craft supplies|table linens|tablecloth/.test(filed)) return null;
  // A gabi or blanket is not a cushion just because it appeared on the pillow market.
  if (/\bgabi\b|\bblanket\b|\bthrow\b/.test(title) && !/pillow|cushion/.test(title)) return null;
  // A rug or curtain keeps that slot even when Etsy files the listing under a broad decor heading.
  // A real wall-decor breadcrumb wins over the word "pillow", so a tapestry filed as a wall hanging stays on the wall.
  if (/\brugs?\b|\bkilims?\b/.test(title)) return "rug";
  if (/curtain|window treatment|\bdrapes?\b/.test(title) && !/shower/.test(title)) return "curtains";
  if (/wall decor|wall hanging|tapestries|paintings/.test(filed)) return "wall_art";
  if (/\b(pillow|cushion|pillowcase|pillow cover)s?\b/.test(title) && !/head\s?rest/.test(title)) return "cushion";
  if (/wall hanging|wall decor|wall art|wall basket|painting|canvas/.test(title)) return "wall_art";
  if (/throw pillows|decorative pillows|pillow covers|cushions/.test(filed)) return "cushion";
  if (/floor & rugs|\brugs\b/.test(filed)) return "rug";
  if (/curtains|window treatments/.test(filed)) return "curtains";
  if (/\bmesob\b/.test(title) && !/print|pillow|cover|backdrop|earring/.test(title)) return "coffee_table";
  return null;
}

function breadcrumbOf(blocks) {
  const crumb = blocks.find((b) => b["@type"] === "BreadcrumbList");
  if (!crumb) return "";
  return (crumb.itemListElement ?? [])
    .map((item) => decode(item.name))
    .filter(Boolean)
    .join(" > ");
}

function productBlock(blocks) {
  return blocks.find((b) => b["@type"] === "Product") ?? null;
}

function imageFromProduct(product) {
  const images = Array.isArray(product.image) ? product.image : [product.image];
  const urls = images
    .map((image) => (typeof image === "string" ? image : image?.contentURL || image?.url))
    .filter(Boolean);
  const full = urls.find((url) => url.includes("il_fullxfull")) ?? urls[0];
  return full ? full.replace(/il_\d+x(?:\d+|N)/, "il_fullxfull") : null;
}

function inches(text, label) {
  const match = text.match(new RegExp(`${label}:\\s*([\\d.]+)\\s*inch`, "i"));
  return match ? Math.round(Number(match[1]) * 2.54 * 10) / 10 : undefined;
}

function dimensionsFrom(text, slot) {
  // Etsy prints Width and Height next to each other in the item highlights.
  // Searching the whole page picks up unrelated lengths, such as a 2 inch detail.
  const block = text.match(/Width:\s*[\d.]+\s*inch(?:es)?[\s\S]{0,120}?(?:Height|Length|Depth):\s*[\d.]+\s*inch/i)?.[0] ?? "";
  if (!block) return undefined;
  const width = inches(block, "Width");
  const height = inches(block, "Height");
  const depth = inches(block, "Depth");
  const length = inches(block, "Length");
  const dims = {};
  if (slot === "rug") {
    if (width) dims.width = width;
    if (length) dims.depth = length;
    else if (depth) dims.depth = depth;
  } else {
    if (width) dims.width = width;
    if (depth) dims.depth = depth;
    if (height) dims.height = height;
    else if (length && !height) dims.height = length;
  }
  return Object.keys(dims).length ? dims : undefined;
}

function materialsFrom(text, name) {
  const found = new Set();
  const line = text.match(/Materials?:\s*([^.<\n]+)/i)?.[1] ?? "";
  for (const word of `${line} ${name}`.toLowerCase().split(/[^a-z]+/)) {
    if (["leather", "cotton", "wool", "straw", "palm", "wood", "silver", "brass", "grass", "shells", "linen"].includes(word)) found.add(word);
  }
  return [...found];
}

function colorsFrom(name) {
  const known = ["red", "green", "gold", "yellow", "white", "black", "blue", "brown", "orange", "beige", "cream", "natural"];
  return known.filter((color) => new RegExp(`\\b${color}\\b`, "i").test(name));
}

function styleTags(name) {
  const tags = ["african"];
  if (/vintage|antique/.test(name.toLowerCase())) tags.push("classic");
  if (/boho|bohemian/.test(name.toLowerCase())) tags.push("bohemian");
  return tags;
}

function jpegSize(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i < buf.length - 8) {
    if (buf[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = buf[i + 1];
    if (marker >= 0xc0 && marker <= 0xc2) {
      const height = buf.readUInt16BE(i + 5);
      const width = buf.readUInt16BE(i + 7);
      return { width, height, format: "jpeg" };
    }
    if (marker === 0xd8 || marker === 0xd9) {
      i += 2;
      continue;
    }
    const seglen = buf.readUInt16BE(i + 2);
    i += 2 + seglen;
  }
  return null;
}

function pngSize(buf) {
  if (buf.toString("ascii", 1, 4) !== "PNG") return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), format: "png" };
}

async function inspectImage(url) {
  const { body, type } = await get(url);
  if (!/^image\/(jpeg|png|webp)/.test(type) && !jpegSize(body) && !pngSize(body)) {
    throw new Error(`not an image (${type || "unknown"})`);
  }
  const size = jpegSize(body) || pngSize(body);
  if (!size) throw new Error(`could not read ${type || "image"} dimensions`);
  if (Math.min(size.width, size.height) < MIN_EDGE) throw new Error(`${size.width}x${size.height} is under ${MIN_EDGE}px`);
  return size;
}

async function mapPool(items, limit, worker) {
  const out = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      out[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return out;
}

async function snapshotFor(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const available = await get(`https://archive.org/wayback/available?url=${encodeURIComponent(url)}`);
    const data = JSON.parse(available.body.toString("utf8"));
    const snap = data?.archived_snapshots?.closest;
    if (snap?.url && snap.status === "200") return snap;
    if (data?.error?.code !== "timeout") return null;
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }
  const id = listingId(url);
  if (!id) return null;
  const cdx = await get(
    `https://web.archive.org/cdx/search/cdx?url=www.etsy.com/listing/${id}&output=json&fl=timestamp,statuscode&filter=statuscode:200&limit=1`,
  );
  const rows = JSON.parse(cdx.body.toString("utf8"));
  const timestamp = rows?.[1]?.[0];
  return timestamp ? { url: `https://web.archive.org/web/${timestamp}id_/https://www.etsy.com/listing/${id}`, status: "200" } : null;
}

async function enrich(item) {
  const snap = item.archive ? { url: item.archive, status: "200" } : await snapshotFor(item.productUrl);
  if (!snap?.url) return { ...item, etsyCategory: item.market?.label ?? "" };
  const archived = snap.url.includes("id_/") ? snap.url : snap.url.replace(/\/web\/(\d+)\//, "/web/$1id_/");
  const page = await get(archived);
  const html = page.body.toString("utf8");
  if (/captcha-delivery|Please enable JS/.test(html)) return { ...item, etsyCategory: item.market?.label ?? "" };
  const blocks = jsonLd(html);
  const product = productBlock(blocks);
  const breadcrumb = breadcrumbOf(blocks);
  const description = decode(product?.description ?? "").slice(0, 420);
  const offers = Array.isArray(product?.offers) ? product.offers[0] : product?.offers ?? {};
  const price = Number(offers.price);
  const currency = offers.priceCurrency || item.currency;
  const image = product ? imageFromProduct(product) : null;
  const brand = typeof product?.brand === "object" ? product.brand?.name : product?.brand;
  return {
    ...item,
    name: product?.name ? decode(product.name) : item.name,
    description,
    etsyCategory: breadcrumb || item.market?.label || "",
    price: currency === "USD" && price > 0 ? price : item.price,
    currency: currency === "USD" && price > 0 ? "USD" : item.currency,
    availability: String(offers.availability ?? "").endsWith("OutOfStock")
      ? "out_of_stock"
      : String(offers.availability ?? "").endsWith("InStock")
        ? "in_stock"
        : item.availability,
    imageUrl: image || item.imageUrl,
    brand: decode(brand) || item.brand,
    pageText: decode(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")).slice(0, 8000),
  };
}

async function main() {
  const pooled = [];
  for (const market of MARKETS) {
    process.stdout.write(`market ${market.id} ... `);
    const page = await get(market.archive);
    const items = productsFromMarket(page.body.toString("utf8"), market);
    console.log(items.length);
    pooled.push(...items);
  }
  for (const seed of SEED_LISTINGS) {
    const id = listingId(seed.url);
    if (pooled.some((item) => item.externalId === id)) continue;
    pooled.push({
      externalId: id,
      name: "",
      productUrl: seed.url,
      imageUrl: "",
      price: 0,
      currency: "",
      availability: "unknown",
      brand: "",
      market: null,
      archive: seed.archive,
    });
  }

  const unique = [...new Map(pooled.map((item) => [item.externalId, item])).values()];
  console.log(`enriching ${unique.length} listings`);
  const enriched = (await mapPool(unique, 4, async (item) => {
    try {
      return await enrich(item);
    } catch (error) {
      console.warn(`  skip ${item.externalId}: ${error.message}`);
      return item.market ? { ...item, etsyCategory: item.market.label } : null;
    }
  })).filter(Boolean);

  const chosen = [];
  const counts = {};
  const ranked = enriched
    .map((item) => {
      // The market title is not the listing's category. Only a breadcrumb with
      // several levels is Etsy's own filing; otherwise the product name decides.
      const filed = (item.etsyCategory || "").includes(">") ? item.etsyCategory : "";
      const slot = slotFor(item.name, filed);
      return { ...item, slot, rank: quality(item.name) };
    })
    .filter((item) => item.slot && item.currency === "USD" && item.price >= 8 && item.availability !== "out_of_stock")
    .filter((item) => isEthiopian(`${item.name} ${item.description ?? ""}`))
    .filter((item) => !/digital print|digital download|instant download/i.test(`${item.name} ${item.description ?? ""}`))
    .filter((item) => item.rank >= 0)
    .filter((item) => item.slot !== "coffee_table" || item.price >= 80)
    .sort((a, b) => b.rank - a.rank || b.price - a.price);

  for (const item of ranked) {
    const used = counts[item.slot] ?? 0;
    if (used >= (CAPS[item.slot] ?? 0)) continue;
    counts[item.slot] = used + 1;
    chosen.push(item);
  }

  console.log(`checking ${chosen.length} photos`);
  const products = [];
  for (const item of chosen) {
    if (!item.imageUrl) {
      console.warn(`  no image ${item.externalId} ${item.name.slice(0, 60)}`);
      continue;
    }
    try {
      const image = await inspectImage(item.imageUrl);
      const categoryLabel = item.etsyCategory || item.market?.label || item.slot;
      const dims = dimensionsFrom(`${item.pageText ?? ""} ${item.description ?? ""}`, item.slot);
      // A mesob only fills the coffee-table slot when the listing gives a table-sized width.
      let slot = item.slot;
      if (slot === "coffee_table" && !(dims?.width >= 40)) {
        if (/wall/.test(`${item.name} ${categoryLabel}`.toLowerCase())) slot = "wall_art";
        else {
          console.warn(`  mesob without table size, skipped ${item.externalId}`);
          continue;
        }
      }
      products.push({
        externalId: item.externalId,
        name: item.name,
        description: `Etsy category: ${categoryLabel}. ${item.description ?? ""}`.trim().slice(0, 500),
        category: slot,
        price: item.price,
        currency: "USD",
        productUrl: item.productUrl,
        imageUrl: item.imageUrl,
        brand: item.brand || undefined,
        colors: colorsFrom(item.name),
        materials: materialsFrom(`${item.pageText ?? ""} ${item.description ?? ""}`, item.name),
        styleTags: styleTags(item.name),
        availability: item.availability === "in_stock" ? "in_stock" : "unknown",
        ...(dims ? { dimensionsCm: dims } : {}),
        image: { ...image, source: "listing photo" },
      });
      console.log(`  ${slot.padEnd(12)} $${item.price} ${image.width}x${image.height} ${item.name.slice(0, 72)}`);
    } catch (error) {
      console.warn(`  photo ${item.externalId}: ${error.message}`);
    }
  }

  const body = {
    source: "https://www.etsy.com/market/ethiopian_home_decor",
    checked_at: new Date().toISOString(),
    rules:
      "Listings come from archived public Etsy market pages for Ethiopian pillows and sefed, plus archived wall-decor listings from those sellers. Each product keeps the Etsy category it was listed in: pillows and cushion covers are cushions, wall hangings and wall decor are wall art, and floor rugs are rugs. A mesob is a coffee table only when the listing states a table-sized width. Clothing, jewelry, digital downloads, kits, table linens and gabi blankets are left out, because this room planner has no slot for them. Photos stay on i.etsystatic.com and are the seller's listing photo, at least 512 px on the short side. Prices are the US dollar price on the archived .com page.",
    products,
  };
  await writeFile(OUT, `${JSON.stringify(body, null, 2)}\n`);
  const tally = products.reduce((acc, product) => {
    acc[product.category] = (acc[product.category] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`wrote ${products.length}`, tally);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
