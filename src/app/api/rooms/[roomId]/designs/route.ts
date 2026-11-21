import { nanoid } from "nanoid";
import { after } from "next/server";
import { z } from "zod";
import { config } from "@/lib/config";
import { db } from "@/lib/db";
import { ACTIVE_STATUSES, designDto, getDesign, getRoom, listDesigns } from "@/lib/designs";
import { jsonError } from "@/lib/http";
import { startDesignJob } from "@/lib/pipeline";
import { clientIp, rateLimited } from "@/lib/rate-limit";
import { getStyle } from "@/lib/styles";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  style: z.string(),
  prompt: z.string().max(240).optional(),
  budget: z.object({ amount_minor: z.number().int().positive().max(100_000_000), currency: z.string().length(3) }).optional(),
  layout_fidelity: z.enum(["high", "medium", "low"]).default("high"),
});

export async function GET(_req: Request, ctx: RouteContext<"/api/rooms/[roomId]/designs">) {
  try {
    const { roomId } = await ctx.params;
    const room = getRoom(roomId);
    if (!room) return jsonError(404, "not_found", "Room not found.");
    return Response.json({ items: listDesigns(roomId).map((d) => designDto(d, room)) });
  } catch (e) {
    console.error("[designs GET]", e);
    return jsonError(500, "internal_error", e instanceof Error ? e.message : "Could not list designs.");
  }
}

export async function POST(request: Request, ctx: RouteContext<"/api/rooms/[roomId]/designs">) {
  try {
    const { roomId } = await ctx.params;
    const room = getRoom(roomId);
    if (!room) {
      return jsonError(
        404,
        "not_found",
        "Room not found. On Vercel the temporary database can reset between requests — please upload your room photo again.",
      );
    }
    if (rateLimited(`design:${clientIp(request)}`, 15, 60 * 60 * 1000)) {
      return jsonError(429, "rate_limited", "Design limit reached for now. Please try again later.");
    }

    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return jsonError(400, "invalid_request", "Invalid design request.", parsed.error.flatten());
    const body = parsed.data;
    if (!getStyle(body.style)) return jsonError(400, "invalid_request", "Unknown style.");

    const active = listDesigns(roomId).filter((d) => ACTIVE_STATUSES.includes(d.status)).length;
    if (active >= 2) {
      return jsonError(429, "too_many_active", "Two designs are already being generated for this room. Please wait for one to finish.");
    }

    const id = nanoid(14);
    db().prepare(
      "INSERT INTO designs (id, room_id, style, user_prompt, budget_total_minor, budget_currency, layout_fidelity) VALUES (?,?,?,?,?,?,?)",
    ).run(
      id,
      roomId,
      body.style,
      body.prompt ?? null,
      body.budget?.amount_minor ?? null,
      body.budget?.currency.toUpperCase() ?? null,
      body.layout_fidelity,
    );

    // On serverless, run the job in this isolate so /tmp room files stay available.
    // Locally, schedule it and return immediately.
    if (config.isServerless) {
      await new Promise<void>((resolve) => {
        startDesignJob(id, (task) => {
          void task.finally(resolve);
        });
      });
      const design = getDesign(id);
      return Response.json(
        {
          id,
          room_id: roomId,
          style: body.style,
          status: design?.status ?? "queued",
        },
        { status: 202 },
      );
    }

    startDesignJob(id, (task) => {
      after(async () => {
        await task;
      });
    });

    return Response.json({ id, room_id: roomId, style: body.style, status: "queued" }, { status: 202 });
  } catch (e) {
    console.error("[designs POST]", e);
    return jsonError(500, "internal_error", e instanceof Error ? e.message : "Could not start the design.");
  }
}
