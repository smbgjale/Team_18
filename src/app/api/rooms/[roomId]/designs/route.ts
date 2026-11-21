import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@/lib/db";
import { ACTIVE_STATUSES, designDto, getRoom, listDesigns } from "@/lib/designs";
import { jsonError } from "@/lib/http";
import { startDesignJob } from "@/lib/pipeline";
import { getStyle } from "@/lib/styles";

const Body = z.object({
  style: z.string(),
  prompt: z.string().max(240).optional(),
  budget: z.object({ amount_minor: z.number().int().positive().max(100_000_000), currency: z.string().length(3) }).optional(),
  layout_fidelity: z.enum(["high", "medium", "low"]).default("high"),
});

export async function GET(_req: Request, ctx: RouteContext<"/api/rooms/[roomId]/designs">) {
  const { roomId } = await ctx.params;
  const room = getRoom(roomId);
  if (!room) return jsonError(404, "not_found", "Room not found.");
  return Response.json({ items: listDesigns(roomId).map((d) => designDto(d, room)) });
}

export async function POST(request: Request, ctx: RouteContext<"/api/rooms/[roomId]/designs">) {
  const { roomId } = await ctx.params;
  const room = getRoom(roomId);
  if (!room) return jsonError(404, "not_found", "Room not found.");

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "invalid_request", "Invalid design request.", parsed.error.flatten());
  const body = parsed.data;
  if (!getStyle(body.style)) return jsonError(400, "invalid_request", "Unknown style.");

  const active = listDesigns(roomId).filter((d) => ACTIVE_STATUSES.includes(d.status)).length;
  if (active >= 2) return jsonError(429, "too_many_active", "Two designs are already being generated for this room. Please wait for one to finish.");

  const id = nanoid(14);
  db().prepare(
    "INSERT INTO designs (id, room_id, style, user_prompt, budget_total_minor, budget_currency, layout_fidelity) VALUES (?,?,?,?,?,?,?)",
  ).run(id, roomId, body.style, body.prompt ?? null, body.budget?.amount_minor ?? null, body.budget?.currency.toUpperCase() ?? null, body.layout_fidelity);
  startDesignJob(id);
  return Response.json({ id, room_id: roomId, style: body.style, status: "queued" }, { status: 202 });
}
