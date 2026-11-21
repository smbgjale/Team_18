import { WALL_MOUNTED, type Category } from "./categories";

// Scene units are metres. The origin is the centre of the floor; +x is right, +z points towards
// the viewer, and the back wall is at z = -length/2. A model's front faces +z at rotation 0.
export interface Dims { w: number; d: number; h: number }
export interface Placement { x: number; z: number; rot: number }
export interface SceneRoom { width: number; length: number; height: number }
export interface SceneItemInput { id: string; category: Category; quantity: number; dims: Dims }

export const ATTACH_HOSTS: Partial<Record<Category, Category[]>> = {
  table_lamp: ["side_table", "desk", "tv_unit"],
  cushion: ["sofa", "armchair", "bed"],
};

const FIXED_TO_WALL: Category[] = ["curtains", "wall_art", "mirror"];

export function windowSpec(room: SceneRoom) {
  return { x: room.width / 4, width: Math.min(1.4, room.width / 3), bottom: 0.9, height: Math.min(1.3, room.height - 1.2) };
}

export function halfExtents(dims: Dims, rot: number) {
  const r = (rot * Math.PI) / 180;
  const c = Math.abs(Math.cos(r));
  const s = Math.abs(Math.sin(r));
  return { hx: (c * dims.w + s * dims.d) / 2, hz: (s * dims.w + c * dims.d) / 2 };
}

export function clampToRoom(p: Placement, dims: Dims, room: SceneRoom): Placement {
  const { hx, hz } = halfExtents(dims, p.rot);
  const clamp = (v: number, half: number, size: number) => (half * 2 >= size ? 0 : Math.max(-size / 2 + half, Math.min(size / 2 - half, v)));
  return { x: round(clamp(p.x, hx, room.width)), z: round(clamp(p.z, hz, room.length)), rot: normaliseRot(p.rot) };
}

export function fitsInRoom(dims: Dims, room: SceneRoom) {
  return Math.max(dims.w, dims.d) <= Math.max(room.width, room.length) && Math.min(dims.w, dims.d) <= Math.min(room.width, room.length);
}

export function hostOf(category: Category, present: Set<Category>): Category | null {
  return (ATTACH_HOSTS[category] ?? []).find((h) => present.has(h)) ?? null;
}

export function isDraggable(category: Category, present: Set<Category>) {
  return !FIXED_TO_WALL.includes(category) && !hostOf(category, present);
}

// Height of the bottom of the model above the floor.
export function baseHeight(category: Category, dims: Dims, room: SceneRoom, hostHeight: number | null): number {
  if (hostHeight != null) return category === "cushion" ? hostHeight * 0.5 : hostHeight;
  switch (category) {
    case "ceiling_light": return Math.max(1.9, room.height - dims.h - 0.5);
    case "wall_art": return Math.max(0.9, 1.55 - dims.h / 2);
    case "mirror": return dims.h >= 1 ? 0.35 : Math.max(0.9, 1.5 - dims.h / 2);
    case "curtains": return 0.02;
    default: return 0;
  }
}

const round = (n: number) => Math.round(n * 1000) / 1000;
export const normaliseRot = (r: number) => ((Math.round(r) % 360) + 540) % 360 - 180;

// Initial arrangement: the main piece against the back wall, the rest arranged around it.
export function defaultLayout(items: SceneItemInput[], room: SceneRoom): Record<string, Placement[]> {
  const W = room.width;
  const L = room.length;
  const out: Record<string, Placement[]> = {};
  const by = new Map(items.map((i) => [i.category, i]));
  const win = windowSpec(room);
  const back = (d: number) => -L / 2 + d / 2 + 0.05;
  const dims = (c: Category) => by.get(c)?.dims;
  const place = (c: Category, ps: Placement | Placement[]) => {
    const it = by.get(c);
    if (!it) return;
    out[it.id] = (Array.isArray(ps) ? ps : [ps]).map((p) => (WALL_MOUNTED.includes(c) && c !== "ceiling_light" ? { ...p, x: round(p.x), z: round(p.z) } : clampToRoom(p, it.dims, room)));
  };
  const at = (c: Category) => {
    const it = by.get(c);
    const p = it && out[it.id]?.[0];
    return p && it ? { ...p, dims: it.dims } : null;
  };

  if (dims("bed")) place("bed", { x: 0, z: back(dims("bed")!.d), rot: 0 });
  if (dims("sofa")) place("sofa", { x: 0, z: back(dims("sofa")!.d), rot: 0 });
  if (dims("desk")) place("desk", { x: win.x, z: back(dims("desk")!.d), rot: 0 });
  if (dims("dining_table")) place("dining_table", { x: 0, z: 0, rot: 0 });
  const sofa = at("sofa");
  if (dims("coffee_table")) {
    const d = dims("coffee_table")!;
    place("coffee_table", { x: sofa?.x ?? 0, z: sofa ? sofa.z + sofa.dims.d / 2 + 0.45 + d.d / 2 : 0, rot: 0 });
  }
  const coffee = at("coffee_table");
  if (dims("tv_unit")) place("tv_unit", { x: W / 2 - dims("tv_unit")!.d / 2 - 0.05, z: coffee?.z ?? 0, rot: -90 });
  if (dims("armchair")) {
    const d = dims("armchair")!;
    place("armchair", sofa ? { x: -W / 2 + d.d / 2 + 0.25, z: coffee?.z ?? 0, rot: 90 } : { x: -W / 4, z: -L / 6, rot: 30 });
  }
  const bed = at("bed");
  const desk = at("desk");
  const table = at("dining_table");
  const arm = at("armchair");

  if (dims("side_table")) {
    const d = dims("side_table")!;
    if (bed) place("side_table", { x: bed.x + bed.dims.w / 2 + d.w / 2 + 0.08, z: back(d.d), rot: 0 });
    else if (arm) place("side_table", { x: arm.x, z: arm.z - halfExtents(arm.dims, arm.rot).hz - d.d / 2 - 0.1, rot: 0 });
    else place("side_table", { x: W / 2 - 0.45, z: back(d.d), rot: 0 });
  }
  if (dims("floor_lamp")) {
    const d = dims("floor_lamp")!;
    if (sofa) place("floor_lamp", { x: sofa.x - sofa.dims.w / 2 - d.w / 2 - 0.12, z: back(d.d), rot: 0 });
    else if (desk) place("floor_lamp", { x: desk.x - desk.dims.w / 2 - d.w / 2 - 0.15, z: back(d.d), rot: 0 });
    else if (arm) place("floor_lamp", { x: arm.x, z: arm.z + halfExtents(arm.dims, arm.rot).hz + d.d / 2 + 0.1, rot: 0 });
    else place("floor_lamp", { x: -W / 2 + 0.35, z: back(d.d), rot: 0 });
  }
  if (dims("wardrobe")) place("wardrobe", { x: -W / 2 + dims("wardrobe")!.d / 2 + 0.05, z: L / 2 - dims("wardrobe")!.w / 2 - 0.4, rot: 90 });
  if (dims("shelf")) {
    const d = dims("shelf")!;
    place("shelf", desk || table ? { x: -W / 2 + d.d / 2 + 0.05, z: -L / 2 + d.w / 2 + 0.3, rot: 90 } : { x: W / 2 - d.d / 2 - 0.05, z: -L / 4, rot: -90 });
  }
  const chair = by.get("chair");
  if (chair) {
    const n = chair.quantity;
    const d = chair.dims;
    if (table) {
      const cols = Math.ceil(n / 2);
      place("chair", Array.from({ length: n }, (_, i) => {
        const side = i % 2 === 0 ? -1 : 1;
        const col = Math.floor(i / 2);
        return { x: table.x + (col - (cols - 1) / 2) * (table.dims.w / cols), z: table.z + side * (table.dims.d / 2 + d.d / 2 - 0.05), rot: side === -1 ? 0 : 180 };
      }));
    } else if (desk) {
      place("chair", { x: desk.x, z: desk.z + desk.dims.d / 2 + d.d / 2 - 0.1, rot: 180 });
    } else {
      place("chair", Array.from({ length: n }, (_, i) => ({ x: -W / 2 + d.d / 2 + 0.1, z: -L / 4 + i * (d.w + 0.1), rot: 90 })));
    }
  }
  if (dims("rug")) {
    const d = dims("rug")!;
    const rot = d.d > d.w ? 90 : 0;
    const anchor = coffee ?? (bed ? { x: bed.x, z: bed.z + bed.dims.d * 0.25 } : table ?? (desk ? { x: desk.x, z: desk.z + desk.dims.d / 2 + 0.4 } : { x: 0, z: 0 }));
    place("rug", { x: anchor.x, z: anchor.z, rot });
  }
  if (dims("plant_pot")) place("plant_pot", { x: W / 2 - 0.3, z: back(dims("plant_pot")!.d) + 0.05, rot: 0 });
  if (dims("ceiling_light")) place("ceiling_light", { x: table?.x ?? 0, z: table?.z ?? 0, rot: 0 });
  if (dims("wall_art")) place("wall_art", { x: -W / 4, z: -L / 2 + dims("wall_art")!.d / 2 + 0.01, rot: 0 });
  if (dims("mirror")) place("mirror", { x: W / 2 - dims("mirror")!.d / 2 - 0.01, z: L / 8, rot: -90 });
  if (dims("curtains")) place("curtains", { x: win.x, z: -L / 2 + 0.07, rot: 0 });

  const present = new Set(items.map((i) => i.category));
  for (const it of items) {
    if (out[it.id]) continue;
    const host = hostOf(it.category, present);
    const h = host ? at(host) : null;
    place(it.category, h ? { x: h.x, z: h.z, rot: h.rot } : { x: -W / 2 + 0.4, z: L / 2 - 0.4, rot: 0 });
  }
  return out;
}
