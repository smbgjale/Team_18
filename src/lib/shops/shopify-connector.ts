import type { ConnectorFactory, RawProduct, ShopConnector } from "./types";
import { decodeHtml } from "./html";

interface ShopifyConfig {
  shop_url: string;
  style_tags?: string[];
}

interface ShopifyVariant {
  id: number;
  title: string;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  sku: string | null;
  available: boolean;
  price: string;
  compare_at_price: string | null;
  featured_image: { src?: string } | null;
}

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  vendor: string;
  body_html: string | null;
  product_type: string;
  tags: string[] | string;
  options: { name: string; position: number }[];
  variants: ShopifyVariant[];
  images: { src: string }[];
}

const UA = "HOMELY-AI/0.1 (catalogue sync; public product catalogue read)";

function tagList(tags: ShopifyProduct["tags"]) {
  return Array.isArray(tags) ? tags : tags.split(",").map((t) => t.trim()).filter(Boolean);
}

function optionValue(product: ShopifyProduct, variant: ShopifyVariant, names: string[]) {
  const opt = product.options.find((o) => names.includes(o.name.toLowerCase()));
  if (!opt) return undefined;
  const value = [variant.option1, variant.option2, variant.option3][opt.position - 1];
  return value && value !== "Default Title" ? value : undefined;
}

export function shopifyProducts(shopUrl: string, products: ShopifyProduct[], styleTags: string[]): RawProduct[] {
  const origin = shopUrl.replace(/\/$/, "");
  const out: RawProduct[] = [];
  for (const product of products) {
    for (const variant of product.variants) {
      const price = Number(variant.price);
      const compare = variant.compare_at_price ? Number(variant.compare_at_price) : null;
      const color = optionValue(product, variant, ["color", "colour"]);
      const image = variant.featured_image?.src || product.images[0]?.src;
      const title = variant.title && variant.title !== "Default Title" ? `${product.title} — ${variant.title}` : product.title;
      const tags = tagList(product.tags);
      out.push({
        externalId: String(variant.id),
        name: decodeHtml(title),
        description: product.body_html ? decodeHtml(product.body_html).slice(0, 500) : undefined,
        shopCategoryPath: product.product_type.trim(),
        price: compare != null && compare > price ? compare : price,
        salePrice: compare != null && compare > price ? price : null,
        productUrl: `${origin}/products/${product.handle}?variant=${variant.id}`,
        imageUrl: image ?? "",
        brand: product.vendor || undefined,
        colors: color ? [color.toLowerCase()] : [],
        materials: /cotton/i.test(`${product.title} ${tags.join(" ")}`) ? ["handwoven ethiopian cotton"] : [],
        styleTags,
        availability: variant.available ? "in_stock" : "out_of_stock",
      });
    }
  }
  return out;
}

class ShopifyConnector implements ShopConnector {
  constructor(private cfg: ShopifyConfig) {}

  async *fetchProducts(): AsyncIterable<RawProduct> {
    const origin = this.cfg.shop_url.replace(/\/$/, "");
    const styleTags = this.cfg.style_tags ?? [];
    for (let page = 1; page <= 20; page++) {
      const res = await fetch(`${origin}/products.json?limit=250&page=${page}`, {
        headers: { Accept: "application/json", "User-Agent": UA },
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`Shopify catalogue returned ${res.status}`);
      const body = (await res.json()) as { products?: ShopifyProduct[] };
      const products = body.products ?? [];
      if (!products.length) break;
      for (const product of shopifyProducts(origin, products, styleTags)) yield product;
      if (products.length < 250) break;
    }
  }
}

export const shopifyConnectorFactory: ConnectorFactory = (shop) =>
  new ShopifyConnector(shop.connector_config as unknown as ShopifyConfig);
