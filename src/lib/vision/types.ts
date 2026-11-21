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
  detectItems(input: { image: Buffer; roomType: RoomType; style: string }): Promise<DetectedItem[]>;
}
