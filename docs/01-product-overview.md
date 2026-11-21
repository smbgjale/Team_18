# 1. Product Overview

## 1.1 Purpose

HOMELY AI lets a user upload a photo of their room, choose a design style, and receive a realistic redesign that looks like a professional 3D interior visualisation, furnished with real, purchasable products. The same products can be explored and arranged in an interactive 3D layout view.

## 1.2 Core user flow

1. User uploads a room photo, chooses the room type and the **design direction for their home: Modern or Traditional** (required; it can be changed later on the room page).
2. User picks a style within that direction: Modern, Scandinavian, Minimalist or Industrial for a modern home; Classic, Rustic Farmhouse, African Heritage or Bohemian for a traditional one. Budget and wishes are optional.
3. HOMELY AI chooses real products from integrated shops for the room (one per furniture slot, within the budget), then generates a 3D-style render of the room furnished with them, keeping the original layout (walls, windows, doors, camera angle).
4. User compares original vs redesign with a before/after slider.
5. User opens the 3D view to look around the room and move, rotate or swap the products at their real sizes.
6. User generates more styles for the same room (variations are stored under the same room).
7. User downloads a design image.
8. HOMELY AI lists the products used in the design with similar alternatives, filterable by category and budget.
9. User clicks through to the product page on the shop's website to buy.

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
- Choose the products for a design up front, so every piece in it is a real catalogue product.
- For each product recommend similar alternatives from integrated shops.
- Consider design style, category, colour, price/user budget, room size and availability (when shop data supports it).
- (Planned in the original design, still used for designs created before products were chosen up front:) identify furniture in the generated image and match similar products.

### D. 3D layout view
- Show the chosen products in a 3D room at their real dimensions and colours.
- Orbit and zoom; drag, rotate and swap products; edit the room's width and length; save the layout per design.

## 1.4 3D-style rendered image vs interactive 3D model

This is a deliberate product boundary and must be reflected in UI copy, marketing and documentation. The MVP now has the first two columns; the third is a later version.

| | 3D-style rendered image (MVP) | 3D layout view (MVP) | Full interactive 3D room model (future) |
|---|---|---|---|
| What it is | A single 2D image produced by a generative model that imitates the look of a 3D render | A real 3D scene (WebGL) of a box-shaped room with the design's products | A real 3D scene reconstructed from the actual room, with a detailed 3D model of each product |
| Editable? | No. Only re-generate with a different prompt/style | Yes. Move, rotate and swap products, change the room's width and length | Yes. Also materials, lighting, walls, openings |
| Camera | Fixed to the uploaded photo's viewpoint | Free orbit and zoom | Free orbit / walk-through, AR |
| Products | The chosen real products are given to the AI as reference photos; the AI may change details, drop or add objects | Exactly the chosen catalogue products, at the real width/depth/height and colour from the shop | Exactly the chosen catalogue products as photo-real 3D models |
| Product shapes | Photo-real looking, but generated | **Simplified generic shape per category** (a sofa looks like a generic sofa of the right size and colour) | The product's own 3D model (glTF) supplied by the shop or built for it |
| Room geometry | Taken from the photo (approximately) | A rectangular room with estimated dimensions that the user can edit; one window, no doors; not derived from the photo | Measured or reconstructed (LiDAR, photogrammetry, layout estimation) |
| Geometric accuracy | Approximate | Real product sizes; room as accurate as the dimensions entered | Metric |
| Typical tech | Image diffusion / image-editing models with structure guidance | Three.js via React Three Fiber, procedural shapes from catalogue dimensions | Three.js / Babylon.js / Unity with glTF assets, room reconstruction |
| Effort/cost | Low per image | Low: runs in the browser, no per-product assets | High: asset pipeline, 3D models per product, room reconstruction |

Consequences for the product:
- UI must say "3D-style render" or "AI visualisation" for the image, and "3D layout view" with "real sizes, simplified shapes" for the 3D view. Never call either a "3D model of your room" or a photo-real 3D model of the products.
- Sizes in the render are not reliable. The 3D view uses the shop's dimensions, so it can warn when a product is larger than the room, but it does not replace measuring the real room.
- The image may not reproduce every chosen product faithfully. The product list marks products that the image check could not find, and products swapped after the image was made.
- A full interactive 3D room model remains a **later version** (see [Roadmap](07-development-roadmap.md)) and needs room reconstruction and per-product 3D assets.

## 1.5 MVP scope

In scope:
- Photo upload, style selection, 3D-style render generation via one external image-generation provider.
- Before/after comparison, regenerate with other styles, download.
- Small curated product catalogue (roughly 3 to 5 shops, a few hundred to a few thousand products) loaded via the connector layer (official API, feed, or curated CSV with the shop's permission).
- Products chosen up front for every design, with alternatives filterable by category and budget.
- 3D layout view of the chosen products (simplified shapes at real sizes).
- Outbound links to shop product pages (with affiliate/UTM parameters where an agreement exists).
- Accounts (email or social login), saved rooms/designs.

Out of scope for MVP:
- Room reconstruction from the photo, per-product photo-real 3D models, AR placement.
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
