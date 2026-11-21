import { activeVisionProvider } from "../config";
import { MockVisionProvider } from "./mock";
import { OpenAIVisionProvider } from "./openai";
import type { VisionProvider } from "./types";

export function getVisionProvider(): VisionProvider {
  return activeVisionProvider() === "openai" ? new OpenAIVisionProvider() : new MockVisionProvider();
}
export * from "./types";
