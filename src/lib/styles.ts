import type { RoomType } from "./categories";
import { ROOM_ITEMS } from "./categories";

export interface StylePreset {
  id: string;
  name: string;
  description: string;
  phrase: string;
  palette: string;
  lighting: string;
  swatches: string[];
  adjacent: string[];
  colors: string[];
  wallHex: string;
  floorHex: string;
}

export const STYLES: StylePreset[] = [
  { id: "modern", name: "Modern", description: "Clean lines, neutral palette, statement lighting", phrase: "modern contemporary", palette: "neutral greys and whites, black metal accents, glass and smooth finishes", lighting: "recessed spotlights and a statement pendant light", swatches: ["#b4b3af", "#26262a", "#f2efe8"], adjacent: ["minimalist"], colors: ["grey", "charcoal", "black", "white", "brass"], wallHex: "#e7e5e1", floorHex: "#9a948c" },
  { id: "scandinavian", name: "Scandinavian", description: "Light woods, white walls, cosy textiles", phrase: "Scandinavian", palette: "white walls, light oak wood, sage green and linen textiles", lighting: "bright natural daylight and warm table lamps", swatches: ["#f2efe8", "#b98a56", "#728f78"], adjacent: ["minimalist"], colors: ["oak", "white", "green", "beige", "grey"], wallHex: "#f4f1ea", floorHex: "#d4b48a" },
  { id: "minimalist", name: "Minimalist", description: "Few pieces, calm tones, open space", phrase: "minimalist", palette: "off-white, soft beige and pale concrete tones with very few pieces", lighting: "soft diffuse daylight", swatches: ["#e8dfc9", "#d6c5a6", "#b4b3af"], adjacent: ["modern", "scandinavian"], colors: ["white", "beige", "ivory", "grey", "oak"], wallHex: "#f3efe7", floorHex: "#cbc2b4" },
  { id: "industrial", name: "Industrial", description: "Brick, dark metal, leather and concrete", phrase: "industrial loft", palette: "exposed brick, dark metal, cognac leather and a polished concrete floor", lighting: "warm filament bulbs and track lights", swatches: ["#4b4b4f", "#7a5538", "#26262a"], adjacent: ["modern"], colors: ["charcoal", "black", "walnut", "brass", "grey"], wallHex: "#a8705a", floorHex: "#8c8a86" },
  { id: "bohemian", name: "Bohemian", description: "Terracotta, rattan, layered rugs and plants", phrase: "bohemian eclectic", palette: "terracotta, mustard, rattan, layered rugs and lots of plants", lighting: "warm golden light", swatches: ["#c4704f", "#d1a02a", "#728f78"], adjacent: [], colors: ["terracotta", "mustard", "green", "blush", "beige"], wallHex: "#efdfca", floorHex: "#b07a4f" },
  { id: "classic", name: "Classic", description: "Cream, navy, wood panelling and brass", phrase: "classic elegant", palette: "cream walls, navy accents, wood panelling and brass details", lighting: "warm chandelier and wall sconces", swatches: ["#e8dfc9", "#2f4468", "#b8963e"], adjacent: [], colors: ["navy", "ivory", "walnut", "brass", "beige"], wallHex: "#e9dec8", floorHex: "#7a5538" },
];

export function getStyle(id: string) {
  return STYLES.find((s) => s.id === id);
}

export function styleAffinity(designStyle: string, productStyles: string[]): number {
  if (productStyles.length === 0) return 0.5;
  if (productStyles.includes(designStyle)) return 1;
  const adj = getStyle(designStyle)?.adjacent ?? [];
  if (productStyles.some((s) => adj.includes(s))) return 0.5;
  return 0;
}

const RENDER_QUALITY =
  "professional 3D interior design visualization, photorealistic architectural render, V-Ray style rendering, global illumination, soft realistic shadows, physically based materials, clean styled composition, high detail, sharp";

export const NEGATIVE_PROMPT =
  "low quality, blurry, noisy phone photo, harsh flash, clutter, distorted perspective, warped walls, extra windows, extra doors, floating furniture, deformed furniture, text, watermark, logo, people, cartoon, sketch";

export function sanitizeUserPrompt(input: string | undefined | null): string {
  if (!input) return "";
  return input
    .replace(/[\r\n]+/g, " ")
    .replace(/ignore (all |any )?(previous|above|prior)[^.]*\.?/gi, "")
    .slice(0, 240)
    .trim();
}

export interface PromptProduct {
  category: string;
  name: string;
  colorName?: string | null;
  material?: string | null;
  quantity?: number;
  refIndex?: number;
}

function describeProduct(p: PromptProduct) {
  const what = [p.colorName, p.material, p.category.replace(/_/g, " ")].filter(Boolean).join(" ");
  const qty = p.quantity && p.quantity > 1 ? `${p.quantity} x ` : "";
  const ref = p.refIndex ? `, exactly as shown in reference product image ${p.refIndex}` : "";
  return `${qty}${what} ("${p.name}"${ref})`;
}

export function buildPrompt(opts: { style: StylePreset; roomType: RoomType; userPrompt?: string; fidelity: "high" | "medium" | "low"; products?: PromptProduct[] }) {
  const { style, roomType, fidelity } = opts;
  const roomPhrase = roomType.replace(/_/g, " ");
  const products = opts.products ?? [];
  const furniture = products.length
    ? `Furnish it with these real catalogue products, keeping each one's shape, colour and material: ${products.map(describeProduct).join("; ")}. Do not add other large furniture`
    : `Show clearly visible, separate furniture pieces such as ${ROOM_ITEMS[roomType].slice(0, 5).map((c) => c.replace(/_/g, " ")).join(", ")}, plus matching decor`;
  const layoutRule =
    fidelity === "high"
      ? "Keep the original room layout exactly: same walls, windows, doors, ceiling, camera angle and perspective."
      : fidelity === "medium"
        ? "Keep the original room structure: walls, windows, doors and camera angle; furniture arrangement may change."
        : "Keep the camera angle and the position of windows and doors; other elements may change freely.";
  const hint = sanitizeUserPrompt(opts.userPrompt);
  return [
    `Redesign this ${roomPhrase} as a ${RENDER_QUALITY}.`,
    `Interior style: ${style.phrase}. Materials and palette: ${style.palette}. Lighting: ${style.lighting}.`,
    `${furniture}. Use a new wall colour and flooring that suit the style.`,
    layoutRule,
    hint ? `Additional wishes from the user: ${hint}.` : "",
    `The result must look like a polished 3D render made by a professional interior visualizer, not a retouched phone photo. Avoid: ${NEGATIVE_PROMPT}.`,
  ]
    .filter(Boolean)
    .join(" ");
}
