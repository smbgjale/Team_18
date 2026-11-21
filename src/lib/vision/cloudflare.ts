import sharp from "sharp";
import { runWorkersAI } from "../cloudflare";
import { config } from "../config";
import { DETECTION_PROMPT, parseDetections } from "./parse";
import type { DetectedItem, VisionProvider } from "./types";

export class CloudflareVisionProvider implements VisionProvider {
  readonly name = "cloudflare";

  async detectItems({ image, style }: Parameters<VisionProvider["detectItems"]>[0]): Promise<DetectedItem[]> {
    const jpeg = await sharp(image).resize(1024, 1024, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    const result = (await runWorkersAI(
      config.cloudflare.visionModel,
      JSON.stringify({
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: DETECTION_PROMPT },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${jpeg.toString("base64")}` } },
            ],
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 1500,
        temperature: 0.1,
      }),
      "application/json",
      90_000,
    )) as { response?: unknown; choices?: { message?: { content?: string } }[] } | undefined;
    const raw = result?.response ?? result?.choices?.[0]?.message?.content;
    if (raw == null) throw new Error("Workers AI vision model returned no response");
    return parseDetections(raw, style);
  }
}
