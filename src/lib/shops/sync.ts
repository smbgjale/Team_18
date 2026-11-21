import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import { isCategory } from "../categories";
import { colorNameToHex } from "../color";
import { config } from "../config";
import { db } from "../db";
import { connectorFor } from "./registry";
import type { ShopRecord } from "./types";

interface ShopConfigEntry {
  slug: string;
  name: string;
  website_url: string;
  currency: string;
  connector_type: string;
  connector_config: Record<string, unknown>;
  category_map: Record<string, string>;
  affiliate_template?: string;
  agreement_type: string;
  is_demo?: boolean;
}

export interface SyncReport {
  shop: string;
  dryRun: boolean;
  seen: number;
  created: number;
  updated: number;
  unchanged: number;
  deactivated: number;
  rejected: { externalId: string; reason: string }[];
}

function rowToShop(r: Record<string, unknown>): ShopRecord {
  return {
    id: r.id as string,
    slug: r.slug as string,
    name: r.name as string,
    website_url: r.website_url as string,
    currency: r.currency as string,
    connector_type: r.connector_type as string,
    connector_config: JSON.parse(r.connector_config as string),
    category_map: JSON.parse(r.category_map as string),
    affiliate_template: (r.affiliate_template as string | null) ?? null,
    is_demo: !!r.is_demo,
  };
}

export function listShops(onlyEnabled = true): ShopRecord[] {
  const rows = db().prepare(`SELECT * FROM shops ${onlyEnabled ? "WHERE is_enabled = 1" : ""} ORDER BY name`).all() as Record<string, unknown>[];
  return rows.map(rowToShop);
}

export async function registerShopsFromConfig(file = path.join(config.root, "data", "shops.json")) {
  const entries = JSON.parse(await readFile(file, "utf8")) as ShopConfigEntry[];
  const upsert = db().prepare(`
    INSERT INTO shops (id, slug, name, website_url, currency, connector_type, connector_config, category_map, affiliate_template, agreement_type, is_demo)
    VALUES (@id, @slug, @name, @website_url, @currency, @connector_type, @connector_config, @category_map, @affiliate_template, @agreement_type, @is_demo)
    ON CONFLICT(slug) DO UPDATE SET name=excluded.name, website_url=excluded.website_url, currency=excluded.currency,
      connector_type=excluded.connector_type, connector_config=excluded.connector_config, category_map=excluded.category_map,
      affiliate_template=excluded.affiliate_template, agreement_type=excluded.agreement_type, is_demo=excluded.is_demo`);
  for (const e of entries) {
    upsert.run({
      id: nanoid(12),
      slug: e.slug,
      name: e.name,
      website_url: e.website_url,
      currency: e.currency,
      connector_type: e.connector_type,
      connector_config: JSON.stringify(e.connector_config),
      category_map: JSON.stringify(e.category_map),
      affiliate_template: e.affiliate_template ?? null,
      agreement_type: e.agreement_type,
      is_demo: e.is_demo ? 1 : 0,
    });
  }
  // Shops removed from the config disappear from the catalogue, including ones already imported.
  const slugs = entries.map((e) => e.slug);
  db().prepare(`UPDATE shops SET is_enabled = 1 WHERE slug IN (${slugs.map(() => "?").join(",")})`).run(...slugs);
  db().prepare(`UPDATE shops SET is_enabled = 0 WHERE slug NOT IN (${slugs.map(() => "?").join(",")})`).run(...slugs);
  db().prepare("UPDATE products SET is_active = 0 WHERE shop_id IN (SELECT id FROM shops WHERE is_enabled = 0)").run();
}

export async function syncShop(shop: ShopRecord, opts: { dryRun?: boolean } = {}): Promise<SyncReport> {
  const dryRun = !!opts.dryRun;
  const d = db();
  const report: SyncReport = { shop: shop.slug, dryRun, seen: 0, created: 0, updated: 0, unchanged: 0, deactivated: 0, rejected: [] };
  const runId = nanoid(12);
  if (!dryRun) d.prepare("INSERT INTO shop_sync_runs (id, shop_id, status) VALUES (?, ?, 'running')").run(runId, shop.id);

  const existing = new Map<string, { id: string; content_hash: string; is_active: number }>();
  for (const r of d.prepare("SELECT id, external_id, content_hash, is_active FROM products WHERE shop_id = ?").all(shop.id) as {
    id: string; external_id: string; content_hash: string; is_active: number;
  }[]) existing.set(r.external_id, r);

  const upsert = d.prepare(`
    INSERT INTO products (id, shop_id, external_id, name, description, category, price_minor, sale_price_minor, currency, product_url, image_url,
      brand, colors, dominant_color_hex, materials, style_tags, width_cm, depth_cm, height_cm, availability, is_active, content_hash, last_synced_at)
    VALUES (@id, @shop_id, @external_id, @name, @description, @category, @price_minor, @sale_price_minor, @currency, @product_url, @image_url,
      @brand, @colors, @dominant_color_hex, @materials, @style_tags, @width_cm, @depth_cm, @height_cm, @availability, 1, @content_hash, datetime('now'))
    ON CONFLICT(shop_id, external_id) DO UPDATE SET name=excluded.name, description=excluded.description, category=excluded.category,
      price_minor=excluded.price_minor, sale_price_minor=excluded.sale_price_minor, currency=excluded.currency, product_url=excluded.product_url,
      image_url=excluded.image_url, brand=excluded.brand, colors=excluded.colors, dominant_color_hex=excluded.dominant_color_hex,
      materials=excluded.materials, style_tags=excluded.style_tags, width_cm=excluded.width_cm, depth_cm=excluded.depth_cm,
      height_cm=excluded.height_cm, availability=excluded.availability, is_active=1, content_hash=excluded.content_hash, last_synced_at=datetime('now')`);

  const seen = new Set<string>();
  try {
    for await (const p of connectorFor(shop).fetchProducts()) {
      report.seen++;
      const reject = (reason: string) => report.rejected.push({ externalId: p.externalId ?? "?", reason });
      if (!p.externalId || !p.name) { reject("missing id or name"); continue; }
      if (p.price == null || p.price <= 0) { reject("missing or invalid price"); continue; }
      if (!p.productUrl) { reject("missing product URL"); continue; }
      if (!p.imageUrl) { reject("missing image"); continue; }
      const category = shop.category_map[p.shopCategoryPath];
      if (!category || !isCategory(category)) { reject(`unmapped category "${p.shopCategoryPath}"`); continue; }

      const row = {
        id: existing.get(p.externalId)?.id ?? nanoid(12),
        shop_id: shop.id,
        external_id: p.externalId,
        name: p.name,
        description: p.description ?? null,
        category,
        price_minor: Math.round(p.price * 100),
        sale_price_minor: p.salePrice ? Math.round(p.salePrice * 100) : null,
        currency: (p.currency ?? shop.currency).toUpperCase(),
        product_url: p.productUrl,
        image_url: p.imageUrl,
        brand: p.brand ?? null,
        colors: JSON.stringify(p.colors ?? []),
        dominant_color_hex: colorNameToHex(p.colors?.[0]),
        materials: JSON.stringify(p.materials ?? []),
        style_tags: JSON.stringify(p.styleTags ?? []),
        width_cm: p.dimensionsCm?.width ?? null,
        depth_cm: p.dimensionsCm?.depth ?? null,
        height_cm: p.dimensionsCm?.height ?? null,
        availability: p.availability,
        content_hash: "",
      };
      row.content_hash = createHash("sha256").update(JSON.stringify({ ...row, id: undefined })).digest("hex");
      seen.add(p.externalId);

      const prev = existing.get(p.externalId);
      if (!prev) report.created++;
      else if (prev.content_hash !== row.content_hash || !prev.is_active) report.updated++;
      else { report.unchanged++; if (!dryRun) d.prepare("UPDATE products SET last_synced_at = datetime('now') WHERE id = ?").run(prev.id); continue; }
      if (!dryRun) upsert.run(row);
    }

    for (const [ext, prev] of existing) {
      if (!seen.has(ext) && prev.is_active) {
        report.deactivated++;
        if (!dryRun) d.prepare("UPDATE products SET is_active = 0 WHERE id = ?").run(prev.id);
      }
    }
    if (!dryRun) {
      d.prepare(`UPDATE shop_sync_runs SET finished_at = datetime('now'), status = ?, products_seen = ?, products_created = ?, products_updated = ?,
        products_deactivated = ?, products_rejected = ? WHERE id = ?`).run(
        report.rejected.length ? "partial" : "succeeded", report.seen, report.created, report.updated, report.deactivated, report.rejected.length, runId);
    }
  } catch (e) {
    if (!dryRun) d.prepare("UPDATE shop_sync_runs SET finished_at = datetime('now'), status = 'failed', error_summary = ? WHERE id = ?").run(String(e), runId);
    throw e;
  }
  return report;
}

export async function syncAll(opts: { dryRun?: boolean } = {}) {
  await registerShopsFromConfig();
  const reports: SyncReport[] = [];
  for (const shop of listShops()) {
    try {
      reports.push(await syncShop(shop, opts));
    } catch (e) {
      console.error(`[catalogue] sync failed for ${shop.slug}:`, e);
    }
  }
  return reports;
}

const g = globalThis as unknown as { __catalogueReady?: Promise<void> };

// Loads the sample shops on first use so a fresh checkout works without a manual step.
export function ensureCatalogue(): Promise<void> {
  if (!g.__catalogueReady) {
    // Registers shops added to data/shops.json since the database was created and imports any
    // shop that has no products yet; scheduled syncs keep the rest up to date.
    g.__catalogueReady = (async () => {
      await registerShopsFromConfig();
      const count = db().prepare("SELECT COUNT(*) AS n FROM products WHERE shop_id = ?");
      for (const shop of listShops()) {
        if ((count.get(shop.id) as { n: number }).n > 0) continue;
        try {
          await syncShop(shop);
        } catch (e) {
          console.error(`[catalogue] sync failed for ${shop.slug}:`, e);
        }
      }
    })().catch((e) => {
      g.__catalogueReady = undefined;
      throw e;
    });
  }
  return g.__catalogueReady;
}
