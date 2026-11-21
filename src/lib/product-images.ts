import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const publicDir = path.join(process.cwd(), "public");
const cache = new Map<string, Buffer>();
const MAX_BYTES = 5 * 1024 * 1024;

// Loads a product image as PNG (max 512 px). Local paths are read from /public; remote URLs come
// from shop feeds (not from visitors) and are fetched with a size and time limit.
export async function loadProductImage(url: string, maxEdge = 512): Promise<Buffer | null> {
  const key = `${maxEdge}:${url}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let raw: Buffer;
  try {
    if (url.startsWith("/")) {
      const file = path.resolve(publicDir, "." + url);
      if (!file.startsWith(publicDir + path.sep)) return null;
      raw = await readFile(file);
    } else if (/^https?:\/\//i.test(url)) {
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("image/")) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > MAX_BYTES) return null;
      raw = buf;
    } else {
      return null;
    }
    const png = await sharp(raw, { density: 144 }).resize(maxEdge, maxEdge, { fit: "inside", withoutEnlargement: false }).flatten({ background: "#ffffff" }).png().toBuffer();
    if (cache.size > 300) cache.delete(cache.keys().next().value!);
    cache.set(key, png);
    return png;
  } catch {
    return null;
  }
}
