import sharp from "sharp";
import { CloudflareError, runWorkersAI } from "../cloudflare";
import { config } from "../config";
import { RenderError, type RenderProvider, type RenderRequest, type RenderResult } from "./types";

// Workers AI requires reference images to fit within 512x512; the output can be larger.
const MAX_INPUT_EDGE = 512;
const OUTPUT_LONG_EDGE = 1024;

export function outputSize(width: number, height: number) {
  const scale = OUTPUT_LONG_EDGE / Math.max(width, height);
  const round16 = (n: number) => Math.max(256, Math.min(1920, Math.round((n * scale) / 16) * 16));
  return { width: round16(width), height: round16(height) };
}

// FLUX models do not support negative prompts; listing unwanted things can make them appear.
export function fluxPrompt(prompt: string) {
  return `Image 0 is a photo of a real room. ${prompt.replace(/\s*Avoid:[\s\S]*$/, "")}`;
}

export class CloudflareRenderProvider implements RenderProvider {
  readonly name = "cloudflare";

  async render(req: RenderRequest): Promise<RenderResult> {
    const input = await sharp(req.sourceImage)
      .resize(MAX_INPUT_EDGE, MAX_INPUT_EDGE, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    const size = outputSize(req.width, req.height);

    const form = new FormData();
    form.set("prompt", fluxPrompt(req.prompt));
    form.set("input_image_0", new Blob([new Uint8Array(input)], { type: "image/png" }), "room.png");
    form.set("width", String(size.width));
    form.set("height", String(size.height));

    let result: unknown;
    try {
      // Passing FormData through a Response serialises it and yields the multipart boundary header.
      const encoded = new Response(form);
      result = await runWorkersAI(config.cloudflare.imageModel, await encoded.arrayBuffer(), encoded.headers.get("content-type")!);
    } catch (e) {
      if (e instanceof CloudflareError) {
        if (e.quotaExceeded) throw new RenderError("provider_quota_exceeded", e.message);
        if (e.status === 400 && /nsfw|safety|policy|moderat/i.test(e.message)) throw new RenderError("provider_policy_rejected", "The image was rejected by the AI provider's content policy.");
        throw new RenderError("provider_unavailable", e.message);
      }
      const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
      throw new RenderError(timeout ? "provider_timeout" : "provider_unavailable", String(e));
    }

    const image = (result as { image?: string } | undefined)?.image;
    if (!image) throw new RenderError("provider_bad_response", "Workers AI returned no image");
    return { image: Buffer.from(image, "base64"), mime: "image/png", providerName: this.name, providerModel: config.cloudflare.imageModel };
  }
}
