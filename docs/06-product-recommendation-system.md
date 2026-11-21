# 6. Product Recommendation System

> MVP note: the first implementation matches with keyword, style, colour, price and availability scores and no image embeddings yet. New designs no longer infer products from the image: they are furnished with real products before rendering (§6.9), and matching is used to suggest alternatives. See [MVP Implementation Status](09-mvp-implementation-status.md).

Covers (a) how shops are integrated, (b) how products are normalised, (c) how items in a generated design are identified, and (d) how products are matched and ranked.

## 6.1 Shop integration strategy

Use the most official, stable channel available per shop, in this order of preference:

| Priority | Channel | Notes |
|---|---|---|
| 1 | **Official shop API** (e.g. a storefront/catalogue API the shop publishes, or the platform API for shops built on e-commerce platforms that expose a public storefront API) | Structured data, stock and price; respect rate limits and auth |
| 2 | **Product feed** (Google-Merchant-style XML/CSV, platform feed exports) | Most common for retailers; usually daily; may lack stock detail |
| 3 | **Affiliate / partner network feeds** (shops that join an affiliate network or run a partner programme) | Provides feeds plus tracking links and a revenue model; requires approval |
| 4 | **Direct partnership + curated CSV/JSON** supplied by the shop | Best for the MVP's small catalogue; manual refresh process |
| Not allowed | Scraping shop websites without written permission | Violates many terms of service and carries legal risk; do not use |

**MVP:** 3 to 5 shops with which HOMELY AI has permission, ingested from feeds/APIs/curated files, a few hundred to a few thousand products total. Focus on core categories (sofa, bed, tables, curtains, lighting, rugs, chairs, storage).

Business and legal checklist per shop (stored in `shops.agreement_*`):
- Written permission/terms for displaying product names, descriptions and images.
- Whether images may be hot-linked, cached, or must be fetched from the shop's CDN.
- Attribution and affiliate disclosure requirements ("We may earn a commission").
- Pricing display rules (show shop price and note that it may change; show currency).
- Takedown/contact process; ability to remove a shop's products immediately (`is_enabled = false`).

## 6.2 Connector architecture (adding new shops easily)

```
shops row ──> ConnectorRegistry ──> ShopConnector ──> RawProduct stream
                                                          │
                                  Normaliser (category map, price, colour, dimensions)
                                                          │
                                  Enricher (colour extraction, style tagging, embeddings)
                                                          │
                                  Upsert into products / product_embeddings
```

Built-in connector types (each is a class implementing `ShopConnector`, see [Architecture §2.4](02-system-architecture.md#24-shop-connector-layer-extensibility)):

| `connector_type` | Config examples |
|---|---|
| `feed_csv` | `feed_url`, `delimiter`, `column_map` |
| `feed_xml_google_merchant` | `feed_url`, optional auth |
| `shopify_storefront` | `store_domain`, token reference, collection handles |
| `affiliate_network` | network name, programme/advertiser ID, feed URL, token reference |
| `rest_api` | `base_url`, auth reference, pagination style, field mapping (JSONPath) |
| `manual` | file uploaded by an admin (CSV/JSON) |

Normalised product (output of every connector):

```ts
interface NormalisedProduct {
  externalId: string;
  name: string;
  description?: string;
  shopCategoryPath: string[];      // original categories
  priceMinor: number;
  salePriceMinor?: number;
  currency: string;
  productUrl: string;              // direct product page on the shop's site
  imageUrls: string[];
  brand?: string;
  colors?: string[];
  materials?: string[];
  dimensionsCm?: { width?: number; depth?: number; height?: number };
  availability: 'in_stock' | 'low_stock' | 'out_of_stock' | 'preorder' | 'unknown';
  stockQuantity?: number;
  raw: unknown;
}
```

**Sync job rules**
- Scheduled per `shops.sync_interval_minutes` (default daily); full sync plus optional frequent price/stock refresh via `fetchAvailability`.
- Idempotent upsert by `(shop_id, external_id)`; skip unchanged rows using `content_hash`.
- Products absent from N consecutive syncs → `is_active = false`.
- Validation: reject products without name, price, URL or image; log counts in `shop_sync_runs`.
- Dry-run mode prints what would change; first sync of a new shop always starts as a dry run.
- Unmapped categories are reported to admins; unmapped products are stored but excluded from recommendations.
- Isolation: one shop's failure never affects others; exponential backoff and alerting on repeated failures.
- Prices: recorded in the shop's currency. For cross-currency display, convert with a daily FX rate and label it as approximate; filtering budget uses converted value.

**Checklist: "add a new shop"**
1. Confirm the agreement/permission and the data channel.
2. Insert `shops` row (disabled).
3. Choose/configure the connector, or implement a new one (about one file + tests using a recorded fixture).
4. Write `category_map`.
5. Dry-run sync; review category coverage, image validity, price sanity.
6. Run a real sync; spot-check 20 products against the live site.
7. Enable the shop; monitor sync runs and click-outs.

## 6.3 Taxonomy and enrichment

Normalisation pipeline per product:

1. **Category**: map shop category path → HOMELY category (`shops.category_map`); fallback to a text classifier on the product name for unmapped items (flagged for review).
2. **Colour**: use feed colour if present; otherwise extract dominant colours from the product image (background removal or centre-weighted crop, k-means in Lab colour space). Store names and `color_lab`.
3. **Style tags**: from feed attributes/keywords; otherwise AI tagging of the image + title with a controlled vocabulary (`modern`, `scandinavian`, `minimalist`, `industrial`, `bohemian`, `classic`).
4. **Embeddings**: image embedding (and optional text embedding) from a CLIP/SigLIP-family model; stored with the model version.
5. **Dimensions**: parse from feed or description where available.

## 6.4 Identifying items in the generated design

After the render is stored, the worker runs item detection:

1. **Detect**: send the render to a vision model with a structured-output schema listing HOMELY categories; request for each visible item `category`, `label` (colour, material, shape), bounding box, confidence. Alternatively or additionally use an open-vocabulary object detector prompted with the HOMELY category names. Discard detections below a confidence threshold (about 0.5) and boxes that are too small (below about 2% of image area) to be shoppable.
2. **Crop** each box with a small margin; store in object storage.
3. **Describe**: dominant colours from the crop (masking out background where possible), material and style tags (vision model).
4. **Embed**: image embedding of the crop with the same model as the products.
5. **Persist** into `design_items`.

Expected categories: sofa, armchair, bed, tables (coffee/dining/side), desk, chairs, wardrobe/storage, TV unit, shelves, rug, curtains, lighting (ceiling, floor, table lamps), wall art, mirror, plants and decor, cushions. Wall colour and flooring are detected as *attributes* (colour/material) and shown as "paint colour / flooring suggestion" in the UI; in the MVP they are not matched to products unless a paint/flooring shop is integrated.

Known limitations to communicate in the UI: detection is probabilistic; the render may contain items that look plausible but are generic; the user can hide wrong items and request "find more like this".

## 6.5 Matching and ranking algorithm

For each detected item the matcher runs a **filter → retrieve → score → diversify** pipeline.

### Step 1: Hard filters (SQL)
- `category` equals the item's category (with a small compatibility table, e.g. `armchair` item may also pull `accent chair`).
- `is_active = true` and shop enabled.
- `availability != 'out_of_stock'` (unknown is allowed).
- Currency/budget filter (see below).
- User filters: shops, price range, in-stock only.

### Step 2: Candidate retrieval (vector)
Within the filtered set, take the top K (e.g. 50) by cosine similarity between the item crop embedding and `product_embeddings.image_embedding` (pgvector). If the filtered set is small (typical in the MVP's small catalogue), skip the ANN and score all candidates.

### Step 3: Scoring

```
score = w_visual * visual
      + w_style  * style
      + w_color  * color
      + w_price  * price
      + w_avail  * availability
```

Default weights (tunable, stored in config): visual 0.35, style 0.20, color 0.20, price 0.15, availability 0.10.

| Component | Definition |
|---|---|
| `visual` | Cosine similarity of crop vs product image embeddings, normalised to 0..1 (min-max over candidates) |
| `style` | Overlap between design style (and item style tags) and product `style_tags`: 1.0 exact match, 0.5 adjacent style (e.g. modern ↔ minimalist, rustic ↔ african), 0.25 another style of the same direction (modern or traditional), 0 otherwise; 0.5 if the product has no tags (neutral) |
| `color` | `1 - min(1, ΔE / 50)`, where ΔE is the CIE76 (or CIEDE2000) distance in Lab between the item's dominant colour and the product's closest colour; falls back to colour-name match |
| `price` | Based on budget fit (below) |
| `availability` | `in_stock` 1.0, `low_stock` 0.8, `preorder` 0.5, `unknown` 0.7, `out_of_stock` excluded |

### Budget handling
- If the user gave an **overall budget**, allocate a per-item share using typical proportions per room type (e.g. living room: sofa 35%, tables 15%, rug 10%, curtains 10%, lighting 15%, other 15%); the share is a soft target.
- `price` score = 1.0 if price ≤ item target; decays linearly to 0 at 1.5× target; products above the user's explicit hard maximum (`max_price`) are filtered out.
- If no budget is given, `price` score is neutral (0.7) so cheaper or pricier items are not favoured.
- The response includes a `budget_summary` for the top-ranked product per item so the user sees the estimated total.

### Step 4: Diversify and finalise
- Return top N (default 5) per item.
- Limit the same shop to at most 3 of 5 results when other shops have comparable scores, so the list is not dominated by one shop.
- Prefer one result per distinct product family (same name/different size collapsed).
- Store `score` and `score_breakdown` in `product_matches` (also useful for debugging and evaluation).

### Step 5: Re-ranking with user signals (later)
Use clicks and saves as a weak relevance signal (learning-to-rank), and consider coordinated sets ("this rug goes with this sofa") in v1.x.

### Pseudocode

```ts
async function matchItem(item: DesignItem, ctx: MatchContext): Promise<Match[]> {
  const candidates = await db.products.search({
    categories: compatibleCategories(item.category),
    active: true,
    notOutOfStock: true,
    price: ctx.priceFilter(item),
    shops: ctx.shops,
    nearestTo: item.embedding,
    limit: 50,
  });

  const scored = candidates.map(p => {
    const b = {
      visual: p.visualSimilarity,
      style: styleScore(ctx.style, item.styleTags, p.styleTags),
      color: colorScore(item.dominantColors, p),
      price: priceScore(p, ctx.itemBudget(item)),
      availability: availabilityScore(p.availability),
    };
    return { product: p, breakdown: b, score: weighted(b, WEIGHTS) };
  });

  return diversify(scored.sort(byScoreDesc), { n: ctx.matchesPerItem, maxPerShop: 3 });
}
```

## 6.6 Product display requirements

Every product card shows: **image, name, price (with currency), short description, shop name (and logo), availability badge when known, and a "View on {shop}" button** linking via `/r/{productId}` to the product page on the shop's website. Include "Prices and availability are provided by the shop and may change", an affiliate disclosure where applicable, and a "Similar to the item in your design" label (not "exact match").

Filters on "Shop this look" and the catalogue page: category, budget (min/max), shop, colour, in-stock only. Sorting: best match, price low/high.

## 6.7 Evaluating recommendation quality

- **Offline relevance set**: 100 labelled (design item crop → acceptable products) pairs; measure precision@5 and category accuracy (must be ~100% because of hard filter), colour match rate.
- **Detection quality**: manual review of 50 designs; track precision/recall of shoppable items.
- **Online**: click-through rate per item category, save rate, "not relevant" feedback, share of designs with ≥ 1 click-out.
- **Coverage**: percentage of detected items with ≥ 3 matches. Low coverage means the catalogue needs more products in that category (an input to prioritising shop onboarding).

## 6.8 Future improvements

- Product-aware generation: include real catalogue products as reference images in the render step (image-prompt/IP-Adapter-style conditioning, or provider reference-image features) so renders feature purchasable items.
- Complementary/set recommendations and bundles within a budget.
- Real-time stock/price via partner APIs.
- Interactive 3D: replace inference-from-pixels with exact products as 3D assets in a scene (v2).

## 6.9 Furnishing a design with real products (MVP)

Instead of generating an image and then searching for look-alike products, the MVP picks the products first and renders the room with them (`src/lib/furnish.ts`):

1. **Slots.** The room type defines the furniture slots (living room: sofa, coffee table, rug, curtains, floor lamp, TV unit, wall art, cushion, plant; bedroom: bed, side table, curtains, rug, table lamp, wardrobe, mirror, cushion, plant; and so on). A slot with no product from the connected shops is left empty. Dining chairs come in fours (twos in a kitchen).
2. **Candidates.** Active, not out of stock, in the budget's currency, and small enough for the room: the product's footprint must fit within the room's width and length minus 30 cm (in either orientation). Only products tagged with a style of the design's direction (or untagged) are considered, so a traditional room never gets a modern sofa; if a slot has no such product, the other direction is used rather than leaving it empty.
3. **Score.** `0.55 style + 0.30 palette + 0.15 availability`, where `style` is 1 for a product tagged with the chosen style, 0.5 for an adjacent style or an untagged product, 0.25 for another style of the same direction, otherwise 0, and `palette` is the CIE76 colour distance between the product colour and the style's palette. The best-scoring candidate fills the slot.
4. **Budget.** While the total (price times quantity) is over budget, make the single swap with the lowest loss of score per unit of money saved, across all slots. If no cheaper candidate is left, drop optional decor (plant, wall art, mirror, cushion, table lamp, shelf, side table). The main pieces are never dropped.
5. **Alternatives.** For each chosen product the regular matcher (§6.5) ranks up to N alternatives in the same or compatible categories, using the chosen product's own colours and text as the query, and the user's price, stock and shop filters.

The user can swap a product for an alternative (`PATCH /api/designs/{id}/products/{itemId}`); the 3D view updates immediately and the item is marked "changed after the image was made" until a new design is generated.

