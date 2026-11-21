import path from "node:path";

const root = process.cwd();

export const config = {
  root,
  dataDir: path.resolve(root, process.env.HOMELY_DATA_DIR ?? "var"),
  renderProvider: (process.env.RENDER_PROVIDER ?? "").toLowerCase(),
  visionProvider: (process.env.VISION_PROVIDER ?? "").toLowerCase(),
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    imageModel: process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1",
    visionModel: process.env.OPENAI_VISION_MODEL ?? "gpt-4o-mini",
  },
  maxUploadBytes: 15 * 1024 * 1024,
  maxImageEdgePx: 1536,
  stuckJobMs: 5 * 60 * 1000,
};

export function activeRenderProvider(): "openai" | "mock" {
  if (config.renderProvider === "mock") return "mock";
  if (config.renderProvider === "openai" || config.openai.apiKey) return "openai";
  return "mock";
}

export function activeVisionProvider(): "openai" | "mock" {
  if (config.visionProvider === "mock") return "mock";
  if (config.visionProvider === "openai" || config.openai.apiKey) return "openai";
  return "mock";
}
