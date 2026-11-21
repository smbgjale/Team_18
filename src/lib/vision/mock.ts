import sharp from "sharp";
import { mockLayout } from "../mock-layout";
import type { DetectedItem, VisionProvider } from "./types";

export class MockVisionProvider implements VisionProvider {
  readonly name = "mock";
  async detectItems({ image, roomType, style }: Parameters<VisionProvider["detectItems"]>[0]): Promise<DetectedItem[]> {
    const { width, height } = await sharp(image).metadata();
    return (await mockLayout(roomType, style, width!, height!)).map((it) => ({
      category: it.category,
      label: `${it.colorName} ${it.category.replace(/_/g, " ")}`,
      confidence: 0.9,
      bbox: it.bbox,
      colorName: it.colorName,
      colorHex: it.colorHex,
      styleTags: [style],
    }));
  }
}
