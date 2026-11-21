# 7. Development Roadmap

Phases are ordered by dependency and risk, not by dates. Each phase ends with an exit criterion that must be met before the next begins.

## Phase 0: Foundations and validation
- Repository, CI, environments, lint/test tooling, database migrations, object storage, queue.
- **AI spike:** build the `RenderProvider` interface, integrate 1 to 2 candidate providers, run the evaluation set ([AI guide §5.8](05-ai-integration-guide.md#58-evaluation-before-committing-to-a-provider)). Select the primary provider and tune the style prompts.
- **Shop spike:** sign up 3 to 5 pilot shops/partner programmes; confirm legal permission and data channel for each; obtain sample feeds.
- Define category taxonomy and style vocabulary.

Exit: a provider that meets the layout-preservation and "render look" targets; at least 3 shops with confirmed data access.

## Phase 1: MVP — 3D-style generation plus small shoppable catalogue

Design generation
- Upload room photo, room type selection, preprocessing, structure maps.
- Render pipeline with a Modern/Traditional direction choice and 8 styles, quality gate, fallback provider.
- Before/after slider, multi-style variations per room, download (PNG/JPEG), disclaimer label.
- Quotas and basic accounts.

Shops and products
- `ShopConnector` interface plus `feed_csv`, `feed_xml_google_merchant` and `manual` connectors (add API connector for any pilot shop that offers one).
- Admin UI/CLI to register shops, map categories, run dry-run syncs.
- Catalogue browsing with category and budget filters; product cards with image, name, price, description, shop and "View on shop" link; click tracking.

Matching
- Item detection on the render, colour extraction, crop embeddings.
- Matching pipeline (filters + embeddings + weighted score), budget input.
- "Shop this look" panel per design.

Quality, ops
- Test suites and eval sets ([Testing plan](08-testing-and-deployment.md)), staging and production deploys, monitoring, privacy policy and data deletion.

Exit (MVP launch criteria):
- ≥ 90% of generated designs pass the layout quality gate; p95 render latency < 90 s.
- ≥ 80% of designs have matches for ≥ 3 detected categories.
- Every product shown links to a working product page; sync of all shops healthy for 7 consecutive days.
- UI never calls the output an editable 3D model.

## Phase 2: v1.x — Quality, selection and scale
- Region editing: inpainting to change floor/wall/furniture while keeping the rest; "keep my sofa".
- Product-aware generation (reference images of real products).
- More shops (target 10+), API connectors, affiliate network integration, scheduled stock/price refresh.
- Saved boards/shopping lists, shareable design links, budget planner across items.
- Learning-to-rank from click/save data; catalogue AI tagging improvements.
- Multi-currency and localisation.
- Paid plans (higher quotas, no watermark, HD upscaling).

## Phase 3: v2 — Full interactive 3D room (separate product track)

Already in the MVP (a first step): every design is furnished with real catalogue products, and a 3D layout view shows them at their real sizes in a rectangular room with editable dimensions, with drag, rotate, swap and saved layouts. The user can also save a GLB built from each catalogue photo (see [Overview §1.4](01-product-overview.md#14-3d-style-rendered-image-vs-interactive-3d-model)). The remaining work below turns that into a full 3D room.

Prerequisites and workstreams:
- **Room reconstruction:** from measured dimensions, a floor plan wizard, or reconstruction from photos/LiDAR (device-dependent).
- **3D asset catalogue:** glTF models for products (from shop partners or generated), with scale metadata from real dimensions.
- **Scene editor:** extend the MVP viewer (React Three Fiber) with materials and lighting, doors and multiple windows, collision checks, undo, and a 2D floor-plan mode.
- **Rendering:** real-time view plus optional AI "photoreal pass" over a scene screenshot for presentation images.
- **Real fit checks:** the MVP warns when a product is larger than the entered room size; with a reconstructed room, check clearances, doors and walkways.
- Optional AR placement on mobile.

Gate: validated user demand from MVP/v1 usage, and partner agreement for 3D assets. This is a significant new subsystem, not an incremental feature.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Renders alter room layout | Users lose trust | Structure guidance, quality gate, fidelity levels, show before/after |
| Renders look like edited photos, not 3D renders | Core promise missed | Render-quality prompt block, higher img2img strength, evaluation with blind ratings, provider comparison |
| Users expect an editable 3D model | Disappointment | Clear labelling, FAQ, roadmap messaging ([Overview §1.4](01-product-overview.md#14-3d-style-rendered-image-vs-interactive-3d-model)) |
| Shops refuse data access or terms change | Empty catalogue | Multiple channels, partner outreach early, affiliate networks, kill switch per shop |
| Poor product matches | Low click-through | Hard category filter, evaluation set, weights tuning, feedback button |
| Stale prices/stock | Bad experience | Show sync time, disclaimers, frequent refresh for top products, link out for final price |
| AI cost overruns | Margin loss | Quotas, caching, concurrency limits, cheaper preview mode |
| Privacy of room photos | Legal/reputation | EXIF stripping, deletion, private storage, provider with no-training terms |
| Provider outage or policy change | Downtime | Provider abstraction and fallback |

## Suggested team and ownership
- Full-stack engineers: web app, API, admin.
- ML/AI engineer: render provider evals, prompts, detection, embeddings, matching.
- Data/integration engineer: connectors, normalisation, sync reliability.
- Design/UX: before/after, "shop this look", clear disclosure messaging.
- Business development: shop partnerships and legal agreements (in parallel from Phase 0).
