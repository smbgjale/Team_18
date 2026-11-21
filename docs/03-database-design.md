# 3. Database Design

PostgreSQL 15+ with the `pgvector` extension. Prices are stored in minor units (integer) plus ISO currency to avoid float errors. Primary keys are UUIDs.

## 3.1 Entity overview

```
users 1─* rooms 1─* designs 1─* design_items 1─* product_matches *─1 products *─1 shops
                       │                                              │
                       └─* design_downloads                          ├─* product_images
users 1─* saved_products                                             └─ product_embeddings
shops 1─* shop_sync_runs        products 1─* click_events
```

## 3.2 Schema (DDL)

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ───────── Users ─────────
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  display_name  text,
  plan          text NOT NULL DEFAULT 'free',          -- free | pro
  render_quota_remaining integer NOT NULL DEFAULT 5,
  preferred_currency char(3) NOT NULL DEFAULT 'USD',
  created_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);

-- ───────── Rooms (the user's original photo) ─────────
CREATE TABLE rooms (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name           text,
  room_type      text NOT NULL,                        -- living_room | bedroom | kitchen | dining_room | office | bathroom | other
  original_image_key text NOT NULL,                    -- object storage key (EXIF stripped)
  image_sha256   char(64) NOT NULL,                    -- cache key component
  width_px       integer NOT NULL,
  height_px      integer NOT NULL,
  depth_map_key  text,                                 -- cached structure guidance
  edge_map_key   text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz
);
CREATE INDEX rooms_user_idx ON rooms(user_id, created_at DESC);

-- ───────── Designs (one generated render = one room + one style) ─────────
CREATE TABLE designs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id        uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  style          text NOT NULL,                        -- modern | scandinavian | minimalist | industrial | bohemian | classic | ...
  status         text NOT NULL DEFAULT 'queued',       -- queued | rendering | render_ready | matching | completed | failed
  user_prompt    text,                                 -- optional free-text hints
  color_palette  text[],                               -- optional preferred colours (hex or names)
  budget_total_minor integer,                          -- optional overall budget
  budget_currency char(3),
  provider       text,                                 -- e.g. 'provider_a'
  provider_model text,
  prompt_used    text,                                 -- final prompt (for debugging/repro)
  seed           bigint,
  structure_strength real,                             -- control strength used
  render_image_key   text,                             -- full-size result
  preview_image_key  text,
  structure_score    real,                             -- layout-preservation quality gate result
  error_code     text,
  error_message  text,
  cost_minor     integer,                              -- provider cost estimate
  idempotency_key text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  completed_at   timestamptz,
  UNIQUE (room_id, idempotency_key)
);
CREATE INDEX designs_room_idx ON designs(room_id, created_at DESC);

CREATE TABLE design_downloads (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id  uuid NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id),
  format     text NOT NULL,                            -- png | jpeg
  watermarked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ───────── Items detected in a generated design ─────────
CREATE TABLE design_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id     uuid NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
  category      text NOT NULL,                         -- HOMELY category slug, e.g. 'sofa'
  label         text,                                  -- free-text from the vision model, e.g. 'beige 3-seat linen sofa'
  confidence    real NOT NULL,
  bbox          jsonb NOT NULL,                        -- {x,y,w,h} normalised 0..1
  crop_image_key text,
  dominant_colors jsonb,                               -- [{"hex":"#d9cdb8","name":"beige","share":0.62}, ...]
  style_tags    text[],
  material_tags text[],
  embedding     vector(768),                           -- image embedding of crop (dimension depends on model)
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX design_items_design_idx ON design_items(design_id);

-- ───────── Shops and catalogue ─────────
CREATE TABLE shops (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           text UNIQUE NOT NULL,                 -- 'example-furniture'
  name           text NOT NULL,
  website_url    text NOT NULL,
  logo_url       text,
  country        char(2),
  currency       char(3) NOT NULL,
  connector_type text NOT NULL,                        -- feed_csv | feed_xml_google_merchant | shopify_storefront | affiliate_network | rest_api | manual
  connector_config jsonb NOT NULL DEFAULT '{}',        -- non-secret config; secrets live in the secrets manager
  category_map   jsonb NOT NULL DEFAULT '{}',          -- shop category -> HOMELY category
  affiliate_template text,                             -- e.g. '{url}?utm_source=homely&aff={aff_id}'
  agreement_type text NOT NULL,                        -- official_api | feed_permission | affiliate | partner | manual_permission
  agreement_notes text,                                -- licence, image usage, attribution requirements
  sync_interval_minutes integer NOT NULL DEFAULT 1440,
  is_enabled     boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id        uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  external_id    text NOT NULL,                        -- shop SKU / product id
  name           text NOT NULL,
  description    text,
  category       text NOT NULL,                        -- HOMELY category slug
  subcategory    text,
  price_minor    integer NOT NULL,
  sale_price_minor integer,
  currency       char(3) NOT NULL,
  product_url    text NOT NULL,                        -- direct link to the shop's product page
  primary_image_url text NOT NULL,
  brand          text,
  colors         text[],                               -- normalised colour names
  dominant_color_hex text,
  color_lab      real[],                               -- [L,a,b] for distance computations
  materials      text[],
  style_tags     text[],                               -- modern, scandinavian, ... (feed data or AI-tagged)
  width_cm       numeric(7,1),
  depth_cm       numeric(7,1),
  height_cm      numeric(7,1),
  availability   text NOT NULL DEFAULT 'unknown',      -- in_stock | low_stock | out_of_stock | preorder | unknown
  stock_quantity integer,
  availability_checked_at timestamptz,
  raw_payload    jsonb,                                -- original shop data for debugging
  content_hash   char(64),                             -- detect changes during sync
  is_active      boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, external_id)
);
CREATE INDEX products_filter_idx ON products(category, is_active, price_minor);
CREATE INDEX products_shop_idx   ON products(shop_id);
CREATE INDEX products_style_gin  ON products USING gin(style_tags);

CREATE TABLE product_images (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url         text NOT NULL,
  position    integer NOT NULL DEFAULT 0
);

CREATE TABLE product_embeddings (
  product_id  uuid PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  image_embedding vector(768),
  text_embedding  vector(768),
  model       text NOT NULL,                           -- embedding model + version; re-embed when changed
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX product_img_emb_idx ON product_embeddings
  USING hnsw (image_embedding vector_cosine_ops);

CREATE TABLE shop_sync_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id       uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz,
  status        text NOT NULL,                         -- running | succeeded | partial | failed
  products_seen integer DEFAULT 0,
  products_created integer DEFAULT 0,
  products_updated integer DEFAULT 0,
  products_deactivated integer DEFAULT 0,
  error_summary text
);

-- ───────── Matches ─────────
CREATE TABLE product_matches (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  design_item_id uuid NOT NULL REFERENCES design_items(id) ON DELETE CASCADE,
  product_id     uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  rank           integer NOT NULL,
  score          real NOT NULL,                        -- final weighted score 0..1
  score_breakdown jsonb NOT NULL,                      -- {visual:.., style:.., color:.., price:.., availability:..}
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (design_item_id, product_id)
);
CREATE INDEX product_matches_item_idx ON product_matches(design_item_id, rank);

-- ───────── User actions and analytics ─────────
CREATE TABLE saved_products (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  design_id  uuid REFERENCES designs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);

CREATE TABLE click_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  product_id  uuid NOT NULL REFERENCES products(id),
  design_id   uuid REFERENCES designs(id) ON DELETE SET NULL,
  design_item_id uuid REFERENCES design_items(id) ON DELETE SET NULL,
  clicked_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX click_events_product_idx ON click_events(product_id, clicked_at DESC);
```

## 3.3 Notes

- **Categories** are a fixed HOMELY taxonomy (table or enum-like constants): `sofa`, `armchair`, `bed`, `mattress`, `dining_table`, `coffee_table`, `side_table`, `desk`, `chair`, `wardrobe`, `shelf`, `tv_unit`, `rug`, `curtains`, `ceiling_light`, `floor_lamp`, `table_lamp`, `wall_art`, `mirror`, `plant_pot`, `cushion`, `other`. Every shop's categories map into this list via `shops.category_map`.
- **Embedding dimension** (768) is an example. It must equal the output of the chosen embedding model; `product_embeddings.model` records which model produced each vector so mixed versions are never compared.
- **Availability**: `unknown` is a first-class value. Many feeds do not expose stock; the matcher must not treat `unknown` as out of stock but may rank in-stock items higher.
- **Soft delete** (`deleted_at`) for users and rooms, with a background purge job that removes object-storage files; hard delete on user request.
- **Staleness**: products not seen in the last N syncs are set `is_active = false`, not deleted, so old matches and click history stay valid.
- **Migrations** are managed with a migration tool (e.g. Prisma Migrate, Drizzle Kit or Flyway) and run in CI against an ephemeral database.
- **Data minimisation**: store only the product data needed to display and rank; keep `raw_payload` for debugging with a retention limit.
