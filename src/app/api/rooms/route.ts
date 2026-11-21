import { nanoid } from "nanoid";
import sharp, { type OutputInfo } from "sharp";
import { ROOM_TYPES, type RoomType } from "@/lib/categories";
import { config } from "@/lib/config";
import { db, ensureDb, persistDb } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { clientIp, rateLimited } from "@/lib/rate-limit";
import { fileUrl, putFile } from "@/lib/storage";
import { isDirection } from "@/lib/styles";

export const runtime = "nodejs";
export const maxDuration = 30;

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export async function POST(request: Request) {
  try {
    await ensureDb();
    if (rateLimited(`upload:${clientIp(request)}`, 20, 60 * 60 * 1000)) {
      return jsonError(429, "rate_limited", "Too many uploads. Please try again later.");
    }
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return jsonError(400, "invalid_request", "Expected multipart form data with a `file` field.");
    }
    const file = form.get("file");
    const roomType = String(form.get("room_type") ?? "living_room") as RoomType;
    const name = String(form.get("name") ?? "").slice(0, 80) || null;
    const direction = form.get("design_direction");

    if (!(file instanceof File)) return jsonError(400, "invalid_request", "A room photo is required.");
    if (!ALLOWED.includes(file.type)) return jsonError(422, "unsupported_type", "Please upload a JPEG, PNG or WebP photo.");
    if (file.size > config.maxUploadBytes) return jsonError(422, "file_too_large", "The photo is larger than 15 MB.");
    if (!ROOM_TYPES.includes(roomType)) return jsonError(400, "invalid_request", "Unknown room type.");
    if (!isDirection(direction)) return jsonError(400, "invalid_request", "Choose a design direction: modern or traditional.");

    let processed: Buffer;
    let info: OutputInfo;
    try {
      ({ data: processed, info } = await sharp(Buffer.from(await file.arrayBuffer()))
        .rotate()
        .resize(config.maxImageEdgePx, config.maxImageEdgePx, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 88 })
        .toBuffer({ resolveWithObject: true }));
    } catch {
      return jsonError(422, "invalid_image", "That file could not be read as an image.");
    }
    if (Math.min(info.width, info.height) < 512) {
      return jsonError(422, "image_too_small", "The photo is too small. Use an image at least 512 px on its short side.");
    }

    const id = nanoid(16);
    const key = await putFile(`rooms/${id}/original.jpg`, processed);
    db().prepare(
      "INSERT INTO rooms (id, name, room_type, design_direction, original_image_key, width_px, height_px) VALUES (?,?,?,?,?,?,?)",
    ).run(id, name, roomType, direction, key, info.width, info.height);
    await persistDb();

    return Response.json(
      {
        id,
        name,
        room_type: roomType,
        design_direction: direction,
        original_image_url: fileUrl(key),
        width_px: info.width,
        height_px: info.height,
      },
      { status: 201 },
    );
  } catch (e) {
    console.error("[rooms POST]", e);
    return jsonError(500, "internal_error", e instanceof Error ? e.message : "Could not upload the room photo.");
  }
}
