import type { Availability, ConnectorFactory, RawProduct, ShopConnector } from "./types";
import { decodeHtml } from "./html";

interface WooConfig {
  store_url: string;
  category: string;
  style_tags?: string[];
}

interface WooPrices {
  price: string;
  regular_price: string;
  currency_minor_unit?: number;
  currency_code?: string;
}

interface WooProduct {
  id: number;
  name: string;
  permalink: string;
  sku: string;
  short_description: string;
  prices: WooPrices;
  images: { src: string }[];
  is_in_stock: boolean;
  is_on_backorder: boolean;
}

const UA = "HOMELY-AI/0.1 (catalogue sync; public product catalogue read)";

// The store's "Home and Kitchen" category mixes baskets with cups and clothing-adjacent goods.
// Only the basket forms map onto a furniture slot; everything else is reported as unmapped.
export function wooHomeKind(name: string) {
  const n = decodeHtml(name).toLowerCase();
  if (/basket|mesobwerk|agelegil|muday/.test(n)) return "Basket";
  if (/\bmesob\b|messob/.test(n)) return "Mesob";
  return "Other";
}

export function wooAmounts(prices: WooPrices) {
  const div = 10 ** (prices.currency_minor_unit ?? 2);
  const current = Number(prices.price) / div;
  const regular = Number(prices.regular_price) / div;
  if (!Number.isFinite(current) || current <= 0) return null;
  const price = Number.isFinite(regular) && regular > current ? regular : current;
  return { price, sale: price > current ? current : null, currency: prices.currency_code };
}

function availability(p: WooProduct): Availability {
  if (p.is_on_backorder) return "preorder";
  return p.is_in_stock ? "in_stock" : "out_of_stock";
}

class WooCommerceConnector implements ShopConnector {
  constructor(private cfg: WooConfig) {}

  async *fetchProducts(): AsyncIterable<RawProduct> {
    const origin = this.cfg.store_url.replace(/\/$/, "");
    const styleTags = this.cfg.style_tags ?? [];
    for (let page = 1; page <= 20; page++) {
      const url = `${origin}/wp-json/wc/store/v1/products?per_page=100&page=${page}&category=${encodeURIComponent(this.cfg.category)}`;
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": UA },
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`WooCommerce catalogue returned ${res.status}`);
      const products = (await res.json()) as WooProduct[];
      if (!Array.isArray(products) || !products.length) break;
      for (const p of products) {
        const amounts = wooAmounts(p.prices);
        yield {
          externalId: p.sku || String(p.id),
          name: decodeHtml(p.name),
          description: p.short_description ? decodeHtml(p.short_description).slice(0, 500) : undefined,
          shopCategoryPath: wooHomeKind(p.name),
          price: amounts?.price ?? null,
          salePrice: amounts?.sale,
          currency: amounts?.currency,
          productUrl: p.permalink,
          imageUrl: p.images[0]?.src ?? "",
          colors: [],
          materials: /basket|mesob/i.test(p.name) ? ["handwoven"] : [],
          styleTags,
          availability: availability(p),
        };
      }
      if (products.length < 100) break;
    }
  }
}

export const woocommerceConnectorFactory: ConnectorFactory = (shop) =>
  new WooCommerceConnector(shop.connector_config as unknown as WooConfig);
