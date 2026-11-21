import { jsonError } from "@/lib/http";
import { getFile } from "@/lib/storage";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", glb: "model/gltf-binary" };

export async function GET(_req: Request, ctx: RouteContext<"/api/files/[...key]">) {
  const { key } = await ctx.params;
  const joined = key.join("/");
  const ext = joined.split(".").pop() ?? "";
  const allowed = (/^(rooms|designs)\//.test(joined) && (ext === "jpg" || ext === "png")) || (/^models\/[A-Za-z0-9_-]+\.glb$/.test(joined) && ext === "glb");
  if (!allowed || !TYPES[ext]) return jsonError(404, "not_found", "File not found.");
  try {
    const data = await getFile(joined);
    return new Response(new Uint8Array(data), { headers: { "Content-Type": TYPES[ext], "Cache-Control": "private, max-age=3600" } });
  } catch {
    return jsonError(404, "not_found", "File not found.");
  }
}
