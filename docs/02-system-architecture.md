# 2. System Architecture

## 2.1 High-level diagram

```
                          +------------------------+
                          |  Web client (Next.js)  |
                          |  upload, style picker, |
                          |  before/after, shop UI |
                          +-----------+------------+
                                      | HTTPS (REST/JSON)
                          +-----------v------------+
                          |      API service       |
                          |  auth, rooms, designs, |
                          |  products, redirects   |
                          +--+------+---------+----+
                             |      |         |
              enqueue jobs   |      |         | SQL / vector queries
          +------------------v+     |    +----v-----------------------+
          |  Redis / BullMQ   |     |    | PostgreSQL + pgvector      |
          +--------+----------+     |    | rooms, designs, items,     |
                   |                |    | shops, products, matches   |
        +----------v----------+     |    +----------------------------+
        |   Worker service    |     |
        |  1. preprocess      |     |    +----------------------------+
        |  2. render (AI)     +-----+--->| Object storage (S3 compat) |
        |  3. detect items    |          | originals, renders, crops  |
        |  4. match products  |          +----------------------------+
        +--+--------+------+--+
           |        |      |
  +--------v--+ +---v----+ +--v-------------------+
  | Render    | | Vision | | Embedding model      |
  | Provider  | | model  | | (image + text)       |
  | (external)| | (detect| +----------------------+
  +-----------+ +--------+

   Catalogue side (independent schedule):
   +--------------------+     +------------------+     +---------------+
   | Scheduler (cron)   |---->| Ingestion worker |---->| products,     |
   +--------------------+     |  ShopConnector   |     | embeddings    |
                              |  per shop        |     +---------------+
                              +---+----+----+----+
                                  |    |    |
                        Shop API  Feed  CSV  (partner/affiliate network)
```

## 2.2 Components

| Component | Responsibility | MVP tech |
|---|---|---|
| Web client | Upload, style selection, progress, before/after slider, download, "Shop this look", filters | Next.js, TypeScript, Tailwind |
| API service | Auth, validation, signed upload URLs, create jobs, read designs/products, tracked outbound redirect | Next.js route handlers (or a separate Node service) |
| Job queue | Decouple slow AI calls from HTTP | Redis + BullMQ |
| Worker | Runs the design pipeline and catalogue ingestion | Node worker process |
| Render provider adapter | Calls the external image-generation service | `RenderProvider` interface (see [AI guide](05-ai-integration-guide.md)) |
| Vision/detection | Finds furniture in the render, returns labels, boxes, dominant colours | Multimodal LLM with structured output and/or open-vocabulary detector |
| Embedding service | Image/text vectors for similarity search | CLIP/SigLIP-family model (hosted or self-run) |
| Catalogue ingestion | Pulls products from shops, normalises, de-duplicates, embeds | `ShopConnector` implementations (see [Recommendation](06-product-recommendation-system.md)) |
| Database | Relational data + vector search | PostgreSQL with `pgvector` |
| Object storage | Original photos, depth/edge maps, renders, item crops, cached product thumbnails (where licence permits) | S3-compatible bucket, private, signed URLs |

## 2.3 Design generation pipeline

Executed by the worker for each `design` (one room + one style).

1. **Validate and preprocess**: check type/size, strip EXIF, resize (long edge about 1024 to 1536 px), moderation check.
2. **Structure extraction** (cached per room): depth map and line/edge map from the original photo. These guide the generator so walls, windows, doors and perspective stay put.
3. **Prompt construction**: combine room type, style preset, user colour/material hints, and the "professional 3D render" template ([AI guide](05-ai-integration-guide.md)).
4. **Render**: call the provider with the image, structure maps and prompt. Retry with backoff; fail over to a secondary provider if configured.
5. **Quality gate** (automatic): reject output if structural similarity to the original edge map is below a threshold, or if it is blank/corrupt; retry once with stronger structure guidance.
6. **Store** render in object storage; create a downscaled preview and a downloadable full-size file.
7. **Detect items**: run the vision model on the render; store each item (`category`, bounding box, dominant colours, style tags, crop).
8. **Match products**: for each item run the recommendation query ([Recommendation](06-product-recommendation-system.md)); store top N matches.
9. **Complete**: mark design `completed`; client (polling or SSE) shows the render and "Shop this look". Steps 7 and 8 may finish after the render is shown (design status `render_ready` then `completed`) so users see the image quickly.

Design status values: `queued` → `rendering` → `render_ready` → `matching` → `completed` (or `failed`).

## 2.4 Shop connector layer (extensibility)

The core never talks to a shop directly. It only knows the `ShopConnector` interface and a `shops` table row with `connector_type` and config:

```ts
interface ShopConnector {
  readonly shopSlug: string;
  // Stream normalised products; supports incremental sync via a cursor.
  fetchProducts(opts: { since?: string; cursor?: string }): AsyncIterable<RawProduct>;
  // Optional: refresh price/stock for specific SKUs between full syncs.
  fetchAvailability?(externalIds: string[]): Promise<AvailabilityUpdate[]>;
  // Map a normalised product to the outbound URL (adds affiliate params).
  buildProductUrl(product: NormalisedProduct): string;
}
```

Adding a shop:
1. Insert a row in `shops` (name, base URL, currency, `connector_type`, config JSON, legal/licence notes).
2. Pick an existing connector type (`feed_csv`, `feed_xml_google_merchant`, `shopify_storefront`, `affiliate_network`, `rest_api`) and configure it, or implement a new `ShopConnector` class and register it.
3. Add a category mapping file from the shop's categories to HOMELY categories.
4. Run a dry-run sync, inspect the report, enable the shop.

A normalisation step converts every shop's data to the single `products` schema (category mapping, price in minor units plus currency, colour extraction, style tagging, image fetch, embedding).

## 2.5 Outbound click tracking

Product links go through `GET /r/{productId}` (see [API](04-api-documentation.md)), which records a `click_events` row and then redirects (HTTP 302) to the shop's product URL with affiliate/UTM parameters. This provides conversion analytics and supports partner reporting.

## 2.6 Cross-cutting concerns

- **Auth:** session cookies or JWT; every room/design query is scoped by `user_id`.
- **Rate limiting and quotas:** per user and per IP; render quota by plan.
- **Idempotency:** `POST /designs` accepts an `Idempotency-Key` so retries do not double-bill the AI provider.
- **Observability:** structured logs with `design_id`, per-stage durations, provider latency/cost, queue depth, error rates.
- **Secrets:** provider and shop API keys in a secrets manager / environment variables, never in the repository or client.
- **Data retention:** user photos and renders deletable on request; shop product data refreshed on schedule, stale products hidden.
- **Failure isolation:** a failing shop connector never blocks designs; a failing matcher still delivers the render.

## 2.7 Future architecture (v2: interactive 3D)

Add a *Scene service* and a *3D asset catalogue*: room layout estimation or measured dimensions → scene graph (JSON) → client renderer (Three.js/Babylon.js) loading glTF models of products. Product matching then places real catalogue products into the scene instead of inferring them from pixels. Not part of the MVP; see [Roadmap](07-development-roadmap.md).
