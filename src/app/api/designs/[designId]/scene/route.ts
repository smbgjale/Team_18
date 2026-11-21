import { z } from "zod";
import { getDesign } from "@/lib/designs";
import { jsonError } from "@/lib/http";
import { rateLimited, clientIp } from "@/lib/rate-limit";
import { saveScene, sceneFor } from "@/lib/scene";

export async function GET(_request: Request, ctx: RouteContext<"/api/designs/[designId]/scene">) {
  const { designId } = await ctx.params;
  const design = getDesign(designId);
  if (!design) return jsonError(404, "not_found", "Design not found.");
  const scene = sceneFor(design);
  if (!scene) return jsonError(404, "not_found", "Room not found.");
  return Response.json(scene);
}

const placement = z.object({ x: z.number().min(-10).max(10), z: z.number().min(-10).max(10), rot: z.number().min(-360).max(360) });
const body = z.object({
  room: z.object({ width_m: z.number().min(2).max(15), length_m: z.number().min(2).max(15) }).optional(),
  items: z.array(z.object({ id: z.string().min(1).max(40), layout: z.array(placement).min(1).max(8) })).max(40).optional(),
});

export async function PUT(request: Request, ctx: RouteContext<"/api/designs/[designId]/scene">) {
  const { designId } = await ctx.params;
  if (rateLimited(`scene:${clientIp(request)}`, 240, 60 * 60 * 1000)) return jsonError(429, "rate_limited", "Too many changes. Please wait a moment.");
  const design = getDesign(designId);
  if (!design) return jsonError(404, "not_found", "Design not found.");
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "invalid_request", "Invalid scene data.");
  saveScene(design, parsed.data);
  return Response.json(sceneFor(design));
}
