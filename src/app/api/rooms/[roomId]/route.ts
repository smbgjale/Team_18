import { db, ensureDb, persistDb } from "@/lib/db";
import { designDto, getRoom, listDesigns } from "@/lib/designs";
import { jsonError } from "@/lib/http";
import { deleteFile, fileUrl } from "@/lib/storage";
import { isDirection } from "@/lib/styles";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(_req: Request, ctx: RouteContext<"/api/rooms/[roomId]">) {
  try {
    await ensureDb();
    const { roomId } = await ctx.params;
    const room = getRoom(roomId);
    if (!room) {
      return jsonError(
        404,
        "not_found",
        "Room not found. Please upload your room photo again.",
      );
    }
    return Response.json({
      id: room.id,
      name: room.name,
      room_type: room.room_type,
      design_direction: isDirection(room.design_direction) ? room.design_direction : null,
      original_image_url: fileUrl(room.original_image_key),
      width_px: room.width_px,
      height_px: room.height_px,
      created_at: room.created_at,
      designs: listDesigns(roomId).map((d) => designDto(d, room)),
    });
  } catch (e) {
    console.error("[rooms GET]", e);
    return jsonError(500, "internal_error", e instanceof Error ? e.message : "Could not load the room.");
  }
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/rooms/[roomId]">) {
  try {
    await ensureDb();
    const { roomId } = await ctx.params;
    if (!getRoom(roomId)) return jsonError(404, "not_found", "Room not found.");
    const body = (await request.json().catch(() => null)) as { design_direction?: unknown } | null;
    if (!isDirection(body?.design_direction)) {
      return jsonError(400, "invalid_request", "design_direction must be modern or traditional.");
    }
    db().prepare("UPDATE rooms SET design_direction = ? WHERE id = ?").run(body.design_direction, roomId);
    await persistDb();
    return Response.json({ id: roomId, design_direction: body.design_direction });
  } catch (e) {
    console.error("[rooms PATCH]", e);
    return jsonError(500, "internal_error", e instanceof Error ? e.message : "Could not update the room.");
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/rooms/[roomId]">) {
  try {
    await ensureDb();
    const { roomId } = await ctx.params;
    const room = getRoom(roomId);
    if (!room) return jsonError(404, "not_found", "Room not found.");
    const designs = listDesigns(roomId);
    await deleteFile(room.original_image_key);
    for (const d of designs) if (d.render_image_key) await deleteFile(d.render_image_key);
    db().prepare("DELETE FROM rooms WHERE id = ?").run(roomId);
    await persistDb();
    return new Response(null, { status: 204 });
  } catch (e) {
    console.error("[rooms DELETE]", e);
    return jsonError(500, "internal_error", e instanceof Error ? e.message : "Could not delete the room.");
  }
}
