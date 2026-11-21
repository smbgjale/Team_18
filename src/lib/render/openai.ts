import { config } from "../config";
import { RenderError, type RenderProvider, type RenderRequest, type RenderResult } from "./types";

function pickSize(w: number, h: number) {
  const ratio = w / h;
  if (ratio > 1.2) return "1536x1024";
  if (ratio < 0.83) return "1024x1536";
  return "1024x1024";
}

export class OpenAIRenderProvider implements RenderProvider {
  readonly name = "openai";
  readonly maxReferenceImages = 4;

  async render(req: RenderRequest): Promise<RenderResult> {
    if (!config.openai.apiKey) throw new RenderError("provider_unavailable", "OPENAI_API_KEY is not set");
    const form = new FormData();
    form.set("model", config.openai.imageModel);
    const refs = req.products.filter((p) => p.reference).slice(0, this.maxReferenceImages);
    const intro = refs.length
      ? `The first image is the room photo to redesign. The next ${refs.length} images are product photos; reference product image N is image N+1. `
      : "";
    form.set("prompt", intro + req.prompt);
    form.set("size", pickSize(req.width, req.height));
    form.set("n", "1");
    form.append("image[]", new Blob([new Uint8Array(req.sourceImage)], { type: "image/jpeg" }), "room.jpg");
    for (const [i, p] of refs.entries()) {
      form.append("image[]", new Blob([new Uint8Array(p.reference!)], { type: "image/png" }), `product-${i + 1}.png`);
    }

    let res: Response;
    try {
      res = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: { Authorization: `Bearer ${config.openai.apiKey}` },
        body: form,
        signal: AbortSignal.timeout(180_000),
      });
    } catch (e) {
      const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
      throw new RenderError(timeout ? "provider_timeout" : "provider_unavailable", String(e));
    }

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 400 && /safety|moderation|policy/i.test(body)) {
        throw new RenderError("provider_policy_rejected", "The image was rejected by the AI provider's content policy.");
      }
      throw new RenderError("provider_unavailable", `Image provider returned ${res.status}: ${body.slice(0, 300)}`);
    }

    const json = (await res.json()) as { data?: { b64_json?: string; url?: string }[] };
    const first = json.data?.[0];
    if (first?.b64_json) {
      return { image: Buffer.from(first.b64_json, "base64"), mime: "image/png", providerName: this.name, providerModel: config.openai.imageModel };
    }
    if (first?.url) {
      const img = await fetch(first.url);
      return { image: Buffer.from(await img.arrayBuffer()), mime: "image/png", providerName: this.name, providerModel: config.openai.imageModel };
    }
    throw new RenderError("provider_bad_response", "Image provider returned no image");
  }
}
