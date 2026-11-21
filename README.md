# HOMELY AI

HOMELY AI turns a photo of a real room into a professional **3D-style rendered redesign** furnished with **real products from integrated furniture shops**, and shows those same products in an **interactive 3D room view** where they can be moved, rotated and swapped.

> **Important distinction.** Each design has two outputs:
> - A *3D-style rendered image*: a 2D picture that looks like a professional 3D interior render. The chosen products' photos are given to the AI as references, but the AI can still change details of a product. The image cannot be edited.
> - An *interactive 3D layout view*: a real 3D scene (WebGL) with each chosen product at its real width, depth and height and in its colour, drawn as a **simplified shape** for its category. It is not a photo-real 3D model of each product, and the room is a box with estimated (editable) dimensions, not a reconstruction of your photo.
>
> See [Product Overview §1.4](docs/01-product-overview.md#14-3d-style-rendered-image-vs-interactive-3d-model).

## Documentation

The MVP is implemented in this repository (see [Running the MVP](#running-the-mvp) and [MVP implementation status](docs/09-mvp-implementation-status.md)). The design documents below describe the full plan; the status document lists where the MVP intentionally differs.

| # | Document | What it covers |
|---|----------|----------------|
| 1 | [Product Overview](docs/01-product-overview.md) | Scope, user flows, MVP vs later versions, 3D-style image vs 3D layout view vs full 3D model |
| 2 | [System Architecture](docs/02-system-architecture.md) | Components, data flow, async pipeline, shop connector layer |
| 3 | [Database Design](docs/03-database-design.md) | PostgreSQL schema (rooms, designs, design products, detected items, shops, products, matches) |
| 4 | [API Documentation](docs/04-api-documentation.md) | REST endpoints with request/response examples |
| 5 | [AI Integration Guide](docs/05-ai-integration-guide.md) | How to plug in an image-generation service for 3D-style renders |
| 6 | [Product Recommendation System](docs/06-product-recommendation-system.md) | Shop integrations, item detection, matching and ranking |
| 7 | [Development Roadmap](docs/07-development-roadmap.md) | MVP, v1.x, v2 (full interactive 3D) phases |
| 8 | [Testing and Deployment Plan](docs/08-testing-and-deployment.md) | Test strategy, quality evals, environments, CI/CD, monitoring |
| 9 | [MVP Implementation Status](docs/09-mvp-implementation-status.md) | What is built, what is simplified, how to connect real AI and real shops |

## Feature summary

1. **Modern or traditional** – the customer chooses the direction for their home when uploading the photo (and can switch later), then a style within it: Modern, Scandinavian, Minimalist or Industrial; or Classic, Rustic Farmhouse, African Heritage or Bohemian. The products, the prompt and the matching all follow that choice.
2. **Real products first** – before rendering, each design is furnished with real catalogue products (one per furniture slot) chosen for the style, colour palette, room size, budget and availability.
3. **3D-style room redesign** – structure-preserving image generation that uses the chosen products' photos as references, before/after comparison, multiple styles per room, download.
4. **Interactive 3D layout view** – orbit around the room, drag, rotate and swap the chosen products at their real sizes; set the room's width and length.
5. **Furniture shop integration** – pluggable connectors (official APIs, product feeds, approved partner/affiliate programs, curated CSV) so new shops are added without core changes.
6. **Product matching** – similar alternatives for every product in the design, ranked by style, category, colour, price/budget and availability, with links to the shop pages.

## Proposed stack (can be swapped)

TypeScript, Next.js (web + API routes), PostgreSQL with `pgvector`, Redis + BullMQ (job queue), S3-compatible object storage, a provider-agnostic `RenderProvider` interface for image generation, and a vision model for furniture detection.

## Running the MVP

Requirements: Node.js 22+ and npm.

```bash
npm install
npm run dev        # http://localhost:4815
```

No configuration is needed to try it. Without an API key the app runs in **demo mode**:

- Renders come from a local stand-in that restyles your photo and overlays the images of the products chosen for the design. It is clearly labelled "Demo preview" and is **not** a real AI 3D-style render. The 3D view works the same in demo mode and with a real provider.
- The catalogue uses only the shops that were connected: [Sabahar](https://sabahar.com/) (handwoven cushion covers and a fabric basket) and [Ethiopian Cultural Shop](https://ethiopianculturalshop.com/home-goods/) (handwoven baskets). Photos, prices and "View on shop" links come from those websites. Clothing, towels, table linen and cups are not imported. These shops do not sell sofas, beds or tables, so a design is furnished with the cushions and baskets they do sell.

To get real AI renders, copy `.env.example` to `.env.local` and connect one provider:

- **Free:** Cloudflare Workers AI. Set `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` (a free Cloudflare account and a token made with the "Workers AI" template). Renders use FLUX.2 [klein] 4B (with the room photo and up to three product photos as references) and the check of which products appear in the image uses Llama 4 Scout. The free daily allowance (10,000 Neurons) covers roughly 45 complete designs a day.
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
