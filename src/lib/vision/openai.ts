import { config } from "../config";
import { DETECTION_PROMPT, parseDetections } from "./parse";
import type { DetectedItem, VisionProvider } from "./types";

export class OpenAIVisionProvider implements VisionProvider {
  readonly name = "openai";

  async detectItems({ image, style }: Parameters<VisionProvider["detectItems"]>[0]): Promise<DetectedItem[]> {
    if (!config.openai.apiKey) throw new Error("OPENAI_API_KEY is not set");
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
              { type: "text", text: DETECTION_PROMPT },
              { type: "image_url", image_url: { url: `data:image/png;base64,${image.toString("base64")}` } },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) throw new Error(`Vision provider returned ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const json = (await res.json()) as { choices: { message: { content: string } }[] };
    return parseDetections(json.choices[0].message.content, style);
  }
}
