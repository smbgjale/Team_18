import { meshyConfig } from "../config";

const ENDPOINT = "https://api.meshy.ai/openapi/v1/image-to-3d";
const MAX_GLB_BYTES = 40 * 1024 * 1024;

export class MeshError extends Error {
  constructor(readonly code: "not_found" | "missing_key" | "provider_auth" | "provider_quota" | "provider_error" | "rate_limited", message: string) {
    super(message);
  }
}

export interface MeshyTaskBody {
  status?: string;
  model_url?: string;
  model_urls?: { glb?: string };
  task_error?: { message?: string };
}

export type MeshyProgress =
  | { status: "pending" }
  | { status: "failed"; message: string }
  | { status: "ready"; url: string };

export function interpretMeshy(body: MeshyTaskBody): MeshyProgress {
  const status = (body.status ?? "").toUpperCase();
  if (status === "SUCCEEDED") {
    const url = body.model_urls?.glb || body.model_url;
    return url ? { status: "ready", url } : { status: "failed", message: "The image-to-3D service did not return a GLB." };
  }
  if (status === "FAILED" || status === "CANCELED") {
    return { status: "failed", message: body.task_error?.message || "The image-to-3D task failed." };
  }
  return { status: "pending" };
}

function authHeaders() {
  const { apiKey } = meshyConfig();
  if (!apiKey) throw new MeshError("missing_key", "MESHY_API_KEY is not set.");
  return { Authorization: `Bearer ${apiKey}` };
}

async function failFromStatus(res: Response): Promise<never> {
  if (res.status === 429) throw new MeshError("rate_limited", "The image-to-3D service is busy. Please try again in a moment.");
  if (res.status === 401 || res.status === 403) throw new MeshError("provider_auth", "The image-to-3D key was rejected.");
  if (res.status === 402) throw new MeshError("provider_quota", "The image-to-3D credit balance is used up.");
  throw new MeshError("provider_error", "The image-to-3D service could not complete this request.");
}

// Sends the catalogue photo we already loaded. Meshy accepts a data URI, so it does not have to fetch the shop CDN.
export async function startMeshyTask(jpeg: Buffer): Promise<string> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url: `data:image/jpeg;base64,${jpeg.toString("base64")}`,
      should_texture: true,
      target_formats: ["glb"],
      ai_model: meshyConfig().model,
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) await failFromStatus(res);
  const body = (await res.json()) as { result?: string };
  if (!body.result) throw new MeshError("provider_error", "The image-to-3D service did not return a task id.");
  return body.result;
}

export async function pollMeshyTask(taskId: string): Promise<MeshyProgress> {
  const res = await fetch(`${ENDPOINT}/${encodeURIComponent(taskId)}`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(30_000),
  });
  if (res.status === 429) return { status: "pending" };
  if (!res.ok) await failFromStatus(res);
  return interpretMeshy((await res.json()) as MeshyTaskBody);
}

export async function downloadGlb(url: string): Promise<Buffer> {
  if (!/^https:\/\//i.test(url)) throw new MeshError("provider_error", "The image-to-3D service returned an invalid model link.");
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000), redirect: "follow" });
  if (!res.ok) throw new MeshError("provider_error", "The generated 3D model could not be downloaded.");
  const announced = Number(res.headers.get("content-length") ?? 0);
  if (announced > MAX_GLB_BYTES) throw new MeshError("provider_error", "The generated 3D model is too large to store.");
  const glb = Buffer.from(await res.arrayBuffer());
  if (glb.length < 20 || glb.length > MAX_GLB_BYTES || glb.toString("utf8", 0, 4) !== "glTF") {
    throw new MeshError("provider_error", "The image-to-3D service did not return a GLB file.");
  }
  return glb;
}
