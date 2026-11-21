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
  living_room: ["sofa", "coffee_table", "rug", "curtains", "floor_lamp", "tv_unit", "wall_art"],
  bedroom: ["bed", "side_table", "curtains", "rug", "table_lamp", "wardrobe", "mirror"],
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
