import { activeRenderProvider } from "../config";
import { MockRenderProvider } from "./mock";
import { OpenAIRenderProvider } from "./openai";
import type { RenderProvider } from "./types";

export function getRenderProvider(): RenderProvider {
  return activeRenderProvider() === "openai" ? new OpenAIRenderProvider() : new MockRenderProvider();
}
export * from "./types";
