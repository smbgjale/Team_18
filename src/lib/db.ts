import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { config } from "./config";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  name TEXT,
  room_type TEXT NOT NULL,
  original_image_key TEXT NOT NULL,
  width_px INTEGER NOT NULL,
  height_px INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS designs (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  style TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  user_prompt TEXT,
  budget_total_minor INTEGER,
  budget_currency TEXT,
  layout_fidelity TEXT NOT NULL DEFAULT 'high',
  provider TEXT,
  prompt_used TEXT,
  render_image_key TEXT,
  structure_score REAL,
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS designs_room_idx ON designs(room_id, created_at DESC);
CREATE TABLE IF NOT EXISTS design_items (
  id TEXT PRIMARY KEY,
  design_id TEXT NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  label TEXT,
  confidence REAL NOT NULL,
  bbox TEXT NOT NULL,
  dominant_colors TEXT NOT NULL,
  style_tags TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS design_items_design_idx ON design_items(design_id);
CREATE TABLE IF NOT EXISTS shops (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  website_url TEXT NOT NULL,
  currency TEXT NOT NULL,
  connector_type TEXT NOT NULL,
  connector_config TEXT NOT NULL DEFAULT '{}',
  category_map TEXT NOT NULL DEFAULT '{}',
  affiliate_template TEXT,
  agreement_type TEXT NOT NULL,
  is_demo INTEGER NOT NULL DEFAULT 0,
  is_enabled INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  price_minor INTEGER NOT NULL,
  sale_price_minor INTEGER,
  currency TEXT NOT NULL,
  product_url TEXT NOT NULL,
  image_url TEXT NOT NULL,
  brand TEXT,
  colors TEXT NOT NULL DEFAULT '[]',
  dominant_color_hex TEXT,
  materials TEXT NOT NULL DEFAULT '[]',
  style_tags TEXT NOT NULL DEFAULT '[]',
  width_cm REAL,
  depth_cm REAL,
  height_cm REAL,
  availability TEXT NOT NULL DEFAULT 'unknown',
  is_active INTEGER NOT NULL DEFAULT 1,
  content_hash TEXT,
  last_synced_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (shop_id, external_id)
);
CREATE INDEX IF NOT EXISTS products_filter_idx ON products(category, is_active, price_minor);
CREATE TABLE IF NOT EXISTS shop_sync_runs (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  status TEXT NOT NULL,
  products_seen INTEGER DEFAULT 0,
  products_created INTEGER DEFAULT 0,
  products_updated INTEGER DEFAULT 0,
  products_deactivated INTEGER DEFAULT 0,
  products_rejected INTEGER DEFAULT 0,
  error_summary TEXT
);
CREATE TABLE IF NOT EXISTS product_matches (
  id TEXT PRIMARY KEY,
  design_item_id TEXT NOT NULL REFERENCES design_items(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  score REAL NOT NULL,
  score_breakdown TEXT NOT NULL,
  UNIQUE (design_item_id, product_id)
);
CREATE INDEX IF NOT EXISTS product_matches_item_idx ON product_matches(design_item_id, rank);
CREATE TABLE IF NOT EXISTS design_products (
  id TEXT PRIMARY KEY,
  design_id TEXT NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  category TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0,
  in_render INTEGER,
  replaced_after_render INTEGER NOT NULL DEFAULT 0,
  layout_json TEXT
);
CREATE INDEX IF NOT EXISTS design_products_design_idx ON design_products(design_id, sort);
CREATE TABLE IF NOT EXISTS product_models (
  product_id TEXT PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  status TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_task_id TEXT,
  model_key TEXT,
  error_message TEXT,
  generations INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS click_events (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  design_id TEXT,
  design_item_id TEXT,
  clicked_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

const g = globalThis as unknown as { __homelyDb?: Database.Database };

function addColumn(conn: Database.Database, table: string, column: string, type: string) {
  const cols = conn.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) conn.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
}

export function db(): Database.Database {
  if (!g.__homelyDb) {
    try {
      mkdirSync(config.dataDir, { recursive: true });
      // WAL needs extra sidecar files and can fail on some ephemeral mounts; DELETE is safer on serverless.
      const conn = new Database(path.join(config.dataDir, "homely.db"));
      conn.pragma(config.isServerless ? "journal_mode = DELETE" : "journal_mode = WAL");
      conn.pragma("foreign_keys = ON");
      conn.exec(SCHEMA);
      addColumn(conn, "rooms", "width_cm", "INTEGER");
      addColumn(conn, "rooms", "length_cm", "INTEGER");
      addColumn(conn, "rooms", "height_cm", "INTEGER");
      addColumn(conn, "rooms", "design_direction", "TEXT");
      g.__homelyDb = conn;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      throw new Error(
        `Could not open the app database in ${config.dataDir}: ${message}`,
      );
    }
  }
  return g.__homelyDb;
}
