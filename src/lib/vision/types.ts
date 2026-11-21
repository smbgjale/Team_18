import type { Category, RoomType } from "../categories";

export interface DetectedItem {
  category: Category;
  label: string;
  confidence: number;
  bbox: { x: number; y: number; w: number; h: number };
  colorName?: string;
  colorHex?: string;
  styleTags?: string[];
}

export interface VisionProvider {
  readonly name: string;
  // `expected` lists the categories of the products that were asked for in the render.
  detectItems(input: { image: Buffer; roomType: RoomType; style: string; expected?: Category[] }): Promise<DetectedItem[]>;
}
