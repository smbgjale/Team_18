# 5. AI Integration Guide: Realistic 3D-Style Room Designs

Goal: the output must look like a **professional 3D interior design render** (clean global illumination, physically plausible materials, soft shadows, tidy styled composition) while **keeping the original room layout**. It must not look like a casually retouched photo.

Reminder: the result is a generated 2D image in a 3D-render style, **not** a 3D model. See [Product Overview §1.4](01-product-overview.md#14-3d-style-rendered-image-vs-interactive-3d-model).

> Provider names, model names, parameters and prices change often. Treat the examples here as patterns. Before choosing, check the provider's current documentation, pricing, content policy and licence terms for commercial use, then run the evaluation in §5.8.

## 5.1 Approach: structure-guided image-to-image generation

A plain "photo → prompt → image" call tends to either barely change the room (looks like an edited photo) or redesign it completely (layout lost). The reliable pattern combines three ingredients:

1. **Source image** – the user's photo, as the layout reference.
2. **Structure guidance** – a depth map and/or line (edge) map extracted from the photo, passed as control inputs so walls, windows, doors, ceiling and perspective are preserved while surfaces and objects are re-imagined.
3. **A "professional 3D render" prompt** – style, materials, lighting and render-quality language (§5.4) plus negative prompts that suppress photographic artefacts.

Typical control levels:

| Setting | Effect | Default |
|---|---|---|
| Image strength / denoise (img2img) | Low = close to the photo, high = more redesign | 0.65 to 0.80 (higher than photo-retouch workflows so the *look* changes to render style) |
| Depth control strength | Keeps room geometry and perspective | 0.7 to 0.9 |
| Line/edge control strength | Keeps windows, door frames, ceiling lines | 0.5 to 0.8 |
| Guidance scale (CFG) | Prompt adherence | provider default, tune in evals |

`layout_fidelity` in the API maps to these presets: `high` (depth 0.9, lines 0.8, strength 0.65), `medium` (0.75/0.6/0.72), `low` (0.6/0.4/0.8).

Optional enhancements:
- **Clear-and-stage**: when the room is cluttered, run an inpainting pass that removes existing movable furniture (using a segmentation mask) while keeping architecture, then generate the new furnishings.
- **Architecture-preserving masks**: segment walls, floor, windows, doors; lock windows/doors, allow walls/floor to change colour/material.

## 5.2 Choosing a provider

Evaluate candidates on: structure-preservation controls (depth/edge/structure inputs), render-style quality, latency, cost per image, resolution, API stability, content policy (interior photos, privacy), commercial-use licence, data-retention/training terms, and regional availability.

Provider categories:

| Category | Examples of what to look for | Pros | Cons |
|---|---|---|---|
| Hosted diffusion API with control inputs | Services that expose structure/depth/sketch control endpoints or host open models with ControlNet-style adapters | Best layout control, tunable | More parameters to tune; model choice matters |
| General multimodal image-editing API | Image-edit endpoints of large AI providers that take a photo plus an instruction | Simple, strong prompt understanding | Less precise layout locking; may alter geometry; verify with the quality gate |
| Interior-design-specific API | Vendors offering room-restyling APIs | Tuned for the task | Vendor lock-in, less control, cost |
| Self-hosted open models on GPUs | Open diffusion models with depth/edge adapters | Full control, no per-image fee | Ops burden, GPU cost, licence review |

**Free option for development and pilots:** Cloudflare Workers AI has a free daily allowance and hosts an image-editing model (FLUX.2 [klein] 4B, which accepts the room photo as a reference image) and vision models for item detection (for example Llama 4 Scout). The MVP ships adapters for it; see [MVP Implementation Status §9.4](09-mvp-implementation-status.md#94-demo-mode-vs-real-mode) for limits. Free tiers of other providers change often and some exclude image generation, so check current terms before relying on one.

**MVP recommendation:** start with one hosted API that supports structure/depth guidance (or a strong image-edit endpoint), behind the `RenderProvider` interface, and keep a second provider as a fallback/evaluation candidate. Do not build GPU infrastructure for the MVP.

## 5.3 Provider abstraction

All provider-specific code lives in an adapter. The rest of the system only sees:

```ts
export interface RenderRequest {
  sourceImage: Buffer;            // preprocessed original photo
  depthMap?: Buffer;
  edgeMap?: Buffer;
  prompt: string;
  negativePrompt?: string;
  style: StyleId;
  roomType: RoomType;
  fidelity: 'high' | 'medium' | 'low';
  seed?: number;
  outputWidth: number;
  outputHeight: number;
}

export interface RenderResult {
  image: Buffer;                  // PNG/JPEG bytes
  seed?: number;
  providerModel: string;
  costMinor?: number;
  raw?: unknown;                  // for debugging only
}

export interface RenderProvider {
  readonly name: string;
  render(req: RenderRequest): Promise<RenderResult>;
  // Providers without native depth/edge input should ignore those fields
  // and rely on instruction text; declare that so the pipeline can adapt.
  readonly capabilities: { depthControl: boolean; edgeControl: boolean; seed: boolean; inpainting: boolean };
}
```

Registry and config:

```ts
const providers: Record<string, RenderProvider> = {
  primary: new ProviderAAdapter(process.env.PROVIDER_A_API_KEY!),
  fallback: new ProviderBAdapter(process.env.PROVIDER_B_API_KEY!),
};
// RENDER_PROVIDER=primary  RENDER_FALLBACK_PROVIDER=fallback
```

Adapter responsibilities: map `fidelity` to provider parameters, convert image formats, handle async job polling/webhooks, map provider errors to internal error codes (`provider_timeout`, `provider_policy_rejected`, `provider_unavailable`), and report cost.

## 5.4 Prompting for a professional 3D render look

Build the prompt from parts so styles are data, not code.

**Template**

```
{render_quality}, {room_type_phrase} interior in {style_phrase} style,
{materials_and_palette}, {furniture_phrase}, {lighting_phrase},
keep the original room layout, same walls, windows, doors and camera angle
```

**Render-quality block (the "3D render look")**
```
professional 3D interior design visualization, photorealistic architectural render,
V-Ray / Corona style rendering, global illumination, soft realistic shadows,
physically based materials, clean styled composition, wide-angle interior shot,
high detail, sharp, 8k
```
(Renderer names in a prompt are style cues only; no renderer is actually used.)

**Negative prompt**
```
low quality, blurry, noisy, grainy phone photo, harsh flash, clutter, distorted perspective,
warped walls, extra windows, extra doors, floating furniture, deformed furniture,
text, watermark, logo, people, cartoon, sketch
```

**Style presets (`styles` table or config)**

| Style | Style phrase | Palette / materials | Lighting |
|---|---|---|---|
| Modern | "modern contemporary" | neutral greys and whites, black metal accents, glass | recessed spots plus a statement pendant |
| Scandinavian | "Scandinavian" | white walls, light oak, sage/linen textiles | bright daylight, warm lamps |
| Minimalist | "minimalist" | off-white, concrete, few pieces | soft diffuse daylight |
| Industrial | "industrial loft" | brick, dark metal, leather, concrete floor | warm Edison bulbs, track lights |
| Bohemian | "bohemian eclectic" | terracotta, rattan, layered rugs, plants | warm golden light |
| Classic | "classic elegant" | cream, navy, wood panelling, brass | warm chandelier and sconces |

Per-request customisation: the user's free-text hint and colour palette are appended after sanitising (length limit, strip instructions that try to override the template, e.g. "ignore previous"). Room type adds expected furniture ("sofa, coffee table, TV unit, rug" for a living room) so that detectable, shoppable items are present.

**Why "shoppable items" matters:** the product-matching stage can only recommend what is visible. Prompts should ask for clearly visible, separate furniture pieces (a sofa, a table, curtains, a lamp) rather than heavily cropped or overlapping objects.

## 5.5 Quality gate and retries

Automatic checks after each render:

1. **Valid image** – decodes, expected size, not blank/black.
2. **Layout preservation** – compute the edge map of the output and compare with the source edge map (e.g. structural similarity on a blurred, downscaled edge map, or depth-map correlation using the same depth estimator). Below the threshold → retry once with `fidelity` raised one level and a new seed.
3. **Style adherence** (optional, later) – a vision model scores "does this look like a clean 3D render in {style}?".
4. **Safety** – provider's moderation response plus your own check.

If retries fail, mark the design `failed` and refund the quota. Log the stage that failed.

## 5.6 Variations and styles

- A *variation* is a new `design` row for the same `room` with a different `style` (or same style, new seed).
- Reuse cached depth/edge maps from `rooms`; only the render step re-runs.
- Cache key: `sha256(room image) + style + prompt hash + fidelity + seed`. Identical requests return the stored result.
- Limit concurrency per user to control cost.

## 5.7 Output handling

- Store the full-resolution result (PNG or high-quality JPEG) and a downscaled preview.
- Optional upscaling step (a separate upscaler model) for download quality; keep it optional because of cost.
- Download endpoint returns a signed URL; free tier may add a small "Made with HOMELY AI" watermark.
- Embed in the image metadata or UI a label: "AI-generated visualisation". Some jurisdictions and platforms expect AI-generated content to be disclosed.

## 5.8 Evaluation before committing to a provider

Build a small evaluation set (30 to 50 diverse room photos: bright/dark, cluttered/empty, different room types and camera angles) and run each candidate.

| Metric | How | Target for MVP |
|---|---|---|
| Layout preservation | Edge/depth similarity score plus human check that windows/doors are unchanged | ≥ 90% of outputs pass |
| "3D render look" | Blind human rating 1 to 5 against a reference set of professional renders | average ≥ 4 |
| Furniture clarity | Human check: major pieces clearly visible and separable | ≥ 85% |
| Artefacts | Count warped furniture, extra windows, text/watermarks | < 10% of outputs |
| Latency | p50 / p95 | p95 < 90 s |
| Cost | Cost per accepted image | Within unit-economics budget |

Re-run this set whenever the model, prompt template or parameters change (see [Testing plan](08-testing-and-deployment.md)).

## 5.9 Failure handling

| Failure | Handling |
|---|---|
| Provider timeout / 5xx | Retry with exponential backoff (max 2), then fallback provider |
| Content-policy rejection | Mark `failed` with `image_rejected` or `provider_policy_rejected`; show a clear message; refund quota |
| Poor structure score | Retry with higher fidelity once; otherwise fail and refund |
| Quota or billing exhausted at provider | Alert on-call; queue jobs, show "high demand" message |

## 5.10 Security and privacy

- API keys server-side only, rotated; per-environment keys.
- Send the provider only the preprocessed image (EXIF stripped). Check the provider's retention and training policy; choose one that does not train on customer data or has an opt-out.
- Do not log image bytes; log IDs and metrics.
- Add the AI providers to the privacy policy as sub-processors.

## 5.11 Roadmap for the AI layer

| Version | Capability |
|---|---|
| MVP | One provider, structure-guided render, 6 styles, quality gate, fallback provider |
| v1.1 | Inpainting for "keep my sofa / replace everything else", per-region editing (change just the floor or wall colour) |
| v1.2 | Upscaling, multiple camera-consistent views if provider supports it |
| v2 | Room layout estimation and real 3D scene (separate from image generation) for interactive editing; products placed as 3D assets |
