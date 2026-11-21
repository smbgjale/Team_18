import sharp from "sharp";
import { getDesign } from "@/lib/designs";
import { jsonError } from "@/lib/http";
import { getFile } from "@/lib/storage";

export async function GET(request: Request, ctx: RouteContext<"/api/designs/[designId]/download">) {
  const { designId } = await ctx.params;
  const design = getDesign(designId);
  if (!design?.render_image_key) return jsonError(404, "not_found", "This design has no image yet.");
  const format = new URL(request.url).searchParams.get("format") === "jpeg" ? "jpeg" : "png";
  const png = await getFile(design.render_image_key);
  const body = format === "jpeg" ? await sharp(png).jpeg({ quality: 92 }).toBuffer() : png;
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": `image/${format}`,
      "Content-Disposition": `attachment; filename="homely-${design.style}-${design.id}.${format === "jpeg" ? "jpg" : "png"}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
