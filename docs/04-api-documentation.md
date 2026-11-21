# 4. API Documentation

Base URL: `/api/v1`. JSON over HTTPS. Authentication: session cookie or `Authorization: Bearer <token>`. All room, design and saved-item endpoints are scoped to the authenticated user.

Conventions:
- IDs are UUIDs. Timestamps are ISO 8601 UTC.
- Money is `{ "amount_minor": 129900, "currency": "USD" }` (amount in minor units).
- Errors: `{ "error": { "code": "string", "message": "string", "details": {} } }` with standard HTTP status codes (400 validation, 401, 403, 404, 409, 422, 429 quota/rate limit, 502 provider failure).
- Long-running work is asynchronous: create returns `202` with a resource in `queued` state; poll `GET` or subscribe to SSE.
- Lists use cursor pagination: `?limit=20&cursor=...` returning `{ "items": [], "next_cursor": "..." | null }`.

## 4.1 Rooms

### `POST /rooms/upload-url`
Get a signed URL to upload the room photo directly to object storage.

Request
```json
{ "content_type": "image/jpeg", "file_size_bytes": 2480112 }
```
Response `200`
```json
{ "upload_url": "https://storage.example/...", "upload_key": "uploads/9f1c...jpg", "expires_in": 600 }
```
Limits: JPEG/PNG/WebP, max 15 MB, min 512 px on the short edge.

### `POST /rooms`
Create a room from an uploaded photo. Server validates, strips EXIF, runs moderation, and computes structure maps.

Request
```json
{ "upload_key": "uploads/9f1c...jpg", "room_type": "living_room", "name": "My living room" }
```
Response `201`
```json
{
  "id": "2f3b...",
  "name": "My living room",
  "room_type": "living_room",
  "original_image_url": "https://cdn.example/signed...",
  "width_px": 1536,
  "height_px": 1024,
  "created_at": "2026-11-21T09:00:00Z"
}
```

### `GET /rooms` / `GET /rooms/{roomId}` / `DELETE /rooms/{roomId}`
List, fetch (with its designs summary), or delete a room and all its designs and files.

## 4.2 Designs (3D-style renders)

### `GET /styles`
Available style presets.
```json
{ "items": [
  { "id": "modern", "name": "Modern", "description": "Clean lines, neutral palette, statement lighting" },
  { "id": "scandinavian", "name": "Scandinavian", "description": "Light woods, white walls, cosy textiles" }
] }
```

### `POST /rooms/{roomId}/designs`
Generate a design in a style. Call again with a different `style` to create another variation of the same room.

Headers: `Idempotency-Key: <uuid>` (recommended).

Request
```json
{
  "style": "scandinavian",
  "prompt": "keep the large window, add a reading corner",
  "color_palette": ["white", "oak", "sage green"],
  "budget": { "amount_minor": 300000, "currency": "USD" },
  "layout_fidelity": "high"
}
```
- `layout_fidelity`: `high` (default, strongest structure guidance), `medium`, `low` (more creative freedom).
- `budget` is optional and is used for product matching.

Response `202`
```json
{
  "id": "d7a1...",
  "room_id": "2f3b...",
  "style": "scandinavian",
  "status": "queued",
  "created_at": "2026-11-21T09:01:00Z"
}
```
Errors: `429 quota_exceeded` when the user's render quota is used up; `422 image_rejected` when moderation fails.

### `GET /designs/{designId}`
Poll for status and result.
```json
{
  "id": "d7a1...",
  "room_id": "2f3b...",
  "style": "scandinavian",
  "status": "completed",
  "render_type": "3d_style_image",
  "original_image_url": "https://cdn.example/signed-original",
  "render_image_url": "https://cdn.example/signed-render",
  "preview_image_url": "https://cdn.example/signed-preview",
  "disclaimer": "AI-generated 3D-style visualisation. Not an editable 3D model; dimensions are approximate.",
  "created_at": "2026-11-21T09:01:00Z",
  "completed_at": "2026-11-21T09:01:48Z"
}
```
`status`: `queued | rendering | render_ready | matching | completed | failed`. On `failed`, `error` contains `code` and `message`; the quota is refunded.

### `GET /designs/{designId}/events` (SSE, optional)
Streams `status` events so the client avoids polling.

### `GET /rooms/{roomId}/designs`
All designs for a room (for style switching and comparison).

### `GET /designs/{designId}/compare`
Convenience payload for the before/after UI.
```json
{ "original_image_url": "...", "render_image_url": "...", "aspect_ratio": 1.5 }
```

### `GET /designs/{designId}/download?format=png`
Returns a short-lived signed URL (or a `302` redirect) to the full-resolution file with `Content-Disposition: attachment`. `format`: `png | jpeg`. Free tier may be watermarked. Each call is recorded in `design_downloads`.
```json
{ "download_url": "https://storage.example/signed...", "expires_in": 300, "watermarked": false }
```

### `DELETE /designs/{designId}`

## 4.3 Shop this look (items and matches)

### `GET /designs/{designId}/items`
Items detected in the generated image, each with top product matches.

Query: `categories=sofa,curtains` (optional filter), `max_price_minor=`, `min_price_minor=`, `currency=`, `in_stock_only=true|false`, `matches_per_item=5`.

Response `200`
```json
{
  "design_id": "d7a1...",
  "items": [
    {
      "id": "a91c...",
      "category": "sofa",
      "label": "light grey 3-seat fabric sofa",
      "confidence": 0.93,
      "bbox": { "x": 0.12, "y": 0.52, "w": 0.46, "h": 0.30 },
      "crop_url": "https://cdn.example/signed-crop",
      "dominant_colors": [{ "hex": "#c9c6c1", "name": "light grey", "share": 0.71 }],
      "matches": [
        {
          "rank": 1,
          "score": 0.87,
          "score_breakdown": { "visual": 0.84, "style": 0.9, "color": 0.88, "price": 1.0, "availability": 1.0 },
          "product": {
            "id": "p_5c20...",
            "name": "Nordic 3-Seater Sofa, Grey",
            "description": "Fabric sofa with solid oak legs...",
            "category": "sofa",
            "image_url": "https://cdn.example/p/5c20.jpg",
            "price": { "amount_minor": 129900, "currency": "USD" },
            "sale_price": null,
            "shop": { "id": "s_01", "slug": "example-furniture", "name": "Example Furniture", "logo_url": "..." },
            "dimensions_cm": { "width": 210, "depth": 90, "height": 80 },
            "availability": "in_stock",
            "product_url": "/r/p_5c20...?design=d7a1...&item=a91c..."
          }
        }
      ]
    }
  ],
  "budget_summary": {
    "budget": { "amount_minor": 300000, "currency": "USD" },
    "top_match_total": { "amount_minor": 287400, "currency": "USD" },
    "within_budget": true
  }
}
```
Matches are *similar products*, not an exact reproduction of what is in the render. Prices and availability come from the shop's data and may be out of date; `availability` may be `unknown`.

### `POST /designs/{designId}/items/{itemId}/rematch`
Re-run matching with different constraints (e.g. new budget, another colour).
```json
{ "max_price": { "amount_minor": 80000, "currency": "USD" }, "colors": ["beige"], "shops": ["example-furniture"] }
```

### Products chosen up front (as implemented in the MVP)

New designs are furnished with real products before rendering, so the MVP's `GET /api/designs/{designId}/items` returns those products instead of detected items (`mode: "products"`). Designs created earlier keep the detected-item format above (`mode: "detected"`, `chosen: null`). The query parameters are the same; price, stock and shop filters apply to the alternatives.

```json
{
  "design_id": "PahnOm87yvphng",
  "status": "completed",
  "mode": "products",
  "items": [
    {
      "id": "Xb1c9...",
      "category": "sofa",
      "label": "Sofas",
      "quantity": 1,
      "in_render": true,
      "replaced_after_render": false,
      "chosen": { "id": "p_5c20...", "name": "Hygge Grey 3-Seater Sofa", "price": { "amount_minor": 48499, "currency": "USD" }, "dimensions_cm": { "width": 218, "depth": 100, "height": 82 }, "...": "same fields as other product objects" },
      "alternatives": [{ "rank": 1, "score": 0.86, "score_breakdown": { "style": 1, "color": 0.9, "...": 0 }, "product": { "...": "..." } }]
    }
  ],
  "budget_summary": {
    "budget": { "amount_minor": 300000, "currency": "USD" },
    "total": { "amount_minor": 166293, "currency": "USD" },
    "within_budget": true
  },
  "notice": "Each design is furnished with these real products from partner shops..."
}
```

- `in_render`: `true` if the image check found the product's category in the generated image, `false` if not (the AI dropped it), `null` if the check did not run.
- `total` is the sum of the chosen products' prices times their quantities.

### `PATCH /api/designs/{designId}/products/{itemId}` (MVP)
Swap the product used in one slot. Body `{ "product_id": "p_..." }`. The product must be active, not out of stock, and in the same or a compatible category. Sets `replaced_after_render` because the existing image no longer shows this product. Returns `{ "ok": true }`.

### `GET /api/designs/{designId}/scene` (MVP)
Data for the 3D layout view. Units are metres; the origin is the centre of the floor, `+x` is right, `+z` points towards the viewer, the back wall is at `z = -length/2`, and `rot` is the rotation about the vertical axis in degrees (0 = the product's front faces `+z`).

```json
{
  "design_id": "PahnOm87yvphng",
  "style": "scandinavian",
  "room": { "width_m": 5, "length_m": 4.2, "height_m": 2.6, "wall_hex": "#f4f1ea", "floor_hex": "#d4b48a" },
  "items": [
    {
      "id": "Xb1c9...",
      "category": "sofa",
      "quantity": 1,
      "dims_m": { "w": 2.18, "d": 1.0, "h": 0.82 },
      "dims_from_shop": true,
      "round": false,
      "color_hex": "#b4b3af",
      "layout": [{ "x": 0, "z": -1.55, "rot": 0 }],
      "product": { "...": "product object" }
    }
  ],
  "total": { "amount_minor": 166293, "currency": "USD" }
}
```

`layout` is `null` until the user moves something; the client then uses the default placement rules. `dims_from_shop: false` means the shop gave no dimensions and a typical size for the category is used.

### `PUT /api/designs/{designId}/scene` (MVP)
Save the layout and/or the room size. Body: `{ "room": { "width_m": 4.5, "length_m": 3.8 }, "items": [{ "id": "Xb1c9...", "layout": [{ "x": 0.2, "z": -1.5, "rot": 90 }] }] }` (both parts optional; room sides 2 to 15 m, up to 8 placements per item). Returns the updated scene. Rate limited per IP.

## 4.4 Products (catalogue browsing)

### `GET /products`
Browse/filter the integrated catalogue.

Query: `q=`, `category=`, `style=`, `color=`, `shop=`, `min_price_minor=`, `max_price_minor=`, `currency=`, `in_stock_only=`, `sort=relevance|price_asc|price_desc|newest`, `limit`, `cursor`.

Response `200`: `{ "items": [ <product object as above> ], "next_cursor": null }`.

### `GET /products/{productId}`
Full product details (all images, description, dimensions, shop info, last synced time).

### `GET /categories`
HOMELY category taxonomy.

### `GET /shops`
Integrated shops visible to users: `id, slug, name, logo_url, website_url, product_count`.

### `GET /r/{productId}?design={designId}&item={itemId}`
Outbound redirect. Records a `click_events` row, then responds `302` to the shop's product page with affiliate/UTM parameters. All "View on shop" buttons use this URL. Product pages open in a new tab (`rel="noopener sponsored"` when affiliate).

## 4.5 Saved products

- `PUT /me/saved-products/{productId}` (optional body `{ "design_id": "..." }`)
- `DELETE /me/saved-products/{productId}`
- `GET /me/saved-products`

## 4.6 Admin / internal API (role `admin`)

| Endpoint | Purpose |
|---|---|
| `POST /admin/shops` | Register a shop (name, URL, currency, connector type, config, category map, agreement info) |
| `PATCH /admin/shops/{shopId}` | Update config; enable/disable |
| `POST /admin/shops/{shopId}/sync` | Trigger a sync; body `{ "dry_run": true }` returns a report without writing |
| `GET /admin/shops/{shopId}/sync-runs` | Sync history and errors |
| `GET /admin/products/unmapped-categories` | Products whose shop category has no HOMELY mapping |
| `POST /admin/designs/{id}/retry` | Retry a failed design |
| `GET /admin/metrics/providers` | Per-provider latency, failure rate, cost |

Example `POST /admin/shops`
```json
{
  "slug": "example-furniture",
  "name": "Example Furniture",
  "website_url": "https://shop.example.com",
  "currency": "USD",
  "connector_type": "feed_xml_google_merchant",
  "connector_config": { "feed_url": "https://shop.example.com/feeds/homely.xml", "auth": "secret:EXAMPLE_FEED_TOKEN" },
  "category_map": { "Sofas & Couches": "sofa", "Curtains & Drapes": "curtains" },
  "affiliate_template": "{url}?utm_source=homely&utm_medium=referral",
  "agreement_type": "feed_permission"
}
```

## 4.7 Webhooks (optional, later)

- `POST /webhooks/render-provider`: if the AI provider supports async callbacks, results are received here (signature verified) instead of polling the provider.
- `POST /webhooks/shops/{slug}`: shops that push product/stock updates (verified by shared secret/HMAC).

## 4.8 Rate limits and quotas (defaults, configurable)

| Resource | Limit |
|---|---|
| Design generation | Free: 5 total; Pro: monthly quota; max 2 concurrent per user |
| Uploads | 20 per hour per user |
| Read endpoints | 120 requests/minute per user |
| Redirect `/r/*` | 60 per minute per IP (bot protection) |
