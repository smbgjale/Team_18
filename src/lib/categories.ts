export const CATEGORIES = [
  "sofa", "armchair", "bed", "coffee_table", "dining_table", "side_table", "desk", "chair",
  "wardrobe", "tv_unit", "shelf", "rug", "curtains", "ceiling_light", "floor_lamp", "table_lamp",
  "wall_art", "mirror", "plant_pot", "cushion",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  sofa: "Sofas", armchair: "Armchairs", bed: "Beds", coffee_table: "Coffee tables",
  dining_table: "Dining tables", side_table: "Side tables", desk: "Desks", chair: "Chairs",
  wardrobe: "Wardrobes", tv_unit: "TV units", shelf: "Shelves", rug: "Rugs", curtains: "Curtains",
  ceiling_light: "Ceiling lights", floor_lamp: "Floor lamps", table_lamp: "Table lamps",
  wall_art: "Wall art", mirror: "Mirrors", plant_pot: "Plant pots", cushion: "Cushions",
};

export function isCategory(v: string): v is Category {
  return (CATEGORIES as readonly string[]).includes(v);
}

// Categories that are acceptable substitutes when matching a detected item.
export const COMPATIBLE: Partial<Record<Category, Category[]>> = {
  armchair: ["chair"],
  chair: ["armchair"],
  coffee_table: ["side_table"],
  side_table: ["coffee_table"],
  ceiling_light: [],
  floor_lamp: ["table_lamp"],
};

export const ROOM_TYPES = ["living_room", "bedroom", "dining_room", "office", "kitchen", "other"] as const;
export type RoomType = (typeof ROOM_TYPES)[number];

export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  living_room: "Living room", bedroom: "Bedroom", dining_room: "Dining room",
  office: "Home office", kitchen: "Kitchen", other: "Other",
};

export const ROOM_ITEMS: Record<RoomType, Category[]> = {
  living_room: ["sofa", "coffee_table", "rug", "curtains", "floor_lamp", "tv_unit", "wall_art", "cushion", "plant_pot"],
  bedroom: ["bed", "side_table", "curtains", "rug", "table_lamp", "wardrobe", "mirror", "cushion", "plant_pot"],
  dining_room: ["dining_table", "chair", "ceiling_light", "rug", "curtains", "wall_art", "plant_pot"],
  office: ["desk", "chair", "shelf", "floor_lamp", "rug", "wall_art", "plant_pot"],
  kitchen: ["dining_table", "chair", "ceiling_light", "shelf", "plant_pot", "wall_art"],
  other: ["armchair", "side_table", "rug", "floor_lamp", "curtains", "wall_art", "plant_pot"],
};

// Share of an overall budget typically spent on each category (normalised per detected set).
export const BUDGET_WEIGHT: Record<Category, number> = {
  sofa: 0.35, armchair: 0.15, bed: 0.35, coffee_table: 0.1, dining_table: 0.25, side_table: 0.06,
  desk: 0.25, chair: 0.12, wardrobe: 0.25, tv_unit: 0.12, shelf: 0.08, rug: 0.1, curtains: 0.08,
  ceiling_light: 0.08, floor_lamp: 0.06, table_lamp: 0.04, wall_art: 0.04, mirror: 0.05,
  plant_pot: 0.02, cushion: 0.02,
};

// Fallback sizes (width x depth x height, cm) when a shop does not provide dimensions.
export const DEFAULT_DIMS_CM: Record<Category, [number, number, number]> = {
  sofa: [210, 92, 82], armchair: [80, 82, 86], bed: [165, 215, 100], coffee_table: [100, 55, 40],
  dining_table: [160, 90, 75], side_table: [45, 40, 55], desk: [140, 70, 75], chair: [46, 52, 85],
  wardrobe: [180, 60, 200], tv_unit: [160, 40, 50], shelf: [80, 30, 180], rug: [200, 290, 1],
  curtains: [140, 4, 240], ceiling_light: [45, 45, 40], floor_lamp: [40, 40, 160], table_lamp: [25, 25, 45],
  wall_art: [60, 3, 80], mirror: [60, 3, 120], plant_pot: [30, 30, 35], cushion: [45, 12, 45],
};

export const ROOM_DEFAULT_DIMS_CM: Record<RoomType, { width: number; length: number; height: number }> = {
  living_room: { width: 500, length: 420, height: 260 },
  bedroom: { width: 420, length: 400, height: 260 },
  dining_room: { width: 450, length: 380, height: 260 },
  office: { width: 380, length: 340, height: 260 },
  kitchen: { width: 400, length: 350, height: 260 },
  other: { width: 420, length: 380, height: 260 },
};

export function itemQuantity(category: Category, roomType: RoomType): number {
  if (category !== "chair") return 1;
  return roomType === "dining_room" ? 4 : roomType === "kitchen" ? 2 : 1;
}

export const WALL_MOUNTED: Category[] = ["curtains", "wall_art", "mirror", "ceiling_light"];
