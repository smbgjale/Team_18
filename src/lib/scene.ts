import type { SceneDto } from "./api-types";
import { DEFAULT_DIMS_CM, type Category } from "./categories";
import { colorNameToHex } from "./color";
import { db } from "./db";
import { getRoom, listDesignProducts, roomDims, type DesignRow } from "./designs";
import { effectivePrice, toProductDto } from "./products";
import { getStyle } from "./styles";

export function productDims(p: { category: string; width_cm: number | null; depth_cm: number | null; height_cm: number | null }) {
  const [w, d, h] = DEFAULT_DIMS_CM[p.category as Category] ?? [50, 50, 50];
  return {
    dims: { w: (p.width_cm ?? w) / 100, d: (p.depth_cm ?? d) / 100, h: (p.height_cm ?? h) / 100 },
    fromShop: p.width_cm != null && p.depth_cm != null && p.height_cm != null,
  };
}

export function sceneFor(design: DesignRow): SceneDto | null {
  const room = getRoom(design.room_id);
  if (!room) return null;
  const style = getStyle(design.style);
  const dims = roomDims(room);
  const rows = listDesignProducts(design.id);
  const currencies = new Set(rows.map((r) => r.product.currency));
  const total = rows.reduce((s, r) => s + effectivePrice(r.product) * r.quantity, 0);
  return {
    design_id: design.id,
    style: design.style,
    room: {
      width_m: dims.width / 100,
      length_m: dims.length / 100,
      height_m: dims.height / 100,
      wall_hex: style?.wallHex ?? "#efebe4",
      floor_hex: style?.floorHex ?? "#b89a78",
    },
    items: rows.map((r) => {
      const { dims: d, fromShop } = productDims(r.product);
      const colors = JSON.parse(r.product.colors) as string[];
      return {
        id: r.id,
        category: r.category,
        quantity: r.quantity,
        dims_m: d,
        dims_from_shop: fromShop,
        color_hex: r.product.dominant_color_hex ?? colorNameToHex(colors[0] ?? "") ?? "#9a8f80",
        layout: r.layout_json ? JSON.parse(r.layout_json) : null,
        product: toProductDto(r.product),
      };
    }),
    total: rows.length && currencies.size === 1 ? { amount_minor: total, currency: rows[0].product.currency } : null,
  };
}

export function saveScene(design: DesignRow, input: { room?: { width_m: number; length_m: number }; items?: { id: string; layout: { x: number; z: number; rot: number }[] }[] }) {
  const tx = db().transaction(() => {
    if (input.room) {
      db().prepare("UPDATE rooms SET width_cm = ?, length_cm = ? WHERE id = ?").run(Math.round(input.room.width_m * 100), Math.round(input.room.length_m * 100), design.room_id);
    }
    const update = db().prepare("UPDATE design_products SET layout_json = ? WHERE id = ? AND design_id = ?");
    for (const it of input.items ?? []) update.run(JSON.stringify(it.layout), it.id, design.id);
  });
  tx();
}
