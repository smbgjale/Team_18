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
  product_url: string;
}

export interface MatchDto {
  rank: number;
  score: number;
  score_breakdown: Record<string, number>;
  product: ProductDto;
}

export interface DesignItemDto {
  id: string;
  category: string;
  label: string;
  confidence: number;
  bbox: { x: number; y: number; w: number; h: number };
  dominant_colors: { hex: string; name: string }[];
  matches: MatchDto[];
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
