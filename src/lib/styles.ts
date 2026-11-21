import type { RoomType } from "./categories";
import { ROOM_ITEMS } from "./categories";

export type DesignDirection = "modern" | "traditional";

export interface DirectionPreset {
  id: DesignDirection;
  name: string;
  description: string;
  phrase: string;
  swatches: string[];
}

export const DIRECTIONS: DirectionPreset[] = [
  {
    id: "modern",
    name: "Modern",
    description: "Clean lines, simple shapes and calm, uncluttered rooms.",
    phrase: "a modern home with clean lines, simple shapes and uncluttered surfaces",
    swatches: ["#b4b3af", "#26262a", "#f2efe8"],
  },
  {
    id: "traditional",
    name: "Traditional",
    description: "Warm wood, carved and handcrafted details, rich patterns and timeless pieces.",
    phrase: "a traditional home with handcrafted details, natural materials, warm wood and timeless shapes",
    swatches: ["#6e2f1f", "#b8963e", "#e8dfc9"],
  },
];

export const isDirection = (v: unknown): v is DesignDirection => v === "modern" || v === "traditional";
export const getDirection = (id: DesignDirection) => DIRECTIONS.find((d) => d.id === id)!;

export interface StylePreset {
  id: string;
  name: string;
  direction: DesignDirection;
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
  { id: "modern", name: "Modern", direction: "modern", description: "Clean lines, neutral palette, statement lighting", phrase: "modern contemporary", palette: "neutral greys and whites, black metal accents, glass and smooth finishes", lighting: "recessed spotlights and a statement pendant light", swatches: ["#b4b3af", "#26262a", "#f2efe8"], adjacent: ["minimalist"], colors: ["grey", "charcoal", "black", "white", "brass"], wallHex: "#e7e5e1", floorHex: "#9a948c" },
  { id: "scandinavian", name: "Scandinavian", direction: "modern", description: "Light woods, white walls, cosy textiles", phrase: "Scandinavian", palette: "white walls, light oak wood, sage green and linen textiles", lighting: "bright natural daylight and warm table lamps", swatches: ["#f2efe8", "#b98a56", "#728f78"], adjacent: ["minimalist"], colors: ["oak", "white", "green", "beige", "grey"], wallHex: "#f4f1ea", floorHex: "#d4b48a" },
  { id: "minimalist", name: "Minimalist", direction: "modern", description: "Few pieces, calm tones, open space", phrase: "minimalist", palette: "off-white, soft beige and pale concrete tones with very few pieces", lighting: "soft diffuse daylight", swatches: ["#e8dfc9", "#d6c5a6", "#b4b3af"], adjacent: ["modern", "scandinavian"], colors: ["white", "beige", "ivory", "grey", "oak"], wallHex: "#f3efe7", floorHex: "#cbc2b4" },
  { id: "industrial", name: "Industrial", direction: "modern", description: "Brick, dark metal, leather and concrete", phrase: "industrial loft", palette: "exposed brick, dark metal, cognac leather and a polished concrete floor", lighting: "warm filament bulbs and track lights", swatches: ["#4b4b4f", "#7a5538", "#26262a"], adjacent: ["modern"], colors: ["charcoal", "black", "walnut", "brass", "grey"], wallHex: "#a8705a", floorHex: "#8c8a86" },
  { id: "classic", name: "Classic", direction: "traditional", description: "Timeless elegance: cream, navy, wood panelling and brass", phrase: "classic elegant traditional", palette: "cream walls, navy accents, wood panelling, turned wood and brass details", lighting: "warm chandelier and wall sconces", swatches: ["#e8dfc9", "#2f4468", "#b8963e"], adjacent: ["rustic"], colors: ["navy", "ivory", "walnut", "brass", "beige"], wallHex: "#e9dec8", floorHex: "#7a5538" },
  { id: "rustic", name: "Rustic Farmhouse", direction: "traditional", description: "Reclaimed wood, linen, wrought iron and woven textures", phrase: "rustic farmhouse", palette: "warm reclaimed wood, cream linen, wrought iron, natural stone, jute and woven textures", lighting: "warm lantern pendants and soft daylight", swatches: ["#9c6b3c", "#e8dfc9", "#26262a"], adjacent: ["classic", "african"], colors: ["teak", "ivory", "natural", "black", "green"], wallHex: "#efe7d8", floorHex: "#8f6a45" },
  { id: "african", name: "African Heritage", direction: "traditional", description: "Carved hardwood, woven sisal, kitenge prints and earthy tones", phrase: "East African heritage, inspired by Swahili coast interiors", palette: "dark carved hardwood such as mahogany, brass-studded details, woven sisal and baskets, kitenge and kikoy patterned textiles, terracotta, ochre and indigo accents", lighting: "warm woven pendant lights and brass lanterns", swatches: ["#6e2f1f", "#d1a02a", "#cbb489"], adjacent: ["bohemian", "rustic"], colors: ["mahogany", "terracotta", "mustard", "natural", "navy"], wallHex: "#efe2cc", floorHex: "#7a4a2e" },
  { id: "bohemian", name: "Bohemian", direction: "traditional", description: "Terracotta, rattan, layered rugs and plants", phrase: "bohemian eclectic", palette: "terracotta, mustard, rattan, layered handwoven rugs and lots of plants", lighting: "warm golden light", swatches: ["#c4704f", "#d1a02a", "#728f78"], adjacent: ["african"], colors: ["terracotta", "mustard", "green", "blush", "beige"], wallHex: "#efdfca", floorHex: "#b07a4f" },
];

export const stylesFor = (direction: DesignDirection) => STYLES.filter((s) => s.direction === direction);

// Untagged products could suit either direction, so they are not ruled out.
export function matchesDirection(productStyles: string[], direction: DesignDirection) {
  return productStyles.length === 0 || productStyles.some((s) => getStyle(s)?.direction === direction);
}

export function getStyle(id: string) {
  return STYLES.find((s) => s.id === id);
}

// 1 for the design's own style, 0.5 for an adjacent style or an untagged product, 0.25 for
// another style of the same direction (modern or traditional), otherwise 0.
export function styleAffinity(designStyle: string, productStyles: string[]): number {
  if (productStyles.length === 0) return 0.5;
  if (productStyles.includes(designStyle)) return 1;
  const style = getStyle(designStyle);
  if (productStyles.some((s) => style?.adjacent.includes(s))) return 0.5;
  if (style && productStyles.some((s) => getStyle(s)?.direction === style.direction)) return 0.25;
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
    `Design it as ${getDirection(style.direction).phrase}. Interior style: ${style.phrase}. Materials and palette: ${style.palette}. Lighting: ${style.lighting}.`,
    `${furniture}. Use a new wall colour and flooring that suit the style.`,
    layoutRule,
    hint ? `Additional wishes from the user: ${hint}.` : "",
    `The result must look like a polished 3D render made by a professional interior visualizer, not a retouched phone photo. Avoid: ${NEGATIVE_PROMPT}.`,
  ]
    .filter(Boolean)
    .join(" ");
}
