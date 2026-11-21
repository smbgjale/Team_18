import type { RoomType } from "../categories";
import type { StylePreset } from "../styles";

export interface RenderRequest {
  sourceImage: Buffer;
  prompt: string;
  style: StylePreset;
  roomType: RoomType;
  fidelity: "high" | "medium" | "low";
  width: number;
  height: number;
}

export interface RenderResult {
  image: Buffer;
  mime: "image/png" | "image/jpeg";
  providerName: string;
  providerModel: string;
}

export interface RenderProvider {
  readonly name: string;
  render(req: RenderRequest): Promise<RenderResult>;
}

export class RenderError extends Error {
  constructor(
    public code: "provider_timeout" | "provider_policy_rejected" | "provider_unavailable" | "provider_bad_response" | "provider_quota_exceeded",
    message: string,
  ) {
    super(message);
  }
}
