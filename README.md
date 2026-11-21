# HOMELY AI

HOMELY AI turns a photo of a real room into a professional **3D-style rendered redesign**, then helps the user buy the furniture and decor that recreate it from **real products in integrated furniture shops**.

> **Important distinction.** The MVP produces a *3D-style rendered image* (a 2D picture that looks like a professional 3D interior render). It is **not** an editable, interactive 3D room model. See [Product Overview](docs/01-product-overview.md#3d-style-rendered-image-vs-interactive-3d-model).

## Documentation

This repository currently contains the development documents only (no application code yet). Read them in order:

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

## Feature summary

1. **3D-style room redesign** – structure-preserving image generation, before/after comparison, multiple styles per room, download.
2. **Furniture shop integration** – pluggable connectors (official APIs, product feeds, approved partner/affiliate programs, curated CSV) so new shops are added without core changes.
3. **Product matching** – detect sofas, beds, tables, curtains, lighting etc. in the generated design and recommend similar real products, ranked by style, category, colour, price/budget and availability.

## Proposed stack (can be swapped)

TypeScript, Next.js (web + API routes), PostgreSQL with `pgvector`, Redis + BullMQ (job queue), S3-compatible object storage, a provider-agnostic `RenderProvider` interface for image generation, and a vision model for furniture detection.
