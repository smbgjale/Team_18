import { designDto, getDesign, getRoom } from "@/lib/designs";
import { jsonError } from "@/lib/http";

export async function GET(_req: Request, ctx: RouteContext<"/api/designs/[designId]">) {
  const { designId } = await ctx.params;
  const design = getDesign(designId);
  if (!design) return jsonError(404, "not_found", "Design not found.");
  return Response.json(designDto(design, getRoom(design.room_id)!));
}
