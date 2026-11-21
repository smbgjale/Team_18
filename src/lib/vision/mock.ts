import type { DetectedItem, VisionProvider } from "./types";

// The demo renderer composites exactly the requested products, so all of them are present.
export class MockVisionProvider implements VisionProvider {
  readonly name = "mock";
  async detectItems({ style, expected }: Parameters<VisionProvider["detectItems"]>[0]): Promise<DetectedItem[]> {
    return (expected ?? []).map((category) => ({
      category,
      label: category.replace(/_/g, " "),
      confidence: 1,
      bbox: { x: 0, y: 0, w: 1, h: 1 },
      styleTags: [style],
    }));
  }
}
