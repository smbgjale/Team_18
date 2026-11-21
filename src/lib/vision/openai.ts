import { z } from "zod";
import { CATEGORIES, isCategory } from "../categories";
import { config } from "../config";
import type { DetectedItem, VisionProvider } from "./types";

const ItemSchema = z.object({
  category: z.string(),
  label: z.string().default(""),
  confidence: z.number().min(0).max(1).default(0.7),
  color: z.string().optional(),
  bbox: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }),
});
const ResponseSchema = z.object({ items: z.array(ItemSchema) });

export class OpenAIVisionProvider implements VisionProvider {
  readonly name = "openai";

  async detectItems({ image, style }: Parameters<VisionProvider["detectItems"]>[0]): Promise<DetectedItem[]> {
    if (!config.openai.apiKey) throw new Error("OPENAI_API_KEY is not set");
    const prompt = `You analyse an interior design render. List the clearly visible, shoppable furniture and decor items.
Use ONLY these categories: ${CATEGORIES.join(", ")}.
For each item return: category, label (short description with colour and material), confidence (0-1), color (one common colour name for the item), bbox as normalised fractions of the image {x,y,w,h} where x,y is the top-left corner.
Ignore walls, floor, windows, doors and tiny objects. Return JSON: {"items":[...]}.`;
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.openai.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.openai.visionModel,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:image/png;base64,${image.toString("base64")}` } },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) throw new Error(`Vision provider returned ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const json = (await res.json()) as { choices: { message: { content: string } }[] };
    const parsed = ResponseSchema.parse(JSON.parse(json.choices[0].message.content));
    const out: DetectedItem[] = [];
    for (const it of parsed.items) {
      if (!isCategory(it.category) || it.confidence < 0.5) continue;
      const bbox = {
        x: Math.max(0, Math.min(1, it.bbox.x)),
        y: Math.max(0, Math.min(1, it.bbox.y)),
        w: Math.max(0, Math.min(1, it.bbox.w)),
        h: Math.max(0, Math.min(1, it.bbox.h)),
      };
      if (bbox.w * bbox.h < 0.02) continue;
      out.push({ category: it.category, label: it.label, confidence: it.confidence, bbox, colorName: it.color, styleTags: [style] });
    }
    return out;
  }
}
