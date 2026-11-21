import { activeVisionProvider } from "../config";
import { CloudflareVisionProvider } from "./cloudflare";
import { MockVisionProvider } from "./mock";
import { OpenAIVisionProvider } from "./openai";
import type { VisionProvider } from "./types";

export function getVisionProvider(): VisionProvider {
  switch (activeVisionProvider()) {
    case "openai":
      return new OpenAIVisionProvider();
    case "cloudflare":
      return new CloudflareVisionProvider();
    default:
      return new MockVisionProvider();
  }
}
export * from "./types";
