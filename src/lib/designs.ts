import { db } from "./db";
import { config } from "./config";
import { fileUrl } from "./storage";
import { ROOM_DEFAULT_DIMS_CM, type Category, type RoomType } from "./categories";
import { getProduct, type ProductRow } from "./products";

export interface DesignRow {
  id: string;
  room_id: string;
  style: string;
  status: string;
  user_prompt: string | null;
  budget_total_minor: number | null;
  budget_currency: string | null;
  layout_fidelity: string;
  provider: string | null;
  prompt_used: string | null;
  render_image_key: string | null;
  structure_score: number | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface RoomRow {
  id: string;
  name: string | null;
  room_type: string;
  original_image_key: string;
  width_px: number;
  height_px: number;
  width_cm: number | null;
  length_cm: number | null;
  height_cm: number | null;
  created_at: string;
}

export interface DesignProductRow {
  id: string;
  design_id: string;
  product_id: string;
  category: Category;
  quantity: number;
  sort: number;
  in_render: number | null;
  replaced_after_render: number;
  layout_json: string | null;
}

export function roomDims(room: RoomRow) {
  const d = ROOM_DEFAULT_DIMS_CM[room.room_type as RoomType] ?? ROOM_DEFAULT_DIMS_CM.other;
  return { width: room.width_cm ?? d.width, length: room.length_cm ?? d.length, height: room.height_cm ?? d.height };
}

export function listDesignProducts(designId: string): (DesignProductRow & { product: ProductRow })[] {
  const rows = db().prepare("SELECT * FROM design_products WHERE design_id = ? ORDER BY sort, rowid").all(designId) as DesignProductRow[];
  return rows.flatMap((r) => {
    const product = getProduct(r.product_id, { includeInactive: true });
    return product ? [{ ...r, product }] : [];
  });
}

export interface ItemRow {
  id: string;
  design_id: string;
  category: Category;
  label: string;
  confidence: number;
  bbox: string;
  dominant_colors: string;
  style_tags: string;
}

export const ACTIVE_STATUSES = ["queued", "rendering", "render_ready", "matching"];

export function getRoom(id: string): RoomRow | undefined {
  return db().prepare("SELECT * FROM rooms WHERE id = ?").get(id) as RoomRow | undefined;
}

export function getDesign(id: string): DesignRow | undefined {
  const row = db().prepare("SELECT * FROM designs WHERE id = ?").get(id) as (DesignRow & { updated_at: string }) | undefined;
  if (!row) return undefined;
  if (ACTIVE_STATUSES.includes(row.status)) {
    const age = Date.now() - new Date(row.updated_at.replace(" ", "T") + "Z").getTime();
    if (age > config.stuckJobMs) {
      db().prepare("UPDATE designs SET status='failed', error_code='timeout', error_message='Generation took too long. Please try again.', updated_at=datetime('now') WHERE id = ?").run(id);
      return getDesign(id);
    }
  }
  return row;
}

export function listDesigns(roomId: string): DesignRow[] {
  const rows = db().prepare("SELECT id FROM designs WHERE room_id = ? ORDER BY created_at DESC, rowid DESC").all(roomId) as { id: string }[];
  return rows.map((r) => getDesign(r.id)!);
}

export function listItems(designId: string): ItemRow[] {
  return db().prepare("SELECT * FROM design_items WHERE design_id = ? ORDER BY rowid").all(designId) as ItemRow[];
}

export function setStatus(id: string, status: string, extra: Record<string, unknown> = {}) {
  const cols = Object.keys(extra);
  const sets = ["status = @status", "updated_at = datetime('now')", ...cols.map((c) => `${c} = @${c}`)];
  if (status === "completed") sets.push("completed_at = datetime('now')");
  db().prepare(`UPDATE designs SET ${sets.join(", ")} WHERE id = @id`).run({ id, status, ...extra });
}

export const DISCLAIMER =
  "AI-generated 3D-style image of your room furnished with the products listed below. The AI may change small details of a product; the product pages show exactly what you buy. Use the 3D view to arrange the products at their real sizes.";

export function designDto(d: DesignRow, room: RoomRow) {
  return {
    id: d.id,
    room_id: d.room_id,
    style: d.style,
    status: d.status,
    render_type: "3d_style_image" as const,
    provider: d.provider,
    is_demo_preview: d.provider === "mock",
    has_products: (db().prepare("SELECT COUNT(*) AS n FROM design_products WHERE design_id = ?").get(d.id) as { n: number }).n > 0,
    original_image_url: fileUrl(room.original_image_key),
    render_image_url: fileUrl(d.render_image_key),
    width_px: room.width_px,
    height_px: room.height_px,
    layout_score: d.structure_score,
    disclaimer: DISCLAIMER,
    error: d.error_code ? { code: d.error_code, message: d.error_message } : d.error_message ? { code: "warning", message: d.error_message } : null,
    created_at: d.created_at,
    completed_at: d.completed_at,
  };
}
