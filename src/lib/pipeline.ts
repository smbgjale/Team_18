import { nanoid } from "nanoid";
import sharp from "sharp";
import type { Category, RoomType } from "./categories";
import { nearestColorName, rgbToHex } from "./color";
import { db } from "./db";
import { getDesign, getRoom, listItems, setStatus } from "./designs";
import { matchItem, type MatchContext } from "./matching";
import { getRenderProvider, RenderError } from "./render";
import { ensureCatalogue } from "./shops/sync";
import { getFile, putFile } from "./storage";
import { structureScore } from "./structure";
import { buildPrompt, getStyle } from "./styles";
import { getVisionProvider, type DetectedItem } from "./vision";

async function measureColor(image: Buffer, bbox: DetectedItem["bbox"], meta: { width: number; height: number }) {
  const left = Math.floor(bbox.x * meta.width);
  const top = Math.floor(bbox.y * meta.height);
  const width = Math.max(4, Math.min(meta.width - left, Math.floor(bbox.w * meta.width)));
  const height = Math.max(4, Math.min(meta.height - top, Math.floor(bbox.h * meta.height)));
  const { dominant } = await sharp(image).extract({ left, top, width, height }).stats();
  return rgbToHex([dominant.r, dominant.g, dominant.b]);
}

export function startDesignJob(designId: string) {
  setImmediate(() => {
    runDesign(designId).catch((e) => {
      console.error(`[design ${designId}] unexpected failure`, e);
      setStatus(designId, "failed", { error_code: "internal_error", error_message: "Something went wrong while generating the design." });
    });
  });
}

export async function runDesign(designId: string) {
  const design = getDesign(designId);
  if (!design) return;
  const room = getRoom(design.room_id);
  const style = getStyle(design.style);
  if (!room || !style) return setStatus(designId, "failed", { error_code: "not_found", error_message: "Room or style not found" });

  const fidelity = design.layout_fidelity as "high" | "medium" | "low";
  const prompt = buildPrompt({ style, roomType: room.room_type as RoomType, userPrompt: design.user_prompt ?? undefined, fidelity });
  const provider = getRenderProvider();
  setStatus(designId, "rendering", { provider: provider.name, prompt_used: prompt });

  const original = await getFile(room.original_image_key);
  let renderPng: Buffer;
  try {
    const result = await provider.render({ sourceImage: original, prompt, style, roomType: room.room_type as RoomType, fidelity, width: room.width_px, height: room.height_px });
    renderPng = await sharp(result.image).png().toBuffer();
  } catch (e) {
    const err = e instanceof RenderError ? e : null;
    console.error(`[design ${designId}] render failed`, e);
    return setStatus(designId, "failed", {
      error_code: err?.code ?? "provider_unavailable",
      error_message:
        err?.code === "provider_policy_rejected"
          ? err.message
          : "The image generation service could not create this design. Please try again.",
    });
  }

  const renderKey = await putFile(`designs/${designId}/render.png`, renderPng);
  let score: number | null = null;
  try { score = await structureScore(original, renderPng); } catch { /* monitoring signal only */ }
  setStatus(designId, "render_ready", { render_image_key: renderKey, structure_score: score });

  try {
    setStatus(designId, "matching");
    await ensureCatalogue();
    const detected = await getVisionProvider().detectItems({ image: renderPng, roomType: room.room_type as RoomType, style: style.id });
    const meta = await sharp(renderPng).metadata();
    const d = db();
    const insertItem = d.prepare("INSERT INTO design_items (id, design_id, category, label, confidence, bbox, dominant_colors, style_tags) VALUES (?,?,?,?,?,?,?,?)");
    const seen = new Map<string, number>();
    for (const it of detected) {
      const n = (seen.get(it.category) ?? 0) + 1;
      if (n > 2) continue; // at most two detections per category keeps "Shop this look" focused
      seen.set(it.category, n);
      const hex = it.colorHex ?? (await measureColor(renderPng, it.bbox, { width: meta.width!, height: meta.height! }));
      const name = it.colorName ?? nearestColorName(hex);
      insertItem.run(nanoid(12), designId, it.category, it.label, it.confidence, JSON.stringify(it.bbox), JSON.stringify([{ hex, name }]), JSON.stringify(it.styleTags ?? [style.id]));
    }
    storeMatches(designId);
    setStatus(designId, "completed");
  } catch (e) {
    console.error(`[design ${designId}] matching failed`, e);
    setStatus(designId, "completed", { error_message: "The design is ready, but product suggestions could not be generated." });
  }
}

export function matchContextFor(designId: string, overrides: Partial<MatchContext> = {}): MatchContext {
  const design = getDesign(designId)!;
  const items = listItems(designId);
  return {
    style: design.style,
    budgetMinor: design.budget_total_minor,
    budgetCurrency: design.budget_currency,
    allCategories: [...new Set(items.map((i) => i.category))] as Category[],
    ...overrides,
  };
}

export function matchesForItem(item: ReturnType<typeof listItems>[number], ctx: MatchContext) {
  const colors = JSON.parse(item.dominant_colors) as { hex: string; name: string }[];
  return matchItem({ category: item.category, label: item.label, colorHexes: colors.map((c) => c.hex), colorNames: colors.map((c) => c.name) }, ctx);
}

function storeMatches(designId: string) {
  const d = db();
  const ctx = matchContextFor(designId, { perItem: 10 });
  const insert = d.prepare("INSERT OR REPLACE INTO product_matches (id, design_item_id, product_id, rank, score, score_breakdown) VALUES (?,?,?,?,?,?)");
  d.transaction(() => {
    for (const item of listItems(designId)) {
      for (const m of matchesForItem(item, ctx)) insert.run(nanoid(12), item.id, m.product.id, m.rank, m.score, JSON.stringify(m.score_breakdown));
    }
  })();
}
