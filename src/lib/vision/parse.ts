import { z } from "zod";
import { CATEGORIES, isCategory } from "../categories";
import type { DetectedItem } from "./types";

export const DETECTION_PROMPT = `You analyse an interior design render. List the clearly visible, shoppable furniture and decor items.
Use ONLY these categories: ${CATEGORIES.join(", ")}.
For each item return: category, label (short description with colour and material), confidence (0-1), color (one common colour name for the item), bbox as normalised fractions of the image {x,y,w,h} where x,y is the top-left corner.
Ignore walls, floor, windows, doors and tiny objects. Return only JSON in this shape: {"items":[{"category":"sofa","label":"grey linen 3-seat sofa","confidence":0.9,"color":"grey","bbox":{"x":0.1,"y":0.5,"w":0.4,"h":0.3}}]}`;

const ItemSchema = z.object({
  category: z.string(),
  label: z.string().default(""),
  confidence: z.coerce.number().min(0).max(1).default(0.7),
  color: z.string().optional(),
  bbox: z.object({ x: z.coerce.number(), y: z.coerce.number(), w: z.coerce.number(), h: z.coerce.number() }),
});
const ResponseSchema = z.object({ items: z.array(z.unknown()) });

function extractJson(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const text = fenced ? fenced[1] : raw;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return JSON.parse(start >= 0 && end > start ? text.slice(start, end + 1) : text);
}

// Validates a vision model's answer; invalid items are skipped rather than failing the whole design.
export function parseDetections(raw: unknown, style: string): DetectedItem[] {
  const parsed = ResponseSchema.parse(extractJson(raw));
  const out: DetectedItem[] = [];
  for (const candidate of parsed.items) {
    const r = ItemSchema.safeParse(candidate);
    if (!r.success) continue;
    const it = r.data;
    const category = it.category.trim().toLowerCase().replace(/\s+/g, "_");
    if (!isCategory(category) || it.confidence < 0.5) continue;
    const clamp = (n: number) => Math.max(0, Math.min(1, n));
    const bbox = { x: clamp(it.bbox.x), y: clamp(it.bbox.y), w: clamp(it.bbox.w), h: clamp(it.bbox.h) };
    bbox.w = Math.min(bbox.w, 1 - bbox.x);
    bbox.h = Math.min(bbox.h, 1 - bbox.y);
    if (bbox.w * bbox.h < 0.02) continue;
    out.push({ category, label: it.label, confidence: it.confidence, bbox, colorName: it.color?.toLowerCase(), styleTags: [style] });
  }
  return out;
}
