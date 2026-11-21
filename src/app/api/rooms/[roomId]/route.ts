import { db } from "@/lib/db";
import { designDto, getRoom, listDesigns } from "@/lib/designs";
import { jsonError } from "@/lib/http";
import { deleteFile, fileUrl } from "@/lib/storage";

export async function GET(_req: Request, ctx: RouteContext<"/api/rooms/[roomId]">) {
  const { roomId } = await ctx.params;
  const room = getRoom(roomId);
  if (!room) return jsonError(404, "not_found", "Room not found.");
  return Response.json({
    id: room.id,
    name: room.name,
    room_type: room.room_type,
    original_image_url: fileUrl(room.original_image_key),
    width_px: room.width_px,
    height_px: room.height_px,
    created_at: room.created_at,
    designs: listDesigns(roomId).map((d) => designDto(d, room)),
  });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/rooms/[roomId]">) {
  const { roomId } = await ctx.params;
  const room = getRoom(roomId);
  if (!room) return jsonError(404, "not_found", "Room not found.");
  const designs = listDesigns(roomId);
  await deleteFile(room.original_image_key);
  for (const d of designs) if (d.render_image_key) await deleteFile(d.render_image_key);
  db().prepare("DELETE FROM rooms WHERE id = ?").run(roomId);
  return new Response(null, { status: 204 });
}
