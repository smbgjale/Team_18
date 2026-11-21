import path from "node:path";

const root = process.cwd();

export type ProviderName = "openai" | "cloudflare" | "mock";

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
  cloudflare: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
    imageModel: process.env.CLOUDFLARE_IMAGE_MODEL ?? "@cf/black-forest-labs/flux-2-klein-4b",
    visionModel: process.env.CLOUDFLARE_VISION_MODEL ?? "@cf/meta/llama-4-scout-17b-16e-instruct",
  },
  maxUploadBytes: 15 * 1024 * 1024,
  maxImageEdgePx: 1536,
  stuckJobMs: 5 * 60 * 1000,
};

function pick(explicit: string): ProviderName {
  if (explicit === "mock" || explicit === "openai" || explicit === "cloudflare") return explicit;
  if (config.openai.apiKey) return "openai";
  if (config.cloudflare.accountId && config.cloudflare.apiToken) return "cloudflare";
  return "mock";
}

// An explicit RENDER_PROVIDER / VISION_PROVIDER wins; otherwise the first configured provider is used.
export const activeRenderProvider = () => pick(config.renderProvider);
export const activeVisionProvider = () => pick(config.visionProvider);
