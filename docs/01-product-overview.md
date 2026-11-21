# 1. Product Overview

## 1.1 Purpose

HOMELY AI lets a user upload a photo of their room, choose a design style, and receive a realistic redesign that looks like a professional 3D interior visualisation. It then shows real, purchasable products that match what appears in the redesign.

## 1.2 Core user flow

1. User uploads a room photo (and optionally room type, budget, colour preferences).
2. User picks a style (e.g. Modern, Scandinavian, Minimalist, Industrial, Bohemian, Classic).
3. HOMELY AI generates a 3D-style render that keeps the original layout (walls, windows, doors, camera angle).
4. User compares original vs redesign with a before/after slider.
5. User generates more styles for the same room (variations are stored under the same room).
6. User downloads a design image.
7. HOMELY AI lists the furniture/decor visible in the design ("Shop this look") and recommends real products from integrated shops for each item, filterable by category and budget.
8. User clicks through to the product page on the shop's website to buy.

## 1.3 Functional requirements

### A. 3D-style AI room design generation
- Generate high-quality renders that look like a professional 3D interior render (clean global illumination, soft shadows, material detail, consistent perspective), not a lightly edited photo.
- Preserve the original layout as much as possible (room geometry, windows, doors, camera perspective).
- Render furniture, decorations, wall colours, flooring and lighting in the chosen style.
- Before/after comparison (slider and side by side).
- Multiple styles per room; each is a separate stored *design*.
- Download the design (PNG/JPEG; optional watermark on free tier).

### B. Furniture shop integration
- Connect to external furniture and home-decor shops.
- Display real products with image, name, price, description and shop name.
- Filter by category and budget.
- Each product has a direct link to the product page on the shop's site.
- Use official APIs, product feeds or approved partner programs where available.
- Adding a new shop = adding a connector + configuration, not changing core code.

### C. Product matching
- Identify furniture and decor in the generated design (sofa, bed, table, curtains, lighting, rugs, etc.).
- For each item recommend similar products from integrated shops.
- Consider design style, category, colour, price/user budget and availability (when shop data supports it).

## 1.4 3D-style rendered image vs interactive 3D model

This is a deliberate product boundary and must be reflected in UI copy, marketing and documentation.

| | 3D-style rendered image (MVP) | Interactive 3D room model (future) |
|---|---|---|
| What it is | A single 2D image produced by a generative model that imitates the look of a 3D render | A real 3D scene: geometry, materials, lights, objects with positions and sizes |
| Editable? | No. Only re-generate with a different prompt/style. Individual objects cannot be moved or resized | Yes. Move, rotate, swap furniture; change materials and lighting |
| Camera | Fixed to the uploaded photo's viewpoint | Free orbit / walk-through |
| Geometric accuracy | Approximate. The model may subtly alter proportions, add or drop objects | Metric, if built from measured dimensions or reliable reconstruction |
| Furniture list | Inferred by detecting objects in the image (probabilistic) | Exact: every object in the scene is a known catalogue item |
| Typical tech | Image diffusion / image-editing models with structure guidance | Three.js / Babylon.js / Unity with glTF assets, room reconstruction (LiDAR, photogrammetry, monocular layout estimation) |
| Effort/cost | Low per image | High: asset pipeline, 3D models per product, room reconstruction |

Consequences for the product:
- UI must say "3D-style render" or "AI visualisation", never "3D model" or "editable 3D room".
- Sizes in a render are not reliable. Do not claim that a recommended product "fits" the room; show product dimensions from the shop and let the user check.
- Product matches are *similar to* what appears in the image, not a pixel-exact reproduction.
- Interactive 3D editing is a **later version** (see [Roadmap](07-development-roadmap.md)) and requires separate work: room reconstruction and 3D product assets.

## 1.5 MVP scope

In scope:
- Photo upload, style selection, 3D-style render generation via one external image-generation provider.
- Before/after comparison, regenerate with other styles, download.
- Small curated product catalogue (roughly 3 to 5 shops, a few hundred to a few thousand products) loaded via the connector layer (official API, feed, or curated CSV with the shop's permission).
- Item detection on generated designs and per-item product recommendations with category and budget filters.
- Outbound links to shop product pages (with affiliate/UTM parameters where an agreement exists).
- Accounts (email or social login), saved rooms/designs.

Out of scope for MVP:
- Interactive 3D editing, room reconstruction, AR placement.
- On-platform checkout or cart (users buy on the shop's site).
- Large-scale catalogue (100k+ products) and real-time inventory for every shop.
- Custom-trained image models.

## 1.6 Non-functional requirements

- **Latency:** first render within about 30 to 90 seconds; user sees progress status (async job).
- **Cost control:** per-user render quotas; cap variations per request; cache results by `(image hash, style, parameters, seed)`.
- **Privacy:** room photos may show private spaces. Private by default, deletable, never used for model training without explicit consent; strip EXIF/location metadata on upload.
- **Safety:** moderation of uploads (no people/explicit content as a primary subject); blur or reject faces if the provider terms require it.
- **Extensibility:** shops and AI providers are replaceable behind interfaces.
- **Legal:** respect shop terms of service and image licences; no scraping without written permission; disclose affiliate links.
