# HOMELY AI

HOMELY AI turns a photo of a real room into a professional **3D-style rendered redesign**, then helps the user buy the furniture and decor that recreate it from **real products in integrated furniture shops**.

> **Important distinction.** The MVP produces a *3D-style rendered image* (a 2D picture that looks like a professional 3D interior render). It is **not** an editable, interactive 3D room model. See [Product Overview](docs/01-product-overview.md#3d-style-rendered-image-vs-interactive-3d-model).

## Documentation

The MVP is implemented in this repository (see [Running the MVP](#running-the-mvp) and [MVP implementation status](docs/09-mvp-implementation-status.md)). The design documents below describe the full plan; the status document lists where the MVP intentionally differs.

| # | Document | What it covers |
|---|----------|----------------|
| 1 | [Product Overview](docs/01-product-overview.md) | Scope, user flows, MVP vs later versions, 3D-style image vs real 3D model |
| 2 | [System Architecture](docs/02-system-architecture.md) | Components, data flow, async pipeline, shop connector layer |
| 3 | [Database Design](docs/03-database-design.md) | PostgreSQL schema (rooms, designs, detected items, shops, products, matches) |
| 4 | [API Documentation](docs/04-api-documentation.md) | REST endpoints with request/response examples |
| 5 | [AI Integration Guide](docs/05-ai-integration-guide.md) | How to plug in an image-generation service for 3D-style renders |
| 6 | [Product Recommendation System](docs/06-product-recommendation-system.md) | Shop integrations, item detection, matching and ranking |
| 7 | [Development Roadmap](docs/07-development-roadmap.md) | MVP, v1.x, v2 (interactive 3D) phases |
| 8 | [Testing and Deployment Plan](docs/08-testing-and-deployment.md) | Test strategy, quality evals, environments, CI/CD, monitoring |
| 9 | [MVP Implementation Status](docs/09-mvp-implementation-status.md) | What is built, what is simplified, how to connect real AI and real shops |

## Feature summary

1. **3D-style room redesign** – structure-preserving image generation, before/after comparison, multiple styles per room, download.
2. **Furniture shop integration** – pluggable connectors (official APIs, product feeds, approved partner/affiliate programs, curated CSV) so new shops are added without core changes.
3. **Product matching** – detect sofas, beds, tables, curtains, lighting etc. in the generated design and recommend similar real products, ranked by style, category, colour, price/budget and availability.

## Proposed stack (can be swapped)

TypeScript, Next.js (web + API routes), PostgreSQL with `pgvector`, Redis + BullMQ (job queue), S3-compatible object storage, a provider-agnostic `RenderProvider` interface for image generation, and a vision model for furniture detection.

## Running the MVP

Requirements: Node.js 22+ and npm.

```bash
npm install
npm run dev        # http://localhost:4815
```

No configuration is needed to try it. Without an API key the app runs in **demo mode**:

- Renders come from a local stand-in that restyles your photo and overlays sample furniture. It is clearly labelled "Demo preview" and is **not** a real AI 3D-style render.
- The catalogue contains three **fictional sample shops** (about 220 products) loaded from CSV feeds in `data/catalogue/`. Their "View on shop" links open a sample product page inside the app.

To get real AI renders, copy `.env.example` to `.env.local` and connect one provider:

- **Free:** Cloudflare Workers AI. Set `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` (a free Cloudflare account and a token made with the "Workers AI" template). Renders use FLUX.2 [klein] 4B and furniture detection uses Llama 4 Scout. The free daily allowance (10,000 Neurons) covers roughly 50 complete designs a day.
- **Paid:** OpenAI. Set `OPENAI_API_KEY`.

Restart `npm run dev` after changing `.env.local`. See the [AI Integration Guide](docs/05-ai-integration-guide.md) and the [status document](docs/09-mvp-implementation-status.md) for details.

Useful commands:

| Command | Purpose |
|---|---|
| `npm run dev` / `npm run build` / `npm start` | Run the app (port 4815) |
| `npm test` | Unit and catalogue/matching tests |
| `npm run typecheck`, `npm run lint` | Static checks |
| `npm run catalogue:sync` | Re-sync all shops from their connectors (`catalogue:dry-run` previews changes) |
| `npm run catalogue:generate` | Regenerate the sample shops and product images |

Data (SQLite database, uploaded photos, renders) is stored in `var/` and is git-ignored.
