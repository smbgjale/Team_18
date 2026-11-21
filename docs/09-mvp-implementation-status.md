# 9. MVP Implementation Status

This document records what the first implementation does, where it intentionally departs from the full design in documents 1 to 8, and how to connect real services.

## 9.1 What is implemented

| Area | Status |
|---|---|
| Upload a room photo (EXIF stripped, resized, type/size validated) | Done |
| Modern or Traditional direction chosen at upload (switchable on the room page), 8 style presets in the two directions, and the "professional 3D render" prompt builder | Done |
| Render pipeline: queued, rendering, render_ready, matching, completed or failed | Done (in-process job) |
| `RenderProvider` interface with Cloudflare Workers AI (free) and OpenAI adapters plus a local demo stand-in | Done |
| Layout-preservation score (edge-map correlation) stored per design | Done (monitoring signal only, not a hard gate) |
| Before/after slider and side-by-side view | Done |
| Several styles per room, design history per room | Done |
| Download PNG or JPEG | Done |
| `ShopConnector` interface, CSV feed connector, connector registry, sync with dry run and reports | Done |
| Four sample shops (fictional, about 280 products, including a traditional African heritage and rustic range), category mapping, availability parsing | Done |
| Sabahar (Shopify) and Ethiopian Cultural Shop (WooCommerce) public catalogues: cushions, baskets; real photos, prices and product pages | Done (home goods only; not full furniture) |
| Catalogue browser with category, shop, look (modern or traditional), budget, in-stock filters | Done |
| Designs furnished with real catalogue products before rendering (style, palette, room size, budget, availability) | Done (see 9.6) |
| Product photos sent to the image model as reference images; prompt names every product | Done (Cloudflare up to 3, OpenAI up to 4, demo composites them) |
| Image check of which chosen products are visible (`in_render`) | Done (vision provider; demo marks all visible) |
| Interactive 3D layout view: orbit, zoom, drag, rotate, keyboard nudging, room size, saved layout | Done (simplified shapes at real sizes, see 9.6) |
| Matching: category filter, style, colour, price/budget, availability, shop diversity | Done (see 9.3), now used for alternatives |
| "Products in this design" with alternatives, swap, category and budget filters, outbound links with click tracking (`/r/{id}`) | Done |
| Tests for scoring, prompts, structure score, sync idempotency, matching, furnishing, 3D layout rules and a demo pipeline run | Done |

## 9.2 Where the MVP differs from the plan

| Planned (docs 1 to 8) | MVP | Why / next step |
|---|---|---|
| PostgreSQL + pgvector | SQLite (`better-sqlite3`), schema mirrors doc 3 minus users and vectors | Zero-setup local run. Move to Postgres before multi-instance deployment; the SQL in `src/lib/db.ts` is plain and the data access is concentrated in `src/lib/*.ts`. |
| Redis + BullMQ job queue, separate worker | Jobs run in the web server process (`setImmediate`) | Fine for one instance. Jobs in flight are lost on restart; designs stuck for over 5 minutes are marked failed. Add a queue before scaling out. |
| Accounts, quotas, rate limits | None. Rooms and designs are reachable by unguessable ID only | Add authentication, per-user quotas and rate limiting before any public launch, because each design costs money with a real provider. |
| Depth/edge control maps sent to the provider | Layout preservation is requested through the prompt (neither OpenAI image edit nor FLUX.2 [klein] on Workers AI takes depth/edge input) | The prompt asks to keep walls, windows, doors and camera angle, and the structure score measures the result. To get stronger locking, add a provider adapter that accepts depth/edge control (see doc 5 section 5.1). |
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

| | Demo mode (no keys) | Cloudflare Workers AI (free) | OpenAI (paid) |
|---|---|---|---|
| Settings | none | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | `OPENAI_API_KEY` |
| Render | Local stand-in: tinted photo plus the chosen products' images, labelled "Demo preview". Not an AI render. | FLUX.2 [klein] 4B image editing with the room photo as reference image | `POST /v1/images/edits` with the room photo and the generated prompt |
| Product check | All chosen products marked visible (the stand-in drew them) | Llama 4 Scout vision model, JSON output | Vision model, JSON output |
| Cost | Free | Free daily allowance of 10,000 Neurons (resets 00:00 UTC). A design uses roughly 210 (about 125 for the render: 26 per 512 px output tile plus 5.4 per input image tile for the room photo and up to 3 product photos; about 85 for the product check), so about 45 designs a day | Paid per image |
| Data | Stays local | Both models are listed by Cloudflare as zero data retention | See the provider's data policy |

When several providers are configured, OpenAI is used first, then Cloudflare. `RENDER_PROVIDER` and `VISION_PROVIDER` (`mock`, `cloudflare`, `openai`) override the choice, for example to render with Cloudflare and detect with OpenAI.

Cloudflare limits to keep in mind:
- The reference image must fit within 512 x 512 px, so fine detail from the original photo is lost and the model sees only the overall layout. Output is 1024 px on the long edge.
- FLUX.2 [klein] 4B is a small, fast model. Expect good-looking results but weaker layout locking than a model with depth/edge control; check the layout score and compare views.
- When the daily allowance is used up, new designs fail with a clear message until 00:00 UTC.

The OpenAI and Cloudflare adapters were written against the providers' public API documentation and are covered by tests with mocked HTTP responses, but they could not be exercised against the real services in the development environment because no keys were available. Run one real design end to end and review the quality before relying on them, and check current model names, pricing and content policies (all model names are configurable through environment variables).

## 9.5 Connecting a real shop

1. Obtain permission and a data channel (doc 6 section 6.1). Scraping is not supported.
2. If the shop provides a CSV feed with Google-Merchant-style columns (`id,title,description,product_type,price,sale_price,currency,link,image_link,brand,color,material,availability,width_cm,depth_cm,height_cm,style`), add an entry to `data/shops.json` with `connector_type: "feed_csv"`, `connector_config: { "feed_url": "https://..." }` (or a local `path`), and a `category_map` from the shop's `product_type` values to HOMELY categories. Remove `is_demo`.
3. Run `npm run catalogue:dry-run`, check rejected rows and unmapped categories in the report, then `npm run catalogue:sync`.
4. For a different format or an official API, implement `ShopConnector` (`src/lib/shops/types.ts`) and register it in `src/lib/shops/registry.ts`. No other code changes are needed.
5. Optional: set `affiliate_template` (for example `{url}?utm_source=homely`) on the shop entry for tracked links.

Remove the demo shops from `data/shops.json` before launching with real shops, because demo products would otherwise appear in results.

## 9.6 Real products and the 3D layout view

What happens when a design is generated:

1. The app picks one real product per furniture slot for the room type (doc 6 §6.9), within the budget if one is given, and stores them in `design_products`.
2. The image provider gets the room photo, the photos of the biggest pieces as reference images, and a prompt that names every product (doc 5 §5.12).
3. The vision provider checks which products are visible in the result.
4. The UI shows the image (compare and side by side), the **3D view** tab, and "Products in this design" with alternatives.

What the 3D view is and is not:

| It is | It is not |
|---|---|
| A real 3D scene in the browser (React Three Fiber / Three.js) | A reconstruction of the uploaded room: the room is a rectangle with default dimensions for the room type (editable), one window and no doors |
| Exactly the products in the design, at the width, depth and height from the shop and in the product's colour | The products' own 3D models: each category is drawn as a simplified generic shape (round tables, rugs and mirrors are round) |
| Editable: drag, rotate 90°, arrow keys and R, swap products, change room size; saved per design | Linked to the image: moving things does not change the AI image, and a swapped product appears in the image only after generating a new design |

Limitations:
- Wall items (curtains, wall art, mirror) are fixed to their wall, and lamps and cushions follow the furniture they sit on.
- There is no collision detection between pieces, only clamping to the walls, and a warning when a product is larger than the room.
- When a shop provides no dimensions, a typical size for the category is used and the product panel says so.
- The 3D view needs WebGL; a message is shown when the browser does not support it.

