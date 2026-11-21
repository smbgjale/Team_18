import sharp from "sharp";

const FORMATS = new Set(["jpeg", "png", "webp"]);

export interface ImageVerdict {
  ok: boolean;
  reason: string;
  width: number;
  height: number;
  format: string;
  cleanEdges: number;
  borderClean: number;
  whiteFraction: number;
  topClear: boolean;
  insetTop: number;
  insetRight: number;
  insetBottom: number;
  insetLeft: number;
  boxW: number;
  boxH: number;
  topBand: number;
  touchesTop: boolean;
  touchesRight: boolean;
  touchesBottom: boolean;
  touchesLeft: boolean;
}

// A product photo is usable as a redesign reference when the whole piece is large enough to see,
// the file is a normal photo format, and it sits alone on a white, transparent, or studio-light ground.
export async function judgeProductImage(buffer: Buffer): Promise<ImageVerdict> {
  const empty = (reason: string): ImageVerdict => ({
    ok: false, reason, width: 0, height: 0, format: "", cleanEdges: 0, borderClean: 0, whiteFraction: 0, topClear: false,
    insetTop: 0, insetRight: 0, insetBottom: 0, insetLeft: 0, boxW: 0, boxH: 0, topBand: 0,
    touchesTop: false, touchesRight: false, touchesBottom: false, touchesLeft: false,
  });
  let meta: { format?: string; width?: number; height?: number };
  try {
    meta = await sharp(buffer, { failOn: "none" }).metadata();
  } catch {
    return empty("unreadable image");
  }
  const format = meta.format ?? "";
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const fail = (reason: string, extra: Partial<ImageVerdict> = {}): ImageVerdict => ({ ...empty(reason), width, height, format, ...extra, ok: false, reason });
  if (!FORMATS.has(format)) return fail(`format ${format || "unknown"} is not PNG, WebP, or JPEG`);
  if (Math.min(width, height) < 512) return fail(`${width}×${height} is below 512 px`);

  const sampled = await sharp(buffer, { failOn: "none" }).resize(160, 160, { fit: "inside" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data, info } = sampled;
  const stats = measure(data, info.width, info.height, info.channels);
  const { center, ...frame } = stats;
  const contact = await edgeContact(buffer, width, height);
  if (stats.cleanEdges < 6 || stats.borderClean < 0.68) return fail("background is not a clean studio background", { ...frame, ...contact });
  if (center < 0.12) return fail("the product does not fill enough of the frame", { ...frame, ...contact });
  return { ok: true, reason: "ok", width, height, format, ...frame, ...contact };
}

// A thin stem or cord disappears when the photo is shrunk, so the frame edges are checked at full size.
async function edgeContact(buffer: Buffer, width: number, height: number) {
  const none = { touchesTop: false, touchesRight: false, touchesBottom: false, touchesLeft: false };
  const band = 4;
  if (width < band * 2 || height < band * 2) return { touchesTop: true, touchesRight: true, touchesBottom: true, touchesLeft: true };
  const hit = async (left: number, top: number, w: number, h: number) => {
    const { data } = await sharp(buffer, { failOn: "none" }).extract({ left, top, width: w, height: h }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let i = 0; i < data.length; i += 12) {
      if (data[i] <= 228 || data[i + 1] <= 228 || data[i + 2] <= 228) return true;
    }
    return false;
  };
  try {
    const [touchesTop, touchesBottom, touchesLeft, touchesRight] = await Promise.all([
      hit(0, 0, width, band),
      hit(0, height - band, width, band),
      hit(0, 0, band, height),
      hit(width - band, 0, band, height),
    ]);
    return { touchesTop, touchesBottom, touchesLeft, touchesRight };
  } catch {
    return none;
  }
}

function isBackground(data: Buffer, w: number, channels: number, x: number, y: number) {
  const i = (y * w + x) * channels;
  const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
  return a < 24 || (r > 228 && g > 228 && b > 228);
}

function measure(data: Buffer, w: number, h: number, channels: number) {
  const pts: [number, number][] = [
    [1, 1], [w - 2, 1], [1, h - 2], [w - 2, h - 2],
    [Math.floor(w / 2), 1], [1, Math.floor(h / 2)], [w - 2, Math.floor(h / 2)], [Math.floor(w / 2), h - 2],
  ];
  let cleanEdges = 0;
  for (const [x, y] of pts) if (isBackground(data, w, channels, x, y)) cleanEdges++;

  const inset = Math.max(2, Math.floor(Math.min(w, h) * 0.05));
  let border = 0;
  let borderTotal = 0;
  let white = 0;
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const bg = isBackground(data, w, channels, x, y);
      if (bg) white++;
      if (x <= inset || x >= w - 1 - inset || y <= inset || y >= h - 1 - inset) {
        borderTotal++;
        if (bg) border++;
      }
    }
  }
  const mid = Math.floor(w / 2);
  const topClear = [mid - 6, mid, mid + 6].every((x) => x > 0 && x < w && isBackground(data, w, channels, x, 1));
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  let found = false;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (isBackground(data, w, channels, x, y)) continue;
      found = true;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  return {
    cleanEdges,
    borderClean: borderTotal ? border / borderTotal : 0,
    whiteFraction: white / Math.ceil(w / 2) / Math.ceil(h / 2),
    topClear,
    center: centerProductFraction(data, w, h, channels),
    insetTop: found ? minY / h : 1,
    insetRight: found ? (w - 1 - maxX) / w : 1,
    insetBottom: found ? (h - 1 - maxY) / h : 1,
    insetLeft: found ? minX / w : 1,
    boxW: found ? (maxX - minX) / w : 0,
    boxH: found ? (maxY - minY) / h : 0,
    topBand: found ? bandWidth(data, w, h, channels, minY, minY + Math.max(1, Math.floor((maxY - minY) * 0.25))) : 0,
  };
}

function bandWidth(data: Buffer, w: number, h: number, channels: number, y0: number, y1: number) {
  let min = w;
  let max = 0;
  let any = false;
  for (let y = y0; y <= y1 && y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (isBackground(data, w, channels, x, y)) continue;
      any = true;
      if (x < min) min = x;
      if (x > max) max = x;
    }
  }
  return any ? (max - min) / w : 0;
}

function centerProductFraction(data: Buffer, w: number, h: number, channels: number) {
  const x0 = Math.floor(w * 0.28);
  const x1 = Math.floor(w * 0.72);
  const y0 = Math.floor(h * 0.28);
  const y1 = Math.floor(h * 0.72);
  let filled = 0;
  let total = 0;
  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      const i = (y * w + x) * channels;
      total++;
      if (data[i] < 222 || data[i + 1] < 222 || data[i + 2] < 222) filled++;
    }
  }
  return total ? filled / total : 0;
}
