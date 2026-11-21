import { readFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../config";
import type { Availability, ConnectorFactory, RawProduct, ShopConnector } from "./types";

interface CuratedProduct {
  externalId: string;
  name: string;
  description?: string;
  category: string;
  price: number;
  currency?: string;
  productUrl: string;
  imageUrl: string;
  brand?: string;
  colors?: string[];
  materials?: string[];
  styleTags?: string[];
  availability?: Availability;
  dimensionsCm?: { width?: number; depth?: number; height?: number };
}

class CuratedConnector implements ShopConnector {
  constructor(private file: string) {}

  async *fetchProducts(): AsyncIterable<RawProduct> {
    const raw = await readFile(path.resolve(config.root, this.file), "utf8");
    const body = JSON.parse(raw) as { products: CuratedProduct[] };
    for (const p of body.products) {
      yield {
        externalId: p.externalId,
        name: p.name,
        description: p.description,
        shopCategoryPath: p.category,
        price: p.price,
        currency: p.currency,
        productUrl: p.productUrl,
        imageUrl: p.imageUrl,
        brand: p.brand,
        colors: p.colors,
        materials: p.materials,
        styleTags: p.styleTags,
        dimensionsCm: p.dimensionsCm,
        availability: p.availability ?? "unknown",
      };
    }
  }
}

export const curatedConnectorFactory: ConnectorFactory = (shop) => {
  const file = shop.connector_config.path;
  if (typeof file !== "string" || !file) throw new Error("curated_json connector needs `path`");
  return new CuratedConnector(file);
};
