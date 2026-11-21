import { createHash } from "node:crypto";
import sharp from "sharp";
import type { ProductModelDto } from "../api-types";
import { activeMeshProvider, meshyConfig } from "../config";
import { db } from "../db";
import { loadProductImage } from "../product-images";
import { getProduct, type ProductRow } from "../products";
import { fileUrl, getFile, putFile } from "../storage";
import { buildTexturedBoxGlb } from "./glb";
import { downloadGlb, MeshError, pollMeshyTask, startMeshyTask } from "./meshy";

const STUCK_MS = 15 * 60 * 1000;
const STARTING_MS = 90 * 1000;

interface ModelRow {
  product_id: string;
  source_url: string;
  source_hash: string;
  status: "pending" | "ready" | "failed";
  provider: "local" | "meshy";
  provider_task_id: string | null;
  model_key: string | null;
  error_message: string | null;
  generations: number;
  created_at: string;
  updated_at: string;
}

export function hashSource(url: string) {
  return createHash("sha256").update(url).digest("hex");
}

export function missingModel(): ProductModelDto {
  return { status: "missing", url: null, provider: null, preview: false, error: null };
}

function ageMs(stamp: string) {
  return Date.now() - new Date(stamp.replace(" ", "T") + "Z").getTime();
}

function rowOf(productId: string) {
  return db().prepare("SELECT * FROM product_models WHERE product_id = ?").get(productId) as ModelRow | undefined;
}

function toDto(row: ModelRow): ProductModelDto {
  const ready = row.status === "ready" && !!row.model_key;
  return {
    status: row.status,
    url: ready ? `${fileUrl(row.model_key)}?v=${row.source_hash.slice(0, 12)}` : null,
    provider: row.provider,
    preview: row.provider === "local",
    error: row.status === "failed" ? row.error_message : null,
  };
}

function saveRow(row: Omit<ModelRow, "created_at" | "updated_at">) {
  db().prepare(`
    INSERT INTO product_models (
      product_id, source_url, source_hash, status, provider, provider_task_id, model_key, error_message, generations
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(product_id) DO UPDATE SET
      source_url = excluded.source_url,
      source_hash = excluded.source_hash,
      status = excluded.status,
      provider = excluded.provider,
      provider_task_id = excluded.provider_task_id,
      model_key = excluded.model_key,
      error_message = excluded.error_message,
      generations = excluded.generations,
      updated_at = datetime('now')
  `).run(row.product_id, row.source_url, row.source_hash, row.status, row.provider, row.provider_task_id, row.model_key, row.error_message, row.generations);
  return rowOf(row.product_id)!;
}

function reusable(row: ModelRow | undefined, hash: string) {
  return !!row && row.status === "ready" && row.source_hash === hash && !!row.model_key;
}

// Reads saved models only. A ready model whose photo has changed is reported as missing so the old file is not shown as current.
export function readModels(products: { id: string; image_url: string }[]) {
  const out = new Map<string, ProductModelDto>();
  if (!products.length) return out;
  const rows = db().prepare(`SELECT * FROM product_models WHERE product_id IN (${products.map(() => "?").join(",")})`).all(...products.map((p) => p.id)) as ModelRow[];
  const byId = new Map(rows.map((row) => [row.product_id, row]));
  for (const product of products) {
    const row = byId.get(product.id);
    out.set(product.id, row && row.source_hash === hashSource(product.image_url) ? toDto(row) : missingModel());
  }
  return out;
}

async function sourceJpeg(product: ProductRow, image?: Buffer) {
  if (image) return sharp(image).jpeg({ quality: 85 }).toBuffer();
  const png = await loadProductImage(product.image_url, 1024);
  return png ? sharp(png).jpeg({ quality: 85 }).toBuffer() : null;
}

function modelKey(productId: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(productId)) throw new MeshError("not_found", "Product not found.");
  return `models/${productId}.glb`;
}

async function storeGlb(product: ProductRow, hash: string, provider: "local" | "meshy", glb: Buffer, generations: number, taskId: string | null) {
  const key = modelKey(product.id);
  await putFile(key, glb);
  return saveRow({
    product_id: product.id,
    source_url: product.image_url,
    source_hash: hash,
    status: "ready",
    provider,
    provider_task_id: taskId,
    model_key: key,
    error_message: null,
    generations,
  });
}

async function advance(product: ProductRow, row: ModelRow): Promise<ModelRow> {
  if (row.status !== "pending") return row;
  if (!row.provider_task_id) {
    if (ageMs(row.updated_at) > STARTING_MS) {
      return saveRow({ ...row, status: "failed", error_message: "The 3D model did not start. Please try again." });
    }
    return row;
  }
  if (ageMs(row.updated_at) > STUCK_MS) {
    return saveRow({ ...row, status: "failed", error_message: "The image-to-3D service took too long." });
  }
  try {
    const progress = await pollMeshyTask(row.provider_task_id);
    if (progress.status === "pending") return row;
    if (progress.status === "failed") return saveRow({ ...row, status: "failed", error_message: progress.message });
    if (row.source_hash !== hashSource(product.image_url)) return row;
    const glb = await downloadGlb(progress.url);
    return storeGlb(product, row.source_hash, "meshy", glb, row.generations + 1, row.provider_task_id);
  } catch (e) {
    if (e instanceof MeshError && (e.code === "provider_auth" || e.code === "missing_key" || e.code === "provider_quota")) {
      return saveRow({ ...row, status: "failed", error_message: e.message });
    }
    return row;
  }
}

// Polls a model that is already being generated. Does not start a new conversion.
export async function refreshProductModel(productId: string): Promise<ProductModelDto | null> {
  const product = getProduct(productId);
  if (!product) return null;
  const row = rowOf(productId);
  if (!row || row.source_hash !== hashSource(product.image_url)) return missingModel();
  if (row.status === "pending" && row.provider === "meshy") return toDto(await advance(product, row));
  return toDto(row);
}

// Builds or reuses a GLB for one catalogue product. The same photo is not converted twice.
// `image` is only for tests; requests load the photo already stored on the product.
export async function ensureProductModel(productId: string, opts: { image?: Buffer } = {}): Promise<ProductModelDto> {
  const product = getProduct(productId);
  if (!product) throw new MeshError("not_found", "Product not found.");
  const hash = hashSource(product.image_url);
  const provider = activeMeshProvider();
  if (provider === "meshy" && !meshyConfig().apiKey) {
    throw new MeshError("missing_key", "MESHY_API_KEY is not set. Leave IMAGE_TO_3D_PROVIDER empty to save a photo-textured model instead.");
  }

  const claimed = db().transaction(() => {
    const current = rowOf(product.id);
    if (reusable(current, hash)) return { action: "ready" as const, row: current! };
    if (current?.status === "pending" && current.source_hash === hash && current.provider === provider && (current.provider_task_id || ageMs(current.updated_at) < STARTING_MS)) {
      return { action: "pending" as const, row: current };
    }
    const row = saveRow({
      product_id: product.id,
      source_url: product.image_url,
      source_hash: hash,
      status: "pending",
      provider,
      provider_task_id: null,
      model_key: current?.model_key ?? null,
      error_message: null,
      generations: current?.generations ?? 0,
    });
    return { action: "start" as const, row };
  })();

  if (claimed.action === "ready") return toDto(claimed.row);
  if (claimed.action === "pending") {
    return toDto(claimed.row.provider === "meshy" && claimed.row.provider_task_id ? await advance(product, claimed.row) : claimed.row);
  }

  try {
    const jpeg = await sourceJpeg(product, opts.image);
    if (!jpeg) {
      return toDto(saveRow({ ...claimed.row, status: "failed", error_message: "The catalogue photo could not be loaded." }));
    }
    if (provider === "local") {
      return toDto(await storeGlb(product, hash, "local", buildTexturedBoxGlb(jpeg), claimed.row.generations + 1, null));
    }
    const taskId = await startMeshyTask(jpeg);
    return toDto(saveRow({ ...claimed.row, status: "pending", provider: "meshy", provider_task_id: taskId, error_message: null }));
  } catch (e) {
    const message = e instanceof MeshError ? e.message : "The 3D model could not be created.";
    saveRow({ ...claimed.row, status: "failed", error_message: message });
    if (e instanceof MeshError && e.code !== "provider_error") throw e;
    return toDto(rowOf(product.id)!);
  }
}

export async function storedGlb(productId: string) {
  const row = rowOf(productId);
  if (!row?.model_key || row.status !== "ready") return null;
  return getFile(row.model_key);
}
