export interface Money { amount_minor: number; currency: string }

export interface ProductDto {
  id: string;
  name: string;
  description: string | null;
  category: string;
  image_url: string;
  price: Money;
  sale_price: Money | null;
  brand: string | null;
  colors: string[];
  materials: string[];
  style_tags: string[];
  dimensions_cm: { width: number | null; depth: number | null; height: number | null } | null;
  availability: "in_stock" | "low_stock" | "out_of_stock" | "preorder" | "unknown";
  shop: { slug: string; name: string; is_demo: boolean };
  dominant_color_hex: string | null;
  product_url: string;
}

export interface MatchDto {
  rank: number;
  score: number;
  score_breakdown: Record<string, number>;
  product: ProductDto;
}

// One furniture slot of a design: the real product it uses (`chosen`) and similar alternatives.
// Designs made before products were chosen up front only have detected items, so `chosen` is null.
export interface DesignProductDto {
  id: string;
  category: string;
  label: string;
  quantity: number;
  in_render: boolean | null;
  replaced_after_render: boolean;
  chosen: ProductDto | null;
  alternatives: MatchDto[];
}

export interface DesignProductsResponse {
  design_id: string;
  status: DesignDto["status"];
  mode: "products" | "detected";
  items: DesignProductDto[];
  budget_summary: { budget: Money | null; total: Money | null; within_budget: boolean | null };
  notice: string;
}

export interface ScenePlacement { x: number; z: number; rot: number }

export interface SceneItemDto {
  id: string;
  category: string;
  quantity: number;
  dims_m: { w: number; d: number; h: number };
  dims_from_shop: boolean;
  color_hex: string;
  layout: ScenePlacement[] | null;
  product: ProductDto;
}

export interface SceneDto {
  design_id: string;
  style: string;
  room: { width_m: number; length_m: number; height_m: number; wall_hex: string; floor_hex: string };
  items: SceneItemDto[];
  total: Money | null;
}

export interface DesignDto {
  id: string;
  room_id: string;
  style: string;
  status: "queued" | "rendering" | "render_ready" | "matching" | "completed" | "failed";
  is_demo_preview: boolean;
  original_image_url: string;
  render_image_url: string | null;
  width_px: number;
  height_px: number;
  layout_score: number | null;
  has_products: boolean;
  disclaimer: string;
  error: { code: string; message: string } | null;
  created_at: string;
}

export interface RoomDto {
  id: string;
  name: string | null;
  room_type: string;
  original_image_url: string;
  width_px: number;
  height_px: number;
  designs: DesignDto[];
}

export interface StyleDto { id: string; name: string; description: string; swatches: string[] }
export interface CategoryDto { id: string; name: string }
export interface ShopDto { slug: string; name: string; website_url: string; is_demo: boolean; product_count: number }
