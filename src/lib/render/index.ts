import { activeRenderProvider } from "../config";
import { CloudflareRenderProvider } from "./cloudflare";
import { MockRenderProvider } from "./mock";
import { OpenAIRenderProvider } from "./openai";
import type { RenderProvider } from "./types";

export function getRenderProvider(): RenderProvider {
  switch (activeRenderProvider()) {
    case "openai":
      return new OpenAIRenderProvider();
    case "cloudflare":
      return new CloudflareRenderProvider();
    default:
      return new MockRenderProvider();
  }
}
export * from "./types";
