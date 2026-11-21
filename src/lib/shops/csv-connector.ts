import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { config } from "../config";
import type { Availability, ConnectorFactory, RawProduct, ShopConnector } from "./types";

function num(v: string | undefined): number | null {
  if (!v) return null;
  const n = parseFloat(v.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function parseAvailability(v: string | undefined): Availability {
  const s = (v ?? "").trim().toLowerCase().replace(/[_-]/g, " ");
  if (s === "in stock") return "in_stock";
  if (s === "limited availability" || s === "low stock") return "low_stock";
  if (s === "out of stock") return "out_of_stock";
  if (s === "preorder" || s === "backorder") return "preorder";
  return "unknown";
}

// Reads a Google-Merchant-style CSV feed from a local path (or a URL when feed_url is set).
class CsvConnector implements ShopConnector {
  constructor(private cfg: { path?: string; feed_url?: string }) {}

  private async load(): Promise<string> {
    if (this.cfg.feed_url) {
      const res = await fetch(this.cfg.feed_url, { signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new Error(`Feed returned ${res.status}`);
      return res.text();
    }
    if (!this.cfg.path) throw new Error("feed_csv connector needs `path` or `feed_url`");
    return readFile(path.resolve(config.root, this.cfg.path), "utf8");
  }

  async *fetchProducts(): AsyncIterable<RawProduct> {
    const rows = parse(await this.load(), { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
    for (const r of rows) {
      const w = num(r.width_cm), d = num(r.depth_cm), h = num(r.height_cm);
      yield {
        externalId: r.id,
        name: r.title,
        description: r.description,
        shopCategoryPath: r.product_type,
        price: num(r.price),
        salePrice: num(r.sale_price),
        currency: r.currency || undefined,
        productUrl: r.link,
        imageUrl: r.image_link,
        brand: r.brand || undefined,
        colors: r.color ? [r.color.toLowerCase()] : [],
        materials: r.material ? [r.material.toLowerCase()] : [],
        styleTags: r.style ? r.style.split(/[|,]/).map((s) => s.trim().toLowerCase()) : [],
        dimensionsCm: { width: w ?? undefined, depth: d ?? undefined, height: h ?? undefined },
        availability: parseAvailability(r.availability),
      };
    }
  }
}

export const csvConnectorFactory: ConnectorFactory = (shop) =>
  new CsvConnector(shop.connector_config as { path?: string; feed_url?: string });
