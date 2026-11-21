import path from "node:path";
import os from "node:os";

const root = process.cwd();

function resolveDataDir() {
  if (process.env.HOMELY_DATA_DIR) {
    const dir = process.env.HOMELY_DATA_DIR;
    return path.isAbsolute(dir) ? dir : path.resolve(root, dir);
  }
  // Vercel (and most serverless hosts) only allow writes under /tmp.
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(os.tmpdir(), "gojjodesign");
  }
  return path.resolve(root, "var");
}

export type ProviderName = "openai" | "cloudflare" | "mock";
export type MeshProviderName = "local" | "meshy";

export const config = {
  root,
  dataDir: resolveDataDir(),
  isServerless: Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME),
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
  if (config.cloudflare.accountId && config.cloudflare.apiToken) return "cloudflare";
  if (config.openai.apiKey) return "openai";
  return "mock";
}

// An explicit RENDER_PROVIDER / VISION_PROVIDER wins. Otherwise Cloudflare is used when it is configured.
// OpenAI is only used when it is named explicitly, or when Cloudflare is not configured.
export const activeRenderProvider = () => pick(config.renderProvider);
export const activeVisionProvider = () => pick(config.visionProvider);

// Image-to-3D is separate from the room image generator. An explicit IMAGE_TO_3D_PROVIDER wins.
// A Meshy key selects Meshy. Otherwise a GLB is built from the catalogue photo and saved the same way.
export function activeMeshProvider(): MeshProviderName {
  const explicit = (process.env.IMAGE_TO_3D_PROVIDER ?? "").toLowerCase();
  if (explicit === "local" || explicit === "meshy") return explicit;
  return process.env.MESHY_API_KEY ? "meshy" : "local";
}

export function meshyConfig() {
  return { apiKey: process.env.MESHY_API_KEY, model: process.env.MESHY_MODEL || "latest" };
}
