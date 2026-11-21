import type { Category, RoomType } from "../categories";
import type { StylePreset } from "../styles";

export interface RenderProduct {
  category: Category;
  name: string;
  imageUrl: string;
  // PNG reference image, present for the products the provider receives as reference images.
  reference?: Buffer;
}

export interface RenderRequest {
  sourceImage: Buffer;
  prompt: string;
  style: StylePreset;
  roomType: RoomType;
  fidelity: "high" | "medium" | "low";
  width: number;
  height: number;
  products: RenderProduct[];
}

export interface RenderResult {
  image: Buffer;
  mime: "image/png" | "image/jpeg";
  providerName: string;
  providerModel: string;
}

export interface RenderProvider {
  readonly name: string;
  // How many product photos can be sent alongside the room photo.
  readonly maxReferenceImages: number;
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
