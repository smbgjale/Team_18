# 9. MVP Implementation Status

This document records what the first implementation does, where it intentionally departs from the full design in documents 1 to 8, and how to connect real services.

## 9.1 What is implemented

| Area | Status |
|---|---|
| Upload a room photo (EXIF stripped, resized, type/size validated) | Done |
| 6 style presets and the "professional 3D render" prompt builder | Done |
| Render pipeline: queued, rendering, render_ready, matching, completed or failed | Done (in-process job) |
| `RenderProvider` interface with an OpenAI image-edit adapter and a local demo stand-in | Done |
| Layout-preservation score (edge-map correlation) stored per design | Done (monitoring signal only, not a hard gate) |
| Before/after slider and side-by-side view | Done |
| Several styles per room, design history per room | Done |
| Download PNG or JPEG | Done |
| `ShopConnector` interface, CSV feed connector, connector registry, sync with dry run and reports | Done |
| Three sample shops (fictional, about 220 products), category mapping, availability parsing | Done |
| Catalogue browser with category, shop, budget, in-stock filters | Done |
| Item detection (vision provider interface, OpenAI adapter, demo stand-in) | Done |
| Matching: category filter, style, colour, price/budget, availability, shop diversity | Done (see 9.3) |
| "Shop this look" with category and budget filters, product cards, outbound links with click tracking (`/r/{id}`) | Done |
| Tests for scoring, prompts, structure score, sync idempotency and matching constraints | Done |

## 9.2 Where the MVP differs from the plan

| Planned (docs 1 to 8) | MVP | Why / next step |
|---|---|---|
| PostgreSQL + pgvector | SQLite (`better-sqlite3`), schema mirrors doc 3 minus users and vectors | Zero-setup local run. Move to Postgres before multi-instance deployment; the SQL in `src/lib/db.ts` is plain and the data access is concentrated in `src/lib/*.ts`. |
| Redis + BullMQ job queue, separate worker | Jobs run in the web server process (`setImmediate`) | Fine for one instance. Jobs in flight are lost on restart; designs stuck for over 5 minutes are marked failed. Add a queue before scaling out. |
| Accounts, quotas, rate limits | None. Rooms and designs are reachable by unguessable ID only | Add authentication, per-user quotas and rate limiting before any public launch, because each design costs money with a real provider. |
| Depth/edge control maps sent to the provider | Layout preservation is requested through the prompt (OpenAI image edit has no depth/edge input) | The prompt asks to keep walls, windows, doors and camera angle, and the structure score measures the result. To get stronger locking, add a provider adapter that accepts depth/edge control (see doc 5 section 5.1). |
| Embedding similarity (CLIP/SigLIP) in matching | Keyword overlap between the detected item's description and the product text replaces the visual component | Weights in `src/lib/matching.ts`: keyword 0.10, style 0.35, colour 0.25, price 0.20, availability 0.10. Add image embeddings (doc 6 section 6.5) when the catalogue grows beyond a few thousand products. |
| Item crops stored | Not stored; colour is measured from the render at detection time | Add crops when embeddings are introduced. |
| Admin API for shops | `data/shops.json` plus `npm run catalogue:sync` | Add the admin endpoints in doc 4 section 4.6 together with authentication. |
| Quality gate rejects bad renders and retries | Score recorded, no automatic retry | Calibrate a threshold on real provider output first (doc 5 section 5.8), then enable rejection and retry. |
| Fallback render provider | Single provider per run | Add a second adapter behind the same interface. |

## 9.3 Matching, as implemented

For each detected item: hard filters (category and compatible categories, active, not out of stock, user price range, in-stock only, shop) then a weighted score:

```
score = categoryExactness * (0.10 keyword + 0.35 style + 0.25 colour + 0.20 price + 0.10 availability)
```

- `colour` uses CIE76 distance in Lab between the item's measured colour and the product colour.
- `price` compares with the item's share of the total budget (weights per category in `src/lib/categories.ts`); neutral when no budget is set or currencies differ.
- Results are limited to 3 per shop where possible so one shop does not dominate.

## 9.4 Demo mode vs real mode

| | Demo mode (no key) | Real mode (`OPENAI_API_KEY` set) |
|---|---|---|
| Render | Local stand-in: tinted photo plus sample furniture sprites, labelled "Demo preview". Not an AI render. | `POST /v1/images/edits` with the room photo and the generated prompt |
| Item detection | Items taken from the same layout the stand-in drew | Vision model returns categories, descriptions, colours and boxes as JSON |
| Shops | Fictional sample shops | Same until real connectors are configured |

The OpenAI adapters were written against the public API documentation but could not be exercised in the development environment because no key was available. Run one real design end to end and review the quality before relying on them, and check the provider's current model names, pricing and content policy (the model names are configurable through `OPENAI_IMAGE_MODEL` and `OPENAI_VISION_MODEL`).

## 9.5 Connecting a real shop

1. Obtain permission and a data channel (doc 6 section 6.1). Scraping is not supported.
2. If the shop provides a CSV feed with Google-Merchant-style columns (`id,title,description,product_type,price,sale_price,currency,link,image_link,brand,color,material,availability,width_cm,depth_cm,height_cm,style`), add an entry to `data/shops.json` with `connector_type: "feed_csv"`, `connector_config: { "feed_url": "https://..." }` (or a local `path`), and a `category_map` from the shop's `product_type` values to HOMELY categories. Remove `is_demo`.
3. Run `npm run catalogue:dry-run`, check rejected rows and unmapped categories in the report, then `npm run catalogue:sync`.
4. For a different format or an official API, implement `ShopConnector` (`src/lib/shops/types.ts`) and register it in `src/lib/shops/registry.ts`. No other code changes are needed.
5. Optional: set `affiliate_template` (for example `{url}?utm_source=homely`) on the shop entry for tracked links.

Remove the demo shops from `data/shops.json` before launching with real shops, because demo products would otherwise appear in results.
